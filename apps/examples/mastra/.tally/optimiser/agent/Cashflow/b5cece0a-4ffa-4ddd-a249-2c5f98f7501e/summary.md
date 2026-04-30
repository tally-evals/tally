# Cashflow Optimization Summary

Job: b5cece0a-4ffa-4ddd-a249-2c5f98f7501e
Max cycles configured: 3
Cycles completed: 3
Stop reason: maxCycles
Selected candidate: 78bc4b3b-0967-48b6-9d8e-cdef7cfdab09
Selected cycle output: 363b6d8a-9989-4b51-a264-7aac0bf17676
Selection reason: Required evals satisfied among compared cycles; Selected candidate 78bc4b3b-0967-48b6-9d8e-cdef7cfdab09 (cycle output 363b6d8a-9989-4b51-a264-7aac0bf17676) with weighted score 0.8882. Compared 3 cycle(s).

## Cycles
- Cycle 1
  - Candidate: f7c387d9-1727-4c5e-9f58-1e66e527bae7
  - Cycle output id: 218ed66b-c23b-4939-ae5a-21be2f364ccc
  - Aggregated pass rate: 0.8945
  - Single-turn overview: 7 of 7 eval(s) in this scope are failing.
Scope verdict totals: 311 pass, 74 fail (385 checks).
Failing eval evidence:
Answer Relevance: 53 pass, 2 fail, 55 total (96% pass)
Completeness: 53 pass, 2 fail, 55 total (96% pass)
Affordability Decision: 51 pass, 4 fail, 55 total (93% pass)
Clarification Precision: 38 pass, 17 fail, 55 total (69% pass)
Context Precision: 12 pass, 43 fail, 55 total (22% pass)
Context Recall: 54 pass, 1 fail, 55 total (98% pass)
Over Clarification: 50 pass, 5 fail, 55 total (91% pass)
  - Multi-turn overview: 1 of 2 eval(s) in this scope are failing.
Scope verdict totals: 55 pass, 2 fail (57 checks).
Failing eval evidence:
Overall Quality: 53 pass, 2 fail, 55 total (96% pass)
Passing evals: Role Adherence.
  - Failure analysis: 8 failure item(s)
  - Failure target blocks: full-prompt, summary-scorers
    - [step] Answer Relevance: 2 fail / 55 total
    - [step] Completeness: 2 fail / 55 total
    - [step] Affordability Decision: 4 fail / 55 total
    - [step] Clarification Precision: 17 fail / 55 total
    - [step] Context Precision: 43 fail / 55 total
    - [step] Context Recall: 1 fail / 55 total
    - [step] Over Clarification: 5 fail / 55 total
    - [summary] Overall Quality: 2 fail / 55 total
- Cycle 2
  - Candidate: 12aaf7e6-1bdd-4285-9e9a-84afd4edf6e4
  - Cycle output id: a60f0dde-4ff6-4868-a8d1-2db6fb758ce3
  - Aggregated pass rate: 0.9255
  - Single-turn overview: 7 of 7 eval(s) in this scope are failing.
Scope verdict totals: 326 pass, 59 fail (385 checks).
Failing eval evidence:
Answer Relevance: 54 pass, 1 fail, 55 total (98% pass)
Completeness: 52 pass, 3 fail, 55 total (95% pass)
Affordability Decision: 52 pass, 3 fail, 55 total (95% pass)
Clarification Precision: 48 pass, 7 fail, 55 total (87% pass)
Context Precision: 15 pass, 40 fail, 55 total (27% pass)
Context Recall: 54 pass, 1 fail, 55 total (98% pass)
Over Clarification: 51 pass, 4 fail, 55 total (93% pass)
  - Multi-turn overview: 1 of 2 eval(s) in this scope are failing.
Scope verdict totals: 56 pass, 1 fail (57 checks).
Failing eval evidence:
Overall Quality: 54 pass, 1 fail, 55 total (98% pass)
Passing evals: Role Adherence.
  - Failure analysis: 8 failure item(s)
  - Failure target blocks: full-prompt, summary-scorers
    - [step] Answer Relevance: 1 fail / 55 total
    - [step] Completeness: 3 fail / 55 total
    - [step] Affordability Decision: 3 fail / 55 total
    - [step] Clarification Precision: 7 fail / 55 total
    - [step] Context Precision: 40 fail / 55 total
    - [step] Context Recall: 1 fail / 55 total
    - [step] Over Clarification: 4 fail / 55 total
    - [summary] Overall Quality: 1 fail / 55 total
- Cycle 3 [SELECTED]
  - Candidate: 78bc4b3b-0967-48b6-9d8e-cdef7cfdab09
  - Cycle output id: 363b6d8a-9989-4b51-a264-7aac0bf17676
  - Aggregated pass rate: 0.8882
  - Single-turn overview: 6 of 7 eval(s) in this scope are failing.
Scope verdict totals: 303 pass, 82 fail (385 checks).
Failing eval evidence:
Completeness: 53 pass, 2 fail, 55 total (96% pass)
Affordability Decision: 46 pass, 9 fail, 55 total (84% pass)
Clarification Precision: 35 pass, 20 fail, 55 total (64% pass)
Context Precision: 9 pass, 46 fail, 55 total (16% pass)
Context Recall: 53 pass, 2 fail, 55 total (96% pass)
Over Clarification: 52 pass, 3 fail, 55 total (95% pass)
Passing evals: Answer Relevance.
  - Multi-turn overview: All 2 eval(s) in this scope are passing.
Scope verdict totals: 57 pass, 0 fail (57 checks).
Role Adherence: 2 pass, 0 fail, 2 total (100% pass)
Overall Quality: 55 pass, 0 fail, 55 total (100% pass)
  - Failure analysis: 6 failure item(s)
  - Failure target blocks: full-prompt
    - [step] Completeness: 2 fail / 55 total
    - [step] Affordability Decision: 9 fail / 55 total
    - [step] Clarification Precision: 20 fail / 55 total
    - [step] Context Precision: 46 fail / 55 total
    - [step] Context Recall: 2 fail / 55 total
    - [step] Over Clarification: 3 fail / 55 total
