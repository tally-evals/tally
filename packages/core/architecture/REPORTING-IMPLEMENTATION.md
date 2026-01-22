---
title: Reporting & Run Artifacts — Implementation Checklist
status: in-progress
package: "@tally-evals/core"
---

This checklist tracks the work required to implement the canonical reporting/run-artifact spec in [`REPORTING.md`](./REPORTING.md).

## Guiding rules

- **No compatibility layers**: we migrate producers + consumers together.
- **Names as IDs**: `EvalName`/`MetricName` are string keys; no `evalId`/`metricId`.
- **Stored run is read-only tooling**: TUI/viewer read the stored artifact; tests should rely on SDK outputs + view helpers.
- **No heuristics for per-step mapping**: single-turn results must be explicitly indexed by `stepIndex`.

---

## Current state snapshot (as implemented)

- **Persisted format**: `TallyRunArtifact` (schemaVersioned) + Zod codec ✅
- **Store**: `RunRef` loads/saves `type === "tally"` as `TallyRunArtifact` ✅
- **Producer**:
  - `executePipeline(...)` still emits **legacy intermediate maps** (`rawMetrics/derivedScores/verdicts/evalSummaries`).
  - `TallyContainer.run()` currently converts those into a `TallyRunArtifact` (including `defs`, `result.singleTurn.byStepIndex`, `outcome`, and `summaries`).
- **Consumers**: CLI + Viewer read/render `TallyRunArtifact` ✅
- **Tests**: examples use `createTargetRunView(artifact)` for verdict assertions ✅

This checklist below is updated to reflect that reality and the remaining work needed to align the SDK surface with the spec (`tally.run()` returning a Report rather than the persisted Artifact).

---

## Phase 0 — Spec alignment (docs only)

- [x] Convert `REPORTING.md` from proposal → **spec** (frontmatter + wording)
- [x] Flatten `Measurement` (no nested `raw`)
- [x] DX-first summary lookup (`summaries.byEval`)
- [x] Naming conventions section (defs vs results vs artifacts; stepIndex; avoid “target”)

---

## Phase 1 — Core: introduce `TallyRunArtifact` and codec; switch store to load/save it

### 1.1 Core types

- [x] Add `packages/core/src/types/runArtifact.ts` defining:
  - `Verdict`, `Score` (reuse primitives), `MetricScalar` (reuse primitives)
  - `Measurement`, `VerdictPolicyInfo`, `EvalOutcome`
  - `MetricDefSnap`, `EvalDefSnap`, `RunDefs`
  - `StepEvalResult`, `ConversationEvalResult`
  - `SingleTurnEvalSeries`, `ConversationResult`
  - `Aggregations`, `VerdictSummary`, `EvalSummarySnap`, `Summaries`
  - `TallyRunArtifact` (schemaVersioned)
- [x] Export from `packages/core/src/types/index.ts`
- [x] Export from `packages/core/src/index.ts`

### 1.2 Core codec

- [x] Add `packages/core/src/codecs/runArtifact.ts`:
  - `encodeRunArtifact(artifact: TallyRunArtifact): string`
  - `decodeRunArtifact(content: string): TallyRunArtifact`
  - Use **plain objects** (no `Map` fields in the persisted schema)
  - Date fields as **ISO strings**
- [x] Export from `packages/core/src/codecs/index.ts`

### 1.3 Store integration

- [x] Update `packages/core/src/store/RunRef.ts`:
  - `type === "tally"` loads/saves `TallyRunArtifact` via new codec
  - keep `type === "trajectory"` unchanged (`TrajectoryRunMeta`)

### 1.4 Core tests & fixtures

- [x] Update `packages/core/test/unit/codecs.test.ts` for the new codec roundtrip
- [x] Update `packages/core/test/unit/store.test.ts` to load/save `TallyRunArtifact`
- [x] Replace/regen any `sample-run.json` fixture that assumed `EvaluationReport`

---

## Phase 2 — Producer: Tally pipeline emits `TallyRunArtifact`

### 2.1 Step-index propagation (required)

- [x] Implement `stepIndex`-addressable single-turn series in the produced run result:
  - [x] `result.singleTurn[eval].byStepIndex[stepIndex] = StepEvalResult | null`
  - [ ] **Follow-up**: remove any remaining “same ordering” assumptions when mapping raw metric arrays → `stepIndex` (ensure mapping is truly step-indexed, not position-indexed).

### 2.2 Build `defs`

- [x] Snap metric defs → `MetricDefSnap` (stored once)
- [x] Snap eval defs → `EvalDefSnap` (stored once; includes `kind`, `outputShape`, `metric`, `verdict`)

### 2.3 Build `result` (conversation-scoped)

- [x] Replace `perTargetResults[]` with `ConversationResult`:
  - [x] `singleTurn[eval].byStepIndex[stepIndex] = StepEvalResult | null`
  - [x] `multiTurn[eval] = ConversationEvalResult`
  - [x] `scorers[eval]` explicit `shape` union
- [x] Remove `derivedMetrics` flattening entirely

### 2.4 Outcomes

- [x] Convert verdict computation output to `EvalOutcome` (policy info included)
- [x] Attach outcomes at the same granularity as the measurement (step vs conversation)

### 2.5 Summaries

- [x] Produce `summaries.byEval[eval] = EvalSummarySnap`
- [x] Ensure single-turn includes `verdictSummary`; multi-turn/scorers may omit

### 2.6 SDK return surface

- [x] **Interim (implemented)**: `tally.run()` returns `TallyRunArtifact`
- [ ] **Align with spec (required)**: change SDK to return a `TallyRunReport` and keep `TallyRunArtifact` as the persisted/tooling format.

---

## Phase 3 — SDK/test DX: implement `TargetRunView`

- [x] Add `createTargetRunView(artifact)` (no `conversationId` argument):
  - [x] `step(stepIndex, eval)`
  - [x] `conversation(eval)`
  - [x] `stepVerdict(stepIndex, eval)`
  - [x] `conversationVerdict(eval)`
  - [x] `evalDef(eval)`
  - [x] `metricDefForEval(eval)`
- [ ] **Align with spec**: expose the view from the SDK Report surface:
  - [ ] `report.view()` (preferred) or `createTargetRunView(report)` that accepts a `TallyRunReport`
  - [ ] Add typed variant `createTargetRunViewFor(report, evalRegistry, ...)`
- [x] Update example tests to use the view API

---

## Phase 4.5 — SDK surface alignment: introduce `TallyRunReport` (spec-required)

Goal: `tally.run()` returns an ergonomic Report for tests/user code, and artifacts remain a persisted, schema-stable format for read-only tooling.

- [ ] Add `TallyRunReport` type in `@tally-evals/core` (or `@tally-evals/tally` if we want to keep “SDK runtime helpers” out of core):
  - [ ] `runId`, `createdAt` (runtime `Date` allowed)
  - [ ] `defs`, `result`, `summaries`
  - [ ] `toArtifact(): TallyRunArtifact`
  - [ ] `view(): TargetRunView`
- [ ] Update `TallyContainer.run()` to return `TallyRunReport` (not `TallyRunArtifact`)
- [ ] Update example harness + tests:
  - [ ] Persist via `report.toArtifact()` when writing to `RunRef`/store
  - [ ] Use `report.view()` for assertions (instead of `createTargetRunView(artifact)`), if we adopt that shape
- [ ] Confirm CLI + Viewer continue to consume artifacts only (no change in behavior)

---

## Phase 4 — Read-only tooling migration (CLI + Viewer)

### 4.1 CLI

- [x] Replace all `EvaluationReport` assumptions in:
  - [x] `packages/cli/src/components/BrowseView.tsx`
  - [x] `packages/cli/src/components/TurnByTurnView.tsx` (remove per-step heuristics)
  - [x] `packages/cli/src/components/SummaryView.tsx`
  - [x] `packages/cli/src/components/CompareView.tsx`

### 4.2 Viewer

- [x] Update viewer run loading/types to `TallyRunArtifact`
- [x] Replace `buildPerStepMetrics` heuristics with `singleTurn[eval].byStepIndex`
- [x] Render summaries from `summaries.byEval`

---

## Phase 5 — Remove old report schema (cleanup)

- [x] Remove/stop using:
  - [x] `packages/core/src/types/report.ts` (`EvaluationReport`)
  - [x] `packages/core/src/codecs/report.ts`
  - [x] `packages/tally/src/utils/reportFormatter.ts` (rewritten to consume `TallyRunArtifact`)
  - [x] Docs/examples that reference `perTargetResults/derivedMetrics/evalSummaries` old shape

---

## Validation checklist (must pass before merge)

- [x] Core codec: run artifact roundtrip passes
- [ ] Stored artifact contains **no duplicated defs per step**
- [ ] Single-turn results are **addressable by `stepIndex`** with `null` holes for skipped steps
- [x] CLI turn-by-turn view renders without heuristics
- [x] Viewer run page renders without heuristics
- [x] Example tests can assert `view.stepVerdict(...)` / `view.conversationVerdict(...)`

