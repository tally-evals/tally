# Cashflow Optimization Summary

Job: 193f220f-ab29-4c36-bb62-86cfd3710e72
Max cycles configured: 3
Cycles completed: 3
Stop reason: maxCycles
Selected candidate: 72660330-6e24-4840-8f45-eb2714334c57
Selected cycle output: 68627542-6d56-4666-9095-49c4623a83f5
Selection reason: Required evals satisfied among compared cycles; Selected candidate 72660330-6e24-4840-8f45-eb2714334c57 (cycle output 68627542-6d56-4666-9095-49c4623a83f5) with weighted score 0.8882. Compared 3 cycle(s).

## Cycles
- Cycle 1
  - Candidate: 2f61467b-6316-4641-85b8-dbe9b9f70fc1
  - Cycle output id: b12f4a05-b49b-4390-825d-116e2d23778c
  - Aggregated pass rate: 0.8667
  - Single-turn overview: 7 of 7 eval(s) in this scope are failing.
Scope verdict totals: 300 pass, 85 fail (385 checks).
Failing eval evidence:
Answer Relevance: 53 pass, 2 fail, 55 total (96% pass)
Completeness: 49 pass, 6 fail, 55 total (89% pass)
Affordability Decision: 53 pass, 2 fail, 55 total (96% pass)
Clarification Precision: 47 pass, 8 fail, 55 total (85% pass)
Context Precision: 3 pass, 52 fail, 55 total (5% pass)
Context Recall: 51 pass, 4 fail, 55 total (93% pass)
Over Clarification: 44 pass, 11 fail, 55 total (80% pass)
  - Multi-turn overview: All 2 eval(s) in this scope are passing.
Scope verdict totals: 57 pass, 0 fail (57 checks).
Role Adherence: 2 pass, 0 fail, 2 total (100% pass)
Overall Quality: 55 pass, 0 fail, 55 total (100% pass)
  - Failure analysis: 7 failure item(s)
  - Failure target blocks: full-prompt
    - [step] Answer Relevance: 2 fail / 55 total
    - [step] Completeness: 6 fail / 55 total
    - [step] Affordability Decision: 2 fail / 55 total
    - [step] Clarification Precision: 8 fail / 55 total
    - [step] Context Precision: 52 fail / 55 total
    - [step] Context Recall: 4 fail / 55 total
    - [step] Over Clarification: 11 fail / 55 total
- Cycle 2 [SELECTED]
  - Candidate: 72660330-6e24-4840-8f45-eb2714334c57
  - Cycle output id: 68627542-6d56-4666-9095-49c4623a83f5
  - Aggregated pass rate: 0.8882
  - Single-turn overview: 7 of 7 eval(s) in this scope are failing.
Scope verdict totals: 193 pass, 45 fail (238 checks).
Failing eval evidence:
Answer Relevance: 33 pass, 1 fail, 34 total (97% pass)
Completeness: 32 pass, 2 fail, 34 total (94% pass)
Affordability Decision: 31 pass, 3 fail, 34 total (91% pass)
Clarification Precision: 32 pass, 2 fail, 34 total (94% pass)
Context Precision: 4 pass, 30 fail, 34 total (12% pass)
Context Recall: 30 pass, 4 fail, 34 total (88% pass)
Over Clarification: 31 pass, 3 fail, 34 total (91% pass)
  - Multi-turn overview: All 2 eval(s) in this scope are passing.
Scope verdict totals: 36 pass, 0 fail (36 checks).
Role Adherence: 2 pass, 0 fail, 2 total (100% pass)
Overall Quality: 34 pass, 0 fail, 34 total (100% pass)
  - Failure analysis: 7 failure item(s)
  - Failure target blocks: full-prompt
    - [step] Answer Relevance: 1 fail / 34 total
    - [step] Completeness: 2 fail / 34 total
    - [step] Affordability Decision: 3 fail / 34 total
    - [step] Clarification Precision: 2 fail / 34 total
    - [step] Context Precision: 30 fail / 34 total
    - [step] Context Recall: 4 fail / 34 total
    - [step] Over Clarification: 3 fail / 34 total
- Cycle 3
  - Candidate: 7d812022-653c-41e8-bae9-b1a03c4ee104
  - Cycle output id: 06832d27-4a36-4ca8-8eb6-ade7d461f911
  - Aggregated pass rate: 0.8362
  - Single-turn overview: 7 of 7 eval(s) in this scope are failing.
Scope verdict totals: 183 pass, 62 fail (245 checks).
Failing eval evidence:
Answer Relevance: 32 pass, 3 fail, 35 total (91% pass)
Completeness: 30 pass, 5 fail, 35 total (86% pass)
Affordability Decision: 29 pass, 6 fail, 35 total (83% pass)
Clarification Precision: 31 pass, 4 fail, 35 total (89% pass)
Context Precision: 4 pass, 31 fail, 35 total (11% pass)
Context Recall: 27 pass, 8 fail, 35 total (77% pass)
Over Clarification: 30 pass, 5 fail, 35 total (86% pass)
  - Multi-turn overview: 1 of 2 eval(s) in this scope are failing.
Scope verdict totals: 36 pass, 1 fail (37 checks).
Failing eval evidence:
Overall Quality: 34 pass, 1 fail, 35 total (97% pass)
Passing evals: Role Adherence.
  - Failure analysis: 8 failure item(s)
  - Failure target blocks: full-prompt, summary-scorers
    - [step] Answer Relevance: 3 fail / 35 total
    - [step] Completeness: 5 fail / 35 total
    - [step] Affordability Decision: 6 fail / 35 total
    - [step] Clarification Precision: 4 fail / 35 total
    - [step] Context Precision: 31 fail / 35 total
    - [step] Context Recall: 8 fail / 35 total
    - [step] Over Clarification: 5 fail / 35 total
    - [summary] Overall Quality: 1 fail / 35 total
