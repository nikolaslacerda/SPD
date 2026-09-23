import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RagEngine } from '../services/rag-engine';
import { VectorStore } from '../services/vector-store';
import { BenchmarkConfigComponent } from './benchmark-config/benchmark-config.component';
import { BenchmarkResultsComponent } from './benchmark-results/benchmark-results.component';
import { BenchmarkRunnerService } from './services/benchmark-runner.service';
import { VECTOR_STORE_DB_NAME } from './models/vector-store-db-name.token';
import { BenchmarkConfig, BenchmarkRunState, INITIAL_BENCHMARK_RUN_STATE } from './models/benchmark.models';

@Component({
  selector: 'app-benchmark-page',
  standalone: true,
  imports: [CommonModule, BenchmarkConfigComponent, BenchmarkResultsComponent],
  templateUrl: './benchmark-page.component.html',
  styleUrl: './benchmark-page.component.scss',
  // Component-scoped DI subtree (research.md #11): VectorStore/RagEngine/BenchmarkRunnerService
  // resolved here are NEW instances, isolated from the root singletons used by the chat page.
  // LlmClient/Embedder are intentionally left unprovided so they still resolve to the root
  // singletons (research.md #12) — the benchmark reuses the same LlmClient the chat uses,
  // guarded instead by the lock/unlock/isLocked$ contract.
  providers: [
    VectorStore,
    RagEngine,
    BenchmarkRunnerService,
    { provide: VECTOR_STORE_DB_NAME, useValue: 'takere-benchmark-db' },
  ],
})
export class BenchmarkPageComponent {
  runState: BenchmarkRunState = INITIAL_BENCHMARK_RUN_STATE;
  lastConfig: BenchmarkConfig | null = null;

  constructor(private runner: BenchmarkRunnerService, private cdr: ChangeDetectorRef) {
    this.runner.runState$.subscribe((state) => {
      this.runState = state;
      this.cdr.detectChanges();
    });
  }

  onRunRequested(config: BenchmarkConfig): void {
    this.lastConfig = config;
    this.runner.run(config);
  }
}
