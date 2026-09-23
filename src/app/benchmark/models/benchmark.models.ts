export interface BenchmarkModelOption {
  id: string;
  displayName: string;
}

export interface TestQuestion {
  id: string;
  question: string;
  expectedAnswer: string;
}

export interface BenchmarkConfig {
  selectedModelIds: string[];
  chunkSize: number;
  maxVectorStoreChunks: number;
  inputFile: File | null;
  embeddingModel: string;
  similarityThresholdPercent: number;
  questions: TestQuestion[];
}

export type BenchmarkResultStatus = 'completed' | 'blocked' | 'failed';
export type BenchmarkVerdict = 'pass' | 'fail';

export interface BenchmarkResultRow {
  modelId: string;
  questionId: string;
  status: BenchmarkResultStatus;
  generatedAnswer: string | null;
  similarityPercent: number | null;
  verdict: BenchmarkVerdict | null;
  responseTimeMs: number | null;
  errorMessage: string | null;
}

export interface ModelPerformanceSummary {
  modelId: string;
  averageSimilarityPercent: number | null;
  passRatePercent: number | null;
  averageResponseTimeMs: number | null;
  blockedCount: number;
  failedCount: number;
}

export type BenchmarkRunPhase = 'idle' | 'ingesting' | 'running' | 'completed' | 'error';

export interface BenchmarkRunState {
  phase: BenchmarkRunPhase;
  currentModelId: string | null;
  currentQuestionId: string | null;
  completedCount: number;
  totalCount: number;
  results: BenchmarkResultRow[];
  summaries: ModelPerformanceSummary[];
  errorMessage: string | null;
}

export const INITIAL_BENCHMARK_RUN_STATE: BenchmarkRunState = {
  phase: 'idle',
  currentModelId: null,
  currentQuestionId: null,
  completedCount: 0,
  totalCount: 0,
  results: [],
  summaries: [],
  errorMessage: null
};
