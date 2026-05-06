# Cashflow Optimization Summary

Job: 2f8f73c6-57d1-4a3b-aa47-a64560b9b0f7
Max cycles configured: 3
Cycles completed: 3
Stop reason: maxCycles
Selected candidate: bf84c088-a5a5-46c1-9038-5ff5762c141a
Selected cycle output: 63f57f7d-9a12-4475-9bc1-fb93702ee9ee
Selection reason: Required evals satisfied among compared cycles; Selected candidate bf84c088-a5a5-46c1-9038-5ff5762c141a (cycle output 63f57f7d-9a12-4475-9bc1-fb93702ee9ee) with weighted score 0.8691. Compared 3 cycle(s).

## Cycles
- Cycle 1
  - Candidate: 3e3a54ab-ee9c-4b34-b18d-ad1e1decf854
  - Cycle output id: 4395eee9-9797-452c-957a-da50176e6919
  - Aggregated pass rate: 0.8491
  - Single-turn overview: 7 of 7 eval(s) in this scope are failing.
Scope verdict totals: 282 pass, 89 fail (371 checks).
Failing eval evidence:
Answer Relevance: 52 pass, 1 fail, 53 total (98% pass)
Completeness: 46 pass, 7 fail, 53 total (87% pass)
Affordability Decision: 47 pass, 6 fail, 53 total (89% pass)
Clarification Precision: 48 pass, 5 fail, 53 total (91% pass)
Context Precision: 6 pass, 47 fail, 53 total (11% pass)
Context Recall: 43 pass, 10 fail, 53 total (81% pass)
Over Clarification: 40 pass, 13 fail, 53 total (75% pass)
  - Multi-turn overview: 1 of 2 eval(s) in this scope are failing.
Scope verdict totals: 54 pass, 1 fail (55 checks).
Failing eval evidence:
Overall Quality: 52 pass, 1 fail, 53 total (98% pass)
Passing evals: Role Adherence.
  - Failure analysis: 8 failure item(s)
  - Failure target blocks: full-prompt, summary-scorers
    - [step] Answer Relevance: 1 fail / 53 total
    - [step] Completeness: 7 fail / 53 total
    - [step] Affordability Decision: 6 fail / 53 total
    - [step] Clarification Precision: 5 fail / 53 total
    - [step] Context Precision: 47 fail / 53 total
    - [step] Context Recall: 10 fail / 53 total
    - [step] Over Clarification: 13 fail / 53 total
    - [summary] Overall Quality: 1 fail / 53 total
- Cycle 2
  - Candidate: fdd6ad34-8dda-4eaf-9ede-fd164987777b
  - Cycle output id: 72d47fbc-23e7-43dc-8e7c-3a04128fa086
  - Aggregated pass rate: 0.7739
  - Single-turn overview: 7 of 7 eval(s) in this scope are failing.
Scope verdict totals: 302 pass, 83 fail (385 checks).
Failing eval evidence:
Answer Relevance: 54 pass, 1 fail, 55 total (98% pass)
Completeness: 49 pass, 6 fail, 55 total (89% pass)
Affordability Decision: 50 pass, 5 fail, 55 total (91% pass)
Clarification Precision: 50 pass, 5 fail, 55 total (91% pass)
Context Precision: 5 pass, 50 fail, 55 total (9% pass)
Context Recall: 44 pass, 11 fail, 55 total (80% pass)
Over Clarification: 50 pass, 5 fail, 55 total (91% pass)
  - Multi-turn overview: 2 of 2 eval(s) in this scope are failing.
Scope verdict totals: 53 pass, 4 fail (57 checks).
Failing eval evidence:
Role Adherence: 1 pass, 1 fail, 2 total (50% pass)
Overall Quality: 52 pass, 3 fail, 55 total (95% pass)
  - Failure analysis: 9 failure item(s)
  - Failure target blocks: full-prompt, multi-turn, summary-scorers
    - [step] Answer Relevance: 1 fail / 55 total
    - [step] Completeness: 6 fail / 55 total
    - [step] Affordability Decision: 5 fail / 55 total
    - [step] Clarification Precision: 5 fail / 55 total
    - [step] Context Precision: 50 fail / 55 total
    - [step] Context Recall: 11 fail / 55 total
    - [step] Over Clarification: 5 fail / 55 total
    - [conversation] Role Adherence: 1 fail / 2 total
    - [summary] Overall Quality: 3 fail / 55 total
- Cycle 3 [SELECTED]
  - Candidate: bf84c088-a5a5-46c1-9038-5ff5762c141a
  - Cycle output id: 63f57f7d-9a12-4475-9bc1-fb93702ee9ee
  - Aggregated pass rate: 0.8691
  - Single-turn overview: 7 of 7 eval(s) in this scope are failing.
Scope verdict totals: 301 pass, 84 fail (385 checks).
Failing eval evidence:
Answer Relevance: 53 pass, 2 fail, 55 total (96% pass)
Completeness: 48 pass, 7 fail, 55 total (87% pass)
Affordability Decision: 51 pass, 4 fail, 55 total (93% pass)
Clarification Precision: 49 pass, 6 fail, 55 total (89% pass)
Context Precision: 3 pass, 52 fail, 55 total (5% pass)
Context Recall: 50 pass, 5 fail, 55 total (91% pass)
Over Clarification: 47 pass, 8 fail, 55 total (85% pass)
  - Multi-turn overview: 1 of 2 eval(s) in this scope are failing.
Scope verdict totals: 56 pass, 1 fail (57 checks).
Failing eval evidence:
Overall Quality: 54 pass, 1 fail, 55 total (98% pass)
Passing evals: Role Adherence.
  - Failure analysis: 8 failure item(s)
  - Failure target blocks: full-prompt, summary-scorers
    - [step] Answer Relevance: 2 fail / 55 total
    - [step] Completeness: 7 fail / 55 total
    - [step] Affordability Decision: 4 fail / 55 total
    - [step] Clarification Precision: 6 fail / 55 total
    - [step] Context Precision: 52 fail / 55 total
    - [step] Context Recall: 5 fail / 55 total
    - [step] Over Clarification: 8 fail / 55 total
    - [summary] Overall Quality: 1 fail / 55 total
