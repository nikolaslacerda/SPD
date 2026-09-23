# Research: Benchmark de Modelos LLM

**Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Codebase survey performed against the current `src/app` tree (see summary below); no external
web research was needed since this feature reuses existing in-repo infrastructure. Each decision
below resolves a `NEEDS CLARIFICATION` from the Technical Context.

## Decisions

### 1. Which LLM client to reuse: `LlmClient` vs `LlmClient(WeInfer)`

**Decision**: Reuse `src/app/services/llm-client.ts` (`LlmClient`) and `src/app/services/rag-engine.ts`
(`RagEngine`) — the ones already used by the main chat flow — not the `-weinfer` variants.

**Rationale**: The user explicitly asked to reuse "o mesmo serviço/wrapper usado no fluxo
principal de chat". Additionally, `RagEngineWeInfer` has no guardrail logic at all (it was
stripped in that variant), while the benchmark spec (FR-010, FR-013) requires guardrail
blocking to be reflected in results. Only the main `RagEngine` has the query/answer guardrail
checks needed.

**Alternatives considered**: `RagEngineWeInfer`/`LlmClientWeInfer` — rejected because it already
supports proper `setModel()` swapping, but lacks guardrails, which is a hard requirement.

### 2. Fixing model swapping in `LlmClient`

**Decision**: Fix the existing bug in `LlmClient.setModel(modelId)` (`src/app/services/llm-client.ts`),
which currently ignores its argument and always assigns the hardcoded default model id. After the
fix, `setModel` DEVE update `currentModel` and require `initialize()` to be called again to load
the new model. Add an `unloadModel()` method that calls the underlying `MLCEngine.unload()` (part
of `@mlc-ai/web-llm`'s public API) before creating a new engine, wrapped in try/catch so an
unavailable/failed unload does not crash a benchmark run — worst case the old engine's WebGPU
memory is not released until the next unload succeeds or the tab is closed.

**Rationale**: The benchmark needs to load and swap between multiple models sequentially within
one page session; today nothing does this (chat only ever loads one hardcoded model). Fixing the
existing method (rather than adding a parallel one) keeps a single source of truth per the
constitution's reuse principle. The exact behavior of `MLCEngine.unload()` in the installed
`@mlc-ai/web-llm@^0.2.79` version DEVE be confirmed once dependencies are installed locally
(implementation-time verification task); if the method name/signature differs, adapt the wrapper
accordingly without changing the public `LlmClient` contract used by the rest of the app.

**Alternatives considered**: Creating a brand-new `MLCEngine` per model without unloading the
previous one — rejected, as it would leak WebGPU memory across a multi-model benchmark run and
likely crash the browser tab before all models finish.

### 3. Model catalog for the benchmark (Phi-4-mini, Google Gemma 4, Qwen3-8B)

**Decision**: Add a benchmark-specific model list (id + display name) to the benchmark module,
using the closest available prebuilt WebLLM/MLC quantized model ids for each requested family
(Phi-4-mini, Gemma family, Qwen3 8B), resolved from `webllm.prebuiltAppConfig.model_list` at
implementation time. `LlmClient.availableModels` (currently hardcoded to a single Llama model) is
extended/replaced with this list so both chat and benchmark can select from the same source of
truth.

**Rationale**: WebLLM only ships models that MLC has pre-quantized and published; the exact
published id string for "Phi-4-mini" / "Gemma 4" / "Qwen3-8B" cannot be hardcoded here without
risking a stale/incorrect id as the library version evolves. The plan defers exact id lookup to
an implementation task (verify against the installed package's `prebuiltAppConfig`) rather than
guessing, and documents the intended family/size mapping so the task is unambiguous.

**Alternatives considered**: Letting the user type an arbitrary model id — rejected, contradicts
spec Assumption "lista de modelos LLM disponível... não modelos arbitrários".

### 4. Extracting `cosineSimilarity` for the new `SimilarityService`

**Decision**: Extract the existing `private cosineSimilarity(a, b)` method out of
`src/app/services/vector-store.ts` into a small standalone, injectable utility
(`src/app/services/similarity.ts`, exported as `SimilarityService`) with a pure
`cosineSimilarity(a: number[], b: number[]): number` method. `VectorStore` is updated to inject
and call this service instead of its private copy (no behavior change for existing chat/guardrail
flows). The benchmark's `SimilarityService` (per the user's requested component structure) reuses
this same method internally and adds `scorePercent(actual: string, expected: string): Promise<number>`
(embeds both strings via `Embedder`, computes cosine similarity, maps `[-1, 1] → [0, 100]`) and
`verdict(scorePercent: number, thresholdPercent: number): 'pass' | 'fail'`.

**Rationale**: Satisfies the constitution's reuse principle (no duplicated similarity math) while
keeping `VectorStore`'s public contract unchanged. This is a refactor of existing shared logic,
not a new duplicate implementation.

**Alternatives considered**: Duplicating the cosine similarity formula directly inside the new
`SimilarityService` — rejected as unnecessary duplication when extraction is a 5-line, low-risk
change with no behavior impact.

### 5. Isolating the benchmark's vector data from the main chat's knowledge base

**Decision**: Extend `VectorStore.initialize()` to accept an optional database name parameter,
defaulting to the existing `'takere-db'` (no change for the chat flow). The benchmark module
creates its own `VectorStore` instance(s) configured with a separate database name (e.g.
`'takere-benchmark-db'`) so ingesting a benchmark PDF never clears or mixes with the user's
existing chat knowledge base, and vice versa.

**Rationale**: `VectorStore` is currently a single global `providedIn: 'root'` singleton backed
by one hardcoded IndexedDB database; reusing it as-is for the benchmark would force clearing the
user's real chat data before/after every benchmark run, which is unacceptable. A parameterized
database name is the smallest change that preserves the existing default behavior everywhere
else.

**Alternatives considered**: Reusing the exact same singleton/db and calling `clear()` around
each benchmark run — rejected, destroys the user's existing chat data as a side effect of running
a benchmark.

### 6. Making chunk size configurable in `PdfParser`

**Decision**: Change `PdfParser.parseFile(file: File, chunkSize = 500)` to accept an optional
`chunkSize` parameter (default `500`, preserving current chat behavior exactly), replacing the
hardcoded `500` literal in the character-splitting loop.

**Rationale**: FR-003 requires the benchmark to configure chunk size; reusing `PdfParser` with an
added optional parameter (rather than forking it) satisfies the reuse principle and keeps a
single chunking implementation for both chat and benchmark.

**Alternatives considered**: Forking `PdfParser` into a benchmark-only copy — rejected as
unjustified duplication given the change needed is a one-line default-parameter addition.

### 7. Results table UI: native HTML table vs. adding Angular Material

**Decision**: Build the results table as a plain native `<table>` (with Angular's `@for` control
flow) styled via SCSS, matching the project's current all-native-HTML UI approach. Do **not** add
`@angular/material`/`@angular/cdk` as new dependencies.

**Rationale**: The project has zero existing Angular Material usage and no `mat-table` anywhere
in the codebase (confirmed via `package.json` and a full-source grep); the constitution's
Development Workflow gate requires new dependencies to be justified when existing stack cannot
reasonably deliver the feature, and a results table is easily built with native HTML/CSS. The
user's plan input mentioned `mat-table` only as an illustrative example ("ex.:"), not a hard
requirement.

**Alternatives considered**: Installing Angular Material for its table/sorting features —
rejected as an unjustified new dependency for a feature a plain table satisfies.

### 8. Benchmark similarity threshold vs. RagEngine's internal guardrail thresholds

**Decision**: Treat the benchmark's user-configurable similarity threshold (FR-006a, compares
generated answer against the user-supplied expected answer) as fully independent from
`RagEngine`'s internal, hardcoded guardrail thresholds (`QUERY_THRESHOLD = 0.1`,
`ANSWER_THRESHOLD = 0.55`, which compare the query/answer against retrieved context chunks). The
benchmark run still surfaces `RagEngine`'s guardrail rejections as a distinct "blocked" status
(FR-013), separate from the pass/fail verdict derived from the benchmark threshold.

**Rationale**: These are two different similarity comparisons serving different purposes
(retrieval relevance vs. answer-quality-against-reference); conflating them would produce
confusing or incorrect benchmark results.

**Alternatives considered**: Reusing `ANSWER_THRESHOLD` as the default benchmark threshold —
considered as a sensible default value for the new configurable field, but kept as a distinct,
independently adjustable setting rather than a hardcoded reuse, since spec FR-006a requires it to
be user-configurable.

### 9. Routing, lazy loading, and navigation

**Decision**: Add a `benchmark` route to `src/app/app.routes.ts` using `loadComponent` (dynamic
`import()`), since no lazy-loading pattern exists yet to follow and the user explicitly requested
lazy loading. Add a minimal top-level navigation (e.g., two links: "Chat" / "Benchmark") to
`src/app/app.html` + `src/app/app.ts`, since no nav/menu component currently exists — `app.ts` is
presently just a `<router-outlet>` wrapper.

**Rationale**: Directly satisfies the user's explicit routing/navigation instructions; introduces
the smallest possible nav shell rather than a larger app-shell redesign, since nothing in scope
requires more.

**Alternatives considered**: Keeping `HomeComponent` eagerly loaded and only lazy-loading
`benchmark` — this **is** the chosen approach (only the new feature needs to be lazy; `HomeComplete`
stays as-is, unchanged, avoiding unrelated churn).

### 10. Zoneless change detection compatibility

**Decision**: New benchmark components follow the same manual `ChangeDetectorRef.detectChanges()`
pattern already used in `HomeComponent`, since `app.config.ts` uses
`provideZonelessChangeDetection()` project-wide.

**Rationale**: Required for any new UI to actually re-render during async operations
(model loading, streaming generation, progress updates) under zoneless mode; this is an existing
project-wide constraint, not new to this feature.

### 11. Instance Isolation for the Benchmark

**Decision**: The Benchmark module/component will use component-level providers (or a dedicated factory via DI) to instantiate its own RagEngine and VectorStore tree. An InjectionToken will be introduced to configure the VectorStore's `dbName`, allowing the chat to use 'takere-db' while the benchmark injects 'takere-benchmark-db'.

**Rationale**: VectorStore and RagEngine are global singletons (provided in 'root'). Dynamically changing the database would cause data leakage between the chat and the benchmark.

### 12. LlmClient state management during benchmarking

**Decision**: The LlmClient will remain a strict singleton. The Benchmark module must read the active model before starting (Snapshot), block other parts of the application from using the service (Lock), perform the model swaps, and—mandatorily—restore the original model upon completion or destruction (Restore). The Lock is implemented **on `LlmClient` itself**, not only inside `BenchmarkRunnerService`: `LlmClient` exposes `lock(): void`, `unlock(): void`, and `isLocked$: Observable<boolean>` (a `BehaviorSubject<boolean>` under the hood, consistent with its existing `progress` Observable pattern). `BenchmarkRunnerService.run()` calls `lock()` before swapping models and `unlock()` in a `finally` block alongside the model restore. Any other consumer of `LlmClient` — today, that's `HomeComponent` (chat) — subscribes to `isLocked$` and disables its own model-invoking UI (the message input and send action) while `true`, showing a short notice that a benchmark is running.

**Rationale**: The LlmClient is a shared singleton. Unlike the database, we cannot instantiate multiple instances of the LlmClient due to the high memory/VRAM consumption of local language models. However, the benchmark dynamically switches models, which would corrupt the active chat model. A lock flag local to `BenchmarkRunnerService` only prevents a second overlapping benchmark run — it does nothing to stop `HomeComponent` from calling `LlmClient.generate()`/`setModel()` concurrently with the benchmark's swap loop if the user simply navigates to the chat page while a run is in progress (a normal SPA navigation, not an edge case). Putting the lock flag on `LlmClient` itself, with an observable other components can react to, is the only way to actually satisfy the "must not regress chat" constraint against that scenario.

**Alternatives considered**: Keeping the lock as a private flag inside `BenchmarkRunnerService` only — rejected because it can't prevent `HomeComponent` (or any other future consumer) from using `LlmClient` concurrently, since nothing outside `BenchmarkRunnerService` would ever know a run is in progress.

### 13. Modelo de Embeddings Fixo

**Decision**: In its current state (MVP), the Embedder will support and load only one optimized model by default. FR-006 will be addressed passively: the settings UI will display the model in use as a read-only field for transparency purposes, with no option to switch models.

**Rationale**: Requirement FR-006 allows the user to select the embedding model. However, changing the embedding model invalidates the entire existing vector database, as different models generate vectors with incompatible dimensionalities and latent spaces. Recalculating the embeddings for the entire knowledge base locally would create a severe performance bottleneck.

## Summary of resulting Technical Context

- **Language/Version**: TypeScript 5.9 (strict), Angular 20.3
- **Primary Dependencies**: `@mlc-ai/web-llm` (LLM inference), `@xenova/transformers` +
  `onnxruntime-web` (embeddings), `pdfjs-dist` (PDF parsing), RxJS — all already in `package.json`,
  no new dependencies added
- **Storage**: IndexedDB via `VectorStore`, extended to support a second, separate database name
  for benchmark data, isolated from the chat knowledge base
- **Testing**: Karma + Jasmine (`ng test`), following the existing `TestBed.inject(...)` service
  spec pattern; new component specs follow standard standalone-component `TestBed`/`fixture` style
  (no prior component spec exists in-repo to copy, so this establishes the pattern)
- **Target Platform**: Browser (WebGPU-capable), same as the rest of the app
- **Project Type**: Single-page Angular web application (frontend-only, no backend)
- **Performance Goals**: Sequential per-model execution; no hard latency target beyond the soft
  run-size warning (>5 models or >20 questions) already defined in the spec
- **Constraints**: Local-only processing (no network calls for inference/embeddings/storage);
  zoneless change detection; must not regress existing chat flow behavior — enforced via
  `LlmClient.lock()`/`unlock()`/`isLocked$`, which `HomeComponent` must observe and react to
  (research.md #12)
- **Scale/Scope**: Single benchmark page, one run at a time, no cross-session persistence
