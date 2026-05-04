# Cashflow Optimization Comparison Report (Jobs `193f220f…` vs `ce72e8…`)

# Gemini model: gemini-3-flash-preview

## Summary

Both jobs’ selected trajectory `stepTraces.json` record the model as **`gemini-3-flash-preview`**, so the outcome differences below are **not** due to a model change.

### Job `193f220f-ab29-4c36-bb62-86cfd3710e72` (2026-04-30)

- **Trajectories**: `trj-0`, `trj-1`
- **Max cycles configured**: `3`
- **Cycles completed**: `3`
- **Stop reason**: `maxCycles`
- **Optimizer required evals**: `Role Adherence`
- **Selected candidate**: `72660330-6e24-4840-8f45-eb2714334c57`
- **Selected cycle output**: `68627542-6d56-4666-9095-49c4623a83f5`
- **Selected weighted score / aggregated pass rate**: `0.8882`

Selection reason:

> Required evals satisfied among compared cycles; Selected candidate `72660330-6e24-4840-8f45-eb2714334c57` (cycle output `68627542-6d56-4666-9095-49c4623a83f5`) with weighted score `0.8882`. Compared 3 cycle(s).

### Job `ce72e8f0-63fc-44e1-91a3-6888a4223c4c` (2026-05-04)

- **Trajectories**: `trj-0`, `trj-1`
- **Max cycles configured**: `3`
- **Cycles completed**: `3`
- **Stop reason**: `maxCycles`
- **Optimizer required evals**: `Role Adherence`
- **Selected candidate**: `77c07ad8-a89c-44fc-ad45-39a63d29308f`
- **Selected cycle output**: `eed56777-706b-48e0-bd6d-4c9573067240`
- **Selected weighted score / aggregated pass rate**: `0.9042`

Selection reason:

> Required evals satisfied among compared cycles; Selected candidate `77c07ad8-a89c-44fc-ad45-39a63d29308f` (cycle output `eed56777-706b-48e0-bd6d-4c9573067240`) with weighted score `0.9042`. Compared 3 cycle(s).


## Optimizer Policy (recorded in `result.json`)

(Same policy across both jobs.)

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

### Job `193f220f…`

| Cycle | Selected | Candidate | Cycle output id | Aggregated pass rate | Required eval status | Notable failures |
| --- | --- | --- | --- | ---: | --- | --- |
| 1 | No | `2f61467b-6316-4641-85b8-dbe9b9f70fc1` | `b12f4a05-b49b-4390-825d-116e2d23778c` | `0.8667` | Role Adherence **passed** | Very low Context Precision (3/55 pass) |
| 2 | **Yes** | `72660330-6e24-4840-8f45-eb2714334c57` | `68627542-6d56-4666-9095-49c4623a83f5` | **`0.8882`** | Role Adherence **passed** | Context Precision (4/34 pass), Context Recall (30/34), Affordability (31/34) |
| 3 | No | `7d812022-653c-41e8-bae9-b1a03c4ee104` | `06832d27-4a36-4ca8-8eb6-ade7d461f911` | `0.8362` | Role Adherence **passed**, but other regressions | Overall Quality had 1 fail (34/35 pass) |

### Job `ce72e8…`

| Cycle | Selected | Candidate | Cycle output id | Aggregated pass rate | Required eval status | Notable failures |
| --- | --- | --- | --- | ---: | --- | --- |
| 1 | No | `3a17f0ec-656a-4b4a-829b-ece1951f133f` | `b271a8b5-b5e4-4eb1-ba47-9a537a74a07a` | `0.8654` | Role Adherence **passed** | Very low Context Precision (5/54 pass) |
| 2 | **Yes** | `77c07ad8-a89c-44fc-ad45-39a63d29308f` | `eed56777-706b-48e0-bd6d-4c9573067240` | **`0.9042`** | Role Adherence **passed** | Context Precision (5/55 pass) |
| 3 | No | `ef8f4bcc-4e47-4d95-88d5-be9ea3b20569` | `86c70bac-7323-4810-ae33-66c9e97c16a6` | `0.7367` | Role Adherence **failed** | Multi-turn Role Adherence 1/2; broader regressions |

## Selected Candidate Details

### Job `193f220f…` (selected Cycle 2)

Selected cycle output: `68627542-6d56-4666-9095-49c4623a83f5` (candidate `72660330-6e24-4840-8f45-eb2714334c57`).

#### Single-turn evals (count = 34)

| Eval | Mean score | Pass / total | Pass rate |
| --- | ---: | ---: | ---: |
| Answer Relevance | `0.98` | `33 / 34` | `97.06%` |
| Completeness | `0.96` | `32 / 34` | `94.12%` |
| Affordability Decision | `0.94` | `31 / 34` | `91.18%` |
| Clarification Precision | `0.98` | `32 / 34` | `94.12%` |
| Context Precision | `0.2467` | `4 / 34` | `11.76%` |
| Context Recall | `0.90` | `30 / 34` | `88.24%` |
| Over Clarification | `0.9667` | `31 / 34` | `91.18%` |

#### Multi-turn / scorer evals

| Eval | Count | Pass / total | Pass rate |
| --- | ---: | ---: | ---: |
| Role Adherence | 2 | `2 / 2` | `100%` |
| Overall Quality (computed by Tally; not used by optimizer) | 34 | `34 / 34` | `100%` |

### Job `ce72e8…` (selected Cycle 2)

Selected cycle output: `eed56777-706b-48e0-bd6d-4c9573067240` (candidate `77c07ad8-a89c-44fc-ad45-39a63d29308f`).

#### Single-turn evals (count = 55)

| Eval | Mean score | Pass / total | Pass rate |
| --- | ---: | ---: | ---: |
| Answer Relevance | `0.98` | `54 / 55` | `98.18%` |
| Completeness | `0.9733` | `52 / 55` | `94.55%` |
| Affordability Decision | `1` | `53 / 55` | `96.36%` |
| Clarification Precision | `0.98` | `51 / 55` | `92.73%` |
| Context Precision | `0.22` | `5 / 55` | `9.09%` |
| Context Recall | `0.9467` | `53 / 55` | `96.36%` |
| Over Clarification | `0.98` | `51 / 55` | `92.73%` |

#### Multi-turn / scorer evals

| Eval | Count | Pass / total | Pass rate |
| --- | ---: | ---: | ---: |
| Role Adherence | 2 | `2 / 2` | `100%` |
| Overall Quality (computed by Tally; not used by optimizer) | 55 | `55 / 55` | `100%` |

## Key Observations

- **`ce72e8…` improves aggregate score**: `0.9042` vs `0.8882` on the selected cycle.
- **Affordability Decision and Context Recall improved** in the selected cycle (91.18% → 96.36% and 88.24% → 96.36% respectively).
- **Other small gains vs `report2.md`**: Answer Relevance **+1.12pp** (97.06% → 98.18%), Completeness **+0.43pp** (94.12% → 94.55%), Over Clarification **+1.55pp** (91.18% → 92.73%).
- **Context Precision remains the dominant weakness** in both (11.76% vs 9.09%).
- **Role Adherence is stable at 100%** for both selected candidates; one non-selected `ce72e8…` cycle (Cycle 3) shows that multi-turn failures are still possible under some prompt candidates.



