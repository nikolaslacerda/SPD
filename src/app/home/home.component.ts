import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RagEngine } from '../services/rag-engine';
import { VERSION } from '../version';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Array<{ page: number }>;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  @ViewChild('chatContainer') chatContainer?: ElementRef;

  // Fixed Configuration
  private readonly MODEL_NAME = 'Llama-3.2-3B-Instruct-q4f16_1-MLC';
  private readonly ENABLE_HYBRID_SEARCH = true;
  private readonly ENABLE_CONVERSATIONAL_MEMORY = true;
  private readonly ENABLE_SOURCE_CITATIONS = false;

  loading = true;
  uploading = false;
  querying = false;
  question = '';
  answer = '';
  initProgress = '';
  showBrowserError = false;
  browserErrorDetails = '';
  isModelLoaded = false;

  loadingProgress = 0;
  currentStep = 0;
  uploadProgress = 0;
  uploadStatus = '';
  uploadFileName = '';
  loadedDocumentName = '';

  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

  conversationHistory: Array<{ question: string; answer: string }> = [];
  chatMessages: ChatMessage[] = [];

  showSetupSection = true;
  shouldStopGeneration = false;

  readonly appVersion = VERSION;

  constructor(
    private rag: RagEngine,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    const capabilities = this.checkBrowserCapabilities();

    if (!capabilities.supported) {
      this.showBrowserError = true;
      this.browserErrorDetails = capabilities.message;
      this.loading = false;
      return;
    }

    console.log('✅', capabilities.message);

    // 🔒 Fix model
    this.rag.llm.setModel(this.MODEL_NAME);

    await this.initializeRag();
  }

  private checkBrowserCapabilities(): { supported: boolean; message: string } {
    const hasWebGPU = 'gpu' in navigator;
    const hasWasm = typeof WebAssembly !== 'undefined';

    if (hasWebGPU) {
      return { supported: true, message: 'WebGPU detected - GPU acceleration enabled' };
    } else if (hasWasm) {
      return { supported: true, message: 'WebGPU not found - CPU mode enabled (slower)' };
    } else {
      return {
        supported: false,
        message: 'Browser not supported - WebGPU and WebAssembly unavailable'
      };
    }
  }

  private async initializeRag() {
    try {
      this.loading = true;
      this.loadingProgress = 5;
      this.currentStep = 1;
      this.initProgress = 'Initializing LLM...';
      this.cdr.detectChanges();

      await this.rag.llm.initialize();
      this.loadingProgress = 70;

      this.currentStep = 2;
      this.initProgress = 'Initializing embedder...';
      this.cdr.detectChanges();

      await this.rag.embedder.initialize();
      this.loadingProgress = 90;

      this.currentStep = 3;
      this.initProgress = 'Initializing vector store...';
      this.cdr.detectChanges();

      await this.rag.vectorStore.initialize();
      this.loadingProgress = 100;

      this.currentStep = 4;
      this.initProgress = '✅ All systems ready!';
      await new Promise(resolve => setTimeout(resolve, 500));

      this.loading = false;
      this.isModelLoaded = true;
      this.cdr.detectChanges();

      console.log('✅ RAG fully initialized');
    } catch (error) {
      console.error('❌ Initialization error:', error);
      this.showBrowserError = true;
      this.browserErrorDetails = (error as Error).message;
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async onFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    this.uploading = true;
    this.uploadFileName = file.name;
    this.uploadProgress = 0;
    this.uploadStatus = 'Parsing PDF...';
    this.cdr.detectChanges();

    try {
      await this.rag.vectorStore.clear();

      const chunks = await this.rag.parser.parseFile(file);

      for (const [index, chunk] of chunks.entries()) {
        this.uploadProgress = Math.floor((index / chunks.length) * 100);
        this.cdr.detectChanges();

        const embedding = await this.rag.embedder.embed(chunk.text);

        await this.rag.vectorStore.addChunk({
          id: `${file.name}-${index}`,
          text: chunk.text,
          embedding,
          metadata: {
            filename: file.name,
            pageNumber: chunk.pageNumber
          }
        });
      }

      this.uploadProgress = 100;
      this.loadedDocumentName = file.name;
      this.showToastNotification('Documento carregado!', 'success');
    } catch (error) {
      console.error(error);
      this.showToastNotification('Deu merda na carregação do documento.', 'error');
    } finally {
      await new Promise(resolve => setTimeout(resolve, 500));
      this.uploading = false;
      input.value = '';
      this.cdr.detectChanges();
    }
  }

  async onQuery() {
    if (!this.question.trim()) return;

    this.querying = true;
    this.shouldStopGeneration = false;
    this.answer = '';

    const currentQuestion = this.question;

    this.chatMessages.push({
      role: 'user',
      content: currentQuestion,
      timestamp: new Date()
    });

    this.question = '';

    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date()
    };

    this.chatMessages.push(assistantMessage);
    const assistantIndex = this.chatMessages.length - 1;

    this.cdr.detectChanges();
    this.scrollToBottom();

    try {
      const result = await this.rag.query(
        currentQuestion,
        (partialAnswer: string) => {
          if (this.shouldStopGeneration) {
            throw new Error('STOPPED_BY_USER');
          }

          this.answer = partialAnswer;
          this.chatMessages[assistantIndex].content = partialAnswer;
          this.cdr.detectChanges();
          this.scrollToBottom();
        },
        this.ENABLE_CONVERSATIONAL_MEMORY ? this.conversationHistory : [],
        this.ENABLE_HYBRID_SEARCH,
        this.ENABLE_SOURCE_CITATIONS
      );

      // Caso o RAG tenha bloqueado a pergunta
      // e retornado a mensagem padrão
      if (result) {
        this.answer = result;
        this.chatMessages[assistantIndex].content = result;
        this.cdr.detectChanges();
        this.scrollToBottom();
      }

      if (this.ENABLE_CONVERSATIONAL_MEMORY && this.answer) {
        this.conversationHistory.push({
          question: currentQuestion,
          answer: this.answer
        });
      }

    } catch (error: any) {
      if (error.message === 'STOPPED_BY_USER') {
        if (!this.chatMessages[assistantIndex].content) {
          this.chatMessages[assistantIndex].content = '⏹️ Generation stopped.';
        }
      } else {
        this.chatMessages[assistantIndex].content = '❌ Error querying document.';
      }
    } finally {
      this.querying = false;
      this.shouldStopGeneration = false;
      this.cdr.detectChanges();
    }
  }

  stopGeneration() {
    this.shouldStopGeneration = true;
  }

  scrollToBottom() {
    setTimeout(() => {
      if (this.chatContainer) {
        const element = this.chatContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    }, 100);
  }

  toggleSetup() {
    this.showSetupSection = !this.showSetupSection;
  }

  clearConversation() {
    this.conversationHistory = [];
    this.chatMessages = [];
    this.question = '';
    this.answer = '';
    this.showToastNotification('Conversation cleared', 'success');
  }

  showToastNotification(message: string, type: 'success' | 'error') {
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    this.cdr.detectChanges();

    setTimeout(() => {
      this.showToast = false;
      this.cdr.detectChanges();
    }, 4000);
  }

  getPageNumbers(sources?: Array<{ page: number }>): string {
    if (!sources || sources.length === 0) return '';
    return sources.map(s => s.page).join(', ');
  }

  getBrowserInfo(): string {
    return navigator.userAgent;
  }
}
