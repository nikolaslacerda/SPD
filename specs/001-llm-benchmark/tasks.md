---
description: "Task list template for feature implementation"
---

# Tasks: Benchmark de Modelos LLM

**Input**: Design documents from `/specs/001-llm-benchmark/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Included — constitution Principle VI ("Testes Unitários Obrigatórios") mandates unit
tests for all new/changed components and services in this project; they are not optional here.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent
implementation and testing of each story, after a shared Setup + Foundational phase.

**Regenerated**: This version supersedes the previous tasks.md to incorporate research.md
decisions #11–#13, added after a `/speckit-analyze` pass flagged two CRITICAL gaps (how
`VectorStore`/`RagEngine` isolation and `LlmClient` model-swap safety are actually achieved,
given they are Angular singletons) and one HIGH gap (FR-006's embedding-model "selection" was
silently narrowed without a documented decision). It also formalizes two rough placeholder tasks
that had been sketched directly in this file (DI-boundary setup, VectorStore token refactor) into
properly-numbered, fully-specified tasks below. All three decisions are now reflected end to end.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1, US2, US3) — omitted for Setup,
  Foundational, and Polish tasks
- Every task includes the exact file path(s) it touches

## Path Conventions

Single Angular project (no separate backend) — all paths are relative to `src/app/`, per
plan.md's Project Structure section.

---

## Phase 1: Setup

**Purpose**: Scaffolding for the new feature and its entry points; no business logic yet.

- [ ] T001 Create the `benchmark` feature directory skeleton: `src/app/benchmark/`, `src/app/benchmark/benchmark-config/`, `src/app/benchmark/benchmark-results/`, `src/app/benchmark/models/`, `src/app/benchmark/services/` (empty dirs are fine; populated by later tasks)
- [ ] T002 [P] Add a lazy-loaded `benchmark` route via `loadComponent` in `src/app/app.routes.ts`, pointing at the future `BenchmarkPageComponent` (created in T033)
- [ ] T003 [P] Add a minimal top-level navigation with two links ("Chat" and "Benchmark") in `src/app/app.html` and `src/app/app.ts`, since no nav/menu exists yet (today `app.ts` only renders `<router-outlet>`)

**Checkpoint**: App has a working (empty) `/benchmark` route reachable from a nav link.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types and additive, backward-compatible extensions to the existing
`LlmClient` / `PdfParser` / `VectorStore` services that every user story below depends on,
including the DI isolation primitives from research.md #11 (component-scoped `VectorStore`/
`RagEngine` via an `InjectionToken`) needed before any benchmark execution logic is written.

**⚠️ CRITICAL**: No user story task may start until this phase is complete.

- [ ] T004 [P] Define `BenchmarkModelOption`, `TestQuestion`, `BenchmarkConfig`, `BenchmarkResultRow`, `ModelPerformanceSummary`, and `BenchmarkRunState` interfaces in `src/app/benchmark/models/benchmark.models.ts`, exactly matching the field names/types/nullability documented in data-model.md (e.g., `BenchmarkResultRow.status: 'completed' | 'blocked' | 'failed'`, `similarityPercent: number | null`, `verdict: 'pass' | 'fail' | null`)
- [ ] T005 [P] Create `VECTOR_STORE_DB_NAME` as an `InjectionToken<string>` in `src/app/benchmark/models/vector-store-db-name.token.ts` (research.md #11) — this token, when provided at component level, lets a `VectorStore` instance resolve a different IndexedDB database name than the root singleton's default
- [ ] T006 Update `VectorStore`'s constructor in `src/app/services/vector-store.ts` to optionally inject `VECTOR_STORE_DB_NAME` via `@Inject(VECTOR_STORE_DB_NAME) @Optional() private injectedDbName?: string`; `initialize(dbName?: string)` DEVE resolve the effective name as `dbName ?? this.injectedDbName ?? 'takere-db'`, so the root singleton (no token provided) keeps using `'takere-db'` exactly as before (depends on T005)
- [ ] T007 Fix the bug in `LlmClient.setModel(modelId)` in `src/app/services/llm-client.ts` — it currently ignores its `modelId` argument and always assigns the hardcoded default model id; make it actually set `currentModel = modelId`
- [ ] T008 Add an `unloadModel(): Promise<void>` method to `LlmClient` in `src/app/services/llm-client.ts` that calls the underlying `MLCEngine.unload()` (research.md #2) wrapped in try/catch so a failed/unavailable unload does not throw, then clears the internal engine reference (depends on T007, same file)
- [ ] T009 Extend `LlmClient.availableModels` in `src/app/services/llm-client.ts` to include Phi-4-mini, Google Gemma 4, and Qwen3-8B entries, resolving each family's exact prebuilt MLC/WebLLM model id against the installed `@mlc-ai/web-llm` package's `prebuiltAppConfig.model_list` (research.md #3) — do not guess an id string; look it up in the installed package (depends on T008, same file)
- [ ] T010 Extract the existing `private cosineSimilarity(a, b)` method out of `VectorStore` (`src/app/services/vector-store.ts`) into a new injectable `SimilarityService` in `src/app/services/similarity.ts` exposing `cosineSimilarity(a: number[], b: number[]): number`; update `VectorStore` to inject `SimilarityService` and call it instead of its removed private copy, with no behavior change (depends on T006, same file as `vector-store.ts`)
- [ ] T011 Add `scorePercent(actual: string, expected: string): Promise<number>` (embeds both strings via `Embedder`, computes cosine similarity via `SimilarityService.cosineSimilarity`, maps `[-1, 1] → [0, 100]`) and `verdict(scorePercent: number, thresholdPercent: number): 'pass' | 'fail'` to `SimilarityService` in `src/app/services/similarity.ts` (depends on T010, same file)
- [ ] T012 [P] Add an optional `chunkSize` parameter to `PdfParser.parseFile(file: File, chunkSize = 500)` in `src/app/services/pdf-parser.ts`, replacing the hardcoded `500` literal in the chunking loop with the parameter (default preserves current chat behavior exactly)
- [ ] T013 [P] Unit test for the `LlmClient.setModel`/`unloadModel` fix in `src/app/services/llm-client.spec.ts` — assert `setModel('x')` updates the model actually used by a subsequent `initialize()` call
- [ ] T014 [P] Unit test for `PdfParser`'s configurable chunk size in `src/app/services/pdf-parser.spec.ts` — assert a custom `chunkSize` changes the number/length of returned chunks, and the default (omitted) argument still produces ~500-char chunks
- [ ] T015 [P] Unit test for `VectorStore`'s database-name resolution in `src/app/services/vector-store.spec.ts` — assert: (a) with no token provided and no explicit argument, `initialize()` uses `'takere-db'`; (b) `initialize('custom-db')` overrides it; (c) two `VectorStore` instances configured with different effective names (one via the injected `VECTOR_STORE_DB_NAME` token, one via the default) do not see each other's chunks
- [ ] T016 [P] Unit test for `SimilarityService` in `src/app/services/similarity.spec.ts` — assert `cosineSimilarity` on known vectors, `scorePercent` maps identical strings near 100 and unrelated strings lower, and `verdict` returns `'pass'`/`'fail'` correctly around the threshold boundary

**Checkpoint**: Foundation ready — shared types and the DI isolation token exist, `LlmClient` can
actually swap models, `PdfParser`/`VectorStore` accept the new optional parameters, and
`SimilarityService` exists and is tested. User story implementation can now begin.

---

## Phase 3: User Story 1 - Configurar e executar uma bateria de testes (Priority: P1) 🎯 MVP

**Goal**: The user can fill in all benchmark attributes (models, chunk size, max vector store
chunks, input PDF, embedding model, similarity threshold, test questions) and start a run; the
system processes the document in an isolated vector store, then runs every question against
every selected model sequentially — without corrupting the chat's active model or knowledge
base — isolating failures per model, and reporting progress.

**Independent Test**: Configure one model, one input file, and one question with an expected
answer; start the run; verify the system ingests the PDF and produces one `BenchmarkResultRow`
for that model/question pair (inspectable via `BenchmarkRunnerService.runState$`, even before the
results table exists in US2); separately, verify the chat's model and knowledge base are
unaffected once the run finishes.

### Implementation for User Story 1

- [ ] T017 [P] [US1] Create `BenchmarkConfigComponent` (standalone) skeleton with an empty `FormGroup` in `src/app/benchmark/benchmark-config/benchmark-config.component.ts`, `.html`, and `.scss`
- [ ] T018 [US1] Add a `selectedModelIds: string[]` `FormControl` (multi-select, `Validators.required`, at least 1 item) to `BenchmarkConfigComponent`, populated from `LlmClient.availableModels` (depends on T009, T017)
- [ ] T019 [P] [US1] Add a `chunkSize` numeric `FormControl` (default `500`, `Validators.min(1)`) to `BenchmarkConfigComponent` in `src/app/benchmark/benchmark-config/benchmark-config.component.ts`
- [ ] T020 [P] [US1] Add a `maxVectorStoreChunks` numeric `FormControl` (`Validators.min(1)`, count-based per spec Clarifications) to `BenchmarkConfigComponent`
- [ ] T021 [P] [US1] Add an `inputFile` file-picker control (required, PDF only) to `BenchmarkConfigComponent`, validating the file type on change and surfacing an error if a non-PDF file is chosen
- [ ] T022 [P] [US1] Add a read-only `embeddingModel` field to `BenchmarkConfigComponent`, displaying (not letting the user choose) the existing embedding model id used by `Embedder` (`Xenova/all-MiniLM-L6-v2`) — per research.md #13, `Embedder` supports exactly one model because switching it would invalidate the whole vector database, so FR-006 is satisfied passively via this read-only display, not a selector
- [ ] T023 [P] [US1] Add a `similarityThresholdPercent` numeric `FormControl` (`Validators.required`, `Validators.min(0)`, `Validators.max(100)`) to `BenchmarkConfigComponent`
- [ ] T024 [US1] Add a `questions` `FormArray` of `{ question, expectedAnswer }` groups (each field `Validators.required` + non-empty after trim) to `BenchmarkConfigComponent`, with add/edit/remove row methods; the array itself requires at least 1 item (depends on T017)
- [ ] T025 [US1] Implement submit-blocking validation in `BenchmarkConfigComponent`: when any required field is missing (no model, no file, or no question with an expected answer), disable the Run action and show a validation message (FR-008) (depends on T018–T024)
- [ ] T026 [US1] Implement the non-blocking run-size warning in `BenchmarkConfigComponent`: show a warning (not disabling Run) when `selectedModelIds.length > 5` or `questions.length > 20` (FR-008a) (depends on T018, T024)
- [ ] T027 [US1] Create `BenchmarkRunnerService` in `src/app/benchmark/services/benchmark-runner.service.ts` exposing a `runState$: Observable<BenchmarkRunState>` backed by a `BehaviorSubject`, matching the existing `LlmClient.progress`/`RagEngine.progress` Observable pattern; inject `VectorStore`, `RagEngine`, and `LlmClient` normally (their actual isolation/scope is determined by whoever provides this service — see T033) (depends on T004)
- [ ] T028 [US1] Implement a snapshot → lock → restore wrapper around `LlmClient` in `BenchmarkRunnerService` (research.md #12): before a run starts, capture `LlmClient.getCurrentModel()` as `originalModelId` and set an internal `locked` flag so a second concurrent `run()` call is rejected; wrap the entire run body in `try/finally` so that on completion, error, or explicit cancellation, `LlmClient.unloadModel()` + `setModel(originalModelId)` + `initialize()` restore the model that was active before the benchmark started, and `locked` is cleared (depends on T007, T008, T027)
- [ ] T028.5 During the execution of `run()`, `BenchmarkRunnerService` must make explicit calls to `LlmClient.lock()` at the beginning and `LlmClient.unlock()` at the end (within a `finally` block). Do not rely solely on a local `isRunning` flag within the benchmark service; the lock must be triggered on the LLM instance so that the rest of the app (SPA) is aware and can react accordingly.
- [ ] T029 [US1] Implement the ingest step in `BenchmarkRunnerService.run(config: BenchmarkConfig)`: set `phase = 'ingesting'`, use `PdfParser.parseFile(config.inputFile, config.chunkSize)` + `Embedder` to populate the injected `VectorStore` instance (isolated from chat's data via the `VECTOR_STORE_DB_NAME` token — see T033; this service does not choose the db name itself), capping stored chunks at `config.maxVectorStoreChunks` (FR-009, research.md #5, #11) (depends on T006, T012, T027)
- [ ] T030 [US1] Implement the sequential per-model execution loop in `BenchmarkRunnerService`, running inside the T028 lock: for each `modelId` in `config.selectedModelIds`, call `LlmClient.unloadModel()` then `setModel(modelId)` + `initialize()`, then for each `TestQuestion` call the injected `RagEngine.query(...)`, measuring `responseTimeMs`, detecting guardrail rejection (`status = 'blocked'`), and computing `similarityPercent`/`verdict` via `SimilarityService.scorePercent`/`verdict` against `config.similarityThresholdPercent`, producing one `BenchmarkResultRow` per pair (FR-010, FR-011, FR-013) (depends on T007, T008, T009, T011, T027, T028, T029)
- [ ] T031 [US1] Implement per-model failure isolation in `BenchmarkRunnerService`: wrap each model's load/generation work in try/catch so a failure (e.g., model fails to load) marks that model's remaining rows `status = 'failed'` with an `errorMessage`, and the loop continues to the next model without stopping — this is independent of and does not skip the T028 restore step (FR-016, SC-004) (depends on T030)
- [ ] T032 [US1] Emit live progress from `BenchmarkRunnerService` into `runState$` during execution: `phase = 'running'`, `currentModelId`, `currentQuestionId`, `completedCount`/`totalCount` updated after each row (FR-015) (depends on T030)
- [ ] T033 [US1] Create `BenchmarkPageComponent` (standalone, route target for T002) in `src/app/benchmark/benchmark-page.component.ts`, `.html`, `.scss`; in its `@Component` decorator, add `providers: [VectorStore, RagEngine, BenchmarkRunnerService, { provide: VECTOR_STORE_DB_NAME, useValue: 'takere-benchmark-db' }]` so this component's subtree resolves its own isolated `VectorStore`/`RagEngine`/`BenchmarkRunnerService` instances instead of the root singletons, while `LlmClient`/`Embedder` still resolve to the root singletons (intentionally, per research.md #11/#12); compose `BenchmarkConfigComponent` and a simple progress indicator bound to `BenchmarkRunnerService.runState$` (depends on T005, T006, T017, T027)
- [ ] T034 [US1] Wire the "Run" action in `BenchmarkPageComponent`: on click, read the current `BenchmarkConfigComponent` form value as a `BenchmarkConfig` snapshot and call `BenchmarkRunnerService.run(config)` (FR-009 "os atributos são carregados no programa") (depends on T025, T029, T033)
- [ ] T035 The Chat component (HomeComponent) must observe the `isLocked` property (Signal or Observable) of the `LlmClient`. When `isLocked` is `true` (indicating that a benchmark is running in the background), the text input field and the send button must be disabled, and the interface must display a small, friendly notice (e.g., "The assistant is busy running a benchmark").

### Tests for User Story 1

- [ ] T035 [P] [US1] Unit test for `BenchmarkConfigComponent` in `src/app/benchmark/benchmark-config/benchmark-config.component.spec.ts` — assert the form is invalid (and Run disabled) with missing required fields, valid with all required fields present, and the non-blocking warning flag toggles correctly above 5 models / 20 questions
- [ ] T036 [P] [US1] Unit test for `BenchmarkRunnerService` in `src/app/benchmark/services/benchmark-runner.service.spec.ts` — using fakes/spies for `RagEngine`/`LlmClient`/`VectorStore`, assert: one row is produced per model×question pair; a guardrail rejection yields `status = 'blocked'`; a thrown model error yields `status = 'failed'` for that model only while other models still complete (FR-016); after `run()` settles (success, partial failure, or thrown error), `LlmClient.setModel` was last called with the pre-run `originalModelId` (restore verified, research.md #12); and the `VectorStore` instance used received `initialize()`/ingestion calls, never touching a `'takere-db'`-named store (isolation verified, research.md #11)

**Checkpoint**: User Story 1 is fully functional and independently testable — a benchmark run can
be configured and executed end-to-end, with results accumulating in `BenchmarkRunnerService.runState$`,
without regressing the chat's active model or knowledge base.

---

## Phase 4: User Story 2 - Visualizar resultados e métricas de desempenho (Priority: P2)

**Goal**: Once a run completes (or progresses), the user sees a results table (one row per
model/question pair) and a per-model performance summary.

**Independent Test**: Run a minimal batch (1 model, 2 questions) per US1, then verify the results
table shows both rows with similarity/verdict, and a summary block shows per-model average
similarity, pass rate, and average response time.

### Implementation for User Story 2

- [ ] T037 [P] [US2] Implement a pure aggregation function grouping `BenchmarkResultRow[]` by `modelId` into `ModelPerformanceSummary[]` (averageSimilarityPercent, passRatePercent, averageResponseTimeMs, blockedCount, failedCount — exact formulas per data-model.md) in `src/app/benchmark/services/benchmark-runner.service.ts` (depends on T030)
- [ ] T038 [US2] Recompute `summaries` in `BenchmarkRunnerService.runState$` incrementally as each model's rows complete, using the function from T037 (depends on T037)
- [ ] T039 [P] [US2] Create `BenchmarkResultsComponent` (standalone) skeleton in `src/app/benchmark/benchmark-results/benchmark-results.component.ts`, `.html`, `.scss`
- [ ] T040 [US2] Implement the results table in `BenchmarkResultsComponent`: one native `<table>` row per `BenchmarkResultRow`, showing `generatedAnswer`, `similarityPercent`, `verdict`, and visually highlighting `blocked`/`failed` rows distinctly from `completed` similarity results (FR-012, FR-013) (depends on T039)
- [ ] T041 [US2] Implement the per-model summary block in `BenchmarkResultsComponent`, rendering each `ModelPerformanceSummary`'s `averageSimilarityPercent`, `passRatePercent`, `averageResponseTimeMs`, `blockedCount`, and `failedCount` (FR-014) (depends on T039, T038)
- [ ] T042 [US2] Integrate `BenchmarkResultsComponent` into `BenchmarkPageComponent`, shown once `runState$.phase` is `'running'` or `'completed'` (rows render incrementally as they complete) (depends on T033, T040, T041)

### Tests for User Story 2

- [ ] T043 [P] [US2] Unit test for the `ModelPerformanceSummary` aggregation function in `src/app/benchmark/services/benchmark-runner.service.spec.ts` — assert correct averages/pass-rate/counts for a known mixed set of completed/blocked/failed rows
- [ ] T044 [P] [US2] Unit test for `BenchmarkResultsComponent` in `src/app/benchmark/benchmark-results/benchmark-results.component.spec.ts` — assert one rendered row per result, blocked/failed rows visually distinguished (e.g., via a CSS class or test-id), and summary values match input fixtures

**Checkpoint**: User Stories 1 and 2 both work independently — results and metrics are visible.

---

## Phase 5: User Story 3 - Exportar os resultados (Priority: P3)

**Goal**: The user can export the completed results table (rows + per-model summary) to a CSV
file; the export action is unavailable until a run has completed.

**Independent Test**: Before any run, confirm Export is disabled. After a run completes (US1+US2),
click Export and confirm a `.csv` file downloads containing all rows and the summary.

### Implementation for User Story 3

- [ ] T045 [P] [US3] Create `BenchmarkExportService` in `src/app/benchmark/services/benchmark-export.service.ts` with `exportToCsv(results: BenchmarkResultRow[], summaries: ModelPerformanceSummary[], config: BenchmarkConfig): void`, building CSV text (result rows, then a summary section) and triggering a download via `Blob` + `URL.createObjectURL` + a temporary anchor element (no prior art in this codebase per research.md — this is new, self-contained logic)
- [ ] T046 [US3] Add an "Exportar" button to `BenchmarkResultsComponent`, disabled unless `runState.phase === 'completed'`, calling `BenchmarkExportService.exportToCsv(...)` with the current results/summaries/config on click (FR-017, spec acceptance scenario "nenhuma bateria... opção fica indisponível") (depends on T045, T040, T041)

### Tests for User Story 3

- [ ] T047 [P] [US3] Unit test for `BenchmarkExportService` in `src/app/benchmark/services/benchmark-export.service.spec.ts` — assert the generated CSV text contains one line per result row and one line per model summary, with expected column values from fixture data

**Checkpoint**: All three user stories are independently functional — configure & run, view
results & metrics, and export.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup that spans all three stories.

- [ ] T048 [P] Manually run all 5 scenarios in `specs/001-llm-benchmark/quickstart.md` against the implemented feature and confirm each expected outcome
- [ ] T049 [P] Perform the quickstart.md "Regression check": confirm the existing chat flow on the Home page (`src/app/home/`) still behaves exactly as before, INCLUDING the two isolation-specific assertions added after research.md #11/#12 — chat's active model is restored after a benchmark run (not left on whatever model the benchmark last loaded), and chat's knowledge base/documents remain intact and searchable after a benchmark run
- [ ] T050 Run `ng lint` (or configured lint command) and `ng build` and confirm no new errors/warnings were introduced by the benchmark feature, per constitution's Development Workflow gate
- [ ] T051 [P] Apply SCSS styling using strictly the global variables defined in `src/styles.scss` and `src/app/home/home.component.scss` (e.g., variables for background color, typography, and spacing) for `BenchmarkConfigComponent`, `BenchmarkResultsComponent`, and `BenchmarkPageComponent`. Reuse existing utility classes and mixins for buttons, cards, and inputs to ensure visual consistency without introducing hardcoded values (such as hex colors or arbitrary pixel margins)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories. Within this
  phase: T005→T006 (token must exist before `VectorStore` can inject it); `llm-client.ts` edits
  T007→T008→T009 are strictly sequential (same file); `vector-store.ts`/`similarity.ts` edits
  T006→T010→T011 are strictly sequential (same files).
- **User Stories (Phase 3–5)**: All depend on Foundational phase completion.
  - US1 (P1) has no dependency on US2/US3.
  - US2 (P2) depends on US1's `BenchmarkResultRow`/`BenchmarkRunnerService` (T030, T032) existing,
    since it renders and aggregates that data — implement after US1 for a working increment, though
    the two remain conceptually independent per spec.
  - US3 (P3) depends on US2's `BenchmarkResultsComponent` existing as the place to add the Export
    button (T040, T041) and on having results/summaries to export.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Within Each User Story

- Reactive Form fields before the validation/warning logic that reads them.
- `BenchmarkRunnerService` core loop (T030) depends on the snapshot/lock (T028) and ingest (T029)
  steps existing first; failure isolation (T031) and progress (T032) both extend the same loop.
- The DI isolation wiring (T033's component `providers`) must exist before Run is wired (T034),
  since `BenchmarkRunnerService`'s injected `VectorStore`/`RagEngine` are only actually isolated
  once something provides them at component scope.
- Aggregation logic (US2) before the UI that renders it.
- Export service (US3) before the button that calls it.

### Parallel Opportunities

- T002 and T003 (Setup) can run in parallel — different files.
- T004, T005, T012 (Foundational) can run in parallel — different files from each other and from
  the `llm-client.ts` chain (T007–T009) and the `vector-store.ts`/`similarity.ts` chain (T006,
  T010, T011).
- T013–T016 (Foundational tests) can run in parallel with each other once their respective
  implementation task lands.
- Within US1: T019–T023 (independent form fields) can run in parallel; T035/T036 (tests) can run
  in parallel with each other.
- Within US2: T037 and T039 can start in parallel (different files); T043/T044 in parallel.
- Within US3: T045 has no dependency on US1/US2 internals beyond the data shapes from T004, so it
  can be built in parallel with US2 if staffed, even though T046 (wiring the button) waits on US2's
  component.

---

## Parallel Example: Foundational Phase

```bash
# Launch independent Foundational tasks together (different files):
Task: "Define benchmark model types in src/app/benchmark/models/benchmark.models.ts"          # T004
Task: "Create VECTOR_STORE_DB_NAME InjectionToken in src/app/benchmark/models/vector-store-db-name.token.ts"  # T005
Task: "Add optional chunkSize parameter to PdfParser.parseFile in src/app/services/pdf-parser.ts"  # T012

# The vector-store.ts/similarity.ts chain must run sequentially (same files, and T006 needs T005):
Task: "Inject VECTOR_STORE_DB_NAME into VectorStore, update initialize() fallback"  # T006 (after T005)
Task: "Extract cosineSimilarity into SimilarityService"                            # T010 (after T006)
Task: "Add scorePercent()/verdict() to SimilarityService"                          # T011 (after T010)

# The llm-client.ts chain must run sequentially (same file):
Task: "Fix LlmClient.setModel bug"        # T007
Task: "Add LlmClient.unloadModel()"       # T008 (after T007)
Task: "Extend LlmClient.availableModels"  # T009 (after T008)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: confirm a run can be configured and executed end-to-end (inspect
   `BenchmarkRunnerService.runState$` results even without the table UI), AND confirm the chat's
   model/knowledge base are unaffected afterward (T036's isolation/restore assertions)
5. Demo if ready — this alone proves the riskiest technical unknowns (DI-scoped model swapping,
   isolated vector store, sequential execution, failure isolation, and safely sharing the
   singleton `LlmClient` with chat)

### Incremental Delivery

1. Setup + Foundational → shared infrastructure ready
2. Add User Story 1 → validate independently (MVP: runs produce correct results, chat unaffected)
3. Add User Story 2 → validate independently (results/metrics visible in the UI)
4. Add User Story 3 → validate independently (export works, gated on completion)
5. Polish (Phase 6) → quickstart validation, regression check, lint/build, styling

### Suggested MVP Scope

**User Story 1 alone** (Phases 1–3) is the suggested MVP: it proves the hardest parts (reusing
`RagEngine` across multiple sequentially-loaded models via DI-scoped instances, isolating
benchmark vector data from the chat's knowledge base via `VECTOR_STORE_DB_NAME`, safely sharing
the singleton `LlmClient` with the chat flow via snapshot/lock/restore, and computing similarity
against a user-supplied expected answer) even before any table/export UI exists.
