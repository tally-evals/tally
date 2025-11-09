# @tally/trajectories (Design Preview)

A framework-agnostic trajectory generation package for building multi-turn conversation trajectories using:

- A goal and persona to guide the flow
- Optional steps (strict or loose adherence)
- Agent wrappers to accept agents from different ecosystems:
  - `withAISdkAgent(agent)` for AI SDK agents
  - `withMastraAgent(agent)` for Mastra agents
- Internal AI-as-user generation and AI SDK-style `ModelMessage` flow
- Built-in, configurable memory (can be disabled)
- One-step-per-line JSONL outputs and Tally `Conversation` conversion

Note: This package currently contains documentation only. Implementation will be added in a later phase.

## What this solves

- Reusable trajectory orchestration across runtimes (via small agent wrappers)
- Deterministic “strict” and exploratory “loose” flows
- AI-as-user simulation with persona guidance
- Built-in local memory with the option to disable

## High-level API (subject to change)

```ts
// Pseudocode: type names and signatures may evolve

const agent = withAISdkAgent(myAgent) // or withMastraAgent(myMastraAgent)

createTrajectory(
  {
    goal: string,
    persona: { name?: string; description: string; guardrails?: string[] },
    steps?: TrajectoryStep[],
    mode: 'strict' | 'loose',
    maxTurns?: number,
    userModel?: LanguageModel, // AI SDK model function for user generation
    memory?: { strategy: 'local' | 'none'; ttlMs?: number; capacity?: number; conversationId?: string },
  },
  agent,
);

runTrajectory(trajectory, {
  memory, // optional override of built-in memory
  userModel, // optional override of trajectory userModel
});
```

See `ARCHITECTURE.md` for the full design and type details.

## Status

- Docs-only design snapshot
- No runtime code yet
- Agents in this repo are slated to move to a separate examples repository


