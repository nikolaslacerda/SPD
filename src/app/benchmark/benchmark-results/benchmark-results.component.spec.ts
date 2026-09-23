import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { BenchmarkResultsComponent } from './benchmark-results.component';
import { BenchmarkConfig, BenchmarkRunState } from '../models/benchmark.models';

const fakeConfig: BenchmarkConfig = {
  selectedModelIds: ['model-a'],
  chunkSize: 500,
  maxVectorStoreChunks: 100,
  inputFile: null,
  embeddingModel: 'Xenova/all-MiniLM-L6-v2',
  similarityThresholdPercent: 70,
  questions: [
    { id: 'q1', question: 'Question 1', expectedAnswer: 'Answer 1' },
    { id: 'q2', question: 'Question 2', expectedAnswer: 'Answer 2' },
    { id: 'q3', question: 'Question 3', expectedAnswer: 'Answer 3' },
  ],
};

describe('BenchmarkResultsComponent', () => {
  function buildRunState(): BenchmarkRunState {
    return {
      phase: 'completed',
      currentModelId: null,
      currentQuestionId: null,
      completedCount: 3,
      totalCount: 3,
      results: [
        {
          modelId: 'model-a',
          questionId: 'q1',
          status: 'completed',
          generatedAnswer: 'answer 1',
          similarityPercent: 90,
          verdict: 'pass',
          responseTimeMs: 120,
          errorMessage: null,
        },
        {
          modelId: 'model-a',
          questionId: 'q2',
          status: 'blocked',
          generatedAnswer: null,
          similarityPercent: null,
          verdict: null,
          responseTimeMs: 40,
          errorMessage: 'blocked message',
        },
        {
          modelId: 'model-a',
          questionId: 'q3',
          status: 'failed',
          generatedAnswer: null,
          similarityPercent: null,
          verdict: null,
          responseTimeMs: null,
          errorMessage: 'failed message',
        },
      ],
      summaries: [
        {
          modelId: 'model-a',
          averageSimilarityPercent: 90,
          passRatePercent: 33.33,
          averageResponseTimeMs: 120,
          blockedCount: 1,
          failedCount: 1,
        },
      ],
      errorMessage: null,
    };
  }

  function createFixture(runState: BenchmarkRunState) {
    TestBed.configureTestingModule({
      imports: [BenchmarkResultsComponent],
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(BenchmarkResultsComponent);
    fixture.componentInstance.runState = runState;
    fixture.componentInstance.config = fakeConfig;
    fixture.detectChanges();
    return fixture;
  }

  it('should be created', () => {
    const fixture = createFixture(buildRunState());
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders one row per result', () => {
    const fixture = createFixture(buildRunState());
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="result-row"]');
    expect(rows.length).toBe(3);
  });

  it('visually distinguishes blocked and failed rows', () => {
    const fixture = createFixture(buildRunState());
    const rows = fixture.nativeElement.querySelectorAll('.result-row');
    expect(rows[1].classList.contains('blocked')).toBeTrue();
    expect(rows[2].classList.contains('failed')).toBeTrue();
    expect(rows[0].classList.contains('blocked')).toBeFalse();
    expect(rows[0].classList.contains('failed')).toBeFalse();
  });

  it('renders summary values matching the input fixtures', () => {
    const fixture = createFixture(buildRunState());
    const summaryText = fixture.nativeElement.querySelector('.summary-table').textContent;
    expect(summaryText).toContain('model-a');
    expect(summaryText).toContain('90');
  });
});
