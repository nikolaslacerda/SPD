import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { SimilarityService } from './similarity';
import { Embedder } from './embedder';

describe('SimilarityService', () => {
  let service: SimilarityService;
  let embedderSpy: jasmine.SpyObj<Embedder>;

  beforeEach(() => {
    embedderSpy = jasmine.createSpyObj('Embedder', ['embed']);
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), { provide: Embedder, useValue: embedderSpy }]
    });
    service = TestBed.inject(SimilarityService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('cosineSimilarity', () => {
    it('returns 1 for identical vectors', () => {
      expect(service.cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1, 5);
    });

    it('returns 0 for orthogonal vectors', () => {
      expect(service.cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
    });

    it('returns -1 for opposite vectors', () => {
      expect(service.cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 5);
    });
  });

  describe('scorePercent', () => {
    it('maps identical embeddings to a percentage near 100', async () => {
      embedderSpy.embed.and.callFake((text: string) =>
        Promise.resolve(text === 'same' ? [1, 0, 0] : [1, 0, 0])
      );
      const score = await service.scorePercent('same', 'same');
      expect(score).toBeCloseTo(100, 5);
    });

    it('maps unrelated embeddings to a lower percentage', async () => {
      embedderSpy.embed.and.callFake((text: string) =>
        Promise.resolve(text === 'actual' ? [1, 0] : [0, 1])
      );
      const score = await service.scorePercent('actual', 'expected');
      expect(score).toBeCloseTo(50, 5);
      expect(score).toBeLessThan(100);
    });
  });

  describe('verdict', () => {
    it('returns pass when the score meets or exceeds the threshold', () => {
      expect(service.verdict(70, 70)).toBe('pass');
      expect(service.verdict(80, 70)).toBe('pass');
    });

    it('returns fail when the score is below the threshold', () => {
      expect(service.verdict(69.9, 70)).toBe('fail');
    });
  });
});
