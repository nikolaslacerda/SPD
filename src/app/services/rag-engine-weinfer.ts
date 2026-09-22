import { Injectable } from '@angular/core';
import { LlmClientWeInfer } from './llm-client-weinfer';
import { Embedder } from './embedder';
import { VectorStore } from './vector-store';
import { PdfParser } from './pdf-parser';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class RagEngineWeInfer {
  constructor(
    public llm: LlmClientWeInfer,
    public embedder: Embedder,
    public vectorStore: VectorStore,
    public parser: PdfParser
  ) {}
  
  get progress(): Observable<string> {
    return this.llm.progress;
  }
  
  async initialize(): Promise<void> {
    console.log('🚀 [WeInfer] Initializing RAG Engine with WeInfer...');
    
    // Initialize in sequence to show progress better
    console.log('1/3: [WeInfer] Initializing LLM with WeInfer optimizations...');
    await this.llm.initialize();
    
    console.log('2/3: [WeInfer] Initializing embedder (shared)...');
    await this.embedder.initialize();
    
    console.log('3/3: [WeInfer] Initializing vector store (shared)...');
    await this.vectorStore.initialize();
    
    console.log('✅ [WeInfer] RAG Engine ready with WeInfer optimizations!');
  }
  
  async ingest(file: File): Promise<void> {
    // 1. Parse PDF (shared parser)
    const parsedChunks = await this.parser.parseFile(file);
    
    // 2. Embed + store with metadata (shared embedder & vector store)
    for (const parsedChunk of parsedChunks) {
      const embedding = await this.embedder.embed(parsedChunk.text);
      await this.vectorStore.addChunk({
        id: `${file.name}-${parsedChunk.chunkIndex}`,
        text: parsedChunk.text,
        embedding,
        metadata: { 
          filename: file.name, 
          chunkIndex: parsedChunk.chunkIndex,
          pageNumber: parsedChunk.pageNumber
        }
      });
    }
  }
  
  async query(
    question: string, 
    onToken?: (partialAnswer: string) => void,
    conversationHistory: Array<{question: string; answer: string}> = [],
    useHybridSearch = false,
    enableSourceCitations = false
  ): Promise<string> {
    const ragStartTime = performance.now();
    console.log('🔍 [WeInfer] RAG Query started:', question);
    
    // Check vector store status
    const totalChunks = await this.vectorStore.getChunkCount();
    console.log(`📊 [WeInfer] Vector store contains ${totalChunks} chunks`);
    
    if (totalChunks === 0) {
      console.warn('⚠️ [WeInfer] Vector store is empty! Please upload a PDF document first.');
      return 'Please upload a PDF document first before asking questions.';
    }
    
    // 1. Embed question (shared embedder)
    console.log('1️⃣ [WeInfer] Embedding question...');
    const embedStart = performance.now();
    const queryEmbedding = await this.embedder.embed(question);
    const embedTime = ((performance.now() - embedStart) / 1000).toFixed(2);
    console.log(`✅ [WeInfer] Question embedded in ${embedTime}s, vector length:`, queryEmbedding.length);
    
    // 2. Search similar chunks (shared vector store)
    console.log('2️⃣ [WeInfer] Searching vector store...');
    const searchStart = performance.now();
    const searchResults = await this.vectorStore.search(queryEmbedding, 3, useHybridSearch, question);
    const searchTime = ((performance.now() - searchStart) / 1000).toFixed(2);
    console.log(`✅ [WeInfer] Found ${searchResults.length} relevant chunks in ${searchTime}s`);
    console.log('📄 Chunks:', searchResults.map((r, i) => 
      `[${i}] Page ${r.chunk.metadata?.['pageNumber'] || '?'} (score: ${r.score.toFixed(3)}): ${r.chunk.text.substring(0, 50)}...`
    ));
    
    // 3. Build context with or without citations
    console.log(`3️⃣ [WeInfer] Building context ${enableSourceCitations ? 'with' : 'without'} source citations...`);
    let context: string;
    
    if (enableSourceCitations) {
      // Include page numbers in context
      const contextParts = searchResults.map((result, i) => {
        const pageNum = result.chunk.metadata?.['pageNumber'] || 'unknown';
        return `[Source ${i + 1} - Page ${pageNum}]\n${result.chunk.text}`;
      });
      context = contextParts.join('\n\n');
    } else {
      // Plain context without citations
      context = searchResults.map(r => r.chunk.text).join('\n\n');
    }
    
    console.log('✅ [WeInfer] Context length:', context.length, 'chars');
    
    // 4. Generate answer with WeInfer optimizations
    console.log('4️⃣ [WeInfer] Generating answer with WeInfer LLM (buffer reuse + async pipeline)...');
    const llmStart = performance.now();
    
    // Build conversation context if history exists
    let conversationContext = '';
    if (conversationHistory.length > 0) {
      conversationContext = '\n\nPrevious conversation:\n';
      conversationHistory.forEach((exchange, i) => {
        conversationContext += `Q${i + 1}: ${exchange.question}\nA${i + 1}: ${exchange.answer}\n\n`;
      });
      console.log(`💭 [WeInfer] Including ${conversationHistory.length} previous exchanges in context`);
    }
    
    // Build prompt with or without citation instruction
    const citationInstruction = enableSourceCitations 
      ? ' Always cite your sources by mentioning the page number when referencing information.' 
      : '';
    
    const answerInstruction = enableSourceCitations
      ? ' (remember to cite page numbers when referencing information)'
      : '';
    
    const prompt = `You are a helpful assistant. Answer the question based on the provided context.${citationInstruction}${conversationContext}

Context:
${context}

Question: ${question}

Answer${answerInstruction}:`;
    const answer = await this.llm.generate(prompt, onToken);
    const llmTime = ((performance.now() - llmStart) / 1000).toFixed(2);
    
    const totalTime = ((performance.now() - ragStartTime) / 1000).toFixed(2);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RAG Pipeline Performance (WeInfer):');
    console.log(`   • Embedding: ${embedTime}s`);
    console.log(`   • Vector search: ${searchTime}s`);
    console.log(`   • LLM generation (WeInfer): ${llmTime}s`);
    console.log(`   • Total RAG time: ${totalTime}s`);
    console.log(`   • Engine: WeInfer (buffer reuse + async pipeline)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    return answer;
  }
}
