import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { RagEngine } from './rag-engine';

describe('RagEngine', () => {
  let service: RagEngine;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    service = TestBed.inject(RagEngine);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
