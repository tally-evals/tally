# Cashflow Optimization Summary

Job: a23ab22c-ad5d-4167-8d13-1ebc40d1d171
Max cycles configured: 3
Cycles completed: 3
Stop reason: maxCycles
Selected candidate: 1c0bd178-4e56-4a4a-a5a7-26cdcbc2589c
Selected cycle output: 770985b3-b432-469d-8329-60c99eb69de7
Selection reason: Required evals satisfied among compared cycles; Selected candidate 1c0bd178-4e56-4a4a-a5a7-26cdcbc2589c (cycle output 770985b3-b432-469d-8329-60c99eb69de7) with weighted score 0.8870. Compared 3 cycle(s).

## Cycles
- Cycle 1
  - Candidate: 46f169d1-f8b9-44d0-b03b-65e7e6b4f02c
  - Cycle output id: 46a1c3ba-72f8-4082-88df-5f37566a3555
  - Aggregated pass rate: 0.8765
  - Single-turn overview: 7 of 7 eval(s) in this scope are failing.
Scope verdict totals: 188 pass, 50 fail (238 checks).
Failing eval evidence:
Answer Relevance: 33 pass, 1 fail, 34 total (97% pass)
Completeness: 31 pass, 3 fail, 34 total (91% pass)
Affordability Decision: 30 pass, 4 fail, 34 total (88% pass)
Clarification Precision: 32 pass, 2 fail, 34 total (94% pass)
Context Precision: 3 pass, 31 fail, 34 total (9% pass)
Context Recall: 27 pass, 7 fail, 34 total (79% pass)
Over Clarification: 32 pass, 2 fail, 34 total (94% pass)
  - Multi-turn overview: All 2 eval(s) in this scope are passing.
Scope verdict totals: 36 pass, 0 fail (36 checks).
Role Adherence: 2 pass, 0 fail, 2 total (100% pass)
Overall Quality: 34 pass, 0 fail, 34 total (100% pass)
  - Failure analysis: 7 failure item(s)
  - Failure target blocks: full-prompt
    - [step] Answer Relevance: 1 fail / 34 total
    - [step] Completeness: 3 fail / 34 total
    - [step] Affordability Decision: 4 fail / 34 total
    - [step] Clarification Precision: 2 fail / 34 total
    - [step] Context Precision: 31 fail / 34 total
    - [step] Context Recall: 7 fail / 34 total
    - [step] Over Clarification: 2 fail / 34 total
- Cycle 2 [SELECTED]
  - Candidate: 1c0bd178-4e56-4a4a-a5a7-26cdcbc2589c
  - Cycle output id: 770985b3-b432-469d-8329-60c99eb69de7
  - Aggregated pass rate: 0.8870
  - Single-turn overview: 7 of 7 eval(s) in this scope are failing.
Scope verdict totals: 201 pass, 51 fail (252 checks).
Failing eval evidence:
Answer Relevance: 35 pass, 1 fail, 36 total (97% pass)
Completeness: 34 pass, 2 fail, 36 total (94% pass)
Affordability Decision: 34 pass, 2 fail, 36 total (94% pass)
Clarification Precision: 33 pass, 3 fail, 36 total (92% pass)
Context Precision: 3 pass, 33 fail, 36 total (8% pass)
Context Recall: 28 pass, 8 fail, 36 total (78% pass)
Over Clarification: 34 pass, 2 fail, 36 total (94% pass)
  - Multi-turn overview: All 2 eval(s) in this scope are passing.
Scope verdict totals: 38 pass, 0 fail (38 checks).
Role Adherence: 2 pass, 0 fail, 2 total (100% pass)
Overall Quality: 36 pass, 0 fail, 36 total (100% pass)
  - Failure analysis: 7 failure item(s)
  - Failure target blocks: full-prompt
    - [step] Answer Relevance: 1 fail / 36 total
    - [step] Completeness: 2 fail / 36 total
    - [step] Affordability Decision: 2 fail / 36 total
    - [step] Clarification Precision: 3 fail / 36 total
    - [step] Context Precision: 33 fail / 36 total
    - [step] Context Recall: 8 fail / 36 total
    - [step] Over Clarification: 2 fail / 36 total
- Cycle 3
  - Candidate: e3154fc7-8846-4cba-80fc-86bb0bbe46d5
  - Cycle output id: 3f9c0469-0fef-49dc-b2e2-0c995ae3b07d
  - Aggregated pass rate: 0.7407
  - Single-turn overview: 7 of 7 eval(s) in this scope are failing.
Scope verdict totals: 189 pass, 63 fail (252 checks).
Failing eval evidence:
Answer Relevance: 34 pass, 2 fail, 36 total (94% pass)
Completeness: 29 pass, 7 fail, 36 total (81% pass)
Affordability Decision: 33 pass, 3 fail, 36 total (92% pass)
Clarification Precision: 27 pass, 9 fail, 36 total (75% pass)
Context Precision: 6 pass, 30 fail, 36 total (17% pass)
Context Recall: 30 pass, 6 fail, 36 total (83% pass)
Over Clarification: 30 pass, 6 fail, 36 total (83% pass)
  - Multi-turn overview: 2 of 2 eval(s) in this scope are failing.
Scope verdict totals: 35 pass, 3 fail (38 checks).
Failing eval evidence:
Role Adherence: 1 pass, 1 fail, 2 total (50% pass)
Overall Quality: 34 pass, 2 fail, 36 total (94% pass)
  - Failure analysis: 9 failure item(s)
  - Failure target blocks: full-prompt, multi-turn, summary-scorers
    - [step] Answer Relevance: 2 fail / 36 total
    - [step] Completeness: 7 fail / 36 total
    - [step] Affordability Decision: 3 fail / 36 total
    - [step] Clarification Precision: 9 fail / 36 total
    - [step] Context Precision: 30 fail / 36 total
    - [step] Context Recall: 6 fail / 36 total
    - [step] Over Clarification: 6 fail / 36 total
    - [conversation] Role Adherence: 1 fail / 2 total
    - [summary] Overall Quality: 2 fail / 36 total
