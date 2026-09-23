# Implementation Plan: Benchmark de Modelos LLM

**Branch**: `001-llm-benchmark` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-llm-benchmark/spec.md`

## Summary

Adicionar uma nova página de benchmark (`/benchmark`, lazy-loaded, com nav própria) onde o
usuário configura uma bateria de testes — lista de modelos LLM, chunk size, tamanho máximo do
banco vetorial, arquivo PDF de entrada, modelo de embeddings, threshold de similaridade e uma
lista de perguntas com resposta esperada — e a executa sequencialmente, um modelo por vez,
reutilizando o `RagEngine`/`LlmClient`/`Embedder`/`PdfParser`/`VectorStore` já existentes no
fluxo de chat (com pequenas extensões: `setModel` corrigido, chunk size parametrizável, banco
vetorial isolado por nome de database). Uma nova `SimilarityService` (reaproveitando a fórmula de
cosseno já usada internamente pelo `VectorStore`) calcula o percentual de similaridade entre a
resposta gerada e a esperada, e deriva um veredito aprovado/reprovado contra o threshold
configurado. Os resultados (uma linha por par modelo/pergunta) são exibidos em uma tabela nativa
(sem novas dependências), com resumo por modelo, e podem ser exportados como CSV.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict mode), Angular 20.3

**Primary Dependencies**: `@mlc-ai/web-llm` (inferência LLM local), `@xenova/transformers` +
`onnxruntime-web` (embeddings locais), `pdfjs-dist` (parsing de PDF), RxJS — todas já presentes
em `package.json`; nenhuma nova dependência é adicionada (ver research.md #7 sobre a decisão de
não adicionar Angular Material)

**Storage**: IndexedDB via `VectorStore` (existente), estendido para aceitar um nome de database
opcional, permitindo uma base vetorial isolada para o benchmark sem afetar a base de chat do
usuário (ver research.md #5)

**Testing**: Karma + Jasmine (`ng test`), seguindo o padrão `TestBed.inject(...)` já usado nos
specs de serviço existentes; novos specs de componente seguem o padrão padrão do Angular CLI para
standalone components (não há exemplo prévio de spec de componente no repositório)

**Target Platform**: Navegador com suporte a WebGPU, mesmo alvo do restante da aplicação

**Project Type**: Aplicação web single-page em Angular (frontend-only, sem backend)

**Performance Goals**: Execução sequencial por modelo (um modelo carregado por vez); sem meta
rígida de latência além do aviso não bloqueante acima de 5 modelos ou 20 perguntas (FR-008a)

**Constraints**: Processamento 100% local (sem chamadas de rede para inferência, embeddings ou
armazenamento); change detection zoneless (`provideZonelessChangeDetection()`); não pode
regredir o comportamento existente do fluxo de chat

**Scale/Scope**: Uma página de benchmark, uma execução por vez, sem persistência entre sessões
do navegador (conforme Assumptions do spec.md)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Gate | Status | Notes |
|---|---|---|
| I. Angular 20 Standalone Architecture | PASS | Todos os novos componentes (`BenchmarkPageComponent`, `BenchmarkConfigComponent`, `BenchmarkResultsComponent`) são standalone; rota usa `loadComponent` (sem `NgModule`) |
| II. Convenção de Estrutura de Pastas | PASS | Nova feature em `src/app/benchmark/` (paralelo a `src/app/home/`), serviços de benchmark em `src/app/benchmark/services/` ou `src/app/services/` conforme escopo de reuso (ver Project Structure) |
| III. Reuso de Services e Interceptors HTTP | PASS | Reutiliza `RagEngine`, `LlmClient`, `Embedder`, `PdfParser`, `VectorStore` existentes, com extensões mínimas e justificadas em research.md (bug fix em `setModel`, parâmetro opcional de chunk size, parâmetro opcional de nome de database) em vez de forks/duplicações |
| IV. SCSS para Estilização | PASS | Todos os componentes visuais novos usam arquivos `.scss` próprios |
| V. Reactive Forms para Formulários | PASS | `BenchmarkConfigComponent` usa `FormGroup`/`FormArray`/`FormBuilder` |
| VI. Testes Unitários Obrigatórios | PASS (a cumprir na implementação) | Specs planejados para `SimilarityService`, `BenchmarkRunnerService`, `BenchmarkConfigComponent`, `BenchmarkResultsComponent` — ver tasks.md (gerado por `/speckit-tasks`) |
| VII. Lint e Estilo de Código Consistente | PASS | Nenhuma nova regra necessária; código novo segue ESLint/Prettier já configurados |
| Tech Stack Constraints | PASS | Nenhuma dependência nova adicionada; extensões são feitas nos serviços já padronizados (WebLLM, Transformers.js, IndexedDB, PDF.js) |
| Dev Workflow: nova dependência requer justificativa | PASS (N/A) | Nenhuma nova dependência proposta (tabela nativa em vez de Angular Material — ver research.md #7) |

Nenhuma violação identificada; seção "Complexity Tracking" abaixo permanece vazia.

## Project Structure

### Documentation (this feature)

```text
specs/001-llm-benchmark/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory is generated: this is a frontend-only Angular application with no
external API surface (no backend, no CLI, no public library exports) for this feature to expose.
The equivalent of a "contract" here — the shapes exchanged between the new benchmark components
and services — is captured in `data-model.md` instead.

### Source Code (repository root)

```text
src/app/
├── app.routes.ts                        # MODIFIED: add lazy `benchmark` route (loadComponent)
├── app.html / app.ts                    # MODIFIED: add minimal top-level nav (Chat / Benchmark)
│
├── home/                                # UNCHANGED: existing chat feature
│   └── ...
│
├── benchmark/                           # NEW: benchmark feature, mirrors `home/`'s pattern
│   ├── benchmark-page.component.ts      # NEW: standalone route target, composes config + results
│   ├── benchmark-page.component.html
│   ├── benchmark-page.component.scss
│   │
│   ├── benchmark-config/
│   │   ├── benchmark-config.component.ts    # NEW: Reactive Form for all benchmark attributes
│   │   ├── benchmark-config.component.html
│   │   └── benchmark-config.component.scss
│   │
│   ├── benchmark-results/
│   │   ├── benchmark-results.component.ts   # NEW: results table + per-model summary + CSV export
│   │   ├── benchmark-results.component.html
│   │   └── benchmark-results.component.scss
│   │
│   ├── models/
│   │   └── benchmark.models.ts          # NEW: BenchmarkConfig, TestQuestion, BenchmarkResultRow,
│   │                                     #      ModelPerformanceSummary types (see data-model.md)
│   │
│   └── services/
│       ├── benchmark-runner.service.ts  # NEW: orchestrates the sequential run, exposes progress
│       └── benchmark-export.service.ts  # NEW: builds and downloads the CSV file
│
└── services/                            # EXISTING, reused with small, additive changes
    ├── rag-engine.ts                    # UNCHANGED (reused as-is by benchmark-runner)
    ├── llm-client.ts                    # MODIFIED: fix `setModel`; add `unloadModel()`;
    │                                    #   `availableModels` sourced from a shared model list
    ├── embedder.ts                      # UNCHANGED (reused as-is)
    ├── pdf-parser.ts                    # MODIFIED: `parseFile(file, chunkSize = 500)`
    ├── vector-store.ts                  # MODIFIED: `initialize(dbName = 'takere-db')`;
    │                                    #   `cosineSimilarity` extracted to `similarity.ts`
    └── similarity.ts                    # NEW: shared `SimilarityService` (cosine similarity +
                                          #   percent score + pass/fail verdict against threshold)
```

**Structure Decision**: Single Angular project (this repo has no separate backend). The new
feature lives entirely under `src/app/benchmark/`, mirroring the existing `src/app/home/`
convention (Principle II), and reuses `src/app/services/*` with additive, backward-compatible
changes only (Principle III) — no new top-level directories, no new dependencies.

## Complexity Tracking

*No constitution violations identified — this section is intentionally empty.*

## Post-Design Constitution Re-Check

Re-evaluated after Phase 1 (data-model.md, quickstart.md) using the concrete design: still no
violations. The Reactive Forms structure (`BenchmarkConfig` FormGroup with a `TestQuestion`
FormArray), the reused-service extensions (additive optional parameters, no breaking changes to
`RagEngine`/`LlmClient`/`PdfParser`/`VectorStore` call sites), and the native-HTML results table
all match the gates confirmed pre-design. No new dependencies were introduced during design.
