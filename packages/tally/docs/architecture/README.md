# Architecture Overview

This document describes the high-level architecture of the Tally evaluation framework.

## System Design

Tally is a TypeScript evaluation framework for running model evaluations. It follows a **pipeline architecture** where data flows through distinct phases.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User API (createTally)                       │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      TallyContainer.run()                            │
│  - Validates input data and evals                                    │
│  - Converts Evals → InternalEvaluators (builder.ts)                  │
│  - Invokes pipeline                                                  │
│  - Builds TallyRunArtifact/Report                                    │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Evaluation Pipeline (6 phases)                    │
│                                                                      │
│  1. Measure      → Execute metrics (LLM/code)                        │
│  2. Calibrate    → Resolve calibration context for normalization     │
│  3. Normalize    → Transform raw values → Scores (0-1)               │
│  4. Score        → Execute scorers to produce derived scores         │
│  5. Verdict      → Apply verdict policies (pass/fail/unknown)        │
│  6. Aggregate    → Compute summaries and aggregations                │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   TallyRunArtifact / TallyRunReport                  │
│  - Serializable artifact with defs + results                         │
│  - Type-safe report with accessor methods                            │
└─────────────────────────────────────────────────────────────────────┘
```

## Core Abstractions

### 1. Data Containers

Two primary input types:

```typescript
// Single-turn: standalone input/output pairs
interface DatasetItem {
  id?: string;
  input: string;
  output: string;
  expected?: string;
  metadata?: Record<string, unknown>;
}

// Multi-turn: conversation with steps
interface Conversation {
  id?: string;
  steps: ConversationStep[];
  systemPrompt?: string;
  metadata?: Record<string, unknown>;
}
```

### 2. Metrics

Metrics **measure** a single aspect. Two execution modes:

| Scope | Runs on | Examples |
|-------|---------|----------|
| `single` | Each step/item independently | Answer relevance, toxicity |
| `multi` | Entire conversation | Goal completion, topic adherence |

Two implementation types:

| Type | Implementation | Produces |
|------|----------------|----------|
| LLM | Prompt template + structured output | value, confidence, reasoning |
| Code | Pure function | value only |

### 3. Normalization

Transforms raw metric values to normalized `Score` (0-1):

```
Raw Value → Normalizer → Score
   │            │          │
   87%      min-max      0.87
   true     identity     1.0
   "high"   ordinal-map  0.9
```

### 4. Scorers

Combine multiple metric scores into a single derived score:

```
Metric A (Score) ─┐
                  ├─→ Scorer → Derived Score
Metric B (Score) ─┘
```

### 5. Evals

User-facing abstraction that wraps a Metric or Scorer with a VerdictPolicy:

```typescript
// Single-turn eval: one metric + verdict
const relevanceEval = defineSingleTurnEval({
  name: 'relevance',
  metric: answerRelevanceMetric,
  verdict: thresholdVerdict({ passAt: 0.7 }),
});

// Scorer eval: multiple metrics + scorer + verdict
const qualityEval = defineScorerEval({
  name: 'quality',
  scorer: weightedAverageScorer,
  verdict: thresholdVerdict({ passAt: 0.8 }),
});
```

### 6. Verdicts

Policies that determine pass/fail status:

| Policy | Description |
|--------|-------------|
| `boolean` | Pass when raw value matches expected boolean |
| `threshold` | Pass when score >= threshold |
| `range` | Pass when score within min/max |
| `ordinal` | Pass when raw value in allowed set |
| `custom` | User-provided function |

## Eval → Internal Evaluator Conversion

The `buildFromEvals()` function converts user Evals to internal structures:

```
SingleTurnEval ─┬─→ InternalEvaluator
                │   - metrics: [MetricDef]
MultiTurnEval  ─┤   - scorer: IdentityScorer (wraps single metric)
                │   - verdictPolicy
ScorerEval ────┴─→ InternalEvaluator
                    - metrics: [from scorer.inputs]
                    - scorer: User's scorer
                    - verdictPolicy
```

Key transformations:
1. **Auto-normalization**: If metric lacks normalization, applies default based on `valueType`
2. **Identity scorer**: Single-turn/multi-turn evals get an identity scorer (passthrough)
3. **Metric deduplication**: Same metric across evals is executed once

## Output Artifacts

### TallyRunArtifact

Serializable JSON structure:

```typescript
interface TallyRunArtifact {
  schemaVersion: 1;
  runId: string;
  createdAt: string;
  defs: {
    metrics: Record<string, MetricDefSnap>;
    evals: Record<string, EvalDefSnap>;
    scorers: Record<string, ScorerDefSnap>;
  };
  result: ConversationResult;
  metadata?: Record<string, unknown>;
}
```

### TallyRunReport

Type-safe wrapper with accessor methods:

```typescript
const report = await tally.run();

// Type-safe access (autocomplete on eval names)
report.result.singleTurn.relevance.byStepIndex[0];
report.result.multiTurn.goalCompletion.measurement.score;

// View API for iteration
report.view.forEachStep((step) => { /* ... */ });
```

## Further Reading

- [Pipeline](./pipeline.md) - Detailed phase-by-phase execution
- [Data Model](./data-model.md) - Type definitions and relationships
- [Type System](./type-system.md) - TypeScript patterns
- [Aggregators](./aggregators.md) - Statistical aggregators
