import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { BenchmarkExportService } from './benchmark-export.service';
import { BenchmarkConfig, BenchmarkResultRow, ModelPerformanceSummary } from '../models/benchmark.models';

describe('BenchmarkExportService', () => {
  let service: BenchmarkExportService;

  const config: BenchmarkConfig = {
    selectedModelIds: ['model-a'],
    chunkSize: 500,
    maxVectorStoreChunks: 100,
    inputFile: null,
    embeddingModel: 'Xenova/all-MiniLM-L6-v2',
    similarityThresholdPercent: 70,
    questions: [{ id: 'q1', question: 'What is X?', expectedAnswer: 'X is Y' }],
  };

  const results: BenchmarkResultRow[] = [
    {
      modelId: 'model-a',
      questionId: 'q1',
      status: 'completed',
      generatedAnswer: 'X is Y',
      similarityPercent: 95,
      verdict: 'pass',
      responseTimeMs: 123,
      errorMessage: null,
    },
  ];

  const summaries: ModelPerformanceSummary[] = [
    {
      modelId: 'model-a',
      averageSimilarityPercent: 95,
      passRatePercent: 100,
      averageResponseTimeMs: 123,
      blockedCount: 0,
      failedCount: 0,
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    service = TestBed.inject(BenchmarkExportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('generates CSV text with one line per result row and one line per model summary', () => {
    const csv = service.buildCsv(results, summaries, config);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('Modelo,Pergunta,Status,Resposta Gerada,Similaridade (%),Veredito,Tempo (ms)');
    expect(lines[1]).toContain('model-a');
    expect(lines[1]).toContain('What is X?');
    expect(lines[1]).toContain('95');
    expect(lines[1]).toContain('pass');

    const summaryHeaderIndex = lines.indexOf(
      'Modelo,Similaridade Média (%),Taxa de Aprovação (%),Tempo Médio (ms),Bloqueados,Falhas'
    );
    expect(summaryHeaderIndex).toBeGreaterThan(-1);
    expect(lines[summaryHeaderIndex + 1]).toContain('model-a');
    expect(lines[summaryHeaderIndex + 1]).toContain('100');
  });
});
