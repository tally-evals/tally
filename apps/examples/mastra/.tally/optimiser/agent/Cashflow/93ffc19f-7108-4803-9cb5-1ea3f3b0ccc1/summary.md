# Cashflow Optimization Summary

Job: 93ffc19f-7108-4803-9cb5-1ea3f3b0ccc1
Max cycles configured: 3
Cycles completed: 3
Stop reason: maxCycles
Selected candidate: a1e62bdb-af98-461d-9ec9-dcdd5c48d216
Selected cycle output: 944a2792-2863-405b-bf64-ea38671a4710
Selection reason: Required evals satisfied among compared cycles; Selected candidate a1e62bdb-af98-461d-9ec9-dcdd5c48d216 (cycle output 944a2792-2863-405b-bf64-ea38671a4710) with weighted score 0.9000. Compared 3 cycle(s).

## Cycles
- Cycle 1
  - Candidate: 32e5e1b9-dfb9-4590-9891-e2ff23c64699
  - Cycle output id: 7608f1f3-b63c-4a95-afc0-846f8b1bafac
  - Aggregated pass rate: 0.8812
  - Single-turn overview: 7 of 7 eval(s) in this scope are failing.
Scope verdict totals: 306 pass, 79 fail (385 checks).
Failing eval evidence:
Answer Relevance: 54 pass, 1 fail, 55 total (98% pass)
Completeness: 50 pass, 5 fail, 55 total (91% pass)
Affordability Decision: 51 pass, 4 fail, 55 total (93% pass)
Clarification Precision: 51 pass, 4 fail, 55 total (93% pass)
Context Precision: 4 pass, 51 fail, 55 total (7% pass)
Context Recall: 47 pass, 8 fail, 55 total (85% pass)
Over Clarification: 49 pass, 6 fail, 55 total (89% pass)
  - Multi-turn overview: 1 of 2 eval(s) in this scope are failing.
Scope verdict totals: 56 pass, 1 fail (57 checks).
Failing eval evidence:
Overall Quality: 54 pass, 1 fail, 55 total (98% pass)
Passing evals: Role Adherence.
  - Failure analysis: 8 failure item(s)
  - Failure target blocks: full-prompt, summary-scorers
    - [step] Answer Relevance: 1 fail / 55 total
    - [step] Completeness: 5 fail / 55 total
    - [step] Affordability Decision: 4 fail / 55 total
    - [step] Clarification Precision: 4 fail / 55 total
    - [step] Context Precision: 51 fail / 55 total
    - [step] Context Recall: 8 fail / 55 total
    - [step] Over Clarification: 6 fail / 55 total
    - [summary] Overall Quality: 1 fail / 55 total
- Cycle 2 [SELECTED]
  - Candidate: a1e62bdb-af98-461d-9ec9-dcdd5c48d216
  - Cycle output id: 944a2792-2863-405b-bf64-ea38671a4710
  - Aggregated pass rate: 0.9000
  - Single-turn overview: 7 of 7 eval(s) in this scope are failing.
Scope verdict totals: 242 pass, 52 fail (294 checks).
Failing eval evidence:
Answer Relevance: 41 pass, 1 fail, 42 total (98% pass)
Completeness: 39 pass, 3 fail, 42 total (93% pass)
Affordability Decision: 40 pass, 2 fail, 42 total (95% pass)
Clarification Precision: 39 pass, 3 fail, 42 total (93% pass)
Context Precision: 6 pass, 36 fail, 42 total (14% pass)
Context Recall: 38 pass, 4 fail, 42 total (90% pass)
Over Clarification: 39 pass, 3 fail, 42 total (93% pass)
  - Multi-turn overview: All 2 eval(s) in this scope are passing.
Scope verdict totals: 44 pass, 0 fail (44 checks).
Role Adherence: 2 pass, 0 fail, 2 total (100% pass)
Overall Quality: 42 pass, 0 fail, 42 total (100% pass)
  - Failure analysis: 7 failure item(s)
  - Failure target blocks: full-prompt
    - [step] Answer Relevance: 1 fail / 42 total
    - [step] Completeness: 3 fail / 42 total
    - [step] Affordability Decision: 2 fail / 42 total
    - [step] Clarification Precision: 3 fail / 42 total
    - [step] Context Precision: 36 fail / 42 total
    - [step] Context Recall: 4 fail / 42 total
    - [step] Over Clarification: 3 fail / 42 total
- Cycle 3
  - Candidate: dd657f4c-7e2b-4177-90d4-7eff4bf7d6f5
  - Cycle output id: 12c54f13-8511-48b1-b747-e6d542586869
  - Aggregated pass rate: 0.8400
  - Single-turn overview: 7 of 7 eval(s) in this scope are failing.
Scope verdict totals: 289 pass, 96 fail (385 checks).
Failing eval evidence:
Answer Relevance: 54 pass, 1 fail, 55 total (98% pass)
Completeness: 48 pass, 7 fail, 55 total (87% pass)
Affordability Decision: 46 pass, 9 fail, 55 total (84% pass)
Clarification Precision: 46 pass, 9 fail, 55 total (84% pass)
Context Precision: 3 pass, 52 fail, 55 total (5% pass)
Context Recall: 45 pass, 10 fail, 55 total (82% pass)
Over Clarification: 47 pass, 8 fail, 55 total (85% pass)
  - Multi-turn overview: 1 of 2 eval(s) in this scope are failing.
Scope verdict totals: 56 pass, 1 fail (57 checks).
Failing eval evidence:
Overall Quality: 54 pass, 1 fail, 55 total (98% pass)
Passing evals: Role Adherence.
  - Failure analysis: 8 failure item(s)
  - Failure target blocks: full-prompt, summary-scorers
    - [step] Answer Relevance: 1 fail / 55 total
    - [step] Completeness: 7 fail / 55 total
    - [step] Affordability Decision: 9 fail / 55 total
    - [step] Clarification Precision: 9 fail / 55 total
    - [step] Context Precision: 52 fail / 55 total
    - [step] Context Recall: 10 fail / 55 total
    - [step] Over Clarification: 8 fail / 55 total
    - [summary] Overall Quality: 1 fail / 55 total
