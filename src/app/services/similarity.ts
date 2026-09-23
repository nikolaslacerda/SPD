import { Injectable } from '@angular/core';
import { Embedder } from './embedder';

@Injectable({
  providedIn: 'root',
})
export class SimilarityService {
  constructor(private embedder: Embedder) {}

  cosineSimilarity(a: number[], b: number[]): number {
    const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dot / (magA * magB);
  }

  async scorePercent(actual: string, expected: string): Promise<number> {
    const [actualEmbedding, expectedEmbedding] = await Promise.all([
      this.embedder.embed(actual),
      this.embedder.embed(expected),
    ]);
    const cosine = this.cosineSimilarity(actualEmbedding, expectedEmbedding);
    const clamped = Math.max(-1, Math.min(1, cosine));
    return ((clamped + 1) / 2) * 100;
  }

  verdict(scorePercent: number, thresholdPercent: number): 'pass' | 'fail' {
    return scorePercent >= thresholdPercent ? 'pass' : 'fail';
  }
}
