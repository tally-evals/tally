# HRPO v1 Refined Implementation Plan

## Goal
Implement HRPO as a new optimizer layer for this monorepo that:

1. Reuses `@tally-evals/trajectories` to generate or replay a fixed conversation corpus.
2. Reuses `@tally-evals/tally` to evaluate each conversation and produce canonical `TallyRunArtifact`s.
3. Iteratively mutates prompt blocks, re-evaluates on the same corpus, and accepts or rejects prompt candidates with explicit gates.

## Core Optimization Framing

- input unit = trajectories
- dataset = the runs inside those trajectories
- optimization target = where the LLM is failing inside those evaluated runs

In repo terms:
- a trajectory defines the scenario and produces conversation artifacts
- each run inside that trajectory becomes an evaluated unit once Tally produces a `TallyRunArtifact`
- HRPO should optimize against the failure patterns extracted from those evaluated runs, not against raw prompt text in isolation

## How HRPO Maps To This Repo

### `packages/trajectories`
- Produces the optimizer corpus.
- `runTrajectory()` persists:
  - `conversation.jsonl`
  - `stepTraces.json`
  - `trajectory.meta.json`
- The conversation artifacts are the ground-truth replay surface for HRPO.

### `packages/tally`
- Evaluates one conversation at a time.
- `createTally({ data: [conversation], evals }).run()` returns a `TallyRunArtifact`.
- The artifact already separates:
  - `result.singleTurn[eval].byStepIndex`
  - `result.multiTurn[eval]`
  - `result.scorers[eval]`
  - `result.summaries.byEval`
- HRPO should treat this artifact as the canonical evaluation record, then build a derived optimizer view on top.

### Actual HRPO Unit Of Work
One HRPO candidate is not one Tally run.

It is:
- one prompt candidate
- evaluated across a fixed set of trajectories
- where the dataset is the set of runs inside those trajectories
- and each evaluated run produces one Tally run artifact
- which are then aggregated into one candidate-level decision

## Critical Corrections To The Current Note

1. Do not make the flattened dataset the source of truth.
The source of truth should remain `conversation.jsonl` + `stepTraces.json` + `TallyRunArtifact`. HRPO can project them into flat rows for optimization, but the projection should be derived and reproducible.

2. Do not model the optimizer around a single run.
`Tally.run()` only emits one run artifact for one container. HRPO must aggregate many per-conversation Tally runs into one candidate evaluation set.

3. Preserve Tally's real scopes exactly.
Single-turn data is sparse `byStepIndex`. Multi-turn data is conversation-level. Scorers can be conversation-level or step-level. HRPO must not collapse these into one undifferentiated table without keeping `evalKind`, `scope`, and `stepIndex`.

4. Do not assume verdict thresholds are normalized scores.
In Tally, `computeVerdict()` uses the raw metric value for threshold/range verdicts, not the normalized score. Some app examples use raw 1-5 thresholds, while other tests use 0-1 thresholds. HRPO acceptance gates should use:
- normalized scores for optimization objectives
- verdict summaries for pass/fail guardrails

5. Freeze the corpus with hashes, not just ids.
Reusing the "same trajectories" must mean the same stored conversation artifacts, not merely the same trajectory names. Store content hashes for `conversation.jsonl`, `stepTraces.json`, and `trajectory.meta.json`.

6. The repo does not yet have a native checkpoint/candidate registry.
`TallyStore` manages conversations and runs, but not optimizer checkpoints. HRPO needs its own manifests for checkpoints, candidates, corpus membership, and acceptance decisions.

7. Trajectory execution metadata is not currently indexed as a normal run.
`runTrajectory()` persists conversation files directly, but it does not currently create `runs/trajectory/*.json` alongside them. The plan should not rely on `ConversationRef.listRuns()` as the sole source of trajectory execution history.

8. The prompt mutation target must be first-class.
The current note says "select mutable prompt blocks", but there is no schema yet for block ids, prompt templates, or parent-child lineage. HRPO needs a stable prompt block registry before mutation logic is implemented.

9. Acceptance cannot be "score went up".
You need non-regression gates on critical evals, minimum sample coverage, and deterministic run settings. Otherwise one noisy candidate can be incorrectly accepted.

10. Empty failure sets are valid and meaningful.
If a candidate has no failures, that should either terminate the loop, trigger exploration on low-scoring passes, or fall back to broader summary logic. It should not be treated as an exceptional state.

11. There is a real Tally schema mismatch to account for.
`buildConversationResult()` can emit step-shaped scorer results, but `buildRunDefs()` currently labels scorer evals as `outputShape: "scalar"`. HRPO should inspect `result.scorers[eval].shape` at runtime and not trust `defs.evals[eval].outputShape` for scorers until this is fixed upstream.

## Recommended v1 Architecture

Create a new package: `packages/hrpo`

Why:
- keeps optimizer logic separate from `tally` and `trajectories`
- lets HRPO depend on their public APIs and stored artifacts
- limits required changes in existing packages to small compatibility fixes

### Package Boundaries

- `packages/hrpo/src/corpus`
Loads fixed conversation corpus members and validates hashes.

- `packages/hrpo/src/projector`
Converts `TallyRunArtifact + conversation artifacts` into optimizer records.

- `packages/hrpo/src/failures`
Collects failed eval records, batches by scope and eval name, and attaches context.

- `packages/hrpo/src/reflection`
Builds per-batch summaries and a global reflection input.

- `packages/hrpo/src/prompts`
Manages prompt templates, block ids, block mutation requests, and lineage.

- `packages/hrpo/src/execution`
Runs candidate prompts across the fixed corpus and writes candidate manifests.

- `packages/hrpo/src/acceptance`
Computes candidate-level aggregates and applies accept/reject gates.

- `packages/hrpo/src/checkpoints`
Persists checkpoint manifests and active prompt state.

- `packages/hrpo/src/cli`
Commands like `init`, `run-iteration`, `replay-candidate`, `inspect-checkpoint`.

## Canonical Data Model

### 1. Corpus Manifest
Stores the frozen optimizer dataset.

```ts
type HrpoCorpusManifest = {
  corpusId: string
  createdAt: string
  members: Array<{
    conversationId: string
    appPath: string
    conversationHash: string
    stepTracesHash?: string
    trajectoryMetaHash?: string
    latestAcceptedRunId?: string
  }>
}
```

### 2. Prompt Template Manifest
Stores the mutable prompt source and block structure.

```ts
type PromptTemplateManifest = {
  templateId: string
  sourcePath: string
  promptHash: string
  blocks: Array<{
    blockId: string
    label: string
    mutable: boolean
    startMarker: string
    endMarker: string
  }>
}
```

### 3. Candidate Manifest

```ts
type HrpoCandidateManifest = {
  candidateId: string
  checkpointId: string
  parentPromptVersion: string
  generatedPromptVersion: string
  promptHash: string
  mutatedBlockIds: string[]
  corpusId: string
  conversationRunMap: Array<{
    conversationId: string
    tallyRunId: string
    appPath: string
  }>
  perRunSummaries: Array<{
    conversationId: string
    tallyRunId: string
    evalBreakdown: Record<string, {
      meanScore?: number
      passRate?: number
      failRate?: number
      count: number
    }>
  }>
  aggregates: {
    objectiveScore: number
    evalBreakdown: Record<string, {
      meanScore?: number
      passRate?: number
      failRate?: number
      count: number
    }>
  }
  decision?: {
    status: 'accepted' | 'rejected'
    reasons: string[]
  }
}
```

### 4. Checkpoint Manifest

```ts
type HrpoCheckpointManifest = {
  checkpointId: string
  baseCheckpointId?: string
  activePromptVersion: string
  activePromptHash: string
  corpusId: string
  acceptedCandidateId?: string
  rejectedCandidateIds: string[]
  objectiveBaseline: {
    objectiveScore: number
    criticalEvals: Record<string, {
      passRate?: number
      failRate?: number
      meanScore?: number
    }>
  }
}
```

## Optimizer Projection Shape

Build this from stored artifacts, not as the primary persisted schema:

```ts
type OptimizerRecord = {
  conversationId: string
  tallyRunId: string
  evalName: string
  evalKind: 'singleTurn' | 'multiTurn' | 'scorer'
  scope: 'step' | 'conversation'
  stepIndex: number | null
  score?: number
  rawValue?: number | boolean | string | null
  verdict?: 'pass' | 'fail' | 'unknown'
  reasoning?: string
  metricRef: string
}
```

Projection rules:
- single-turn evals: one row per non-null `byStepIndex` entry
- multi-turn evals: one conversation-level row
- scorers: inspect runtime `shape`; emit either step rows or one conversation row
- attach conversation context by joining to `conversation.jsonl` and optionally `stepTraces.json`

## Summary Model

HRPO should produce two distinct summary layers from the same projected records:

1. Per-run summary
- one summary per `conversationId` / `tallyRunId`
- captures what went wrong or right inside that specific run
- useful for localized reflection and preserving run-specific failure context

2. Cross-run summary
- the existing summary across all runs for a candidate
- groups failures by scope and eval name across the full frozen corpus
- useful for identifying systematic prompt problems

The reflection stage should consume both:
- per-run summaries to understand local failure patterns
- cross-run summaries to identify repeated failure modes worth mutating for

## Refined Execution Loop

### Phase 0: Pre-flight cleanup
Before implementing HRPO proper:

1. Fix or explicitly work around the scorer shape mismatch in Tally.
2. Add helper loaders for:
   - conversation artifact
   - latest tally run artifact for a conversation
   - corpus hashing
3. Decide the prompt source abstraction:
   - direct file template with markers
   - structured prompt JSON
   - prompt builder function with block ids

### Phase 1: Corpus freezing

1. Select the conversation ids that define the optimizer corpus.
2. Resolve them from the app-level `.tally` stores.
3. Hash stored artifacts.
4. Persist `HrpoCorpusManifest`.

This phase is mandatory because HRPO only makes sense if every candidate is evaluated on the exact same corpus.

### Phase 2: Baseline checkpoint creation

1. Load the active prompt template.
2. Run or load the baseline candidate over the frozen corpus.
3. Write checkpoint `0000` with:
   - active prompt version
   - prompt hash
   - corpus id
   - baseline aggregates

### Phase 3: Artifact projection and failure extraction

1. Load all candidate Tally artifacts.
2. Project them into `OptimizerRecord[]`.
3. Build per-run summaries for each `conversationId` / `tallyRunId`.
4. Split failures into:
   - single-turn failures
   - multi-turn failures
   - scorer failures if the scorer has a verdict
5. Batch by `evalName` within each scope across all runs.
6. Build cross-run summaries from those batches.
7. Join each record back to:
   - conversation step text
   - nearby step history
   - optional step trace metadata

This is the layer that should feed HRPO reflection, not the raw artifacts directly.

### Phase 4: Reflection

1. Read per-run summaries to identify run-local breakdowns and representative examples.
2. Read cross-run batch summaries to identify repeated failure patterns across the corpus.
3. Produce one global reflection across both summary layers.
4. Produce one mutation request that references explicit prompt block ids.

Important:
- if there are zero failures, run a separate "plateau" path instead of erroring
- do not mutate blocks that were not implicated by the summaries

### Phase 5: Prompt mutation

1. Load the parent prompt template.
2. Mutate only selected mutable blocks.
3. Write a new prompt version with lineage metadata:
   - parent version
   - changed blocks
   - mutation rationale
   - prompt hash

### Phase 6: Candidate execution

1. Re-run the exact same corpus with the new prompt.
2. Use the same evaluation config and model options.
3. Persist one Tally run artifact per conversation.
4. Write the candidate manifest with conversation-to-run mapping.

Strong recommendation:
- support `n > 1` repeated executions per conversation when the agent or evaluator is materially stochastic
- aggregate repeats before accept/reject if variance is non-trivial

### Phase 7: Acceptance

Use two layers:

1. Objective metric
- weighted candidate score across selected eval summaries

2. Guardrails
- no regression beyond tolerance on critical eval pass rate
- no increase beyond tolerance in critical eval fail rate
- no missing corpus members
- no schema/hash drift

Example acceptance rule:

```ts
accept if:
  candidate.objectiveScore >= baseline.objectiveScore + minDelta
  and every critical eval failRate <= baseline.failRate + tolerance
  and every required conversation completed evaluation
```

Do not accept purely on mean score if verdict guardrails regress.

### Phase 8: Checkpoint transition

If accepted:
- checkpoint N+1 points to the candidate prompt
- baseline becomes candidate aggregates

If rejected:
- checkpoint N+1 keeps the previous prompt
- candidate is still persisted for auditability

## Concrete Shortcomings In The Original Note

The current note is directionally good, but these are the missing pieces that matter most:

- It does not distinguish clearly between conversation artifacts, Tally run artifacts, and optimizer-level aggregates.
- It does not explicitly model the two summary layers HRPO needs: per-run summaries and cross-run summaries.
- It does not specify how prompt blocks are identified and versioned.
- It assumes flattening is a data model, when it should be a derived view.
- It does not account for Tally verdict semantics being raw-value based.
- It does not define acceptance tolerances or critical non-regression rules.
- It does not freeze the evaluation corpus with hashes.
- It does not address scorer runtime shape ambiguity.
- It does not explain where checkpoint and candidate manifests live.
- It does not handle stochastic reruns or repeated trials.
- It does not state what happens when there are no failures but quality is still improvable.

## Minimal v1 Scope

To keep v1 implementable, ship this subset first:

1. New `packages/hrpo` package.
2. Frozen corpus manifest from existing `.tally` conversations.
3. Projection layer from `TallyRunArtifact` to optimizer records.
4. Failure batching for:
   - single-turn
   - multi-turn
5. Prompt block registry with manual markers.
6. One candidate per iteration.
7. Deterministic accept/reject gates.
8. Checkpoint and candidate manifests.

Do not include in v1:
- branchy search over multiple candidates per iteration
- online trajectory generation during optimization
- automatic prompt block discovery
- statistical significance testing beyond simple tolerance thresholds
- distributed execution

## Recommended File Layout

```text
packages/hrpo/
  src/
    corpus/
    projector/
    failures/
    reflection/
    prompts/
    execution/
    acceptance/
    checkpoints/
    cli/
HRPO/
  v-1/
    refined-implementation-plan.md
```

## Implementation Order

1. Add `packages/hrpo` with pure readers/projectors over existing Tally artifacts.
2. Add corpus manifest + hashing.
3. Add checkpoint/candidate manifests.
4. Add failure extraction + summarization inputs.
5. Add prompt block registry and mutation plumbing.
6. Add candidate execution loop over frozen corpus.
7. Add acceptance gates.
8. Patch small upstream gaps in `tally` or `core` only where required.

## First Upstream Changes I Would Make

1. In `packages/tally`, fix scorer `outputShape` metadata or add explicit runtime shape metadata to `defs`.
2. In `packages/core`, add helper utilities to load:
   - latest tally run for a conversation
   - conversation artifact bundle
   - hash bundle for corpus freezing
3. Optionally in `packages/trajectories`, persist trajectory execution metadata into `runs/trajectory` for symmetry and auditability.

## Bottom Line

The right HRPO design for this repo is:

- corpus-first
- artifact-native
- prompt-lineage aware
- acceptance-gated
- implemented as a new package that consumes `trajectories` and `tally`

The biggest change from the original note is that HRPO should sit above existing Tally artifacts, not replace their schema with a new primary dataset model.
