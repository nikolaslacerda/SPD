import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { LlmClient } from './llm-client';

describe('LlmClient', () => {
  let service: LlmClient;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    service = TestBed.inject(LlmClient);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('setModel', () => {
    it('updates the model actually used by a subsequent initialize() call', () => {
      const initialModel = service.getCurrentModel();
      const otherModel = service.availableModels.find((m) => m.id !== initialModel)!.id;

      service.setModel(otherModel);

      expect(service.getCurrentModel()).toBe(otherModel);
      expect(service.getCurrentModel()).not.toBe(initialModel);
    });
  });

  describe('lock/unlock/isLocked$', () => {
    it('emits false initially, true after lock(), and false again after unlock()', () => {
      const emissions: boolean[] = [];
      const subscription = service.isLocked$.subscribe((value) => emissions.push(value));

      service.lock();
      service.unlock();

      subscription.unsubscribe();
      expect(emissions).toEqual([false, true, false]);
    });
  });
});
