import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { BenchmarkRunnerService, summarizeByModel } from './benchmark-runner.service';
import { RagEngine } from '../../services/rag-engine';
import { SimilarityService } from '../../services/similarity';
import { BenchmarkConfig, BenchmarkResultRow } from '../models/benchmark.models';

const QUERY_GUARDRAIL_MESSAGE =
  'Não encontrei informações suficientes no plano de cuidado para responder a essa pergunta.';

describe('BenchmarkRunnerService', () => {
  let service: BenchmarkRunnerService;
  let llmSpy: jasmine.SpyObj<any>;
  let vectorStoreSpy: jasmine.SpyObj<any>;
  let ragEngineSpy: jasmine.SpyObj<RagEngine>;
  let similaritySpy: jasmine.SpyObj<SimilarityService>;

  function buildConfig(overrides: Partial<BenchmarkConfig> = {}): BenchmarkConfig {
    return {
      selectedModelIds: ['model-a', 'model-b'],
      chunkSize: 500,
      maxVectorStoreChunks: 100,
      inputFile: new File(['x'], 'doc.pdf', { type: 'application/pdf' }),
      embeddingModel: 'Xenova/all-MiniLM-L6-v2',
      similarityThresholdPercent: 70,
      questions: [
        { id: 'q1', question: 'What is X?', expectedAnswer: 'X is Y' },
        { id: 'q2', question: 'Unrelated?', expectedAnswer: 'Z' },
      ],
      ...overrides,
    };
  }

  beforeEach(() => {
    llmSpy = jasmine.createSpyObj('LlmClient', [
      'getCurrentModel',
      'setModel',
      'unloadModel',
      'initialize',
      'lock',
      'unlock',
    ]);
    llmSpy.getCurrentModel.and.returnValue('original-model');
    llmSpy.unloadModel.and.returnValue(Promise.resolve());
    llmSpy.initialize.and.returnValue(Promise.resolve());

    vectorStoreSpy = jasmine.createSpyObj('VectorStore', ['initialize', 'clear', 'addChunk']);
    vectorStoreSpy.initialize.and.returnValue(Promise.resolve());
    vectorStoreSpy.clear.and.returnValue(Promise.resolve());
    vectorStoreSpy.addChunk.and.returnValue(Promise.resolve());

    const embedderSpy = jasmine.createSpyObj('Embedder', ['embed']);
    embedderSpy.embed.and.returnValue(Promise.resolve([1, 0, 0]));

    const parserSpy = jasmine.createSpyObj('PdfParser', ['parseFile']);
    parserSpy.parseFile.and.returnValue(
      Promise.resolve([{ text: 'chunk', pageNumber: 1, chunkIndex: 0 }])
    );

    ragEngineSpy = jasmine.createSpyObj<RagEngine>('RagEngine', ['query']);
    (ragEngineSpy as any).llm = llmSpy;
    (ragEngineSpy as any).vectorStore = vectorStoreSpy;
    (ragEngineSpy as any).embedder = embedderSpy;
    (ragEngineSpy as any).parser = parserSpy;

    similaritySpy = jasmine.createSpyObj('SimilarityService', ['scorePercent', 'verdict']);
    similaritySpy.scorePercent.and.returnValue(Promise.resolve(85));
    similaritySpy.verdict.and.returnValue('pass');

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        BenchmarkRunnerService,
        { provide: RagEngine, useValue: ragEngineSpy },
        { provide: SimilarityService, useValue: similaritySpy },
      ],
    });
    service = TestBed.inject(BenchmarkRunnerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('produces one row per model x question pair', async () => {
    ragEngineSpy.query.and.returnValue(Promise.resolve('Generated answer'));

    await service.run(buildConfig());

    let finalState: any;
    service.runState$.subscribe((s) => (finalState = s));

    expect(finalState.results.length).toBe(4); // 2 models x 2 questions
    expect(finalState.phase).toBe('completed');
  });

  it('marks a guardrail rejection as blocked', async () => {
    ragEngineSpy.query.and.returnValue(Promise.resolve(QUERY_GUARDRAIL_MESSAGE));

    await service.run(buildConfig({ selectedModelIds: ['model-a'], questions: [{ id: 'q1', question: 'q', expectedAnswer: 'a' }] }));

    let finalState: any;
    service.runState$.subscribe((s) => (finalState = s));

    expect(finalState.results[0].status).toBe('blocked');
    expect(finalState.results[0].similarityPercent).toBeNull();
  });

  it('isolates a failed model without stopping the others', async () => {
    llmSpy.setModel.and.callFake((modelId: string) => {
      if (modelId === 'model-a') {
        throw new Error('failed to load model-a');
      }
    });
    ragEngineSpy.query.and.returnValue(Promise.resolve('Generated answer'));

    await service.run(buildConfig());

    let finalState: any;
    service.runState$.subscribe((s) => (finalState = s));

    const modelARows = finalState.results.filter((r: BenchmarkResultRow) => r.modelId === 'model-a');
    const modelBRows = finalState.results.filter((r: BenchmarkResultRow) => r.modelId === 'model-b');

    expect(modelARows.every((r: BenchmarkResultRow) => r.status === 'failed')).toBeTrue();
    expect(modelBRows.every((r: BenchmarkResultRow) => r.status === 'completed')).toBeTrue();
  });

  it('locks before the loop and unlocks exactly once after it settles', async () => {
    ragEngineSpy.query.and.returnValue(Promise.resolve('Generated answer'));

    await service.run(buildConfig());

    expect(llmSpy.lock).toHaveBeenCalledTimes(1);
    expect(llmSpy.unlock).toHaveBeenCalledTimes(1);
  });

  it('restores the original model after the run settles', async () => {
    ragEngineSpy.query.and.returnValue(Promise.resolve('Generated answer'));

    await service.run(buildConfig());

    const calls = llmSpy.setModel.calls.allArgs().map((args: any[]) => args[0]);
    expect(calls[calls.length - 1]).toBe('original-model');
  });

  it('ingests via the injected VectorStore instance, never a takere-db-named store directly', async () => {
    ragEngineSpy.query.and.returnValue(Promise.resolve('Generated answer'));

    await service.run(buildConfig());

    expect(vectorStoreSpy.initialize).toHaveBeenCalled();
    expect(vectorStoreSpy.addChunk).toHaveBeenCalled();
  });
});

describe('summarizeByModel', () => {
  it('computes correct averages, pass rate, and counts for a mixed set of rows', () => {
    const rows: BenchmarkResultRow[] = [
      {
        modelId: 'm1',
        questionId: 'q1',
        status: 'completed',
        generatedAnswer: 'a',
        similarityPercent: 80,
        verdict: 'pass',
        responseTimeMs: 100,
        errorMessage: null,
      },
      {
        modelId: 'm1',
        questionId: 'q2',
        status: 'completed',
        generatedAnswer: 'b',
        similarityPercent: 60,
        verdict: 'fail',
        responseTimeMs: 200,
        errorMessage: null,
      },
      {
        modelId: 'm1',
        questionId: 'q3',
        status: 'blocked',
        generatedAnswer: null,
        similarityPercent: null,
        verdict: null,
        responseTimeMs: 50,
        errorMessage: 'blocked',
      },
      {
        modelId: 'm1',
        questionId: 'q4',
        status: 'failed',
        generatedAnswer: null,
        similarityPercent: null,
        verdict: null,
        responseTimeMs: null,
        errorMessage: 'error',
      },
    ];

    const [summary] = summarizeByModel(rows);

    expect(summary.modelId).toBe('m1');
    expect(summary.averageSimilarityPercent).toBeCloseTo(70, 5);
    expect(summary.passRatePercent).toBeCloseTo(25, 5); // 1 pass out of 4 total rows
    expect(summary.averageResponseTimeMs).toBeCloseTo(150, 5);
    expect(summary.blockedCount).toBe(1);
    expect(summary.failedCount).toBe(1);
  });
});
