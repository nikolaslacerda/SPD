import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { RagEngine } from '../../services/rag-engine';
import { SimilarityService } from '../../services/similarity';
import {
  BenchmarkConfig,
  BenchmarkResultRow,
  BenchmarkRunState,
  INITIAL_BENCHMARK_RUN_STATE,
  ModelPerformanceSummary,
} from '../models/benchmark.models';

// RagEngine.query() has no dedicated "blocked" signal — on guardrail rejection it simply
// returns one of these two fixed Portuguese messages as the "answer" (see rag-engine.ts).
// Detecting a block means comparing against these exact strings, since RagEngine's public
// contract is intentionally left unchanged by this feature (plan.md/research.md).
const QUERY_GUARDRAIL_MESSAGE =
  'Não encontrei informações suficientes no plano de cuidado para responder a essa pergunta.';
const ANSWER_GUARDRAIL_MESSAGE = 'Não foi possível validar a resposta com base no plano de cuidado.';

export function summarizeByModel(results: BenchmarkResultRow[]): ModelPerformanceSummary[] {
  const modelIds = Array.from(new Set(results.map((r) => r.modelId)));

  return modelIds.map((modelId) => {
    const rows = results.filter((r) => r.modelId === modelId);
    const completed = rows.filter((r) => r.status === 'completed');
    const blockedCount = rows.filter((r) => r.status === 'blocked').length;
    const failedCount = rows.filter((r) => r.status === 'failed').length;

    const averageSimilarityPercent =
      completed.length > 0
        ? completed.reduce((sum, r) => sum + (r.similarityPercent ?? 0), 0) / completed.length
        : null;

    const passRatePercent =
      rows.length > 0
        ? (completed.filter((r) => r.verdict === 'pass').length / rows.length) * 100
        : null;

    const averageResponseTimeMs =
      completed.length > 0
        ? completed.reduce((sum, r) => sum + (r.responseTimeMs ?? 0), 0) / completed.length
        : null;

    return {
      modelId,
      averageSimilarityPercent,
      passRatePercent,
      averageResponseTimeMs,
      blockedCount,
      failedCount,
    };
  });
}

@Injectable()
export class BenchmarkRunnerService {
  private state$ = new BehaviorSubject<BenchmarkRunState>(INITIAL_BENCHMARK_RUN_STATE);
  private locked = false;

  constructor(private ragEngine: RagEngine, private similarity: SimilarityService) {}

  get runState$(): Observable<BenchmarkRunState> {
    return this.state$.asObservable();
  }

  private patchState(patch: Partial<BenchmarkRunState>): void {
    this.state$.next({ ...this.state$.value, ...patch });
  }

  async run(config: BenchmarkConfig): Promise<void> {
    if (this.locked) {
      throw new Error('A benchmark run is already in progress.');
    }

    const originalModelId = this.ragEngine.llm.getCurrentModel();
    this.locked = true;
    this.ragEngine.llm.lock();

    try {
      this.state$.next({
        ...INITIAL_BENCHMARK_RUN_STATE,
        phase: 'ingesting',
        totalCount: config.selectedModelIds.length * config.questions.length,
      });

      await this.ingest(config);

      this.patchState({ phase: 'running' });

      const results: BenchmarkResultRow[] = [];

      for (const modelId of config.selectedModelIds) {
        try {
          await this.ragEngine.llm.unloadModel();
          this.ragEngine.llm.setModel(modelId);
          await this.ragEngine.llm.initialize();

          for (const question of config.questions) {
            this.patchState({ currentModelId: modelId, currentQuestionId: question.id });

            const row = await this.runOneQuestion(modelId, question, config.similarityThresholdPercent);
            results.push(row);

            this.patchState({
              results: [...results],
              summaries: summarizeByModel(results),
              completedCount: results.length,
            });
          }
        } catch (modelError) {
          for (const question of config.questions) {
            if (results.some((r) => r.modelId === modelId && r.questionId === question.id)) {
              continue;
            }
            results.push({
              modelId,
              questionId: question.id,
              status: 'failed',
              generatedAnswer: null,
              similarityPercent: null,
              verdict: null,
              responseTimeMs: null,
              errorMessage: (modelError as Error)?.message ?? 'Falha ao carregar o modelo.',
            });
          }
          this.patchState({
            results: [...results],
            summaries: summarizeByModel(results),
            completedCount: results.length,
          });
        }
      }

      this.patchState({ phase: 'completed', currentModelId: null, currentQuestionId: null });
    } catch (error) {
      this.patchState({
        phase: 'error',
        errorMessage: (error as Error)?.message ?? 'Falha ao executar o benchmark.',
      });
    } finally {
      try {
        await this.ragEngine.llm.unloadModel();
        this.ragEngine.llm.setModel(originalModelId);
        await this.ragEngine.llm.initialize();
      } finally {
        this.ragEngine.llm.unlock();
        this.locked = false;
      }
    }
  }

  private async ingest(config: BenchmarkConfig): Promise<void> {
    await this.ragEngine.vectorStore.initialize();
    await this.ragEngine.vectorStore.clear();

    const chunks = await this.ragEngine.parser.parseFile(config.inputFile as File, config.chunkSize);
    const cappedChunks = chunks.slice(0, config.maxVectorStoreChunks);

    for (const chunk of cappedChunks) {
      const embedding = await this.ragEngine.embedder.embed(chunk.text);
      await this.ragEngine.vectorStore.addChunk({
        id: `benchmark-${chunk.chunkIndex}`,
        text: chunk.text,
        embedding,
        metadata: { chunkIndex: chunk.chunkIndex, pageNumber: chunk.pageNumber },
      } as any);
    }
  }

  private async runOneQuestion(
    modelId: string,
    question: { id: string; question: string; expectedAnswer: string },
    thresholdPercent: number
  ): Promise<BenchmarkResultRow> {
    const startTime = performance.now();

    try {
      const answer = await this.ragEngine.query(question.question);
      const responseTimeMs = performance.now() - startTime;

      if (answer === QUERY_GUARDRAIL_MESSAGE || answer === ANSWER_GUARDRAIL_MESSAGE) {
        return {
          modelId,
          questionId: question.id,
          status: 'blocked',
          generatedAnswer: null,
          similarityPercent: null,
          verdict: null,
          responseTimeMs,
          errorMessage: answer,
        };
      }

      const similarityPercent = await this.similarity.scorePercent(answer, question.expectedAnswer);
      const verdict = this.similarity.verdict(similarityPercent, thresholdPercent);

      return {
        modelId,
        questionId: question.id,
        status: 'completed',
        generatedAnswer: answer,
        similarityPercent,
        verdict,
        responseTimeMs,
        errorMessage: null,
      };
    } catch (error) {
      return {
        modelId,
        questionId: question.id,
        status: 'failed',
        generatedAnswer: null,
        similarityPercent: null,
        verdict: null,
        responseTimeMs: null,
        errorMessage: (error as Error)?.message ?? 'Falha ao gerar resposta.',
      };
    }
  }
}
