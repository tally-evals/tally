# Session API Reference

Reference for the session lifecycle APIs, core contract types, evaluation summaries, and decision objects used by the optimizer.

The Session API exposes a small set of lifecycle entities and transition points:

- `Session`: top-level optimization lifecycle.
- `TrajectorySet`: immutable trajectory membership for a session.
- `CandidateVersion`: one generated candidate snapshot.
- `CandidateRun<Trajectory>`: one execution batch of a candidate over trajectories.
- `CandidateRunEvaluation`: optimizer-facing evaluation output derived from Tally results.
- `Checkpoint`: durable optimizer state captured after evaluation.
- `FailureAnalysis`: actionable failure evidence used to guide the next candidate.
- `AcceptanceDecision`: explicit accept/reject result between checkpoints.
- `StopDecision`: loop-control decision for ending the session.

---

## Lifecycle APIs

The optimizer workflow is built from the following API calls:

```ts
createSession(config: SessionConfig): Promise<Session>

createTrajectorySet<Trajectory>(
  sessionId: string,
  trajectories: readonly Trajectory[]
): Promise<TrajectorySet>

createCandidateVersion(
  input: CreateCandidateVersionInput
): Promise<CandidateVersion>

createCandidateRun<Trajectory>(
  input: CreateCandidateRunInput
): Promise<CandidateRun<Trajectory>>

evaluateCandidateRun<Trajectory>(
  input: EvaluateCandidateRunInput<Trajectory>
): Promise<CandidateRunEvaluation>

createCheckpoint(
  sessionId: string,
  candidate: CandidateVersion,
  evaluation: CandidateRunEvaluation
): Promise<Checkpoint>

analyzeFailures(
  input: AnalyzeCheckpointFailuresInput
): Promise<FailureAnalysis>

evaluateAcceptance(
  previous: Checkpoint,
  current: Checkpoint,
  options?: AcceptanceOptions
): Promise<AcceptanceDecision>

evaluateStopCondition(input: StopConditionInput): StopDecision
```

---

## Core Configuration And Entities

### `SessionConfig`

Configuration used to create a session.

```ts
type SessionConfig = {
  maxIterations: number;
  acceptanceThreshold?: number;
};
```

`maxIterations: number`

Hard upper bound on optimization iterations for the session.

`acceptanceThreshold?: number`

Optional pass-rate target that allows early stopping once reached.

---

### `Session`

Top-level optimization lifecycle object.

```ts
type Session = {
  sessionId: string;
  config: SessionConfig;
  createdAt: string;
};
```

`sessionId: string`

System-generated identifier for the session.

`config: SessionConfig`

Immutable copy of the configuration that governs the full session.

`createdAt: string`

Creation timestamp for ordering and auditing.

---

### `CreateTrajectorySetInput<Trajectory>`

Input contract for creating a trajectory set.

```ts
type CreateTrajectorySetInput<Trajectory> = {
  sessionId: string;
  trajectories: readonly Trajectory[];
};
```

`sessionId: string`

Owning session for the trajectory set.

`trajectories: readonly Trajectory[]`

Trajectories that will be used consistently across candidate comparisons.

---

### `TrajectorySet`

Records the trajectories selected for a session without duplicating the full payload in the returned contract.

```ts
type TrajectorySet = {
  trajectoryIds: string[];
  createdAt: string;
};
```

`trajectoryIds: string[]`

Identifiers for the trajectories included in the set.

`createdAt: string`

Creation timestamp for the set.

---

### `CreateCandidateVersionInput`

Input contract for generating the next candidate version.

```ts
type CreateCandidateVersionInput = {
  checkpoint: Checkpoint;
  analysis: FailureAnalysis;
};
```

`checkpoint: Checkpoint`

Current saved optimizer state that anchors candidate generation.

`analysis: FailureAnalysis`

Structured failure evidence describing what should improve next.

---

### `CandidateVersion`

One generated candidate snapshot.

```ts
type CandidateVersion = {
  candidateId: string;
  createdAt: string;
};
```

`candidateId: string`

Unique identifier for the generated candidate instance.

`createdAt: string`

Creation timestamp used for ordering candidate versions.

---

### `CreateCandidateRunInput`

Input contract for executing a candidate against the session trajectories.

```ts
type CreateCandidateRunInput = {
  sessionId: string;
  candidate: CandidateVersion;
};
```

`sessionId: string`

Session scope used to locate the correct trajectories and rules.

`candidate: CandidateVersion`

Candidate version to execute.

---

### `CandidateRun<Trajectory>`

Represents one execution batch of a candidate over the selected trajectories.

```ts
type CandidateRun<Trajectory> = {
  sessionId: string;
  candidateId: string;
  trajectories: readonly Trajectory[];
  startedAt: string;
  completedAt?: string;
};
```

`sessionId: string`

Owning session for the run.

`candidateId: string`

Identifier of the exact candidate that was executed.

`trajectories: readonly Trajectory[]`

Concrete trajectories executed in this run.

`startedAt: string`

Execution start timestamp.

`completedAt?: string`

Optional completion timestamp once the run finishes.

---

// view.summary() : From the Tally model, view.summary() returns summaries keyed by eval name

## Evaluation Contracts

### `ScopeIssue<EvalName>`

One issue extracted from a per-eval summary when building a scope-level overview.

```ts
type ScopeIssue<EvalName extends string = string> = {
  eval: EvalName;
  reason: string;
  passRate?: number;
};
```

`eval: EvalName`

Eval name that produced the issue.

`reason: string`

Human-readable explanation of what needs attention for that eval.

`passRate?: number`

Optional pass rate copied from the eval summary when relevant.

---

### `ScopeOverview<EvalName>`

Rolled-up view across all summaries in one scope.

```ts
type ScopeOverview<EvalName extends string = string> = {
  summary: string;
  issues: ScopeIssue<EvalName>[];
  failingEvals: EvalName[];
  passingEvals: EvalName[];
};
```

`summary: string`

Single synthesized summary describing the overall health of the scope.

`issues: ScopeIssue<EvalName>[]`

Collected issues extracted from the scope's per-eval summaries.

`failingEvals: EvalName[]`

Eval names that are currently failing or below the desired threshold.

`passingEvals: EvalName[]`

Eval names that are currently healthy within that scope.

---

### `EvalSummaries<SingleTurnEvalName, MultiTurnEvalName>`

Two-layer evaluation summary surface used by optimizer-facing APIs.

```ts
type EvalSummaries<
  SingleTurnEvalName extends string = string,
  MultiTurnEvalName extends string = string
> = {
  singleTurn: Record<SingleTurnEvalName, EvalSummary>;
  multiTurn: Record<MultiTurnEvalName, EvalSummary>;
  singleTurnOverview: ScopeOverview<SingleTurnEvalName>;
  multiTurnOverview: ScopeOverview<MultiTurnEvalName>;
};
```

`singleTurn: Record<SingleTurnEvalName, EvalSummary>`

Per-eval summaries for step-level evaluations. Each entry corresponds to one eval, like the summary panel shown for a specific eval in the UI.

`multiTurn: Record<MultiTurnEvalName, EvalSummary>`

Per-eval summaries for conversation-level evaluations.

`singleTurnOverview: ScopeOverview<SingleTurnEvalName>`

Derived rolled-up summary across all single-turn eval summaries, highlighting the main issues for that scope.

`multiTurnOverview: ScopeOverview<MultiTurnEvalName>`

Derived rolled-up summary across all multi-turn eval summaries, highlighting the main issues for that scope.

---

### `EvaluateCandidateRunInput<Trajectory>`

Input contract for scoring a completed candidate run.

```ts
type EvaluateCandidateRunInput<Trajectory> = {
  run: CandidateRun<Trajectory>;
};
```

`run: CandidateRun<Trajectory>`

Completed execution batch being evaluated.

---

### `CandidateRunEvaluation`

Optimizer-facing evaluation object derived from Tally report data.

```ts
type CandidateRunEvaluation = {
  sessionId: string;
  candidateId: string;
  evalSummaries: EvalSummaries;
  aggregatedPassRate: number;
};
```

`sessionId: string`

Session scope used for consistency checks.

`candidateId: string`

Candidate identifier for the evaluated run.

`evalSummaries: EvalSummaries`

Primary comparison surface containing both per-eval summaries and rolled-up scope overviews.

`aggregatedPassRate: number`

Top-level session score used for optimization decisions.

Notes:

- Evaluation should be derived from Tally reports via `report.view()`.
- `singleTurn` and `multiTurn` keep the original per-eval summaries.
- `singleTurnOverview` and `multiTurnOverview` are derived layers built from those per-eval summaries.
- `evalSummaries` is the main comparison surface, not low-level step outputs.

---

## Checkpoint And Analysis Types

### `CreateCheckpointInput`

Input contract for storing a durable optimizer checkpoint.

```ts
type CreateCheckpointInput = {
  sessionId: string;
  candidate: CandidateVersion;
  evaluation: CandidateRunEvaluation;
};
```

`sessionId: string`

Owning session for the checkpoint.

`candidate: CandidateVersion`

Candidate version being persisted.

`evaluation: CandidateRunEvaluation`

Evaluation snapshot that justifies the checkpoint.

---

### `Checkpoint`

Durable optimizer state captured after candidate evaluation.

```ts
type Checkpoint = {
  checkpointId: string;
  sessionId: string;
  candidateId: string;
  tallyArtifacts: Array<{
    trajectoryId: string;
    runId: string;
    artifactPath: string;
  }>;
  evalSummaries: EvalSummaries;
  aggregatedPassRate: number;
  accepted?: boolean;
  rejectReason?: string;
  createdAt: string;
};
```

`checkpointId: string`

Unique identifier for the saved optimizer state.

`sessionId: string`

Session that owns the checkpoint.

`candidateId: string`

Candidate captured in this checkpoint.

`tallyArtifacts: Array<{ trajectoryId: string; runId: string; artifactPath: string }>`

Stored Tally artifacts generated from completed trajectory reports via `report.toArtifact()`.

`evalSummaries: EvalSummaries`

Evaluation summaries retained for comparison and review, including both per-eval detail and scope-level issue rollups.

`aggregatedPassRate: number`

Saved top-level score so later decisions do not need to recompute it.

`accepted?: boolean`

Optional acceptance status after comparison against another checkpoint.

`rejectReason?: string`

Optional explanation when a checkpoint is rejected.

`createdAt: string`

Creation timestamp for checkpoint history and ordering.

---

### `AnalyzeCheckpointFailuresInput`

Input contract for failure analysis.

```ts
type AnalyzeCheckpointFailuresInput = {
  checkpoint: Checkpoint;
};
```

`checkpoint: Checkpoint`

Saved optimizer state being inspected for failure evidence.

---

### `FailureAnalysis`

Actionable failure evidence used to guide the next candidate generation step.

```ts
type FailureAnalysis = {
  failures: Array<{
    trajectoryId: string;
    eval: string;
    level: "step" | "conversation" | "summary";
    reason?: string;
  }>;
  targetBlocks: string[];
};
```

`failures: Array<{ trajectoryId: string; eval: string; level: "step" | "conversation" | "summary"; reason?: string }>`

Concrete failures extracted from Tally outputs.

`targetBlocks: string[]`

High-value candidate regions to change in the next generation step.

Notes:

- Prefer explicit Tally verdict failures when available.
- Fall back to low pass-rate eval summaries or scope overview issues when verdicts are absent.

---

## Acceptance And Stop Policies

### `AcceptanceOptions`

Optional controls for acceptance evaluation.

```ts
type AcceptanceOptions = {
  requiredEvals?: string[];
};
```

`requiredEvals?: string[]`

Optional allowlist of evals that must be present and considered for acceptance.

---

### `EvaluateAcceptanceInput`

Input contract for comparing a previous checkpoint with a new checkpoint.

```ts
type EvaluateAcceptanceInput = {
  previous: Checkpoint;
  current: Checkpoint;
  options?: AcceptanceOptions;
};
```

`previous: Checkpoint`

Previously accepted or baseline checkpoint.

`current: Checkpoint`

New checkpoint under consideration.

`options?: AcceptanceOptions`

Optional policy controls for the comparison.

---

### `AcceptanceDecision`

Explicit accept/reject result for checkpoint comparison.

```ts
type AcceptanceDecision = {
  accepted: boolean;
  reason: string;
  checks: {
    passRateImproved: boolean;
    sameSession: boolean;
    requiredEvalsPresent: boolean;
  };
};
```

`accepted: boolean`

Final acceptance decision.

`reason: string`

Human-readable explanation of the result.

`checks: { passRateImproved: boolean; sameSession: boolean; requiredEvalsPresent: boolean }`

Structured checks that explain why the checkpoint passed or failed acceptance.

---

### `StopConditionInput`

Input contract for loop-control evaluation.

```ts
type StopConditionInput = {
  iteration: number;
  checkpoint: Checkpoint;
  maxIterations: number;
  acceptanceThreshold?: number;
};
```

`iteration: number`

Current optimization loop number.

`checkpoint: Checkpoint`

Latest checkpoint being considered.

`maxIterations: number`

Hard session cap.

`acceptanceThreshold?: number`

Optional early-stop threshold from `SessionConfig`.

---

### `StopDecision`

Loop-control result for ending or continuing the session.

```ts
type StopDecision = {
  stop: boolean;
  reason: "thresholdReached" | "maxIterations";
};
```

`stop: boolean`

Whether the optimizer should stop now.

`reason: "thresholdReached" | "maxIterations"`

Explicit reason for stopping.

---

## Flow Notes

- `Session` owns the full optimization lifecycle.
- `TrajectorySet` fixes the comparison set so candidate runs stay comparable.
- `CandidateRunEvaluation` converts Tally output into optimizer decision data.
- `Checkpoint` is the durable decision boundary used for comparison, acceptance, and later inspection.
- `FailureAnalysis` turns evaluation output into targeted mutation guidance.
- `AcceptanceDecision` and `StopDecision` keep loop policy explicit and auditable.
