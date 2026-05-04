# Cashflow Optimization Report (Job `193f220f-ab29-4c36-bb62-86cfd3710e72`)

# Gemini model: gemini-3-flash-preview
Generated on 2026-04-30 from:

- `.tally/optimiser/agent/Cashflow/193f220f-ab29-4c36-bb62-86cfd3710e72/summary.md`
- `.tally/optimiser/agent/Cashflow/193f220f-ab29-4c36-bb62-86cfd3710e72/result.json`

## Summary

- **Job ID**: `193f220f-ab29-4c36-bb62-86cfd3710e72`
- **Trajectories**: `trj-0`, `trj-1`
- **Max cycles configured**: `3`
- **Cycles completed**: `3`
- **Stop reason**: `maxCycles`
- **Optimizer required evals**: `Role Adherence` (Overall Quality removed from optimizer gates)
- **Selected candidate**: `72660330-6e24-4840-8f45-eb2714334c57`
- **Selected cycle output**: `68627542-6d56-4666-9095-49c4623a83f5`
- **Selected weighted score / aggregated pass rate**: `0.8882`

Selection reason:

> Required evals satisfied among compared cycles; Selected candidate `72660330-6e24-4840-8f45-eb2714334c57` (cycle output `68627542-6d56-4666-9095-49c4623a83f5`) with weighted score `0.8882`. Compared 3 cycle(s).

## Optimizer Policy (recorded in `result.json`)

- **Acceptance threshold**: `0.95` (not reached before `maxCycles`)
- **Required evals**: `Role Adherence`
- **Weights**:
  - Role Adherence: `0.15`
  - Affordability Decision: `0.15`
  - Answer Relevance: `0.10`
  - Clarification Precision: `0.10`
  - Over Clarification: `0.10`
  - Completeness: `0.05`
  - Context Precision: `0.05`
  - Context Recall: `0.05`

## Cycle Comparison

| Cycle | Selected | Candidate | Cycle output id | Aggregated pass rate | Required eval status | Notable failures |
| --- | --- | --- | --- | ---: | --- | --- |
| 1 | No | `2f61467b-6316-4641-85b8-dbe9b9f70fc1` | `b12f4a05-b49b-4390-825d-116e2d23778c` | `0.8667` | Role Adherence **passed** | Very low Context Precision (3/55 pass), Completeness (49/55), Over Clarification (44/55) |
| 2 | **Yes** | `72660330-6e24-4840-8f45-eb2714334c57` | `68627542-6d56-4666-9095-49c4623a83f5` | **`0.8882`** | Role Adherence **passed** | Context Precision (4/34 pass), Context Recall (30/34), Affordability (31/34) |
| 3 | No | `7d812022-653c-41e8-bae9-b1a03c4ee104` | `06832d27-4a36-4ca8-8eb6-ade7d461f911` | `0.8362` | Role Adherence **passed**, but Overall Quality had failures | Broader regressions; Overall Quality had 1 fail (34/35 pass) |

## Selected Candidate Details (Cycle 2)

Selected cycle output: `68627542-6d56-4666-9095-49c4623a83f5` (candidate `72660330-6e24-4840-8f45-eb2714334c57`).

### Single-turn evals (count = 34)

| Eval | Mean score | Pass / total | Pass rate |
| --- | ---: | ---: | ---: |
| Answer Relevance | `0.98` | `33 / 34` | `97.06%` |
| Completeness | `0.96` | `32 / 34` | `94.12%` |
| Affordability Decision | `0.94` | `31 / 34` | `91.18%` |
| Clarification Precision | `0.98` | `32 / 34` | `94.12%` |
| Context Precision | `0.2467` | `4 / 34` | `11.76%` |
| Context Recall | `0.90` | `30 / 34` | `88.24%` |
| Over Clarification | `0.9667` | `31 / 34` | `91.18%` |

### Multi-turn / scorer evals

| Eval | Count | Pass / total | Pass rate |
| --- | ---: | ---: | ---: |
| Role Adherence | 2 | `2 / 2` | `100%` |
| Overall Quality (computed by Tally; not used by optimizer) | 34 | `34 / 34` | `100%` |

## Key Observations

- **Overall Quality removal is reflected in optimizer config**: this job’s `result.json` shows Overall Quality is not present in `evaluationPolicy.evalWeights`, and `evaluationPolicy.requiredEvals` only contains `Role Adherence`.
- **Context Precision remains the dominant weakness**: selected cycle has `4 / 34` passes (11.76%), consistent with previous Cashflow runs.
- **Relevance and role adherence are strong**: Answer Relevance is 97% pass and Role Adherence is 100% pass (2/2).
- **Some degradation under ambiguity remains**: Affordability Decision (91% pass) and Context Recall (88% pass) indicate a small but meaningful number of failures across the two-trajectory set.

## Evidence Artifact Pointers (selected cycle)

The selected cycle stores per-trajectory artifacts here:

- `trj-0`: `.tally/optimiser/conversations/193f220f-ab29-4c36-bb62-86cfd3710e72-trj-0-72660330-6e24-4840-8f45-eb2714334c57/runs/tally/run-1777558790532-w4vwzes.json`
- `trj-1`: `.tally/optimiser/conversations/193f220f-ab29-4c36-bb62-86cfd3710e72-trj-1-72660330-6e24-4840-8f45-eb2714334c57/runs/tally/run-1777558847707-lvle44u.json`

