# @tally/trajectories — Architecture

This document describes a reusable, framework-agnostic “trajectory generator” for multi-turn conversations. It enables simulating both sides of a dialogue by letting an AI act as a user, orchestrating strict/loose step plans, and integrating with multiple LLM runtimes via adapters (AI SDK, Mastra).

Status: Implemented. The code reflects the concepts below; specifics are noted where behavior evolved.

---

## Goals

- Provide a generic way to build conversation trajectories driven by:
  - **Goal**: The desired outcome (e.g., plan a trip, complete a form, research a topic).
  - **Persona**: Voice, preferences, and behavioral constraints for the AI-as-user.
  - **Steps (optional)**: Milestones that can be followed strictly or loosely.
- Support AI-as-user simulation to automate trajectory creation.
- Accept agents via small functional wrappers (no trajectory-level adapter):
  - `withAISdkAgent(agent)` for AI SDK agents
  - `withMastraAgent(agent)` for Mastra agents
- Internally rely on AI SDK-style `ModelMessage` for message flow.
- Do not expose a separate "user adapter"; provide an internal AI-as-user generator.
- Provide built-in, configurable storage for conversation history (can be disabled) without requiring external persistence.
- Produce artifacts compatible with Tally:
  - One line per step in JSONL
  - `Conversation` conversion for metrics
- Strong type-safety for core types and adapter boundaries.

---

## Non-Goals (Phase 1)

- No UI/CLI tooling beyond minimal helpers (future work).
- No baked-in evaluation metrics (handled by Tally).
- No external persistence layer beyond built-in local storage.

---

## Package Layout (implemented)

```
packages/trajectories/
  README.md
  ARCHITECTURE.md
  src/
    index.ts
    core/
      types.ts
      orchestrator.ts
      userGenerator.ts
      steps/
        types.ts           # StepDefinition, StepGraph, Precondition, etc.
      execution/
        storage.ts         # initialize storage from config/overrides
        policyEvaluator.ts # create/evaluate policies, build context
        agentInvoker.ts    # call agent and normalize messages
        stepSelector.ts    # bridge to step selection (strict/loose)
        stepRanker.ts      # StepRanker interface for LLM-based ranking
        eligibility.ts     # check preconditions and get eligible steps
        satisfaction.ts    # evaluate step satisfaction
        selectors/
          strictSelector.ts # deterministic sequential step selection
          looseSelector.ts  # LLM-based step ranking with confidence gating
        loopDetector.ts    # loop/no-match/cycle detection and stop reasons
      storage/
        interface.ts
        localStorage.ts
        noopStorage.ts
    policies/
      index.ts             # StrictPolicy, LoosePolicy
    wrappers/
      index.ts             # withAISdkAgent, withMastraAgent
    utils/
      prompt.ts            # build prompts/messages
      output.ts            # JSONL + Tally conversion + summary
      logger.ts            # pretty console logs (optional)
```

---

## Core Concepts and Types (Type-Safe Design)

> TypeScript pseudocode mirrors the implementation; some details are elided for clarity.

```ts
type TrajectoryMode = 'strict' | 'loose';

interface Persona {
  name?: string;
  description: string;
  guardrails?: readonly string[];
}

// Step Graph Architecture
type StepId = string;

interface StepDefinition {
  id: StepId;
  instruction: string;
  hints?: readonly string[];              // Optional prompt hints for user generation
  preconditions?: readonly Precondition[]; // Steps that must be satisfied first
  maxAttempts?: number;
  timeoutMs?: number;
  isSatisfied?: (ctx: SatisfactionContext) => boolean | Promise<boolean>;
}

interface StepGraph {
  steps: readonly StepDefinition[];
  start: StepId;                          // Starting step ID
  terminals?: readonly StepId[];          // Terminal/end step IDs
}

type Precondition =
  | { type: 'stepSatisfied'; stepId: StepId }  // Declarative: step must be satisfied
  | {
      type: 'custom';
      name?: string;
      // Can be sync or async - evaluated in parallel
      evaluate: (ctx: PreconditionContext) => boolean | Promise<boolean>;
    };

interface PreconditionContext {
  history: readonly ModelMessage[];
  snapshot: {
    satisfied: Set<StepId>;
    attemptsByStep: Map<StepId, number>;
  };
}

interface StepRuntimeState {
  stepId: StepId;
  status: 'idle' | 'in_progress' | 'satisfied' | 'blocked' | 'failed' | 'skipped';
  attempts: number;
  lastUpdatedAt: Date;
}

interface StorageConfig {
  strategy: 'local' | 'none';
  ttlMs?: number;
  capacity?: number;
  conversationId?: string;
}

interface LooseConfig {
  ranker?: StepRanker;                    // Custom step ranker (optional)
  scoreThreshold?: number;                 // Min confidence to select (default: 0.5)
  margin?: number;                        // Min score difference (default: 0.1)
  fallback?: 'sequential' | 'stay';       // Fallback when confidence low (default: 'sequential')
}

interface Trajectory {
  goal: string;
  persona: Persona;
  steps?: StepGraph;                      // Step graph (replaces old TrajectoryStep[])
  mode: TrajectoryMode;
  maxTurns?: number;
  storage?: StorageConfig;                 // built-in storage; defaults to 'local'
  userModel?: LanguageModel;               // AI SDK model function for user message generation
  metadata?: Record<string, unknown>;
  // Loop detection for loose mode
  loopDetection?: {
    maxConsecutiveSameStep?: number;       // Same step repeated (default: 3)
    maxConsecutiveNoMatch?: number;        // No step matches (default: 3)
    maxCycleLength?: number;               // Max cycle pattern length (default: 3)
    maxCycleRepetitions?: number;         // Max cycle repetitions (default: 2)
  };
  // Loose mode configuration
  loose?: LooseConfig;
}

// We rely on AI SDK ModelMessage semantics
export type ModelMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | { type: 'tool-call'; id: string; name: string; args: unknown }
        | { type: 'tool-result'; id: string; name: string; result: unknown }
      >;
};

interface StepTrace {
  turnIndex: number;
  userMessage: ModelMessage;
  agentMessages: readonly ModelMessage[];  // Includes assistant and tool messages
  timestamp: Date;
}

type TrajectoryStopReason =
  | 'goal-reached'      // Terminal step reached or all steps completed
  | 'max-turns'         // Maximum turns exceeded
  | 'policy-violation'  // Policy determined violation
  | 'agent-loop'        // Loop detected (same step or cycle)
  | 'no-step-match'     // No step matches agent's questions
  | 'error';            // Error occurred

interface TrajectoryResult {
  steps: readonly StepTrace[];
  completed: boolean;
  reason: TrajectoryStopReason;
  summary?: string;
  traces?: unknown;
}

// Agent wrapper handle (returned by withAISdkAgent / withMastraAgent)
interface AgentHandle {
  respond(
    history: readonly ModelMessage[]
  ): Promise<{
    messages: readonly ModelMessage[];
  }>;
}
```

### Agent Wrappers

- Wrappers normalize each agent runtime to a consistent `AgentHandle.respond(history)`.
- History is represented as AI SDK `ModelMessage` throughout.
- `withAISdkAgent` supports two patterns:
  1. AI SDK Agent instance (with `generate` method)
  2. `generateText` input config (without `messages`/`prompt`, which are added from history)
- Built-in local storage is provided and configurable; it can be disabled with `strategy: 'none'`.
  - When using `generateText` config, wrapper converts `steps` responses and `text` into `ModelMessage[]`.

### Prompt Utilities

- `buildPromptFromHistory()` - Builds AI SDK `Prompt` object from conversation history
  - Supports both `messages` and `prompt` string formats
  - Handles system message injection
- `historyToMessages()` - Converts history to `ModelMessage[]` array
- These utilities ensure consistent prompt construction for both `agent.generate()` and `generateText()` calls

---

## Orchestration and Policies

### Step Selection Architecture

The system uses a pluggable step selection architecture with two strategies:

- **Strict Mode** (`StrictSelector`):
  - Deterministic sequential selection following graph order
  - Respects preconditions (only selects steps whose preconditions are satisfied)
  - Advances to next eligible step in graph order
  - No LLM required

- **Loose Mode** (`LooseSelector`):
  - LLM-based step ranking using `StepRanker` interface
  - Ranks all eligible steps based on agent's last message and goal
  - Confidence gating: requires score ≥ threshold and margin between top candidates
  - Fallback strategies when confidence is low:
    - `sequential`: pick next step in graph order
    - `stay`: remain on current step
  - Supports custom rankers via `LooseConfig.ranker`

### Preconditions

Steps can define preconditions that must be satisfied before selection:

- **`stepSatisfied`**: Declarative precondition requiring another step to be satisfied
- **`custom`**: Procedural precondition with custom async evaluation function
  - Can inspect conversation history and step snapshot
  - Supports both sync and async evaluation
  - All preconditions evaluated in parallel for performance

### Step Satisfaction

Steps track runtime state (`StepRuntimeState`) with status:
- `idle`: Not yet started
- `in_progress`: Currently being executed
- `satisfied`: Step requirements met
- `blocked`: Cannot proceed (preconditions not met)
- `failed`: Step execution failed
- `skipped`: Step was skipped

Steps can define custom `isSatisfied` function, or use default heuristic (user responded to assistant's question).

### Execution Loop (implemented)

1. Initialize storage and conversationId (built-in storage).
2. Build `StepsSnapshot` from current step graph and runtime states.
3. Determine eligible steps by checking preconditions (parallel evaluation).
4. Select next step:
   - **Strict**: Use `StrictSelector` to pick next eligible step in graph order
   - **Loose**: Use `LooseSelector` with LLM ranking, confidence gating, and fallback
5. Check loop detection (loose mode only):
   - Track step selection history
   - Detect consecutive same step, cycles (A→B→A→B), or no matches
6. Evaluate policy (stop conditions: terminal steps, maxTurns).
7. Generate user message via AI-as-user generator (persona + goal + selected step).
8. Call `agent.respond(history)` with full `ModelMessage` history.
9. Collect all agent response messages (assistant and tool messages).
10. Update step runtime state (attempts, status, satisfaction).
11. Append all messages to history via Storage.
12. Emit `StepTrace` with all agent messages.
13. Update current step ID to chosen step.
14. Safety: hard cap at 30 turns to prevent infinite loops.

### Policies

- **`StrictPolicy`**: 
  - Stops when terminal step reached or `maxTurns` exceeded
  - Checks step graph terminals for completion
  
- **`LoosePolicy`**: 
  - More permissive, allows deviations
  - Stops when terminal step reached or `maxTurns` exceeded
  - Steps are guidance, not strict requirements

### Loop Detection (loose mode)

Enhanced loop detection tracks multiple patterns:

1. **Consecutive Same Step**: Same step selected N times in a row (configurable, default: 3)
2. **Cycles**: Repeating patterns like A→B→A→B or A→B→C→A→B→C
   - Configurable cycle length (default: 3)
   - Configurable repetition threshold (default: 2)
3. **No Matches**: Agent questions don't match any step (configurable, default: 3)

All detection uses step IDs (not indices) and maintains step selection history for cycle detection.

---

## Outputs

- **JSONL (one step per line)**:
  - `{ conversationId, stepIndex, input, output[], timestamp, metadata }`
- **Tally Conversation**:
  - `steps: readonly { input: Message; output: readonly Message[] }[]`
- **Tracing**:
  - Optional: tool-call timelines, token/latency counters (future).
 - Pretty console logging is available via `logger.ts` and can be toggled with `generateLogs` at runtime.

---

## API Surface (Implemented)

```ts
// Factory
function createTrajectory(
  def: Trajectory,
  agent: AgentHandle
): Trajectory & { agent: AgentHandle };

// Runtime
function runTrajectory(
  trajectory: Trajectory & { agent: AgentHandle },
  options?: RunTrajectoryOptions
): Promise<TrajectoryResult>;

interface RunTrajectoryOptions {
  storage?: Storage; // override built-in storage if desired
  userModel?: LanguageModel; // override trajectory userModel
  generateLogs?: boolean; // pretty console logging (default: false)
}

// Agent wrappers
function withAISdkAgent(
  agent: { generate: (input: Prompt) => Promise<{ response: { messages: ModelMessage[] } }> }
): AgentHandle;
function withAISdkAgent(
  config: Omit<GenerateTextInput, 'messages' | 'prompt'>
): AgentHandle;
function withMastraAgent(agent: { generate: (input: { messages: ModelMessage[] }) => Promise<{ messages: ModelMessage[] }> }): AgentHandle;

// Step ranker interface (for custom loose mode ranking)
interface StepRanker {
  rank(args: {
    history: readonly ModelMessage[];
    goal: string;
    steps: readonly StepDefinition[];
  }): Promise<Array<{ stepId: StepId; score: number; reasons?: string[] }>>;
}

// Prompt utilities
function buildPromptFromHistory(options: {
  history: readonly ModelMessage[];
  system?: string;
  useMessages?: boolean;
}): Prompt;
function historyToMessages(history: readonly ModelMessage[]): ModelMessage[];

// Helpers
function toJSONL(result: TrajectoryResult): string[];    // one step per line
function toConversation(result: TrajectoryResult): Conversation; // Tally-compatible
function summarize(result: TrajectoryResult): string;    // short human-readable summary
```

### Type-Safety Notes
- Public APIs will use explicit types, `readonly` arrays, and discriminated unions where appropriate.
- `ModelMessage` (AI SDK) is used end-to-end to avoid re-inventing a message shape.
- Wrapper inputs can be strictly typed later with dedicated overloads per ecosystem.

---

## Storage Strategy

- **Built-in Local Storage**:
  - `Map<string, readonly ModelMessage[]>`
  - Optional `ttlMs` and `capacity` for pruning
  - Always append user + assistant + tool messages in order
  - Tool-call/result pairing is preserved
  - Implemented via `LocalStorage` class
- **Disable Option**:
  - `strategy: 'none'` to avoid storing history (stateless execution)
  - Implemented via `NoopStorage` class
- **Storage Interface**:
  - `get(conversationId): readonly ModelMessage[]`
  - `set(conversationId, messages): void`
  - `clear(conversationId): void`
 - **Initialization**:
   - `initializeStorage(trajectory, options)` resolves to `NoopStorage` or `LocalStorage` with configured `ttlMs`, `capacity`, and supports overriding via runtime `options.storage`.

---

## Migration Note: Agents to Examples Repo

- The current debug agents in this repo (e.g., travel planner) will be migrated to a separate examples repository.
- This trajectories package remains runtime-agnostic and does not ship any example agents.

---

## Validation & Testing Plan

- Unit:
  - Strict vs. loose policy behaviors
  - LocalStorage (eviction rules, TTL)
  - Agent wrapper normalization and error propagation
  - Prompt utility correctness (messages vs prompt format)
- E2E:
  - Travel planner on AI SDK and Mastra (happy paths + clarify-first)
  - Dataset writing: JSONL one-step-per-line artifacts
- Performance:
  - Large history handling and storage pruning behavior

---

## Roadmap

- v0:
  - ✅ Types and public API
  - ✅ Agent wrappers (AI SDK + generateText, Mastra) and LocalStorage
  - ✅ Prompt utilities for consistent message handling
  - ✅ JSONL writer + Tally conversion helpers
  - ✅ Step graph architecture with StepDefinition and StepGraph
  - ✅ Preconditions (declarative and custom async)
  - ✅ Step runtime state tracking and satisfaction evaluation
  - ✅ Strict and loose selectors with pluggable architecture
  - ✅ LLM-based step ranking with confidence gating
  - ✅ Enhanced loop detection (consecutive, cycles, no-match)
  - ✅ Loose mode configuration (threshold, margin, fallback)
- v0.1:
  - Enhanced tracing utilities and richer logs
  - Step graph visualization
- v0.2:
  - Goal-reached detectors and simple rule-based evaluators
  - Rich personas (tone, constraints)
  - Step graph branching/guards
- v0.3:
  - CLI for running trajectories and exporting artifacts
  - Examples repository with curated scenarios

---

## Acceptance Criteria

- ✅ Define and run trajectories with or without steps in strict/loose modes
- ✅ Accept agents via functional wrappers (`withAISdkAgent`, `withMastraAgent`) without changing orchestration code
  - `withAISdkAgent` supports both Agent instances and `generateText` config
- ✅ Built-in storage works out-of-the-box and can be disabled
- ✅ Prompt utilities ensure consistent message handling for both agent and generateText patterns
- ✅ Step graph architecture with StepDefinition, StepGraph, and step IDs
- ✅ Preconditions support (declarative `stepSatisfied` and custom async functions)
- ✅ Step runtime state tracking (status, attempts, satisfaction)
- ✅ Strict selector: deterministic sequential selection with precondition checking
- ✅ Loose selector: LLM-based ranking with confidence gating and fallback strategies
- ✅ Enhanced loop detection: consecutive same step, cycles, and no-match patterns
- ✅ Loose mode configuration: custom rankers, thresholds, margins, and fallbacks
- ✅ Assistant and tool messages are properly separated in step traces
- ✅ JSONL and Tally outputs are correct and complete for evaluation


