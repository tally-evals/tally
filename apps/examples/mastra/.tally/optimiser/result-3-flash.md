# Cashflow optimiser comparison (gemini-3-flash-preview)

This note compares two recently generated cashflow optimisation jobs:

- `193f220f-ab29-4c36-bb62-86cfd3710e72` (generated `2026-04-30`)
- `ce72e8f0-63fc-44e1-91a3-6888a4223c4c` (generated `2026-05-04`)

## Model confirmation

For both runs, the stored step traces for the **selected candidate trajectory** record:

- **model**: `gemini-3-flash-preview`

So any differences below are **not attributable to a model swap** (both are already on `gemini-3-flash-preview` in the stored traces).

## Headline outcome (selected cycle)

## Per-eval pass-rate comparison (selected cycle)

From each job’s `summary.md` (selected cycle):

| Eval | `193f220f…` pass rate | `ce72e8…` pass rate 
|---|---|---|---
| Answer Relevance | 97% (33/34) | 98% (54/55) 
| Completeness | 94% (32/34) | 95% (52/55) 
| Affordability Decision | 91% (31/34) | 96% (53/55) 
| Clarification Precision | 94% (32/34) | 93% (51/55) 
| Context Precision | 12% (4/34) | 9% (5/55) 
| Context Recall | 88% (30/34) | 96% (53/55) 
| Over Clarification | 91% (31/34) | 93% (51/55) 
| Role Adherence (multi-turn) | 100% (2/2) | 100% (2/2) 
| Overall Quality (scorer) | 100% (34/34) | 100% (55/55) 

## What got better vs worse

- **Better in `ce72e8…`**
  - **Affordability Decision** improved meaningfully (91% → 96%).
  - **Context Recall** improved a lot (88% → 96%).
  - Small gains in **Answer Relevance**, **Completeness**, **Over Clarification**.

- **Worse in `ce72e8…`**
  - **Context Precision** is still the dominant weakness and is **slightly worse** (12% → 9%).
  - **Clarification Precision** is essentially flat, slightly down (94% → 93%).


