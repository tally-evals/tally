# Cashflow Optimization Summary

Job: 004a0e15-c6b5-4660-b0a8-14270d453a83
Max cycles configured: 3
Cycles completed: 3
Stop reason: maxCycles
Selected candidate: a6f7125c-9b64-4c0a-ad8e-5cf233862095
Selected cycle output: 4fb0003e-c5e9-43ad-a59d-b779648ac19f
Selection reason: Required evals satisfied among compared cycles; Selected candidate a6f7125c-9b64-4c0a-ad8e-5cf233862095 (cycle output 4fb0003e-c5e9-43ad-a59d-b779648ac19f) with weighted score 0.9440. Compared 3 cycle(s).

## Cycles
- Cycle 1 [SELECTED]
  - Candidate: a6f7125c-9b64-4c0a-ad8e-5cf233862095
  - Cycle output id: 4fb0003e-c5e9-43ad-a59d-b779648ac19f
  - Aggregated pass rate: 0.9440
  - Single-turn overview: 3 of 7 eval(s) in this scope are failing.
Scope verdict totals: 149 pass, 26 fail (175 checks).
Failing eval evidence:
Clarification Precision: 24 pass, 1 fail, 25 total (96% pass)
Context Precision: 1 pass, 24 fail, 25 total (4% pass)
Over Clarification: 24 pass, 1 fail, 25 total (96% pass)
Passing evals: Answer Relevance, Completeness, Affordability Decision, Context Recall.
  - Multi-turn overview: All 2 eval(s) in this scope are passing.
Scope verdict totals: 26 pass, 0 fail (26 checks).
Role Adherence: 1 pass, 0 fail, 1 total (100% pass)
Overall Quality: 25 pass, 0 fail, 25 total (100% pass)
  - Failure analysis: 3 failure item(s)
  - Failure target blocks: full-prompt
    - [step] Clarification Precision: 1 fail / 25 total
    - [step] Context Precision: 24 fail / 25 total
    - [step] Over Clarification: 1 fail / 25 total
- Cycle 2
  - Candidate: 0ab3b361-b9ca-472f-9675-a727c35dd787
  - Cycle output id: 42421ed9-87fa-413e-91bd-5866a9b0bfaf
  - Aggregated pass rate: 0.9067
  - Single-turn overview: 7 of 7 eval(s) in this scope are failing.
Scope verdict totals: 173 pass, 37 fail (210 checks).
Failing eval evidence:
Answer Relevance: 28 pass, 2 fail, 30 total (93% pass)
Completeness: 27 pass, 3 fail, 30 total (90% pass)
Affordability Decision: 28 pass, 2 fail, 30 total (93% pass)
Clarification Precision: 28 pass, 2 fail, 30 total (93% pass)
Context Precision: 6 pass, 24 fail, 30 total (20% pass)
Context Recall: 27 pass, 3 fail, 30 total (90% pass)
Over Clarification: 29 pass, 1 fail, 30 total (97% pass)
  - Multi-turn overview: 1 of 2 eval(s) in this scope are failing.
Scope verdict totals: 29 pass, 2 fail (31 checks).
Failing eval evidence:
Overall Quality: 28 pass, 2 fail, 30 total (93% pass)
Passing evals: Role Adherence.
  - Failure analysis: 8 failure item(s)
  - Failure target blocks: full-prompt, summary-scorers
    - [step] Answer Relevance: 2 fail / 30 total
    - [step] Completeness: 3 fail / 30 total
    - [step] Affordability Decision: 2 fail / 30 total
    - [step] Clarification Precision: 2 fail / 30 total
    - [step] Context Precision: 24 fail / 30 total
    - [step] Context Recall: 3 fail / 30 total
    - [step] Over Clarification: 1 fail / 30 total
    - [summary] Overall Quality: 2 fail / 30 total
- Cycle 3
  - Candidate: 1bc75c8e-b950-48c3-acb4-a735c831328f
  - Cycle output id: 56637729-1f7e-4275-aa46-83d9cfa2df3b
  - Aggregated pass rate: 0.7933
  - Single-turn overview: 6 of 7 eval(s) in this scope are failing.
Scope verdict totals: 181 pass, 29 fail (210 checks).
Failing eval evidence:
Completeness: 29 pass, 1 fail, 30 total (97% pass)
Affordability Decision: 29 pass, 1 fail, 30 total (97% pass)
Clarification Precision: 28 pass, 2 fail, 30 total (93% pass)
Context Precision: 7 pass, 23 fail, 30 total (23% pass)
Context Recall: 29 pass, 1 fail, 30 total (97% pass)
Over Clarification: 29 pass, 1 fail, 30 total (97% pass)
Passing evals: Answer Relevance.
  - Multi-turn overview: 1 of 2 eval(s) in this scope are failing.
Scope verdict totals: 30 pass, 1 fail (31 checks).
Failing eval evidence:
Role Adherence: 0 pass, 1 fail, 1 total (0% pass)
Passing evals: Overall Quality.
  - Failure analysis: 7 failure item(s)
  - Failure target blocks: full-prompt, multi-turn
    - [step] Completeness: 1 fail / 30 total
    - [step] Affordability Decision: 1 fail / 30 total
    - [step] Clarification Precision: 2 fail / 30 total
    - [step] Context Precision: 23 fail / 30 total
    - [step] Context Recall: 1 fail / 30 total
    - [step] Over Clarification: 1 fail / 30 total
    - [conversation] Role Adherence: 1 fail / 1 total
