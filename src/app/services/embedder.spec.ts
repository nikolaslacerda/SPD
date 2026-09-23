import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { Embedder } from './embedder';

describe('Embedder', () => {
  let service: Embedder;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    service = TestBed.inject(Embedder);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
