# Updated API Interfaces

## Phase 1: Start Session

API:

```ts
startSession(config: OptimizerSessionConfig): Promise<SessionRecord>
```

Input:

```ts
type OptimizerSessionConfig = {
  projectName: string;
  optimizerName: string;
  sessionId: string;
  maxIterations: number;   // Max number of optimization loops allowed
  acceptanceThreshold?: number;   // Optional score threshold to stop early
  minDelta?: number;         // Optional minimum improvement required to accept a candidate
  hyperparameters: {
    model: string;          
    temperature?: number;
  };
  metadata?: Record<string, unknown>;
};
```

Output:

```ts
type SessionRecord = {
  sessionId: string;
  trajectoryLocation: string;    // Where frozen trajectories / session artifacts are stored
  config: OptimizerSessionConfig;
  status: "created" | "completed"; // Current lifecycle state of the session
  createdAt: string;
};
/*
SessionRecord is the root record for one optimizer session.
It does not store frozen input hashes yet because those are created in persistInputs(...).
*/
```

## Phase 1.5: Persist Frozen Inputs

API:

```ts
persistInputs(
  sessionId: string,
  trajectories: FrozenTrajectoryInput[] // Exact trajectory set to freeze
): Promise<FrozenInputSet>     
```

Input:

```ts
type EvaluationTarget = {
  expectedAnswer?: string;
  label?: string;
  scoreThreshold?: number;
};

/*
EvaluationTarget defines what “success” means for that frozen trajectory.
Answer the question: the target or expected outcome 
EvaluationTarget
{
  expectedAnswer: "Paris",
  label: "correct",
  scoreThreshold: 0.8
}
*/

type ConversationMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

/*
ConversationMessage defines the shape of one message in a conversation.
Answer the question: what exists inside the trajectory data
conversationMessage: [
  {
    role: "system",
    content: "Use the lookup tool when needed."
  },
  {
    role: "user",
    content: "What is the capital of France?"
  },
  {
    role: "tool",
    content: "{\"country\":\"France\",\"capital\":\"Paris\"}"
  },
  {
    role: "assistant",
    content: "The capital of France is Paris."
  }
]
*/

type FrozenTrajectoryInput = {
  trajectoryId: string; // Stable ID for one frozen trajectory
  name: string;
  conversation: ConversationMessage[]; // Frozen conversation content inside the trajectory
  target?: EvaluationTarget;
  metadata?: {
    artifactHashes?: string[];
  };
};
```

Output:

```ts
type FrozenInputSet = {
  sessionId: string;
  sessionHash: string;        // Hash for the full frozen input set
  trajectoryIds: string[];
  artifactHashes: string[];
  inputCount: number;
  createdAt: string;
};
/*
inputCount is the total number of frozen trajectories stored for that session.
trajectoryIds is the exact fixed set that later candidate runs must use.
*/
```

## Phase 2: Run Candidate

API:

```ts
runCandidate(
  sessionId: string,
  candidate: Candidate
): Promise<CandidateRun>
```

Input:

```ts
type Candidate = {
  candidateId: string;
  parentCandidateId?: string;
  version: number;
  prompt: ConversationMessage[];     // Entire prompt/messages are mutable as one unit
  metadata?: Record<string, unknown>;
};

type RunOptions = {
      mode: "bucketed";
      bucketId: string;       // Required when running with buckets
      concurrency?: number;
    }
    {
      mode: "standard";
      concurrency?: number;   // No bucket used
    };
```

Output:

```ts
type StepExecution = {
  stepId: string;
  trajectoryId: string;        // Which frozen trajectory this step belongs to
  parentStepId?: string;
  name: string;
  type:
    | "model_call"      // Step is an LLM/model invocation
    | "tool_call"              // Step is a tool/function call
    | "guardrail_check";        // Step is a guardrail/safety/validation check

  input?: Record<string, unknown>;      // Structured input to this step
  output?: Record<string, unknown>;      // Structured output from this step
  metadata?: Record<string, unknown>;    // Extra step-level metadata

  model?: string;
  totalCost?: number;
  errorInfo?: {
    message: string;
    code?: string;
    details?: Record<string, unknown>;
  };
};

type TallyArtifactRef = {
  trajectoryId: string;
  runId: string;
  path?: string;
};

type TrajectoryRun = {
  trajectoryId: string;
  tallyArtifact?: TallyArtifactRef;      // Reference to the Tally run artifact for this trajectory
  conversation: ConversationMessage[];   // Produced conversation for this trajectory run
  steps: StepExecution[];
  status: "completed" | "failed";
};

type CandidateRun = {
  sessionId: string;
  sessionHash: string;             // Must match the frozen input set for this session
  candidateId: string;
  bucketId?: string;
  trajectories: TrajectoryRun[];
  completedTrajectoryCount: number;
  failedTrajectoryCount: number;
};
```

## Phase 2.5: Evaluate Candidate

API:

```ts
evaluateCandidate(run: CandidateRun): Promise<CandidateEvaluation>
```

Input:

```ts
type MetricScore = {
  metricName: string;
  value: number;
  passed?: boolean;
  reason?: string;
  weight?: number;
};

type EvalFailure = {
  trajectoryId: string;
  level: "step" | "conversation";
  category: string; 
  reason: string;
  relatedStepId?: string;
};
```

Output:

```ts
type TrajectoryEvaluation = {
  trajectoryId: string;
  tallyArtifact?: TallyArtifactRef;

  singleTurnEvals: Array<{
    stepId: string;
    scores: MetricScore[];
  }>;

  multiTurnEvals: MetricScore[];
  overallQuality: number;        // One scalar score for this trajectory
  failures?: EvalFailure[];
};

type WeightedGuardrail = {
  name: string;
  score: number;
  weight: number;
  passed: boolean;
};

type CandidateEvaluation = {
  sessionId: string;
  sessionHash: string;
  candidateId: string;
  trajectories: TrajectoryEvaluation[];
  aggregatedScore: number;       // Mean overallQuality across conversations
  weightedGuardrails: WeightedGuardrail[];
};
```

Notes:
- `aggregatedScore` is the mean `overallQuality` across completed trajectories.
- This is the session-level evaluation object, not a single-trajectory result.

## Phase 2.6: Checkpoint Outputs

API:

```ts
createCheckpoint(
  sessionId: string,
  candidate: Candidate,
  evaluation: CandidateEvaluation
): Promise<CheckpointRecord>
```

Output:

```ts
type CheckpointRecord = {
  checkpointId: string;
  sessionId: string;
  sessionHash: string;                 // Used later for acceptance checks
  candidateId: string;
  parentCandidateId?: string;
  promptHash: string;
  changedBlocks?: string[];
  tallyArtifacts: TallyArtifactRef[];
  aggregatedScore: number;
  weightedGuardrails: WeightedGuardrail[];
  accepted?: boolean;
  rejectReason?: string;
  createdAt: string;
};
/*
CheckpointRecord is the session-level handoff into failure analysis,
candidate generation, and acceptance.
*/
```

## Phase 3: Analyze Failures

API:

```ts
analyzeFailures(
  checkpoint: CheckpointRecord,
  evaluation: CandidateEvaluation
): Promise<FailureAnalysis>
```

Output:

```ts
type FailureSummary = {
  level: "step" | "conversation";
  category: string;
  count: number;    // Number of times this failure occurred
  reason: string;
};

type FailureAnalysis = {
  failedStepEvals: EvalFailure[];
  failedTrajectoryEvals: EvalFailure[];
  trajectorySummary: FailureSummary[];
  globalSummary: FailureSummary[];
  usedFallbackLowOverallQuality: boolean;
  targetBlocks: string[];
};
```

Notes:
- If explicit failures are missing, analysis falls back to low-`overallQuality` trajectories.
- `targetBlocks` identifies the high-priority prompt blocks to mutate next.

## Phase 4: Generate Next Candidate

API:

```ts
generateCandidate(input: CandidateGenerationInput): Promise<Candidate>
```

Input:

```ts
type CandidateGenerationInput = {
  baseline: Candidate;                // Last accepted candidate
  checkpoint: CheckpointRecord;
  analysis: FailureAnalysis;
  rejectedChanges?: string[];
};
```

Output:

```ts
type CandidateGenerationResult = Candidate;
```

Notes:
- Generation starts from the last accepted candidate.
- Reflection and rejected changes can be preserved inside candidate metadata.

## Phase 5: Re-evaluate Candidate

API:

```ts
rerunCandidate(
  sessionId: string,
  candidate: Candidate,
  options?: RunOptions
): Promise<ReEvaluationResult>
```

Output:

```ts
type ReEvaluationResult = {
  run: CandidateRun;
  evaluation: CandidateEvaluation;
  checkpoint: CheckpointRecord;
};
/*
This is just the rerun form of Phase 2 + Phase 2.5 + Phase 2.6 for a new candidate.
*/
```

## Phase 6: Accept or Reject Candidate

API:

```ts
decideAcceptance(
  previous: CheckpointRecord,  // Previously accepted checkpoint
  current: CheckpointRecord,   // Newly evaluated checkpoint
  options?: AcceptanceOptions
): Promise<AcceptanceDecision>
```

Input:

```ts
type AcceptanceOptions = {
  minDelta?: number;
  guardrailTolerance?: number;
};
```

Output:

```ts
type AcceptanceDecision = {
  accepted: boolean;
  reason: string;
  checks: {
    scoreImproved: boolean;
    sessionHashMatch: boolean;
    completedSameTrajectorySet: boolean;
    guardrailsWithinTolerance: boolean;
  };
};
```

Notes:
- Acceptance should check:
  - `current.aggregatedScore >= previous.aggregatedScore + minDelta`
  - `current.sessionHash === previous.sessionHash`
  - both checkpoints represent the same completed trajectory set
  - weighted guardrails remain within tolerance

## Phase 7: Stop Condition

API:

```ts
shouldStop(input: StopConditionInput): StopDecision
```

Input:

```ts
type StopConditionInput = {
  iteration: number;
  checkpoint: CheckpointRecord;
  maxIterations: number;
  acceptanceThreshold?: number;
};
```

Output:

```ts
type StopDecision = {
  stop: boolean;
  reason: "threshold_reached" | "max_iterations" | "continue";
};
/*
If stop is false, the loop continues with failure analysis and next candidate generation.
*/
```
