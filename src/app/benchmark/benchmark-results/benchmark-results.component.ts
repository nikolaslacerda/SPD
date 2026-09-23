import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BenchmarkConfig, BenchmarkRunState } from '../models/benchmark.models';
import { BenchmarkExportService } from '../services/benchmark-export.service';

@Component({
  selector: 'app-benchmark-results',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './benchmark-results.component.html',
  styleUrl: './benchmark-results.component.scss',
})
export class BenchmarkResultsComponent {
  @Input({ required: true }) runState!: BenchmarkRunState;
  @Input({ required: true }) config!: BenchmarkConfig;

  constructor(private exportService: BenchmarkExportService) {}

  get canExport(): boolean {
    return this.runState?.phase === 'completed';
  }

  onExport(): void {
    this.exportService.exportToCsv(this.runState.results, this.runState.summaries, this.config);
  }
}
