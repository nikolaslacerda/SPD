# Implementation Plan: Benchmark de Modelos LLM

**Branch**: `001-llm-benchmark` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-llm-benchmark/spec.md`

## Summary

Adicionar uma nova página de benchmark (`/benchmark`, lazy-loaded, com nav própria) onde o
usuário configura uma bateria de testes — lista de modelos LLM, chunk size, tamanho máximo do
banco vetorial, arquivo PDF de entrada, modelo de embeddings (exibido, não selecionável — ver
research.md #13), threshold de similaridade e uma lista de perguntas com resposta esperada — e a
executa sequencialmente, um modelo por vez, reutilizando o `RagEngine`/`LlmClient`/`Embedder`/
`PdfParser`/`VectorStore` já existentes no fluxo de chat (com pequenas extensões: `setModel`
corrigido, chunk size parametrizável, banco vetorial isolado por nome de database). Como
`VectorStore`/`RagEngine` são singletons `providedIn: 'root'`, o módulo de benchmark instancia
sua própria árvore isolada via providers no nível do componente + um `InjectionToken` para o
`dbName` (research.md #11); como `LlmClient` permanece singleton estrito por restrição de
memória/VRAM, o benchmark aplica um padrão snapshot → lock → restore ao redor da troca de modelos
para não corromper o modelo ativo do chat — o lock vive no próprio `LlmClient` (`lock()`/
`unlock()`/`isLocked$`), e o `HomeComponent` do chat observa `isLocked$` para desabilitar o envio
de mensagens enquanto um benchmark está em execução (research.md #12). Uma nova `SimilarityService`
(reaproveitando a fórmula de cosseno já usada internamente pelo `VectorStore`) calcula o
percentual de similaridade entre a resposta gerada e a esperada, e deriva um veredito
aprovado/reprovado contra o threshold configurado. Os resultados (uma linha por par
modelo/pergunta) são exibidos em uma tabela nativa (sem novas dependências), com resumo por
modelo, e podem ser exportados como CSV.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict mode), Angular 20.3

**Primary Dependencies**: `@mlc-ai/web-llm` (inferência LLM local), `@xenova/transformers` +
`onnxruntime-web` (embeddings locais), `pdfjs-dist` (parsing de PDF), RxJS — todas já presentes
em `package.json`; nenhuma nova dependência é adicionada (ver research.md #7 sobre a decisão de
não adicionar Angular Material)

**Storage**: IndexedDB via `VectorStore` (existente), estendido para aceitar um nome de database
opcional, permitindo uma base vetorial isolada para o benchmark sem afetar a base de chat do
usuário (research.md #5). Como `VectorStore`/`RagEngine` são singletons de aplicação, o
isolamento real é obtido instanciando uma árvore própria desses serviços via providers no nível
do componente de benchmark + um `InjectionToken` para o `dbName` (research.md #11), em vez de
reconfigurar o singleton compartilhado com o chat.

**Testing**: Karma + Jasmine (`ng test`), seguindo o padrão `TestBed.inject(...)` já usado nos
specs de serviço existentes; novos specs de componente seguem o padrão padrão do Angular CLI para
standalone components (não há exemplo prévio de spec de componente no repositório)

**Target Platform**: Navegador com suporte a WebGPU, mesmo alvo do restante da aplicação

**Project Type**: Aplicação web single-page em Angular (frontend-only, sem backend)

**Performance Goals**: Execução sequencial por modelo (um modelo carregado por vez); sem meta
rígida de latência além do aviso não bloqueante acima de 5 modelos ou 20 perguntas (FR-008a)

**Constraints**: Processamento 100% local (sem chamadas de rede para inferência, embeddings ou
armazenamento); change detection zoneless (`provideZonelessChangeDetection()`); não pode
regredir o comportamento existente do fluxo de chat — em particular, `LlmClient` DEVE ter seu
modelo original restaurado (snapshot → lock → restore, research.md #12) ao final ou ao abandonar
uma execução de benchmark, já que é um singleton compartilhado com o chat; além disso, o
`HomeComponent` DEVE desabilitar sua própria UI de envio enquanto `LlmClient.isLocked$` for
`true`, para que o chat nunca chame `generate()`/`setModel()` concorrentemente com uma execução
de benchmark em andamento

**Scale/Scope**: Uma página de benchmark, uma execução por vez, sem persistência entre sessões
do navegador (conforme Assumptions do spec.md)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Gate | Status | Notes |
|---|---|---|
| I. Angular 20 Standalone Architecture | PASS | Todos os novos componentes (`BenchmarkPageComponent`, `BenchmarkConfigComponent`, `BenchmarkResultsComponent`) são standalone; rota usa `loadComponent` (sem `NgModule`) |
| II. Convenção de Estrutura de Pastas | PASS | Nova feature em `src/app/benchmark/` (paralelo a `src/app/home/`), serviços de benchmark em `src/app/benchmark/services/` ou `src/app/services/` conforme escopo de reuso (ver Project Structure) |
| III. Reuso de Services e Interceptors HTTP | PASS | Reutiliza `RagEngine`, `LlmClient`, `Embedder`, `PdfParser`, `VectorStore` existentes, com extensões mínimas e justificadas em research.md (bug fix em `setModel`, `lock()`/`unlock()`/`isLocked$` em `LlmClient`, parâmetro opcional de chunk size, parâmetro opcional de nome de database via `InjectionToken`, instanciação de `RagEngine`/`VectorStore` via providers no componente de benchmark) em vez de forks/duplicações; `HomeComponent` (chat) é ajustado para observar `isLocked$`, não substituído; nenhum novo serviço paralelo é criado, apenas extensões aditivas e uma configuração de escopo de DI diferente para a mesma classe |
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
├── home/                                # MODIFIED: HomeComponent now observes
│   │                                    #   LlmClient.isLocked$ and disables the message
│   │                                    #   input/send action while a benchmark run is in
│   │                                    #   progress (research.md #12) — otherwise unchanged
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
│   │   ├── benchmark.models.ts          # NEW: BenchmarkConfig, TestQuestion, BenchmarkResultRow,
│   │   │                                #      ModelPerformanceSummary types (see data-model.md)
│   │   └── vector-store-db-name.token.ts # NEW: InjectionToken<string> for VectorStore's dbName,
│   │                                     #      provided per-component (research.md #11)
│   │
│   └── services/
│       ├── benchmark-runner.service.ts  # NEW: orchestrates the sequential run (snapshot/lock/
│       │                                #   restore LlmClient's model per research.md #12),
│       │                                #   exposes progress; injects a component-scoped
│       │                                #   RagEngine/VectorStore tree (research.md #11)
│       └── benchmark-export.service.ts  # NEW: builds and downloads the CSV file
│
└── services/                            # EXISTING, reused with small, additive changes
    ├── rag-engine.ts                    # UNCHANGED class; benchmark gets its own instance via
    │                                    #   component providers instead of the root singleton
    ├── llm-client.ts                    # MODIFIED: fix `setModel`; add `unloadModel()` and
    │                                    #   `lock()`/`unlock()`/`isLocked$` (research.md #12);
    │                                    #   `availableModels` sourced from a shared model list;
    │                                    #   remains a root singleton
    ├── embedder.ts                      # UNCHANGED (reused as-is; single fixed embedding model
    │                                    #   for both chat and benchmark, research.md #13)
    ├── pdf-parser.ts                    # MODIFIED: `parseFile(file, chunkSize = 500)`
    ├── vector-store.ts                  # MODIFIED: `initialize(dbName = 'takere-db')`, dbName
    │                                    #   injectable via the new token; `cosineSimilarity`
    │                                    #   extracted to `similarity.ts`; benchmark gets its own
    │                                    #   instance via component providers (research.md #11)
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

**Second re-check (after research.md #11–#13 were added)**: an earlier `/speckit-analyze` pass
flagged two CRITICAL gaps — how `VectorStore`/`RagEngine` isolation is actually achieved given
they are `providedIn: 'root'` singletons (research.md #11), and how `LlmClient`, also a shared
singleton, avoids corrupting the chat's active model while the benchmark swaps between models
(research.md #12) — plus one HIGH gap where FR-006 ("select" an embedding model) was silently
narrowed to a read-only display (research.md #13, now an explicit, rationale-backed decision
instead of an undocumented aside). All three are now resolved with concrete decisions; still no
constitution violations (Principle III is satisfied via DI scoping of the *same* classes, not new
parallel services). `data-model.md` and `tasks.md` need to be updated to reflect #11–#13 —
`tasks.md` in particular predates these decisions and should be regenerated via `/speckit-tasks`.

**Third re-check (after research.md #12 was amended to add a cross-cutting lock)**: a follow-up
`/speckit-analyze` pass found that the original #12 decision only described *what* needed to
happen ("Lock") without specifying *where* the lock lives — nothing stopped `HomeComponent` from
calling `LlmClient` concurrently with a benchmark run if the user simply navigated to the chat
page mid-run. research.md #12 now specifies `lock()`/`unlock()`/`isLocked$` live on `LlmClient`
itself, and `HomeComponent` is an explicitly MODIFIED file (not just the benchmark module) that
subscribes to `isLocked$` to disable its own send action. Still no constitution violations —
Principle III's reuse gate is satisfied because this is an additive change to `LlmClient`'s
existing contract, not a new service; Principle II is satisfied because `HomeComponent` stays in
its existing `src/app/home/` location. `data-model.md`, `quickstart.md`, and `tasks.md` need to
reflect this; `tasks.md` currently has the right *intent* sketched in by hand but with malformed
task IDs (a fractional `T028.5` and a duplicate `T035`) that a `/speckit-tasks` regeneration
should clean up.
