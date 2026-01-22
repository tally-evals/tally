# @tally/trajectories — Architecture

This document describes a reusable, framework-agnostic "trajectory generator" for multi-turn conversations. It enables simulating both sides of a dialogue by letting an AI act as a user, orchestrating step plans with unified selection logic, and integrating with multiple LLM runtimes via adapters (AI SDK, Mastra).

Status: Implemented. The code reflects the concepts below; specifics are noted where behavior evolved.

---

## Goals

- Provide a generic way to build conversation trajectories driven by:
  - **Goal**: The desired outcome (e.g., plan a trip, complete a form, research a topic).
  - **Persona**: Voice, preferences, and behavioral constraints for the AI-as-user.
  - **Steps (optional)**: Milestones with unified selection logic that prioritizes preconditions and falls back to LLM ranking.
- Support AI-as-user simulation to automate trajectory creation.
- Accept agents via small functional wrappers (no trajectory-level adapter):
  - `withAISdkAgent(agent)` for AI SDK agents
  - `withMastraAgent(agent)` for Mastra agents
- Internally rely on AI SDK-style `ModelMessage` for message flow.
- Do not expose a separate "user adapter"; provide an internal AI-as-user generator.
- Use an internal **AgentMemory** (ephemeral message buffer) for agent invocation. This is not part of the public API surface.
- Produce artifacts compatible with Tally:
  - One line per step in JSONL
  - `Conversation` conversion for metrics
- Strong type-safety for core types and adapter boundaries.

---

## Non-Goals (Phase 1)

- No UI/CLI tooling beyond minimal helpers (future work).
- No baked-in evaluation metrics (handled by Tally).
- No standalone persistence layer inside `@tally-evals/trajectories` (durable persistence is handled via core `TallyStore`).

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
        storage.ts         # initialize internal AgentMemory
        policyEvaluator.ts # create/evaluate policies, build context
        agentInvoker.ts    # call agent and normalize messages
        stepSelector.ts    # unified step selection (precondition-first, LLM fallback)
        ranker/
          llmRanker.ts     # LLM-based step ranking with confidence filtering
        eligibility.ts     # check preconditions and get eligible steps
        satisfaction.ts    # evaluate step satisfaction
        loopDetector.ts    # consecutive same step detection
        utils/
          messageFormatting.ts # utilities for formatting messages from step traces
      memory/
        interface.ts
        InMemoryAgentMemory.ts
        NoopAgentMemory.ts
    policies/
      index.ts             # DefaultPolicy
    wrappers/
      index.ts             # withAISdkAgent, withMastraAgent
    utils/
      messageFormatting.ts # extract and format messages from step traces
      prompt.ts            # build prompts from messages
      output.ts            # JSONL + Tally conversion + summary
      logger.ts            # pretty console logs (optional)
```

---

## Core Concepts and Types (Type-Safe Design)

> TypeScript pseudocode mirrors the implementation; some details are elided for clarity.

```ts
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
interface SatisfactionContext {
  stepTraces: readonly StepTrace[];
  snapshot: { satisfied: Set<StepId>; attemptsByStep: Map<StepId, number> };
  step: StepDefinition;
  state: StepRuntimeState;
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
  stepTraces: readonly StepTrace[];  // Canonical state (messages can be derived when needed)
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

interface Trajectory {
  goal: string;
  persona: Persona;
  steps?: StepGraph;                      // Step graph (replaces old TrajectoryStep[])
  maxTurns?: number;
  conversationId?: string;
  userModel?: LanguageModel;               // AI SDK model function for user message generation
  metadata?: Record<string, unknown>;
  // Loop detection
  loopDetection?: {
    /** Maximum consecutive times the same step can be selected (default: 3) */
    maxConsecutiveSameStep?: number;
  };
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
  stepId: string | null;                   // The step selected for this turn
  selection: {
    method: 'start' | 'preconditions-ordered' | 'llm-ranked' | 'none';
    candidates?: readonly { stepId: string; score: number; reasons?: string[] }[];
  };
  end?: {                                  // Present only on the last trace
    isFinal: true;
    reason: TrajectoryStopReason;
    completed: boolean;
    summary?: string;
  };
}

type TrajectoryStopReason =
  | 'goal-reached'      // Terminal step reached or all steps completed
  | 'max-turns'         // Maximum turns exceeded
  | 'policy-violation'  // Policy determined violation
  | 'agent-loop'        // Loop detected (consecutive same step)
  | 'error';            // Error occurred

interface TrajectoryResult {
  steps: readonly StepTrace[];            // Canonical source of truth
}

// Agent wrapper handle (returned by withAISdkAgent / withMastraAgent)
interface AgentHandle {
  respond(
    messages: readonly ModelMessage[]
  ): Promise<{
    messages: readonly ModelMessage[];
  }>;
}
```

### Agent Wrappers

- Wrappers normalize each agent runtime to a consistent `AgentHandle.respond(messages)`.
- Messages are represented as AI SDK `ModelMessage` throughout (AgentMemory snapshot).
- `withAISdkAgent` supports two patterns:
  1. AI SDK Agent instance (with `generate` method)
  2. `generateText` input config (without `messages`/`prompt`, which are added from history)
- AgentMemory is internal; it is not configurable via the public API.
  - When using `generateText` config, wrapper converts `steps` responses and `text` into `ModelMessage[]`.

### Prompt Utilities

- `buildPromptFromMessages()` - Builds AI SDK `Prompt` object from messages (AgentMemory snapshot)
  - Supports both `messages` and `prompt` string formats
  - Handles system message injection
- `messagesToMessages()` - Clones a `ModelMessage[]` array
- These utilities ensure consistent prompt construction for both `agent.generate()` and `generateText()` calls

---

## Orchestration and Policies

### Unified Step Selection Architecture

The system uses a unified step selection approach that combines deterministic and LLM-based selection:

1. **Precondition-First Selection**:
   - Evaluates all step preconditions in parallel
   - Prioritizes steps with satisfied preconditions
   - Selects the next eligible step with preconditions in graph order (deterministic)
   - No LLM required for this path

2. **LLM Fallback**:
   - If no next step with preconditions is found, falls back to LLM-based ranking
   - Ranks all eligible steps (including those without preconditions) based on conversation context
   - Uses step traces (not raw history) for context, including tool messages
   - Filters out candidates with scores ≤ 0.5 (low confidence threshold)
   - If no high-confidence match is found, gracefully continues without a step

3. **Graceful Continuation**:
   - When no step is selected, the conversation continues naturally
   - User generator produces messages based on persona, goal, and conversation history
   - Allows the trajectory to progress even when step matching is uncertain

### Preconditions

Steps can define preconditions that must be satisfied before selection:

- **`stepSatisfied`**: Declarative precondition requiring another step to be satisfied
- **`custom`**: Procedural precondition with custom async evaluation function
  - Can inspect `stepTraces` and step snapshot
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

1. Initialize internal AgentMemory (ephemeral message buffer) and determine `conversationId`.
2. Build `StepsSnapshot` from current step graph and runtime states.
3. Determine eligible steps by checking preconditions (parallel evaluation, uses stepTraces).
4. Select next step using unified selection:
   - Prioritize steps with preconditions (deterministic graph order)
   - Fall back to LLM ranking if no preconditioned step is next
   - Filter candidates with scores ≤ 0.5
   - Gracefully continue without a step if no high-confidence match
5. Check loop detection:
   - Track consecutive same step selections
   - Stop if same step selected more than `maxConsecutiveSameStep` times (default: 3)
6. Evaluate policy (stop conditions: terminal steps, maxTurns).
7. Generate user message via AI-as-user generator:
   - Uses stepTraces (last N steps, default: 2) for conversation context
   - Includes tool messages in context
   - Generates message based on persona, goal, and selected step (if any)
8. Call `agent.respond(messages)` with the full `ModelMessage[]` (AgentMemory snapshot).
9. Collect all agent response messages (assistant and tool messages).
10. Update step runtime state (attempts, status, satisfaction).
11. Append all messages to internal AgentMemory.
12. Emit `StepTrace` with user message, all agent messages, and selection metadata.
13. Update current step ID to chosen step (if any).
14. Repeat until policy stops the trajectory.
15. If a `store` is provided, persist unified artifacts:
    - `conversation.jsonl`: Canonical history
    - `stepTraces.json`: Full StepTrace[] execution history
    - `trajectory.meta.json`: Static trajectory definition

### Policies

- **`DefaultPolicy`**: 
  - Stops when terminal step reached or `maxTurns` exceeded
  - Checks step graph terminals for completion
  - Works for all trajectories regardless of step selection approach

## Loop Detection

Loop detection is **stateless** and derived directly from the step history in `StepTrace[]`:

- **Consecutive Same Step**: Same step selected N times in a row (configurable via `loopDetection.maxConsecutiveSameStep`, default: 3)
- **Derivation**: Orchestrator analyzes `stepTraces.map(t => t.stepId)` on every turn.
- Stops the trajectory with reason `'agent-loop'` when threshold is exceeded
- Always active (not mode-specific)

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

// LLM-based step ranking (internal, not exposed as interface)
// Filters candidates with scores <= 0.5
// Uses stepTraces for conversation context (includes tool messages)

// Prompt utilities
function buildPromptFromMessages(options: {
  messages: readonly ModelMessage[];
  system?: string;
  useMessages?: boolean;
}): Prompt;
function messagesToMessages(messages: readonly ModelMessage[]): ModelMessage[];

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

## AgentMemory (internal)

- **Built-in In-Memory AgentMemory** (internal only):
  - `Map<string, readonly ModelMessage[]>`
  - Optional `ttlMs` and `capacity` for pruning
  - Always append user + assistant + tool messages in order (as provided by the agent runtime)
  - Tool-call/result pairing is preserved
  - Implemented via `InMemoryAgentMemory` class
- **AgentMemory Interface**:
  - `get(conversationId): readonly ModelMessage[]`
  - `set(conversationId, messages): void`
  - `clear(conversationId): void`
 - **Initialization**:
   - `initializeAgentMemory()` returns an internal `InMemoryAgentMemory`.

---

## Migration Note: Agents to Examples Repo

- The current debug agents in this repo (e.g., travel planner) will be migrated to a separate examples repository.
- This trajectories package remains runtime-agnostic and does not ship any example agents.

---

## Message Formatting Utilities

The system provides utilities for extracting and formatting messages from step traces:

- **`extractMessageContent()`**: Extracts text content from `ModelMessage`, handling both string and array formats
  - Supports text parts and tool-call parts
  - Returns formatted string representation

- **`formatConversationFromTraces()`**: Formats conversation exchanges from step traces
  - Extracts user and assistant messages from step traces
  - Includes tool messages in chronological order
  - Formats tool results with tool name and output (JSON, text, errors, content)
  - Returns conversation context string and last assistant message
  - Supports `lastNSteps` parameter to limit context window (default: all steps)
  - Used with `lastNSteps: 1` for LLM ranking (step selection)
  - Used with `lastNSteps: 2` for user generation (default, provides more context)

These utilities are used by:
- LLM ranker for step selection context
- User generator for conversation context
- Any component that needs to format conversation context from step traces

## Validation & Testing Plan

- Unit:
  - Policy behaviors (DefaultPolicy)
  - InMemoryAgentMemory (eviction rules, TTL) [internal]
  - Agent wrapper normalization and error propagation
  - Prompt utility correctness (messages vs prompt format)
  - Message formatting utilities (extractMessageContent, formatConversationFromTraces)
- E2E:
  - Travel planner on AI SDK and Mastra (happy paths + clarify-first)
  - Dataset writing: JSONL one-step-per-line artifacts
- Performance:
  - Large history handling and storage pruning behavior

---

## Roadmap

- v0:
  - ✅ Types and public API
  - ✅ Agent wrappers (AI SDK + generateText, Mastra)
  - ✅ Prompt utilities for consistent message handling
  - ✅ JSONL writer + Tally conversion helpers
  - ✅ Step graph architecture with StepDefinition and StepGraph
  - ✅ Preconditions (declarative and custom async)
  - ✅ Step runtime state tracking and satisfaction evaluation
  - ✅ Unified step selection (precondition-first with LLM fallback)
  - ✅ LLM-based step ranking with score filtering (<= 0.5)
  - ✅ Loop detection (consecutive same step)
  - ✅ Step traces as single source of truth (replaces history dependency)
  - ✅ Message formatting utilities for step traces
  - ✅ Tool message support in conversation context
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

- ✅ Define and run trajectories with or without steps using unified selection
- ✅ Accept agents via functional wrappers (`withAISdkAgent`, `withMastraAgent`) without changing orchestration code
  - `withAISdkAgent` supports both Agent instances and `generateText` config
- ✅ Internal AgentMemory works out-of-the-box for agent invocation
- ✅ Prompt utilities ensure consistent message handling for both agent and generateText patterns
- ✅ Step graph architecture with StepDefinition, StepGraph, and step IDs
- ✅ Preconditions support (declarative `stepSatisfied` and custom async functions)
- ✅ Step runtime state tracking (status, attempts, satisfaction)
- ✅ Unified step selection: precondition-first with LLM fallback
- ✅ LLM ranking with score filtering (candidates with scores <= 0.5 are filtered)
- ✅ Graceful continuation when no high-confidence step match is found
- ✅ Loop detection: consecutive same step tracking (always active)
- ✅ Step traces used throughout (replaces history dependency)
- ✅ Message formatting utilities for extracting and formatting messages from step traces
- ✅ Tool messages included in conversation context
- ✅ Assistant and tool messages are properly separated in step traces
- ✅ JSONL and Tally outputs are correct and complete for evaluation


