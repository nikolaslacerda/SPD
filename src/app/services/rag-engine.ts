import { Injectable } from '@angular/core';
import { LlmClient } from './llm-client';
import { Embedder } from './embedder';
import { VectorStore } from './vector-store';
import { PdfParser } from './pdf-parser';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class RagEngine {
  constructor(
    public llm: LlmClient,
    public embedder: Embedder,
    public vectorStore: VectorStore,
    public parser: PdfParser
  ) {}
  
  get progress(): Observable<string> {
    return this.llm.progress;
  }
  
  async initialize(): Promise<void> {
    console.log('🚀 Initializing RAG Engine...');
    
    // Initialize in sequence to show progress better
    console.log('1/3: Initializing LLM...');
    await this.llm.initialize();
    
    console.log('2/3: Initializing embedder...');
    await this.embedder.initialize();
    
    console.log('3/3: Initializing vector store...');
    await this.vectorStore.initialize();
    
    console.log('✅ RAG Engine ready!');
  }
  
  async ingest(file: File): Promise<void> {
    // 1. Parse PDF
    const parsedChunks = await this.parser.parseFile(file);
    
    // 2. Embed + store with metadata
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
    console.log('🔍 RAG Query started:', question);
    
    // Check vector store status
    const totalChunks = await this.vectorStore.getChunkCount();
    console.log(`📊 Vector store contains ${totalChunks} chunks`);
    
    if (totalChunks === 0) {
      console.warn('⚠️ Vector store is empty! Please upload a PDF document first.');
      return 'Please upload a PDF document first before asking questions.';
    }
    
    // 1. Embed question
    console.log('1️⃣ Embedding question...');
    const embedStart = performance.now();
    const queryEmbedding = await this.embedder.embed(question);
    const embedTime = ((performance.now() - embedStart) / 1000).toFixed(2);
    console.log(`✅ Question embedded in ${embedTime}s, vector length:`, queryEmbedding.length);
    
    // 2. Search similar chunks
    console.log('2️⃣ Searching vector store...');
    const searchStart = performance.now();

    const searchResults = await this.vectorStore.search(
      queryEmbedding,
      3,
      useHybridSearch,
      question
    );

    const searchTime = ((performance.now() - searchStart) / 1000).toFixed(2);

    console.log(`✅ Found ${searchResults.length} relevant chunks in ${searchTime}s`);

    console.log('📄 Chunks:', searchResults.map((r, i) => 
      `[${i}] Page ${r.chunk.metadata?.['pageNumber'] || '?'} (score: ${r.score.toFixed(3)}): ${r.chunk.text.substring(0, 50)}...`
    ));

    // Guardrail
    const QUERY_THRESHOLD = 0.1;

    const bestScore = searchResults.length > 0
      ? Math.max(...searchResults.map(r => r.score))
      : 0;

    console.log(`🛡️ Query similarity: ${bestScore.toFixed(3)}`);

    if (bestScore < QUERY_THRESHOLD) {
      console.log('❌ Query rejected by guardrail');
      return 'Não encontrei informações suficientes no plano de cuidado para responder a essa pergunta.';
    }

    console.log('✅ Query accepted by guardrail');
    
    // 3. Build context with or without citations
    console.log(`3️⃣ Building context ${enableSourceCitations ? 'with' : 'without'} source citations...`);
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
    
    console.log('✅ Context length:', context.length, 'chars');
    
    // 4. Generate answer
    console.log('4️⃣ Generating answer with LLM...');
    const llmStart = performance.now();
    
    // Build conversation context if history exists
    let conversationContext = '';
    if (conversationHistory.length > 0) {
      conversationContext = '\n\nPrevious conversation:\n';
      conversationHistory.forEach((exchange, i) => {
        conversationContext += `Q${i + 1}: ${exchange.question}\nA${i + 1}: ${exchange.answer}\n\n`;
      });
      console.log(`💭 Including ${conversationHistory.length} previous exchanges in context`);
    }
    
    // Build prompt with or without citation instruction
    const citationInstruction = enableSourceCitations 
      ? ' Always cite your sources by mentioning the page number when referencing information.' 
      : '';
    
    const answerInstruction = enableSourceCitations
      ? ' (remember to cite page numbers when referencing information)'
      : '';
    
    const prompt = `Você é um assistente médico que tira dúvidas sobre o plano de cuidado de pacientes transplantados. Responda conforme o plano de cuidado do paciente. Seja o mais breve possível. ${citationInstruction}${conversationContext}

    Context:
    ${context}

    Question: ${question}

    Answer${answerInstruction}:`;

    const answer = await this.llm.generate(prompt, onToken);
    const llmTime = ((performance.now() - llmStart) / 1000).toFixed(2);

    // 5. Guardrail da resposta
    console.log('🛡️ Validating generated answer...');

    const answerEmbedding = await this.embedder.embed(answer);

    const answerResults = await this.vectorStore.search(
      answerEmbedding,
      3,
      useHybridSearch,
      answer
    );

    const ANSWER_THRESHOLD = 0.55;

    const bestAnswerScore = answerResults.length > 0
      ? Math.max(...answerResults.map(r => r.score))
      : 0;

    console.log(`🛡️ Answer similarity: ${bestAnswerScore.toFixed(3)}`);

    if (bestAnswerScore < ANSWER_THRESHOLD) {
      console.log('❌ Answer rejected by guardrail');

      return 'Não foi possível validar a resposta com base no plano de cuidado.';
    }

    console.log('✅ Answer accepted by guardrail');

    const totalTime = ((performance.now() - ragStartTime) / 1000).toFixed(2);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RAG Pipeline Performance:');
    console.log(`   • Embedding: ${embedTime}s`);
    console.log(`   • Vector search: ${searchTime}s`);
    console.log(`   • LLM generation: ${llmTime}s`);
    console.log(`   • Answer guardrail: ${bestAnswerScore.toFixed(3)}`);
    console.log(`   • Total RAG time: ${totalTime}s`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return answer;
  }
}
