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
- Do not expose a separate “user adapter”; provide an internal AI-as-user generator.
- Provide built-in, configurable memory (can be disabled) without requiring external persistence.
- Produce artifacts compatible with Tally:
  - One line per step in JSONL
  - `Conversation` conversion for metrics
- Strong type-safety for core types and adapter boundaries.

---

## Non-Goals (Phase 1)

- No UI/CLI tooling beyond minimal helpers (future work).
- No baked-in evaluation metrics (handled by Tally).
- No external persistence layer beyond built-in local memory.

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
    planner.ts
    memory/
      interface.ts
      localMemory.ai.ts
      noopMemory.ts
  adapters/
    ai-sdk/
      agentAdapter.ts
      userAdapter.ts
      types.ts
    mastra/
      agentAdapter.ts
      userAdapter.ts
      types.ts
  policies/
    strictPolicy.ts
    loosePolicy.ts
  utils/
    messages.ts
    tracing.ts
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
  expectedOutcome?: string;
  requiredInfo?: readonly string[];
  hardStopIfMissing?: boolean;
}

interface MemoryConfig {
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
  memory?: MemoryConfig;      // built-in memory; defaults to 'local'
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
  agentMessages: readonly ModelMessage[];
  toolCalls?: readonly {
    toolCallId: string;
    toolName: string;
    args: unknown;
    result?: unknown;
  }[];
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

### Agent Wrappers (continued)

- Wrappers normalize each agent runtime to a consistent `AgentHandle.respond(history)`.
- History is represented as AI SDK `ModelMessage` throughout.
- Built-in local memory is provided and configurable; it can be disabled with `strategy: 'none'`.

---

## Orchestration and Policies

- **Strict Mode**:
  - Execute steps in order; deviations are violations.
  - If required info is missing:
    - Ask one clarifying question or stop if `hardStopIfMissing`.
  - Validate against `expectedOutcome` when provided.
- **Loose Mode**:
  - Steps act as guidance; allow reasonable deviations.
  - Answer the agent’s clarifying questions using persona + goal + steps context.
  - Prefer progress toward the goal over rigid adherence.

Execution loop (conceptual):
1. Resolve memory and conversationId (built-in memory).
2. Build the next user message via the internal AI-as-user generator (persona + goal + step) as a `ModelMessage`.
3. Call `agent.respond(history)` with full `ModelMessage` history.
4. Append messages to history via Memory.
5. Evaluate stop conditions: goal reached, maxTurns, policy violation.
6. Emit `StepTrace`.

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
  env?: {
    memory?: Memory; // override built-in memory if desired
  }
): Promise<TrajectoryResult>;

// Agent wrappers
function withAISdkAgent(agent: unknown): AgentHandle;
function withMastraAgent(agent: unknown): AgentHandle;

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

## Memory Strategy

- **Built-in Local Memory**:
  - `Map<string, readonly ModelMessage[]>`
  - Optional `ttlMs` and `capacity` for pruning
  - Always append user + assistant + tool messages in order
  - Tool-call/result pairing is preserved
- **Disable Option**:
  - `strategy: 'none'` to avoid storing history (stream-to-agent only).

---

## Migration Note: Agents to Examples Repo

- The current debug agents in this repo (e.g., travel planner) will be migrated to a separate examples repository.
- This trajectories package remains runtime-agnostic and does not ship any example agents.

---

## Validation & Testing Plan

- Unit:
  - Strict vs. loose policy behaviors
  - LocalMemory (eviction rules, TTL)
  - Adapters’ normalization and error propagation
- E2E:
  - Travel planner on AI SDK and Mastra (happy paths + clarify-first)
  - Dataset writing: JSONL one-step-per-line artifacts
- Performance:
  - Large history handling and memory pruning behavior

---

## Roadmap

- v0 (Docs → Skeleton):
  - Finalize types and public API
  - Implement agent wrappers (AI SDK first) and LocalMemory
  - JSONL writer + Tally conversion helpers
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

- Define and run trajectories with or without steps in strict/loose modes
- Accept agents via functional wrappers (`withAISdkAgent`, `withMastraAgent`) without changing orchestration code
- Built-in memory works out-of-the-box and can be disabled
- JSONL and Tally outputs are correct and complete for evaluation


