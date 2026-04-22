# HRPO v4 Implementation Plan

## Goal

The system should optimize the **agent under evaluation**.

The system should:

1. Create an optimization job and attach an **evaluation policy** (see [Api-Interfaces.md](../APIs/Api-Interfaces.md): `evalWeights`, `requiredEvals`, thresholds).
2. Generate **one fixed trajectory set** at the start of the job, using trajectory definitions from **`@tally-evals/trajectories`** (HRPO does not redefine trajectories; it stores ids and links to the fixed set).
3. Keep that trajectory set **fixed** for the whole job; every candidate is judged on the **same** evaluation surface.
4. For **each** cycle, run the **current** candidate on that fixed set and produce **new** run instances (conversations) every time — runs are **candidate-specific**; trajectory ids repeat, `runId`s do not.
5. **Evaluate** those runs with **Tally** (`TallyRunArtifact` as the canonical record per run). The `evaluateCandidate` phase takes the **completed candidate execution batch** (per-trajectory outputs for that `candidateId`) and scores them; it does **not** replace trajectory definitions.
6. Build **`EvalSummaries`** as **structured evaluation evidence** (pass/fail, pass-rates, stats, concise failure text) — not a flat list of scores — and compute the job-level **`aggregatedPassRate`** from that evidence using **`evalWeights`** (see API).
7. Use failure analysis and prior **cycle output** to generate the **next** candidate (evidence carries forward; **execution** does not reuse prior candidates’ runs).
8. Stop when configured stopping criteria are met.
9. After the job stops, **select the final candidate** using the same **evaluation policy** (weights, required evals, aggregate), aligned with [Api-Interfaces.md](../APIs/Api-Interfaces.md).

## v4 Core Rule

Stated plainly:

`agent under evaluation → fixed trajectory set (from trajectories package) → new runs per candidate → Tally evaluation → EvalSummaries (evidence) + aggregated pass rate (policy) → stop check → next candidate from evidence → cycle outputs → final selection`

The optimizer does not optimize Tally.

The optimizer does not optimize the fixed trajectory set.

The optimizer uses the fixed trajectories with **fresh runs for every new candidate**, Tally outputs, cycle output, and optimizer hyper parameters to improve the **agent under evaluation**.

## Trajectories (fixed) vs runs (per candidate)

| What stays fixed across the job | What is new every candidate | What passes to the next cycle (evidence, not re-execution) |
|---------------------------------|-----------------------------|-----------------------------------------------------------|
| Trajectory set (ids + definitions from `@tally-evals/trajectories`) | Agent execution + `tally.run()` / new `TallyRunArtifact` per trajectory row | `cycleOutput`, `FailureAnalysis`, `EvalSummaries` from the **last** completed evaluation |

- The trajectories package provides the **test set**, not “candidate memory.” Cross-cycle memory is **stored cycle outputs and evaluation evidence**, not trajectory objects.
- Example: trajectories A and B fixed for the job; candidate 1 produces runs 1 and 2; candidate 2 on the **same** A and B produces **new** runs 3 and 4. **`CandidateEvaluation`** and **`CycleOutput.tallyArtifacts`** must reference **`candidateId` + `trajectoryId` + `runId`** for that candidate’s execution only.

## v4 Design Decisions

### 1. What is being optimized

* The optimizer evaluates the current version of the agent under evaluation.
* The optimizer reads **Tally outputs** and **structured `EvalSummaries`** for that agent.
* The optimizer analyzes failures for that agent.
* The optimizer generates the next candidate for that agent using **prior cycle evidence** (not by re-running old conversations as the “new” candidate).
* The optimizer evaluates each generated candidate on the **same fixed trajectory set**, with **new** runs each time.

The fixed trajectory set is **evaluation input** (definitions from `@tally-evals/trajectories`).

Tally is **evaluation machinery**.

The **evaluation policy** on the job (`evalWeights`, `requiredEvals`) is how HRPO **aggregates** and **ranks** — Tally does not read weights.

The **agent under evaluation** is the thing being optimized.

### 2. Optimization job-scoped data

* One optimization job generates **one** fixed trajectory set.
* That trajectory set does not change during the job.
* Every candidate is evaluated against **new** runs on the same trajectories, so score changes reflect **candidate** changes, not a different test set.

### 3. Source of truth

* Trajectory definitions come from **`@tally-evals/trajectories`**; the job stores the fixed set by reference.
* The agent produces **conversations** (runs) on those trajectories; each candidate gets **fresh** runs.
* Tally evaluates those conversations; **`TallyRunArtifact`** remains the canonical evaluation record per run.
* Any flattened optimizer rows are **derived views**, not the primary stored schema.

### 4. Evaluation granularity

Each trajectory execution produces one or more runs (conversations). Each run has multiple steps (turns).

Tally evaluates at three layers (all feed **EvalSummaries** and failure analysis):

1. **Step-level (single-turn)** — e.g. relevance, completeness; pass/fail per step where configured.
2. **Conversation-level (multi-turn)** — e.g. role adherence, goal completion.
3. **Scorer / summary outputs** — including `OverallQuality` as **one** scalar per conversation when that eval is in the suite.

`OverallQuality` is **one eval among others**; it is useful for narrative and (if weighted) in the same aggregate. **Optimization priority** in implementation follows **[Api-Interfaces.md](../APIs/Api-Interfaces.md)** — **weighted per-eval pass-rates and `requiredEvals`**, not a default rule that `OverallQuality` alone is the top scalar unless the job policy gives it the largest weight.

### 5. Candidate scoring and selection

* **`aggregatedPassRate`** (API) is the main **job-level** scalar for thresholds and comparison: computed from **per-eval** evidence using **`evalWeights`** on the optimization job’s **`EvaluationPolicy`**, as defined in [Api-Interfaces.md](../APIs/Api-Interfaces.md).
* **Primary levers:** per-eval pass rates (and related stats), **weighted** into `aggregatedPassRate`, plus **`requiredEvals`** for guardrails.
* **`OverallQuality`** contributes like any other weighted eval; do **not** special-case it above the policy unless **`evalWeights`** say so.
* **Final selection** uses the same policy surface (weights, required evals, aggregate) — see Phase 9 in the API; not “highest mean `OverallQuality`” unless the configured weights make that the effective rule.

### 6. EvalSummaries as structured evidence

* **`EvalSummaries`** are **structured evaluation evidence**: pass/fail, pass-rates, key statistics, and concise textual failure reasons (per [Api-Interfaces.md](../APIs/Api-Interfaces.md) shapes such as per-eval summaries and `ScopeOverview` / `ScopeIssue`).
* They feed **failure analysis**, **stop decisions**, and **next-candidate generation** — not a replacement for reading Tally, but the **roll-up** HRPO uses after `TallyRunArtifact` exists.
* One **cycle output** = one cycle snapshot: candidate ref, **this candidate’s** `tallyArtifacts` (run-scoped), eval snapshots, `aggregatedPassRate`, and ordering metadata.
* A new cycle output may reference **history** of prior cycle outputs for the LLM (optimizer behavior); the **next** candidate still runs **fresh** on the fixed trajectory set.

Rules:

* Prompts default to a single mutable block (`full-prompt`) where applicable.
* Each new candidate is derived from the **previous candidate + failure evidence**, not from reusing another candidate’s **run records** as the execution to score.

### 7. `evaluateCandidate` input (API alignment)

* Trajectory **definitions** are **not** the input to `evaluateCandidate` — they are fixed earlier. The input is the **completed candidate execution batch**: **`candidateId`** plus **per-trajectory run outputs** (conversations) ready for Tally. See [Api-Interfaces.md](../APIs/Api-Interfaces.md); the type name may be `Candidate<Trajectory>` or a clearer alias (e.g. completed run batch) if the API is updated.
* Flow: **run agent on fixed trajectories** → **then** `evaluateCandidate` / Tally on those **produced** runs.

### 8. Hyper parameters

Define optimizer hyper parameters explicitly (e.g. `temperature` for next-candidate generation). They are **not** the evaluation target; they apply when **generating** the next candidate, not inside Tally’s scoring config.

### 9. Metrics: Tally, HRPO, and weights

* **`@tally-evals/tally`** receives a single `evals` array at `createTally` time. Metrics can be defined in `@tally-evals/tally/metrics`, in HRPO code, or in a consumer; Tally does not “register” HRPO separately — **composition** passes all evals in one list.
* **`evalWeights` and `requiredEvals`** live on **`OptimizationJobConfig.evaluationPolicy`** ([Api-Interfaces.md](../APIs/Api-Interfaces.md)). Keys must match **eval `name` strings** in the suite. HRPO applies weights when computing `aggregatedPassRate` and in final selection; Tally does not read weights.

## Failure Summaries

Generate summaries from failed evals (and low-scoring areas) of the **agent under evaluation**, using the **evidence** in `EvalSummaries`:

### 1. Per-turn summary

* Aggregates failures across steps; incorrect responses, missing information, weak answers.

### 2. Conversation-level summary

* Aggregates failures across full runs; inconsistency, coherence, role adherence.

These inform **which prompt blocks** to edit next. Ordering should follow **policy-relevant** failures (not OQ-only unless that is where failures cluster).

## Stopping criteria

* Maximum cycles `k` reached.
* **Target threshold** on the **job-level** `aggregatedPassRate` and/or **acceptance** conditions in [Api-Interfaces.md](../APIs/Api-Interfaces.md).
* **All evals passing** (per `EvalSummaries` / required policy).
* **No useful mutations remain** (align HRPO `StopDecision` with this reason where the base API is extended for v4).

If stopping criteria are met, **skip** generating another candidate and proceed to **final selection**.

## API and package references

* Phase APIs and types: [Api-Interfaces.md](../APIs/Api-Interfaces.md).
* Implementation package: `HRPO/` workspace package in the monorepo, depending on `@tally-evals/tally` and `@tally-evals/trajectories`.
* Architecture diagram: [architecture-graph.svg](architecture-graph.svg) / [architecture-graph.md](architecture-graph.md) — interpret “OverallQuality plus weighted guardrails” as **what Tally emits**; **optimization decisions** follow **`EvaluationPolicy`** and weighted pass-rates as above.

## v4 Non-Goals

Do not add these in v4:

* multiple candidates per cycle
* complex statistical testing
* bucket-aware scoring semantics
