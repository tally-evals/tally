# Cashflow Optimization Summary

Job: ce72e8f0-63fc-44e1-91a3-6888a4223c4c
Max cycles configured: 3
Cycles completed: 3
Stop reason: maxCycles
Selected candidate: 77c07ad8-a89c-44fc-ad45-39a63d29308f
Selected cycle output: eed56777-706b-48e0-bd6d-4c9573067240
Selection reason: Required evals satisfied among compared cycles; Selected candidate 77c07ad8-a89c-44fc-ad45-39a63d29308f (cycle output eed56777-706b-48e0-bd6d-4c9573067240) with weighted score 0.9042. Compared 3 cycle(s).

## Cycles
- Cycle 1
  - Candidate: 3a17f0ec-656a-4b4a-829b-ece1951f133f
  - Cycle output id: b271a8b5-b5e4-4eb1-ba47-9a537a74a07a
  - Aggregated pass rate: 0.8654
  - Single-turn overview: 7 of 7 eval(s) in this scope are failing.
Scope verdict totals: 295 pass, 83 fail (378 checks).
Failing eval evidence:
Answer Relevance: 50 pass, 4 fail, 54 total (93% pass)
Completeness: 49 pass, 5 fail, 54 total (91% pass)
Affordability Decision: 50 pass, 4 fail, 54 total (93% pass)
Clarification Precision: 48 pass, 6 fail, 54 total (89% pass)
Context Precision: 5 pass, 49 fail, 54 total (9% pass)
Context Recall: 47 pass, 7 fail, 54 total (87% pass)
Over Clarification: 46 pass, 8 fail, 54 total (85% pass)
  - Multi-turn overview: All 2 eval(s) in this scope are passing.
Scope verdict totals: 56 pass, 0 fail (56 checks).
Role Adherence: 2 pass, 0 fail, 2 total (100% pass)
Overall Quality: 54 pass, 0 fail, 54 total (100% pass)
  - Failure analysis: 7 failure item(s)
  - Failure target blocks: full-prompt
    - [step] Answer Relevance: 4 fail / 54 total
    - [step] Completeness: 5 fail / 54 total
    - [step] Affordability Decision: 4 fail / 54 total
    - [step] Clarification Precision: 6 fail / 54 total
    - [step] Context Precision: 49 fail / 54 total
    - [step] Context Recall: 7 fail / 54 total
    - [step] Over Clarification: 8 fail / 54 total
- Cycle 2 [SELECTED]
  - Candidate: 77c07ad8-a89c-44fc-ad45-39a63d29308f
  - Cycle output id: eed56777-706b-48e0-bd6d-4c9573067240
  - Aggregated pass rate: 0.9042
  - Single-turn overview: 7 of 7 eval(s) in this scope are failing.
Scope verdict totals: 319 pass, 66 fail (385 checks).
Failing eval evidence:
Answer Relevance: 54 pass, 1 fail, 55 total (98% pass)
Completeness: 52 pass, 3 fail, 55 total (95% pass)
Affordability Decision: 53 pass, 2 fail, 55 total (96% pass)
Clarification Precision: 51 pass, 4 fail, 55 total (93% pass)
Context Precision: 5 pass, 50 fail, 55 total (9% pass)
Context Recall: 53 pass, 2 fail, 55 total (96% pass)
Over Clarification: 51 pass, 4 fail, 55 total (93% pass)
  - Multi-turn overview: All 2 eval(s) in this scope are passing.
Scope verdict totals: 57 pass, 0 fail (57 checks).
Role Adherence: 2 pass, 0 fail, 2 total (100% pass)
Overall Quality: 55 pass, 0 fail, 55 total (100% pass)
  - Failure analysis: 7 failure item(s)
  - Failure target blocks: full-prompt
    - [step] Answer Relevance: 1 fail / 55 total
    - [step] Completeness: 3 fail / 55 total
    - [step] Affordability Decision: 2 fail / 55 total
    - [step] Clarification Precision: 4 fail / 55 total
    - [step] Context Precision: 50 fail / 55 total
    - [step] Context Recall: 2 fail / 55 total
    - [step] Over Clarification: 4 fail / 55 total
- Cycle 3
  - Candidate: ef8f4bcc-4e47-4d95-88d5-be9ea3b20569
  - Cycle output id: 86c70bac-7323-4810-ae33-66c9e97c16a6
  - Aggregated pass rate: 0.7367
  - Single-turn overview: 7 of 7 eval(s) in this scope are failing.
Scope verdict totals: 256 pass, 87 fail (343 checks).
Failing eval evidence:
Answer Relevance: 44 pass, 5 fail, 49 total (90% pass)
Completeness: 41 pass, 8 fail, 49 total (84% pass)
Affordability Decision: 42 pass, 7 fail, 49 total (86% pass)
Clarification Precision: 43 pass, 6 fail, 49 total (88% pass)
Context Precision: 6 pass, 43 fail, 49 total (12% pass)
Context Recall: 39 pass, 10 fail, 49 total (80% pass)
Over Clarification: 41 pass, 8 fail, 49 total (84% pass)
  - Multi-turn overview: 2 of 2 eval(s) in this scope are failing.
Scope verdict totals: 47 pass, 4 fail (51 checks).
Failing eval evidence:
Role Adherence: 1 pass, 1 fail, 2 total (50% pass)
Overall Quality: 46 pass, 3 fail, 49 total (94% pass)
  - Failure analysis: 9 failure item(s)
  - Failure target blocks: full-prompt, multi-turn, summary-scorers
    - [step] Answer Relevance: 5 fail / 49 total
    - [step] Completeness: 8 fail / 49 total
    - [step] Affordability Decision: 7 fail / 49 total
    - [step] Clarification Precision: 6 fail / 49 total
    - [step] Context Precision: 43 fail / 49 total
    - [step] Context Recall: 10 fail / 49 total
    - [step] Over Clarification: 8 fail / 49 total
    - [conversation] Role Adherence: 1 fail / 2 total
    - [summary] Overall Quality: 3 fail / 49 total
