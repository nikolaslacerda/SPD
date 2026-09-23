import { Injectable } from '@angular/core';
import { BenchmarkConfig, BenchmarkResultRow, ModelPerformanceSummary } from '../models/benchmark.models';

function csvEscape(value: string | number | null): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

@Injectable({
  providedIn: 'root',
})
export class BenchmarkExportService {
  buildCsv(
    results: BenchmarkResultRow[],
    summaries: ModelPerformanceSummary[],
    config: BenchmarkConfig
  ): string {
    const questionTextById = new Map(config.questions.map((q) => [q.id, q.question]));
    const lines: string[] = [];

    lines.push('Modelo,Pergunta,Status,Resposta Gerada,Similaridade (%),Veredito,Tempo (ms)');
    for (const row of results) {
      lines.push(
        [
          csvEscape(row.modelId),
          csvEscape(questionTextById.get(row.questionId) ?? row.questionId),
          csvEscape(row.status),
          csvEscape(row.generatedAnswer),
          csvEscape(row.similarityPercent),
          csvEscape(row.verdict),
          csvEscape(row.responseTimeMs),
        ].join(',')
      );
    }

    lines.push('');
    lines.push('Resumo por Modelo');
    lines.push('Modelo,Similaridade Média (%),Taxa de Aprovação (%),Tempo Médio (ms),Bloqueados,Falhas');
    for (const summary of summaries) {
      lines.push(
        [
          csvEscape(summary.modelId),
          csvEscape(summary.averageSimilarityPercent),
          csvEscape(summary.passRatePercent),
          csvEscape(summary.averageResponseTimeMs),
          csvEscape(summary.blockedCount),
          csvEscape(summary.failedCount),
        ].join(',')
      );
    }

    return lines.join('\n');
  }

  exportToCsv(
    results: BenchmarkResultRow[],
    summaries: ModelPerformanceSummary[],
    config: BenchmarkConfig
  ): void {
    const csv = this.buildCsv(results, summaries, config);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `benchmark-resultados-${Date.now()}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }
}
