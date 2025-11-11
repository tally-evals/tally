# @tally/trajectories — Architectural Plan (Docs Only)

This document outlines a reusable, framework-agnostic “trajectory generator” for multi-turn conversations. It enables simulating both sides of a dialogue by letting an AI act as a user, orchestrating strict/loose step plans, and integrating with multiple LLM runtimes via adapters (AI SDK, Mastra).

Implementation is intentionally deferred. This document serves as a detailed blueprint for future development and API stabilization with strong type-safety.

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

## Package Layout (planned)

```
packages/trajectories/
  README.md
  ARCHITECTURE.md
  (src/ to be added later)
```

When implemented, the `src/` directory will follow this conceptual structure:

```
src/
  core/
    types.ts
    orchestrator.ts
    storage/
      interface.ts
      localStorage.ts
      noopStorage.ts
    userGenerator.ts
  wrappers/
    index.ts          # Agent wrappers (withAISdkAgent, withMastraAgent)
  policies/
    index.ts          # StrictPolicy, LoosePolicy
  utils/
    prompt.ts         # Prompt building utilities
    output.ts         # JSONL, Conversation conversion
  index.ts
```

---

## Core Concepts and Types (Type-Safe Design)

> TypeScript pseudocode — exact signatures may evolve during implementation.

```ts
type TrajectoryMode = 'strict' | 'loose';

interface Persona {
  name?: string;
  description: string;
  guardrails?: readonly string[];
}

interface TrajectoryStep {
  instruction: string;
  requiredInfo?: readonly string[];
}

interface StorageConfig {
  strategy: 'local' | 'none';
  ttlMs?: number;
  capacity?: number;
  conversationId?: string;
}

interface Trajectory {
  goal: string;
  persona: Persona;
  steps?: readonly TrajectoryStep[];
  mode: TrajectoryMode;
  maxTurns?: number;
  storage?: StorageConfig;     // built-in storage; defaults to 'local'
  userModel?: LanguageModel;   // AI SDK model function for user message generation
  metadata?: Record<string, unknown>;
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

type TrajectoryStopReason = 'goal-reached' | 'max-turns' | 'policy-violation' | 'error';

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

### Prompt Utilities

- `buildPromptFromHistory()` - Builds AI SDK `Prompt` object from conversation history
  - Supports both `messages` and `prompt` string formats
  - Handles system message injection
- `historyToMessages()` - Converts history to `ModelMessage[]` array
- These utilities ensure consistent prompt construction for both `agent.generate()` and `generateText()` calls

---

## Orchestration and Policies

- **Strict Mode**:
  - Execute steps in order; deviations are violations.
  - If required info is missing:
    - Ask one clarifying question or stop.
- **Loose Mode**:
  - Steps act as guidance; allow reasonable deviations.
  - Answer the agent’s clarifying questions using persona + goal + steps context.
  - Prefer progress toward the goal over rigid adherence.

Execution loop (conceptual):
1. Resolve storage and conversationId (built-in storage).
2. Determine current step based on `turnIndex` (one user turn per iteration).
3. Build the next user message via the internal AI-as-user generator (persona + goal + step) as a `ModelMessage`.
4. Call `agent.respond(history)` with full `ModelMessage` history.
   - Uses `buildPromptFromHistory()` to construct proper `Prompt` object
   - Handles both agent and generateText patterns
5. Collect all agent response messages (assistant and tool messages).
6. Append all messages (user + assistant + tool) to history via Storage.
7. Evaluate stop conditions: goal reached, maxTurns, policy violation.
8. Emit `StepTrace` with all agent messages (assistant and tool messages included).

---

## Outputs

- **JSONL (one step per line)**:
  - `{ conversationId, stepIndex, input, output[], timestamp, metadata }`
- **Tally Conversation**:
  - `steps: readonly { input: Message; output: readonly Message[] }[]`
- **Tracing**:
  - Optional: tool-call timelines, token/latency counters (future).

---

## API Surface (Planned)

```ts
// Factory
function createTrajectory(
  def: Trajectory,
  agent: AgentHandle
): Trajectory;

// Runtime
function runTrajectory(
  trajectory: Trajectory,
  options?: {
    storage?: Storage; // override built-in storage if desired
    userModel?: LanguageModel; // override trajectory userModel
  }
): Promise<TrajectoryResult>;

// Agent wrappers
function withAISdkAgent(
  agent: { generate: (input: Prompt) => Promise<{ response: { messages: ModelMessage[] } }> }
): AgentHandle;
function withAISdkAgent(
  config: Omit<GenerateTextInput, 'messages' | 'prompt'>
): AgentHandle;
function withMastraAgent(agent: { generate: (input: { messages: ModelMessage[] }) => Promise<{ messages: ModelMessage[] }> }): AgentHandle;

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

- v0 (Docs → Skeleton):
  - ✅ Finalize types and public API
  - ✅ Implement agent wrappers (AI SDK first) and LocalStorage
  - ✅ Prompt utilities for consistent message handling
  - ✅ JSONL writer + Tally conversion helpers
  - ✅ Step indexing fixes and message separation
- v0.1:
  - Mastra agent wrapper
  - Enhanced tracing utilities
- v0.2:
  - Goal-reached detectors and simple rule-based evaluators
  - Rich personas (tone, constraints)
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
- ✅ Step indexing accurately tracks turns using `turnIndex` instead of message count
- ✅ Assistant and tool messages are properly separated in step traces
- ✅ JSONL and Tally outputs are correct and complete for evaluation


