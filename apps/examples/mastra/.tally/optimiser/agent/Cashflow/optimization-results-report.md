# Cashflow Agent Optimization Results Report

Generated on 2026-04-30 from the persisted Cashflow optimizer artifacts under `.tally/optimiser/agent/Cashflow`.

## Executive Summary

Two optimization runs were reviewed for the Cashflow agent:

1. A single-trajectory run over the golden Cashflow setup flow (`trj-0`).
2. A two-trajectory run over both the golden flow (`trj-0`) and the curve-ball ambiguity flow (`trj-1`).

Both runs completed the configured maximum of 3 cycles and stopped because `maxCycles` was reached. In both cases, the final selected candidate satisfied the required gates, `Overall Quality` and `Role Adherence`, but neither run crossed the configured `0.95` acceptance threshold.

The single-trajectory run produced the stronger selected result with a weighted score / aggregated pass rate of `0.9440`. The two-trajectory run selected a more broadly viable candidate at `0.8882`, because it was the only candidate in that run whose required evals were fully passing. The largest recurring weakness across both runs is `Context Precision`: the agent often uses or includes more context than the evaluator expects, even when the answer is otherwise relevant, complete, role-aligned, and financially useful.

## Source Artifacts

| Run | Job ID | Artifact |
| --- | --- | --- |
| Single trajectory | `004a0e15-c6b5-4660-b0a8-14270d453a83` | `.tally/optimiser/agent/Cashflow/004a0e15-c6b5-4660-b0a8-14270d453a83/result.json` |
| Single trajectory summary | `004a0e15-c6b5-4660-b0a8-14270d453a83` | `.tally/optimiser/agent/Cashflow/004a0e15-c6b5-4660-b0a8-14270d453a83/summary.md` |
| Two trajectories | `b5cece0a-4ffa-4ddd-a249-2c5f98f7501e` | `.tally/optimiser/agent/Cashflow/b5cece0a-4ffa-4ddd-a249-2c5f98f7501e/result.json` |
| Two trajectories summary | `b5cece0a-4ffa-4ddd-a249-2c5f98f7501e` | `.tally/optimiser/agent/Cashflow/b5cece0a-4ffa-4ddd-a249-2c5f98f7501e/summary.md` |

## Evaluation Setup

### Optimizer Configuration

| Setting | Value |
| --- | --- |
| Max cycles | `3` |
| Acceptance threshold | `0.95` |
| Stop reason for both runs | `maxCycles` |
| Required evals | `Overall Quality`, `Role Adherence` |
| Eval model | `models/gemini-3.1-flash-lite-preview` |

### Weighted Selection Policy

| Eval | Weight |
| --- | ---: |
| Overall Quality | `0.25` |
| Role Adherence | `0.15` |
| Affordability Decision | `0.15` |
| Answer Relevance | `0.10` |
| Clarification Precision | `0.10` |
| Over Clarification | `0.10` |
| Completeness | `0.05` |
| Context Precision | `0.05` |
| Context Recall | `0.05` |

The selection policy makes `Overall Quality` and `Role Adherence` hard gates, while the other metrics influence ranking through their weights. This explains why the two-trajectory run selected cycle 3 even though cycle 2 had the higher aggregate pass rate: cycle 2 still had an `Overall Quality` failure, while cycle 3 fully passed both required evals.

### Trajectories

| Trajectory | Name | Purpose | Turns / checks implied by selected runs |
| --- | --- | --- | --- |
| `trj-0` | Golden Cashflow flow | Complete profile setup, projection, scenario, and final projection review. | Single selected run: 25 single-turn checks and 1 role-adherence check. |
| `trj-1` | Curve-ball Cashflow flow | Ambiguous, incomplete, changing, and conflicting financial details. | Two-trajectory selected run combined with `trj-0`: 55 single-turn checks and 2 role-adherence checks. |

## Run 1: Single-Trajectory Optimization

### Final Decision

| Field | Value |
| --- | --- |
| Job ID | `004a0e15-c6b5-4660-b0a8-14270d453a83` |
| Trajectories | `trj-0` |
| Created at | `2026-04-29T14:39:09.530Z` |
| Completed cycles | `3` |
| Stop reason | `maxCycles` |
| Selected cycle | Cycle 1 |
| Selected candidate | `a6f7125c-9b64-4c0a-ad8e-5cf233862095` |
| Selected cycle output | `4fb0003e-c5e9-43ad-a59d-b779648ac19f` |
| Selected weighted score | `0.9440` |

The single-trajectory run selected the first candidate. It was the strongest candidate by weighted score and it satisfied both required evals. The run still continued to 3 cycles because the selected score was below the configured `0.95` acceptance threshold.

### Cycle Comparison

| Cycle | Selected | Candidate | Aggregated pass rate | Required eval status | Main failures |
| --- | --- | --- | ---: | --- | --- |
| 1 | Yes | `a6f7125c-9b64-4c0a-ad8e-5cf233862095` | `0.9440` | `Overall Quality` passed, `Role Adherence` passed | `Context Precision`, plus isolated `Clarification Precision` and `Over Clarification` failures |
| 2 | No | `0ab3b361-b9ca-472f-9675-a727c35dd787` | `0.9067` | `Role Adherence` passed, `Overall Quality` had failures | Failures across all single-turn evals; `Context Precision` remained the largest issue |
| 3 | No | `1bc75c8e-b950-48c3-acb4-a735c831328f` | `0.7933` | `Overall Quality` passed, `Role Adherence` failed | Role failure and broad single-turn regressions |

### Selected Candidate Metrics

| Eval | Scope | Mean score | Raw mean | Pass / total | Pass rate |
| --- | --- | ---: | ---: | ---: | ---: |
| Answer Relevance | Single-turn | `0.992` | `4.96` | `25 / 25` | `100.00%` |
| Completeness | Single-turn | `0.960` | `4.80` | `25 / 25` | `100.00%` |
| Affordability Decision | Single-turn | `0.992` | `4.96` | `25 / 25` | `100.00%` |
| Clarification Precision | Single-turn | `0.968` | `4.84` | `24 / 25` | `96.00%` |
| Context Precision | Single-turn | `0.248` | `1.24` | `1 / 25` | `4.00%` |
| Context Recall | Single-turn | `0.992` | `4.96` | `25 / 25` | `100.00%` |
| Over Clarification | Single-turn | `0.944` | `4.72` | `24 / 25` | `96.00%` |
| Role Adherence | Multi-turn | `1.000` | `5.00` | `1 / 1` | `100.00%` |
| Overall Quality | Scorer | `0.910` | N/A | `25 / 25` | `100.00%` |

### Interpretation

The selected single-trajectory candidate is strong on the user-facing quality dimensions that matter most for a golden-path cashflow assistant. It stays relevant, follows the cashflow assistant role, makes affordability decisions well, and maintains enough information to satisfy context recall.

The weakness is narrow but severe: `Context Precision` passed only `1 / 25` checks. This suggests the agent generally remembers or references the needed facts, but it may include unnecessary or loosely related context when answering. Since `Context Precision` has a relatively low selection weight of `0.05`, the optimizer can still select a candidate with very poor precision when higher-weight and required metrics are strong.

## Run 2: Two-Trajectory Optimization

### Final Decision

| Field | Value |
| --- | --- |
| Job ID | `b5cece0a-4ffa-4ddd-a249-2c5f98f7501e` |
| Trajectories | `trj-0`, `trj-1` |
| Created at | `2026-04-30T07:57:53.195Z` |
| Completed cycles | `3` |
| Stop reason | `maxCycles` |
| Selected cycle | Cycle 3 |
| Selected candidate | `78bc4b3b-0967-48b6-9d8e-cdef7cfdab09` |
| Selected cycle output | `363b6d8a-9989-4b51-a264-7aac0bf17676` |
| Selected weighted score | `0.8882` |

The two-trajectory run selected cycle 3. Cycle 2 had the highest aggregate pass rate (`0.9255`), but it still had an `Overall Quality` failure. Cycle 3 had a lower aggregate pass rate, but it fully satisfied both required evals across the broader trajectory set.

### Cycle Comparison

| Cycle | Selected | Candidate | Aggregated pass rate | Required eval status | Main failures |
| --- | --- | --- | ---: | --- | --- |
| 1 | No | `f7c387d9-1727-4c5e-9f58-1e66e527bae7` | `0.8945` | `Role Adherence` passed, `Overall Quality` had failures | All single-turn evals had at least some failures; `Context Precision` and `Clarification Precision` were largest |
| 2 | No | `12aaf7e6-1bdd-4285-9e9a-84afd4edf6e4` | `0.9255` | `Role Adherence` passed, `Overall Quality` had failures | Best aggregate score, but still failed the required `Overall Quality` gate |
| 3 | Yes | `78bc4b3b-0967-48b6-9d8e-cdef7cfdab09` | `0.8882` | `Overall Quality` passed, `Role Adherence` passed | Lower aggregate score, but no required-eval failures |

### Selected Candidate Metrics

| Eval | Scope | Mean score | Raw mean | Pass / total | Pass rate |
| --- | --- | ---: | ---: | ---: | ---: |
| Answer Relevance | Single-turn | `1.000` | `5.00` | `55 / 55` | `100.00%` |
| Completeness | Single-turn | `0.953` | `4.77` | `53 / 55` | `96.36%` |
| Affordability Decision | Single-turn | `0.940` | `4.70` | `46 / 55` | `83.64%` |
| Clarification Precision | Single-turn | `0.947` | `4.73` | `35 / 55` | `63.64%` |
| Context Precision | Single-turn | `0.400` | `2.00` | `9 / 55` | `16.36%` |
| Context Recall | Single-turn | `0.987` | `4.93` | `53 / 55` | `96.36%` |
| Over Clarification | Single-turn | `0.953` | `4.77` | `52 / 55` | `94.55%` |
| Role Adherence | Multi-turn | `1.000` | `5.00` | `2 / 2` | `100.00%` |
| Overall Quality | Scorer | `0.914` | N/A | `55 / 55` | `100.00%` |

### Interpretation

Adding the curve-ball trajectory made the optimization problem meaningfully harder. The selected candidate remained excellent on answer relevance and passed both required evals, but performance fell on metrics that measure disciplined interaction behavior under ambiguity.

The biggest degradation is `Clarification Precision`, which dropped to `35 / 55` passing checks. That is expected for a trajectory that intentionally gives incomplete, vague, changing, and conflicting data, but it indicates the agent still needs stronger rules for deciding when to ask a targeted question versus proceeding with assumptions.

`Affordability Decision` also dropped to `46 / 55`. This is important because affordability decisions are weighted heavily (`0.15`) and are central to the Cashflow agent's purpose. The likely issue is not general relevance, because `Answer Relevance` is perfect, but the reliability of concrete financial judgment when the input state is ambiguous or changing.

`Context Precision` improved compared with the single-trajectory run, from `4.00%` to `16.36%`, but it remains the largest absolute failure area. The two-trajectory selected candidate is better at selecting useful context than the single-trajectory selected candidate, but still fails most precision checks.

## Side-By-Side Comparison

| Area | Single trajectory selected candidate | Two-trajectory selected candidate | Direction |
| --- | ---: | ---: | --- |
| Weighted score / aggregate pass rate | `0.9440` | `0.8882` | Down with broader coverage |
| Answer Relevance pass rate | `100.00%` | `100.00%` | Stable |
| Completeness pass rate | `100.00%` | `96.36%` | Slightly down |
| Affordability Decision pass rate | `100.00%` | `83.64%` | Down |
| Clarification Precision pass rate | `96.00%` | `63.64%` | Down significantly |
| Context Precision pass rate | `4.00%` | `16.36%` | Up, but still weak |
| Context Recall pass rate | `100.00%` | `96.36%` | Slightly down |
| Over Clarification pass rate | `96.00%` | `94.55%` | Stable |
| Role Adherence pass rate | `100.00%` | `100.00%` | Stable |
| Overall Quality pass rate | `100.00%` | `100.00%` | Stable |

## Key Findings

### 1. Required Gates Are Working

The optimizer consistently selected candidates that passed `Overall Quality` and `Role Adherence`, even when another candidate had a better raw aggregate pass rate. This is especially visible in the two-trajectory run, where cycle 2 scored `0.9255` but was not selected because it still had an `Overall Quality` failure.

### 2. The Single-Trajectory Candidate Is Best for the Golden Path

The selected single-trajectory candidate is strong for the happy path. It has perfect pass rates on answer relevance, completeness, affordability decisions, context recall, role adherence, and overall quality. It only shows meaningful weakness on context precision.

### 3. The Two-Trajectory Candidate Is More Robust but Less Precise

The selected two-trajectory candidate handles both the golden and ambiguous flows while preserving the required gates. It is the better candidate for broader evaluation coverage, but its lower aggregate score shows that robustness came with more failures in detailed step-level behavior.

The main concerns in the broader run are:

- `Clarification Precision`: `20 / 55` failures.
- `Context Precision`: `46 / 55` failures.
- `Affordability Decision`: `9 / 55` failures.

These are exactly the metrics most likely to suffer when the user is uncertain, changes details, or asks for projections before setup is complete.

### 4. Context Recall Is Stronger Than Context Precision

Both selected candidates mostly remember and use the needed information:

- Single trajectory `Context Recall`: `25 / 25`.
- Two trajectories `Context Recall`: `53 / 55`.

But both candidates struggle to avoid unnecessary context:

- Single trajectory `Context Precision`: `1 / 25`.
- Two trajectories `Context Precision`: `9 / 55`.

### 5. Clarification Behavior Needs More Explicit Policy

The curve-ball trajectory exposes a clarification policy gap. The agent can stay relevant, but it does not always ask the right amount of clarification at the right time.

The prompt likely needs sharper instructions for cases such as:

- Missing date for a future cashflow.
- Missing frequency for recurring income or expense.
- Conflicting values for the same income, expense, or balance.
- Projection requested before the profile is complete.
- User asks affordability or runway questions with insufficient data.


## Recommended Prompt Changes

### Priority 1: Improve Context Precision

Add prompt guidance that forces the agent to filter context before answering:

```text
Before responding, identify the exact cashflow facts needed for the user's current request.
Use only those facts in the answer. Do not restate unrelated income, expenses, profile data,
or previous scenario details unless they change the calculation or recommendation.
```

Expected impact:

- Higher `Context Precision`.
- Less verbose responses.
- Lower risk of mixing unrelated past details into a current affordability decision.

### Priority 2: Add a Clarification Decision Rule

Add a compact policy for ambiguity:

```text
If a required calculation field is missing or contradictory, ask one targeted clarification.
If the missing detail does not block a useful answer, state a clear assumption and continue.
Do not ask multiple clarification questions at once unless all are required for the same calculation.
```

Expected impact:

- Higher `Clarification Precision`.
- Better handling of the curve-ball trajectory.
- Reduced over-clarification while still preserving calculation correctness.

### Priority 3: Strengthen Affordability Decision Criteria

Add a stable decision format:

```text
For affordability questions, answer with: decision, key numbers, assumptions, risk level,
and next action. Base the decision on projected lowest balance, safety buffer, known upcoming
cashflows, and any explicitly requested what-if scenario.
```

Expected impact:

- Higher `Affordability Decision`.
- More consistent reasoning under incomplete or changing data.
- Better alignment with the Cashflow agent's core job.

### Priority 4: Preserve Role Adherence While Tightening Responses

The selected candidates already pass role adherence. Any prompt change should keep the existing role framing, but reduce unnecessary context and make financial judgment stricter.

Recommended framing:

```text
You are a cashflow management assistant. Stay focused on tracking income, expenses,
future cashflows, projections, affordability, risk, and user-understandable next steps.
Avoid generic financial advice that is not connected to the user's cashflow data.
```

## Suggested Next Optimization Run

Use both trajectories for the next run, because the two-trajectory setup exposes the real weaknesses better than the golden path alone.

Suggested next-run goal:

| Setting | Recommendation |
| --- | --- |
| Trajectories | Keep `trj-0` and `trj-1` |
| Max cycles | Increase to `4` or `5` if runtime/cost is acceptable |
| Required evals | Keep `Overall Quality` and `Role Adherence`; consider adding `Affordability Decision` if the agent must be production-reliable |
| Weights | Consider raising `Context Precision` from `0.05` to `0.10` if concise context use is important |
| Prompt target | Minimal relevant context, one-question clarification policy, stricter affordability format |

