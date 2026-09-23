# Data Model: Benchmark de Modelos LLM

**Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

All types below live in `src/app/benchmark/models/benchmark.models.ts` unless noted otherwise.
They are in-memory only (no persistence layer) per spec Assumptions.

## BenchmarkModelOption

Represents one selectable LLM model in the benchmark's model list (FR-002).

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | MLC/WebLLM model id, resolved per research.md #3 (Phi-4-mini, Gemma family, Qwen3-8B family) |
| `displayName` | `string` | Human-readable label shown in the UI |

Source: a fixed array exported from `benchmark.models.ts` (or re-exported from `LlmClient.availableModels`
once that list is extended per research.md #3) — not user-editable free text (spec Assumption).

## TestQuestion

Represents one test question configured by the user (FR-007).

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Client-generated (e.g., `crypto.randomUUID()`), stable for the FormArray row's lifetime |
| `question` | `string` | Required, non-empty |
| `expectedAnswer` | `string` | Required, non-empty (FR-008: execution is blocked without it) |

**Validation rules** (enforced by `BenchmarkConfigComponent`'s Reactive Form):
- `question` and `expectedAnswer`: `Validators.required` + `Validators.minLength(1)` (trimmed)
- At least one `TestQuestion` must exist before the form is valid for submission (FR-008)

## BenchmarkConfig

Represents the full set of attributes configured for one benchmark run (FR-002 to FR-007, FR-006a).
This is the `FormGroup`'s value shape for `BenchmarkConfigComponent`.

| Field | Type | Notes |
|---|---|---|
| `selectedModelIds` | `string[]` | References `BenchmarkModelOption.id`; `Validators.required` (min 1 item) |
| `chunkSize` | `number` | Default `500` (matches existing `PdfParser` default); `Validators.min(1)` |
| `maxVectorStoreChunks` | `number` | Max number of chunks considered/stored (count-based per clarification); `Validators.min(1)` |
| `inputFile` | `File \| null` | Required (FR-008); PDF only, validated on file-picker change, not via `FormControl` validator |
| `embeddingModel` | `string` | Read-only, always `Xenova/all-MiniLM-L6-v2` — the `Embedder` supports exactly one embedding model by design (research.md #13: switching embedding models would invalidate the whole vector database, since different models produce incompatible vector spaces). FR-006 is satisfied passively: the field is displayed for transparency, not offered as a selector |
| `similarityThresholdPercent` | `number` | 0–100; `Validators.required`, `Validators.min(0)`, `Validators.max(100)` (FR-006a) |
| `questions` | `TestQuestion[]` | Backed by a `FormArray`; `Validators.required` (min 1 item) |

**Derived/UI-only state** (not part of the submitted config, computed in the component):
- `showRunSizeWarning: boolean` — `selectedModelIds.length > 5 || questions.length > 20` (FR-008a); non-blocking

**State transitions**: `BenchmarkConfig` is immutable snapshot data read once when a run starts
(FR-009 "os atributos são carregados no programa"); editing the form after a run has started does
not affect the in-flight run.

## BenchmarkResultRow

Represents the result of one (model, question) pair (FR-011, FR-012, FR-013).

| Field | Type | Notes |
|---|---|---|
| `modelId` | `string` | References `BenchmarkModelOption.id` |
| `questionId` | `string` | References `TestQuestion.id` |
| `status` | `'completed' \| 'blocked' \| 'failed'` | `blocked` = rejected by `RagEngine`'s query/answer guardrail; `failed` = model load or generation error (FR-016) |
| `generatedAnswer` | `string \| null` | `null` when `status !== 'completed'` |
| `similarityPercent` | `number \| null` | 0–100; `null` when `status !== 'completed'` |
| `verdict` | `'pass' \| 'fail' \| null` | Derived by `SimilarityService.verdict()`; `null` when `status !== 'completed'` |
| `responseTimeMs` | `number \| null` | Wall-clock time for that model/question; `null` when `status === 'failed'` before generation started |
| `errorMessage` | `string \| null` | Set when `status === 'failed'` or `'blocked'`, holding the guardrail/error message |

**Relationships**: many `BenchmarkResultRow` per `BenchmarkResult` (one per selected model ×
question combination); `modelId`/`questionId` are foreign keys into the `BenchmarkConfig` that
produced them (kept alongside the result set, not re-fetched).

## ModelPerformanceSummary

Represents aggregated metrics for one model across the whole run (FR-014).

| Field | Type | Notes |
|---|---|---|
| `modelId` | `string` | |
| `averageSimilarityPercent` | `number \| null` | Mean of `similarityPercent` over `completed` rows for this model; `null` if no completed rows |
| `passRatePercent` | `number \| null` | `(completed rows with verdict='pass') / (total rows for this model) * 100` |
| `averageResponseTimeMs` | `number \| null` | Mean of `responseTimeMs` over `completed` rows for this model |
| `blockedCount` | `number` | Count of rows with `status === 'blocked'` for this model |
| `failedCount` | `number` | Count of rows with `status === 'failed'` for this model |

Computed by `BenchmarkRunnerService` (or a pure function it calls) by grouping `BenchmarkResultRow[]`
by `modelId` once the run completes (or incrementally, as each model finishes, so
`BenchmarkResultsComponent` can render partial summaries during a run).

## BenchmarkRunState

Represents the overall run lifecycle, exposed by `BenchmarkRunnerService` to the UI (FR-015).

| Field | Type | Notes |
|---|---|---|
| `phase` | `'idle' \| 'ingesting' \| 'running' \| 'completed' \| 'error'` | `ingesting` = processing the PDF and building the vector store (FR-009), before any model runs |
| `currentModelId` | `string \| null` | The model currently loading/generating, `null` when not `running` |
| `currentQuestionId` | `string \| null` | The question currently being asked to `currentModelId` |
| `completedCount` | `number` | Rows produced so far, for a simple progress indicator (`completedCount / totalCount`) |
| `totalCount` | `number` | `selectedModelIds.length * questions.length`, fixed once a run starts |
| `results` | `BenchmarkResultRow[]` | Grows incrementally as each (model, question) pair finishes |
| `summaries` | `ModelPerformanceSummary[]` | Recomputed per model as its rows complete |
| `errorMessage` | `string \| null` | Set when `phase === 'error'` (e.g., PDF failed to parse — spec Edge Case) |

Exposed as an RxJS `Observable<BenchmarkRunState>` (a `BehaviorSubject` under the hood), matching
the existing `LlmClient.progress` / `RagEngine.progress` pattern already used in the codebase
(research.md — no Signals are used elsewhere in this project, so this feature stays consistent
with `Observable`-based state rather than introducing Signals for just one feature).

**Isolation notes (research.md #11, #12)**: `BenchmarkRunnerService` does not use the root-level
`VectorStore`/`RagEngine` singletons directly. The benchmark's component tree provides its own
`VectorStore`/`RagEngine` instances (via component-level `providers`), configured through an
`InjectionToken<string>` for the vector store's `dbName`, so the chat's `'takere-db'` is never
touched. `LlmClient` remains a single shared instance (multiple loaded LLMs would exceed
available VRAM), so `BenchmarkRunnerService.run()` snapshots the model id active before the run
starts, calls `LlmClient.lock()`, and restores the snapshotted model plus calls
`LlmClient.unlock()` on completion, failure, or early destruction/navigation-away (restore) —
this is required to satisfy the "must not regress chat" constraint in plan.md.

**Cross-component lock contract (research.md #12)**: the lock is not private to
`BenchmarkRunnerService` — it lives on `LlmClient` itself as `lock(): void`, `unlock(): void`,
and `isLocked$: Observable<boolean>`. `HomeComponent` (the chat UI) subscribes to `isLocked$` and
disables its message input/send action while `true`, with a short notice explaining a benchmark
is running. Without this, a user navigating to chat mid-benchmark-run could trigger
`LlmClient.generate()`/`setModel()` concurrently with the benchmark's own model-swap loop.

## Export payload (CSV)

Not a persisted entity, but the shape written by `benchmark-export.service.ts` (FR-017): one row
per `BenchmarkResultRow` (with `modelId`/`questionId` resolved to their display name/question
text for readability) plus a trailing section with one row per `ModelPerformanceSummary`. Exact
column order and formatting are an implementation detail for `tasks.md`, not specified further
here.
