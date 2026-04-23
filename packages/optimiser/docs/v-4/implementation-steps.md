# HRPO v4 — Step-by-step implementation guide

This guide breaks the work into **small, verifiable steps** so you do not have to implement everything at once. For product requirements, see [implementation-plan.md](implementation-plan.md) and [Api-Interfaces.md](../APIs/Api-Interfaces.md).

**Principle:** after each step, you should be able to `bun run build` / `bun test` (or your package scripts) and have a stable checkpoint.

---

## Phase 0 — Monorepo shell

**Goal:** `HRPO/` is a workspace package that builds and depends on Tally + trajectories.

1. Add `"HRPO"` to the root `package.json` `workspaces` array (alongside `packages/*`, etc.).
2. Create `HRPO/package.json` with:
   - `name` (e.g. `@tally-evals/hrpo` or `hrpo` — match your naming),
   - `workspace:*` deps on `@tally-evals/tally` and `@tally-evals/trajectories`,
   - scripts: `build`, `test`, `lint` aligned with the repo (Biome, TypeScript, tsdown or `tsc`).
3. Add `HRPO/tsconfig.json` extending the shared package config (see `packages/tally` or `packages/typescript-config`).
4. **Checkpoint:** from repo root, `bun run build --filter=<your-hrpo-package-name>` (or `cd HRPO && bun run build`) succeeds; package exports a stub `src/index.ts` if needed.

---

## Phase 1 — Types only (no business logic)

**Goal:** TypeScript types match [Api-Interfaces.md](../APIs/Api-Interfaces.md) and v4 decisions, without full behavior.

1. Add `HRPO/src/types.ts` (or split files if you prefer) and transcribe from the API doc:
   - `OptimizationJobConfig`, `EvaluationPolicy`, `OptimizationJob`
   - `TrajectorySet` / `CreateTrajectorySetInput` as needed
   - `EvalSummaries` / `ScopeOverview` / `ScopeIssue` (and `EvalSummary` as aligned with `@tally-evals/tally` re-exports, or a thin HRPO view type that adds **per-eval outcome counts** — see Phase 3)
   - `CandidateEvaluation`, `CycleOutput`, `FailureAnalysis`, `StopConditionInput` / `StopDecision` — **include** `reason: "noUsefulMutations"` if you extend the API union
   - A single type for **completed candidate execution** (whatever you name it: e.g. `CompletedCandidateRunBatch` or document `Candidate<Trajectory>` as the execution batch)
2. Re-export Tally types you need (`TallyRunArtifact`, `Eval` from tallly) to avoid duplicating the engine.
3. **Checkpoint:** `tsc` / build passes; no runtime code required yet.

**Optional in this phase:** a short `src/validatePolicy.ts` that checks `evalWeights` keys are subset of a provided eval name list (pure function, easy to unit test later).

---

## Phase 2 — In-memory store

**Goal:** one place to hold jobs, fixed trajectory set per job, candidate prompts, run refs, and cycle outputs.

1. Define minimal interfaces, e.g. `OptimizationJobStore` with:
   - create/get job, attach **one** trajectory set per job (reject a second)
   - register `candidateId`, store `CandidatePrompt` / metadata
   - store `CandidateEvaluation` and `CycleOutput` keyed by job + `candidateId` / `cycleOutputId`
   - index **artifact refs** by `candidateId` + `trajectoryId` + `runId` (never conflate two candidates for the same trajectory)
2. Implement an **in-memory** version only (`Map`s or plain objects). Persistence can be a later phase.
3. **Checkpoint:** unit tests that create a job, attach trajectories, store two mock candidates, assert their run ids and artifact rows do not collide.

---

## Phase 3 — Tally bridge (evidence + aggregate)

**Goal:** one module that turns `TallyRunArtifact` / reports into `EvalSummaries` and `aggregatedPassRate`. **Primary evidence** is **per-eval interpretability**: pass/fail *counts* and derived pass rates, not only a single scalar. `aggregatedPassRate` remains the job-level optimization number (thresholds, ranking, stop logic) but should **not** be the only thing surfaced in summaries. Nothing else in HRPO re-parses raw artifacts for routine logic.

**Mental model**

- **Raw Tally output** — verdicts / results per run (and across steps where applicable).
- **HRPO bridge** — converts that into **per-eval evidence**: `passedCount`, `failedCount`, `totalCount`, derived `passRate`, failing trajectories / issues, and concise **summary** text (e.g. “failed mainly on two short-answer cases”).
- **aggregatedPassRate** — computed **from** that evidence (weighted by **`evalWeights`**, which the **user** sets on the job’s **`EvaluationPolicy`**). Weights are **not** equal by default: **higher-weighted** evals move the aggregate and **ranking/selection** more than **lower-weighted** evals, so the user can mark some criteria (e.g. safety) as **more necessary** than others. The aggregate is **secondary** for *display* (users still read per-eval counts) but **primary** for *weighted policy* (thresholds, compare candidates, final pick).

`buildEvalSummariesFromArtifact` and **candidate-level pooling** must preserve **per-eval outcome counts** (`passedCount`, `failedCount`, `totalCount`, and derived `passRate`) so HRPO can show eval-level lines such as *“relevance: 8 pass, 2 fail, 80%”* instead of only a single aggregated candidate score. A pass-rate alone (e.g. `0.8`) is ambiguous (8/10 vs 80/100 vs 4/5); counts make the evidence legible.

**Type design**

- Tally’s **`EvalSummary`** (from `@tally-evals/tally` / core) already includes **`verdictSummary`** with **`passCount`**, **`failCount`**, **`totalCount`**, and rates—treat that as first-class evidence in the bridge; only introduce a separate wrapper (e.g. `HrpoEvalEvidence`) if you need fields Tally does not provide.
- Prefer those fields (or the scope record value) over pass-rate-only views; the bridge should **preserve** counts when mapping and pooling.
- If Tally’s summary is pass-rate–only, introduce a **richer HRPO view** that wraps or extends it, e.g.:

  ```ts
  type HrpoEvalEvidence = {
    summary: EvalSummary; // or minimal Tally-aligned fields
    passedCount: number;
    failedCount: number;
    totalCount: number;
    passRate: number; // derived from the three counts
    reason?: string;
  };
  // e.g. singleTurn: Record<string, HrpoEvalEvidence>
  ```

  so each eval remains **8 pass / 2 fail / 80%** plus optional narrative, not only `{ passRate: 0.8 }`.

1. Implement `buildEvalSummariesFromArtifact` (or from `TallyRunReport` after `tally.run()`):
   - Start from **one** conversation’s artifact; map Tally `summaries` / verdicts into your `EvalSummaries` shape **while preserving per-eval pass/fail counts and derived pass rates** (and summary / reason text when available).
2. Implement **pooling** across multiple trajectories for one candidate: merge per-trajectory evidence by **accumulating** per-eval `passedCount` / `failedCount` (hence `totalCount`), then set `passRate = passedCount / totalCount` (or document edge cases for empty totals). **Do not** average precomputed pass rates without counts unless you have no other option — that loses interpretability. Optionally merge overview / issue text (e.g. concatenation or de-duplication). `aggregatedPassRate` is still computed from the **merged** eval evidence using `evalWeights`; it remains a **derived** scalar, not a substitute for the per-eval breakdown.
3. Implement `computeAggregatedPassRate(evalSummaries, evaluationPolicy)` per API: apply **`evalWeights`** exactly as in [Api-Interfaces.md](../APIs/Api-Interfaces.md) (normalized / combined with `requiredEvals` per API). **After** the rich per-eval evidence exists, this function is what makes **user-assigned** importance show up in a single number for ordering candidates.
4. **Checkpoint:** unit tests with **fixed JSON fixtures** of minimal artifacts (or mocked summaries) that assert **non-trivial** `passedCount` / `failedCount` for at least one eval *and* a correct pooled merge — no LLM, no real agent.

---

## Phase 4 — One vertical slice: `evaluateCandidate` only

**Goal:** given a **mock** completed execution batch (conversations you build by hand or from fixtures), return a valid `CandidateEvaluation`.

1. Wire `createTally({ data: [conversation], evals })` with a **small, fixed** `evals` list (from `@tally-evals/tally` tests or README patterns).
2. For each conversation in the batch, `await tally.run()`, collect artifacts, then call Phase 3 builders.
3. Expose a single function `evaluateCandidate(input)` that uses the store (or accept artifacts injected for tests).
4. **Checkpoint:** integration-style test: 2 mock conversations, 2 artifacts, one `CandidateEvaluation` with `aggregatedPassRate`, non-empty `evalSummaries`, and **verifiable per-eval counts** after pooling (not only pass rates).

---

## Phase 5 — Remaining “pure” phase functions (thin)

Implement in **dependency order**; each can be a few lines that delegate to store + helpers:

| Order | Function | Notes |
|-------|----------|--------|
| 1 | `createOptimizationJob` | validate policy keys against eval name list *when* eval suite is known (see below) |
| 2 | `createTrajectorySet` | one set per job |
| 3 | `createCycleOutput` | persist from `CandidateEvaluation` + prompt + artifact paths |
| 4 | `analyzeFailures` | read `cycleOutput.evalSummaries` → `FailureAnalysis` (deterministic at first) |
| 5 | `evaluateStopCondition` | pure function of cycle, `maxCycles`, `cycleOutput`, threshold |
| 6 | `selectFinalCandidate` | compare `cycleOutputs` with policy: **`evalWeights`** prefer candidates that score better on **high-weight** evals (via `aggregatedPassRate` and rules in API), plus **`requiredEvals`** |

**Checkpoint:** each function has 1–2 unit tests; no full loop yet.

**Note:** `createOptimizationJob` may not know eval names until you add an **eval suite** parameter or a `registerEvalSuiteForJob` step — that is fine; add the validation at the first point both job config and `evals` are available.

---

## Phase 6 — `createCandidatePrompt` (stub, then real)

**Goal:** next prompt from evidence, without blocking on a perfect LLM.

1. **Stub:** return a copy of the previous prompt with a suffix or hash bump so the loop is testable.
2. **Real:** inject `generateText` (e.g. from `ai`) and pass `cycleOutput` + `FailureAnalysis` in the prompt template.
3. **Checkpoint:** test with stub; optional e2e with real API behind env.

---

## Phase 7 — Orchestration loop (end-to-end)

**Goal:** `runOptimizationJob` (or equivalent) that strings phases together.

1. **Without** a real agent first: for each “candidate,” build **synthetic** conversations per trajectory (same text or deterministic mock) so every cycle produces new `runId`s but predictable content.
2. Flow: `createOptimizationJob` → `createTrajectorySet` → for each cycle: build execution batch (mock) → `evaluateCandidate` → `createCycleOutput` → `analyzeFailures` → `evaluateStopCondition` → if continue → `createCandidatePrompt` (stub) → next candidate id → repeat; else `selectFinalCandidate`.
3. **Then** replace the mock batch builder with: `createCandidateAgent` + injected `runTrajectoryWithCandidate` that returns real `Conversation` objects.
4. **Checkpoint:** test runs N cycles, asserts **4 distinct `runId`s** for 2 trajectories × 2 candidates, and final selection picks an id.

---

## Phase 8 — Hardening

- Expand `buildEvalSummaries` overview strings (still grounded in **per-eval counts**, not only rates) and `FailureAnalysis.targetBlocks` if still minimal.
- Add integration test with **one** real LLM eval behind env if you have API keys.
- Document public exports in `HRPO/src/index.ts` and align [Api-Interfaces.md](../APIs/Api-Interfaces.md) (rename `Candidate` to execution batch, etc.) as you stabilize names.

---

## Suggested “stop lines” (when to pause)

| Stop after… | You have |
|-------------|----------|
| Phase 0–1 | Types + build |
| Phase 2–3 | Store + Tally evidence pipeline |
| Phase 4 | `evaluateCandidate` real against Tally |
| Phase 5 | All phase APIs callable in isolation |
| Phase 6 | Optimizer can change prompts |
| Phase 7 | Full loop with mock or real agent |
| Phase 8 | Release-ready package |

---

## What to defer

- Database / filesystem persistence of artifacts (use in-memory or temp paths in `tallyArtifacts[].artifactPath` first).
- Multiple trajectory sources beyond what `@tally-evals/trajectories` already gives you.
- Parallel evaluation of many trajectories (sequential is fine for v1).

This order keeps **Tally and evidence** correct early, and adds **orchestration and LLM** only when the data model is stable.
