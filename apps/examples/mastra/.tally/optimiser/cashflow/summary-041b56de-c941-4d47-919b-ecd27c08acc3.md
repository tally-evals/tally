# Cashflow Optimization Summary

Job: 041b56de-c941-4d47-919b-ecd27c08acc3
Max cycles configured: 3
Cycles completed: 3
Stop reason: thresholdReached
Selected candidate: 99ce4aec-f351-4abb-92ad-3186ed3df541
Selected cycle output: a10db893-c17d-4d6c-9260-beefcae5343d
Selection reason: Required evals satisfied among compared cycles; Selected candidate 99ce4aec-f351-4abb-92ad-3186ed3df541 (cycle output a10db893-c17d-4d6c-9260-beefcae5343d) with weighted score 0.9617. Compared 3 cycle(s).

## Cycles
- Cycle 1
  - Candidate: e5ae15dc-c7df-4421-8e23-d39aed57209c
  - Cycle output id: 00d63ed7-3783-4b2e-8630-806e3689ee6f
  - Aggregated pass rate: 0.9083
  - Single-turn overview: 7 of 7 eval(s) in this scope are failing.
Scope verdict totals: 174 pass, 36 fail (210 checks).
Failing eval evidence:
Answer Relevance: 28 pass, 2 fail, 30 total (93% pass)
Completeness: 28 pass, 2 fail, 30 total (93% pass)
Affordability Decision: 28 pass, 2 fail, 30 total (93% pass)
Clarification Precision: 28 pass, 2 fail, 30 total (93% pass)
Context Precision: 5 pass, 25 fail, 30 total (17% pass)
Context Recall: 28 pass, 2 fail, 30 total (93% pass)
Over Clarification: 29 pass, 1 fail, 30 total (97% pass)
  - Multi-turn overview: 1 of 2 eval(s) in this scope are failing.
Scope verdict totals: 29 pass, 2 fail (31 checks).
Failing eval evidence:
Overall Quality: 28 pass, 2 fail, 30 total (93% pass)
Passing evals: Role Adherence.
  - Failure analysis: 8 failure item(s)
  - Failure target blocks: full-prompt, summary-scorers
    - [step] Answer Relevance: 2 fail / 30 total
    - [step] Completeness: 2 fail / 30 total
    - [step] Affordability Decision: 2 fail / 30 total
    - [step] Clarification Precision: 2 fail / 30 total
    - [step] Context Precision: 25 fail / 30 total
    - [step] Context Recall: 2 fail / 30 total
    - [step] Over Clarification: 1 fail / 30 total
    - [summary] Overall Quality: 2 fail / 30 total
- Cycle 2
  - Candidate: a9b53537-2e3a-43de-ad8d-1d7a6fdd1932
  - Cycle output id: cf264f04-3294-4352-b678-431fb7ef3de3
  - Aggregated pass rate: 0.9417
  - Single-turn overview: 5 of 7 eval(s) in this scope are failing.
Scope verdict totals: 181 pass, 29 fail (210 checks).
Failing eval evidence:
Completeness: 29 pass, 1 fail, 30 total (97% pass)
Affordability Decision: 29 pass, 1 fail, 30 total (97% pass)
Clarification Precision: 29 pass, 1 fail, 30 total (97% pass)
Context Precision: 7 pass, 23 fail, 30 total (23% pass)
Over Clarification: 27 pass, 3 fail, 30 total (90% pass)
Passing evals: Answer Relevance, Context Recall.
  - Multi-turn overview: All 2 eval(s) in this scope are passing.
Scope verdict totals: 31 pass, 0 fail (31 checks).
Role Adherence: 1 pass, 0 fail, 1 total (100% pass)
Overall Quality: 30 pass, 0 fail, 30 total (100% pass)
  - Failure analysis: 5 failure item(s)
  - Failure target blocks: full-prompt
    - [step] Completeness: 1 fail / 30 total
    - [step] Affordability Decision: 1 fail / 30 total
    - [step] Clarification Precision: 1 fail / 30 total
    - [step] Context Precision: 23 fail / 30 total
    - [step] Over Clarification: 3 fail / 30 total
- Cycle 3 [SELECTED]
  - Candidate: 99ce4aec-f351-4abb-92ad-3186ed3df541
  - Cycle output id: a10db893-c17d-4d6c-9260-beefcae5343d
  - Aggregated pass rate: 0.9617
  - Single-turn overview: 2 of 7 eval(s) in this scope are failing.
Scope verdict totals: 188 pass, 22 fail (210 checks).
Failing eval evidence:
Context Precision: 9 pass, 21 fail, 30 total (30% pass)
Over Clarification: 29 pass, 1 fail, 30 total (97% pass)
Passing evals: Answer Relevance, Completeness, Affordability Decision, Clarification Precision, Context Recall.
  - Multi-turn overview: All 2 eval(s) in this scope are passing.
Scope verdict totals: 31 pass, 0 fail (31 checks).
Role Adherence: 1 pass, 0 fail, 1 total (100% pass)
Overall Quality: 30 pass, 0 fail, 30 total (100% pass)
  - Failure analysis: 2 failure item(s)
  - Failure target blocks: full-prompt
    - [step] Context Precision: 21 fail / 30 total
    - [step] Over Clarification: 1 fail / 30 total
