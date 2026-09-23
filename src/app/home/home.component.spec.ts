import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Subject } from 'rxjs';

import { HomeComponent } from './home.component';
import { RagEngine } from '../services/rag-engine';
import { LlmClient } from '../services/llm-client';

describe('HomeComponent', () => {
  let fixture: any;
  let component: HomeComponent;
  let isLocked$: Subject<boolean>;

  beforeEach(() => {
    isLocked$ = new Subject<boolean>();

    const ragEngineSpy = jasmine.createSpyObj('RagEngine', ['initialize', 'ingest', 'query'], {
      llm: jasmine.createSpyObj('LlmClient', ['setModel', 'initialize']),
      embedder: jasmine.createSpyObj('Embedder', ['initialize']),
      vectorStore: jasmine.createSpyObj('VectorStore', ['initialize']),
      parser: {},
    });

    const llmClientSpy = jasmine.createSpyObj('LlmClient', [], { isLocked$: isLocked$.asObservable() });

    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: RagEngine, useValue: ragEngineSpy },
        { provide: LlmClient, useValue: llmClientSpy },
      ],
    });

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  it('disables chat and shows the notice when isLocked$ emits true', async () => {
    fixture.detectChanges();
    // Let the component's own async init chain (real timers) settle first,
    // so it doesn't race with the isLocked$ assertions below.
    await new Promise((resolve) => setTimeout(resolve, 600));
    fixture.detectChanges();

    isLocked$.next(true);
    fixture.detectChanges();

    expect(component.benchmarkLocked).toBeTrue();

    const notice = fixture.nativeElement.querySelector('.benchmark-lock-notice');
    expect(notice).toBeTruthy();

    const input = fixture.nativeElement.querySelector('.chat-input');
    if (input) {
      expect(input.disabled).toBeTrue();
    }
  });

  it('re-enables chat and hides the notice when isLocked$ emits false', async () => {
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 600));
    fixture.detectChanges();

    isLocked$.next(true);
    isLocked$.next(false);
    fixture.detectChanges();

    expect(component.benchmarkLocked).toBeFalse();
    const notice = fixture.nativeElement.querySelector('.benchmark-lock-notice');
    expect(notice).toBeFalsy();
  });
});
