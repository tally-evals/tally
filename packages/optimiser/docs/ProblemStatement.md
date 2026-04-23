# Problem Statement

## Problem

Optimizer optimize the existing AI SDK cashflow agent as a prompt optimization problem.

The agent under evaluation is:

- `apps/examples/ai-sdk/src/agents/cashflow.ts`

The objective is to improve that agent's ability to run a cashflow-planning conversation correctly and efficiently across a fixed set of replayable trajectories.

## Why This Problem

This problem is a strong fit for the optimizer because it already has:

- an existing agent with a mutable system prompt
- replayable conversation artifacts under `apps/examples/ai-sdk/.tally/conversations/`
- existing trajectory definitions and tests
- existing Tally-based evaluation logic

It is also a good optimizer benchmark because the task is not only about final answer quality. The agent must gather missing financial information, avoid unnecessary clarification, use tools in the right order, run projections correctly, and explain results clearly.

That gives the optimizer meaningful failure signals instead of a single shallow exact-match objective.

## Agent Under Evaluation

The thing being optimized is only the `cashflowAgent`.

More specifically, Optimizer should optimize the prompt or prompt blocks that control:

- how the agent asks for missing information
- when the agent decides enough information has been collected
- how the agent sequences tool usage
- how the agent summarizes projection results
- how the agent handles simple what-if follow-ups


## Frozen Evaluation Set

The recommended initial fixed set is:

- `apps/examples/ai-sdk/.tally/conversations/cashflow-golden`
- `apps/examples/ai-sdk/tests/trajectories/cashflow/definitions.ts` using both:
  - `cashflowGoldenTrajectory`
  - `cashflowCurveTrajectory`

These two cases should be treated as complementary:

- `cashflow-golden` tests the clean happy path
- `cashflow-curve` tests incomplete information, clarification, and changing details

Using only the golden path is too narrow and risks optimizer overfitting. Using both gives a better measure of whether the optimizer improves the agent rather than merely memorizing one conversation.


