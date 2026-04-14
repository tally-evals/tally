

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
  model: string;
  maxIterations: number;
  acceptanceThreshold?: number;
  minDelta?: number;
  // Keep model tuning values such as temperature inside metadata.hyperparameters,
  // not as top-level session config fields.
  metadata?: Record<string, unknown>;
};
```

Output:

```ts
type SessionRecord = {
  sessionId: string;
  trajectoryLocation: string;
  conversationArtifactHashes: string[];
  config: OptimizerSessionConfig;
  createdAt: string;
};
```

## Phase 1.5: Persist Frozen Inputs

API:

```ts
persistInputs(input: ConversationInput[]): Promise<PersistInputsResult>
```

Input:

```ts
type EvaluationTarget = {
  expectedAnswer?: string;
  label?: string;
  scoreThreshold?: number;
};

/*
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

type ConversationInput = {
  iterationId: string;
  conversationId?: string;
  name: string;
  input: {
    conversation: ConversationMessage[];
    target?: EvaluationTarget;
  };
  metadata?: {
    sessionHash?: string;
    artifactHashes?: string[];
    hyperparameters?: Record<string, unknown>;
    candidateId?: string;
    candidateVersion?: number;
  };
};
```

Output:

```ts
type PersistInputsResult = {
  sessionHash: string;
  persistedIterationIds: string[];
  inputCount: number;       
};
/*
inputCount is the total number of conversation inputs that were persisted in that persistInputs(...) call.
persistedIterationIds: which iterations were stored
inputCount: how many inputs were stored
So if you call persistInputs(...) with 25 frozen conversations, inputCount should be 25.
*/
```

## Phase 2: Run Candidate

API:

```ts
runCandidate(iterationId: string, candidate: Candidate): Promise<StepExecution[]>
```

Input:

```ts
type Candidate = {
  candidateId: string;
  version: number;
  prompt: Record<string, string>;   //Prompt blocks / named prompt pieces
  model: string;                    // Model used for this candidate
  temperature?: number;             // Optional generation temperature
  metadata?: Record<string, unknown>;   // Extra candidate metadata
};
```

Output:

```ts
type StepExecution = {
  stepId: string;                               // Unique ID for this step
  iterationId: string;                          // Parent iteration this step belongs to
  parentStepId?: string;                        
  name: string;                                 // Human-readable step name
  type:
    | "model_call"                      // when the LLM is actually invoked
    | "tool_call"                       // when the system uses a tool or function
    | "guardrail_check"                // when you verify safety, format, constraints, or policy 
    | "evaluation"                    // when you compute metrics like overall quality, single-turn pass/fail, multi-turn pass/fail
    | "analysis";                    // when you summarize failures or generate reflection for the next candidate

  input?: Record<string, unknown>;      // Input passed into the step
  output?: Record<string, unknown>;    // Output produced by the step
  metadata?: Record<string, unknown>;  // Extra structured information

  // Token or usage information, mainly for model/tool steps
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };

  // Model/provider info if applicable
  model?: string;
  provider?: string;
  totalCost?: number;
  errorInfo?: {
    message: string;
    code?: string;
    details?: Record<string, unknown>;
  };
};
```

## Phase 2.5: Tally Evaluation

API:

```ts
evaluateConversation(iterationId: string, steps: StepExecution[]): Promise<ConversationEval>
```

Input:

```ts
type StepEvalScore = {
  metricName: string;
  value: number;
  passed?: boolean;
  reason?: string;
  weight?: number;
};

type EvalFailure = {
  level: "step" | "conversation";
  category: string;
  reason: string;
  relatedStepId?: string;
};
```

Output:

```ts
type ConversationEval = {
  iterationId: string;          // Parent iteration this evaluation belongs to
  tallyArtifactId?: string;

  // Per-step / single-turn evaluation results
  singleTurnEvals: Array<{
    stepId: string;
    scores: StepEvalScore[];
  }>;
   // Conversation-level / multi-turn evaluation results
  multiTurnEvals: StepEvalScore[];
  overallQuality: {               // Final combined conversation-level quality score
    score: number;
    formula?: string;     // Optional description of how final score was computed
    weightedComponents?: Array<{
      metricName: string;
      value: number;
      weight: number;
    }>;
  };
  failures?: EvalFailure[];
};
```

Notes:
- Single-turn evals are step-level.
- Multi-turn evals are conversation-level.
- `overallQuality.score` is one scalar per conversation.

## Phase 2.6: Checkpoint Outputs

API:

```ts
createCheckpoint(evalResult: ConversationEval, candidate: Candidate): Promise<CheckpointRecord>
```

Output:

```ts
type WeightedGuardrail = {
  name: string;
  score: number;
  weight: number;
  passed: boolean;
};

type CheckpointRecord = {
  checkpointId: string;
  candidateId: string;
  parentCandidateId?: string;
  sessionId: string;
  promptHash: string;
  changedBlocks?: string[];
  tallyArtifactIds?: string[];
  aggregatedScore: number;          // Final aggregate score at this checkpoint
  weightedGuardrails: WeightedGuardrail[];
  reflection?: string;
  accepted?: boolean;
  rejectReason?: string;     // Why it was rejected, if not accepted
  createdAt: string;
};
```

Notes:
- `aggregatedScore` should be the mean `overallQuality.score` across completed conversations.
- Checkpoint data is the handoff object into failure analysis and accept/reject.

## Phase 3: Analyze Failures

API:

```ts
analyzeFailures(
  checkpoint: CheckpointRecord,
  evalResult: ConversationEval
): Promise<FailureAnalysis>
```

Input:

```ts
type FailureAnalysisInput = {
  checkpoint: CheckpointRecord;
  evalResult: ConversationEval;
};
```

Output:

```ts
type FailureSummary = {
  level: "step" | "conversation";
  category: string;
  count: number;
  reason: string;
};

type FailureAnalysis = {
  failedStepEvals: EvalFailure[];
  failedConversationEvals: EvalFailure[];
  conversationSummary: FailureSummary[];
  globalSummary: FailureSummary[];
  usedFallbackLowOverallQuality: boolean;
  targetBlocks: string[];
};
```

Notes:
- If explicit failures are missing, analysis falls back to low-`overallQuality` conversations.
- `targetBlocks` identifies the high-priority prompt blocks to mutate next.

## Phase 4: Generate Next Candidate

API:

```ts
generateCandidate(input: CandidateGenerationInput): Promise<Candidate>
```

Input:

```ts
type CandidateGenerationInput = {
  baseline: Candidate;
  checkpoint: CheckpointRecord;
  failedStepEvals?: EvalFailure[];
  conversationSummary?: FailureSummary[];
  targetBlocks?: string[];
  reflection?: string;
  rejectedChanges?: string[];
};
```

Output:

```ts
type CandidateGenerationResult = Candidate;
```

Notes:
- Generation starts from the last accepted candidate.
- Reflection, rejection history, and changed blocks should be preserved in metadata.

## Phase 5: Re-evaluate Candidate

API:

```ts
rerunCandidate(
  iterationId: string,
  candidate: Candidate
): Promise<{
  steps: StepExecution[];
  evaluation: ConversationEval;
  checkpoint: CheckpointRecord;
}>
```

Output:

```ts
type ReEvaluationResult = {
  steps: StepExecution[];
  evaluation: ConversationEval;
  checkpoint: CheckpointRecord;
};
```

Notes:
- Recompute `aggregatedScore` as the mean `overallQuality.score` across completed conversations.

## Phase 6: Accept or Reject Candidate

API:

```ts
decideAcceptance(
  previous: CheckpointRecord,
  current: CheckpointRecord,
  options?: AcceptanceOptions
): Promise<AcceptanceDecision>
```

Input:

```ts
type AcceptanceOptions = {
  scoreTolerance?: number;
  minDelta?: number;
  requireHashMatch?: boolean;
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
    sessionIdentityMatch: boolean;
    promptHashValid: boolean;
    guardrailsWithinTolerance: boolean;
  };
};
```

Notes:
- Acceptance should check:
  - `current.aggregatedScore >= previous.aggregatedScore + minDelta`
  - hashes and session identity match
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
  reason: "threshold_reached" | "max_iterations" ;
};
```




