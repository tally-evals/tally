# Aggregators Architecture

## Overview

Aggregators in Tally summarize evaluation results across multiple data points. They are **statistical** functions that compute summaries from arrays of values.

> **Note:** Aggregators are distinct from **Verdict Summaries**. Aggregators compute statistical summaries (Mean, Percentile, etc.), while verdict summaries compute pass/fail rates from eval verdict policies.

---

## Core Types

### Discriminated Aggregator Types

Aggregators are discriminated by `kind` to ensure type safety:

```typescript
// Numeric aggregator - operates on number arrays
interface NumericAggregatorDef {
  readonly kind: 'numeric';
  name: string;
  description?: string;
  aggregate: (values: readonly number[]) => number;
  metadata?: Record<string, unknown>;
}

// Boolean aggregator - operates on boolean arrays
interface BooleanAggregatorDef {
  readonly kind: 'boolean';
  name: string;
  description?: string;
  aggregate: (values: readonly boolean[]) => number;
  metadata?: Record<string, unknown>;
}

// Categorical aggregator - operates on string arrays
interface CategoricalAggregatorDef {
  readonly kind: 'categorical';
  name: string;
  description?: string;
  aggregate: (values: readonly string[]) => Record<string, number>;
  metadata?: Record<string, unknown>;
}

// Union of all aggregator types
type AggregatorDef = NumericAggregatorDef | BooleanAggregatorDef | CategoricalAggregatorDef;
```

### Type Compatibility Mapping

The `CompatibleAggregator<T>` type ensures aggregators match the metric's value type:

```typescript
type CompatibleAggregator<T extends MetricScalar> = 
  T extends number 
    ? NumericAggregatorDef 
    : T extends boolean 
    ? NumericAggregatorDef | BooleanAggregatorDef 
    : T extends string 
    ? NumericAggregatorDef | CategoricalAggregatorDef 
    : never;
```

| Metric `valueType` | Compatible Aggregators | Used For |
|-------------------|------------------------|----------|
| `'number'` | `NumericAggregatorDef` | Scores ✓, Raw values ✓ |
| `'boolean'` | `NumericAggregatorDef` | Scores ✓ |
| `'boolean'` | `BooleanAggregatorDef` | Raw values ✓ |
| `'string'` / `'ordinal'` | `NumericAggregatorDef` | Scores ✓ |
| `'string'` / `'ordinal'` | `CategoricalAggregatorDef` | Raw values ✓ |

---

## API Design

### Pattern Summary

| Pattern | Purpose | Examples |
|---------|---------|----------|
| `define*` | Custom aggregator definitions | `defineNumericAggregator`, `defineBooleanAggregator`, `defineCategoricalAggregator` |
| `create*` | Prebuilt implementations | `createMeanAggregator`, `createPercentileAggregator`, `createThresholdAggregator` |

### Custom Aggregators (`define*`)

Use `define*` functions to create custom aggregators:

```typescript
import { 
  defineNumericAggregator, 
  defineBooleanAggregator, 
  defineCategoricalAggregator 
} from 'tally';

// Custom numeric aggregator
const stdDevAggregator = defineNumericAggregator({
  name: 'StdDev',
  description: 'Standard deviation',
  aggregate: (values) => {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(
      values.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / values.length
    );
  },
});

// Custom boolean aggregator
const streakAggregator = defineBooleanAggregator({
  name: 'MaxTrueStreak',
  aggregate: (values) => {
    let max = 0, curr = 0;
    for (const v of values) {
      if (v) { curr++; max = Math.max(max, curr); } else { curr = 0; }
    }
    return max;
  },
});

// Custom categorical aggregator
const entropyAggregator = defineCategoricalAggregator({
  name: 'Entropy',
  aggregate: (values) => {
    const counts: Record<string, number> = {};
    for (const v of values) counts[v] = (counts[v] ?? 0) + 1;
    let entropy = 0;
    for (const count of Object.values(counts)) {
      const p = count / values.length;
      entropy -= p * Math.log2(p);
    }
    return { entropy };
  },
});
```

### Prebuilt Aggregators (`create*`)

| Function | Kind | Description |
|----------|------|-------------|
| `createMeanAggregator()` | `numeric` | Arithmetic mean |
| `createPercentileAggregator({ percentile })` | `numeric` | Nth percentile |
| `createThresholdAggregator({ threshold })` | `numeric` | Proportion >= threshold |
| `createTrueRateAggregator()` | `boolean` | Proportion of true values |
| `createFalseRateAggregator()` | `boolean` | Proportion of false values |
| `createDistributionAggregator()` | `categorical` | Value frequency distribution |
| `createModeAggregator()` | `categorical` | Most frequent value(s) |

---

## Default Aggregators

The `getDefaultAggregators(valueType)` function returns appropriate aggregators:

```typescript
// For 'number' metrics
getDefaultAggregators('number') → [Mean, P50, P75, P90]

// For 'boolean' metrics  
getDefaultAggregators('boolean') → [Mean, P50, P75, P90, TrueRate]

// For 'string'/'ordinal' metrics
getDefaultAggregators('string') → [Mean, P50, P75, P90, Distribution]
```

---

## Usage in Metrics

Aggregators are attached to metrics via factory functions:

```typescript
import { 
  defineSingleTurnCode, 
  defineBaseMetric,
  createMeanAggregator,
  createPercentileAggregator,
  defineNumericAggregator,
} from 'tally';

// Custom aggregator
const minAggregator = defineNumericAggregator({
  name: 'Min',
  aggregate: (values) => Math.min(...values),
});

// Metric with custom + prebuilt aggregators
const latencyMetric = defineSingleTurnCode({
  base: defineBaseMetric({ name: 'latency', valueType: 'number' }),
  compute: async ({ output }) => parseFloat(output),
  aggregators: [
    minAggregator,                              // Custom
    createMeanAggregator(),                     // Prebuilt
    createPercentileAggregator({ percentile: 95 }), // Prebuilt
  ],
});
```

### Type Safety

The type system prevents incompatible aggregators:

```typescript
// ✅ Valid: number metric with numeric aggregators
defineSingleTurnCode({
  base: defineBaseMetric({ name: 'score', valueType: 'number' }),
  compute: () => 0.85,
  aggregators: [createMeanAggregator()], // NumericAggregatorDef ✓
});

// ✅ Valid: boolean metric with numeric + boolean aggregators
defineSingleTurnCode({
  base: defineBaseMetric({ name: 'passed', valueType: 'boolean' }),
  compute: () => true,
  aggregators: [
    createMeanAggregator(),     // NumericAggregatorDef ✓ (for scores)
    createTrueRateAggregator(), // BooleanAggregatorDef ✓ (for raw values)
  ],
});

// ❌ Compile Error: categorical aggregator on boolean metric
defineSingleTurnCode({
  base: defineBaseMetric({ name: 'passed', valueType: 'boolean' }),
  compute: () => true,
  aggregators: [createDistributionAggregator()], // CategoricalAggregatorDef ✗
});
```

---

## Pipeline Execution

### How Aggregators Are Applied

1. **Score Aggregations**: Only `NumericAggregatorDef` aggregators run on normalized scores (always numbers)
2. **Raw Value Aggregations**: Aggregators filtered by `kind` matching `valueType`:
   - `'number'` → `kind: 'numeric'`
   - `'boolean'` → `kind: 'boolean'`
   - `'string'/'ordinal'` → `kind: 'categorical'`

### EvalSummary Structure

```typescript
interface EvalSummary {
  evalName: string;
  evalKind: 'singleTurn' | 'multiTurn' | 'scorer';
  aggregations: {
    score: Aggregations;    // Numeric aggregators on scores
    raw?: Aggregations;     // Type-matched aggregators on raw values
  };
  verdictSummary?: VerdictSummary; // SEPARATE from aggregations
}

interface Aggregations {
  [aggregatorName: string]: number | Record<string, number>;
}
```

---

## Aggregators vs Verdict Summaries

| Concept | Purpose | Source | Examples |
|---------|---------|--------|----------|
| **Aggregators** | Statistical summaries | `metric.aggregators[]` | Mean, P50, P90, StdDev |
| **Verdict Summaries** | Pass/fail rates | `eval.verdict` policy | passRate, failRate, passCount |

**Key Distinction:**
- `createThresholdAggregator({ threshold: 0.7 })` → Proportion of scores >= 0.7 (simple numeric comparison)
- `verdictSummary.passRate` → Proportion of targets that passed according to verdict policy (can have complex rules)

These **can have different values** if the threshold differs from the verdict policy.

---

## File Structure

```
src/aggregators/
├── define.ts        # defineNumericAggregator, defineBooleanAggregator, defineCategoricalAggregator
├── mean.ts          # createMeanAggregator (NumericAggregatorDef)
├── percentile.ts    # createPercentileAggregator (NumericAggregatorDef)
├── threshold.ts     # createThresholdAggregator (NumericAggregatorDef)
├── trueRate.ts      # createTrueRateAggregator, createFalseRateAggregator (BooleanAggregatorDef)
├── distribution.ts  # createDistributionAggregator, createModeAggregator (CategoricalAggregatorDef)
├── default.ts       # DEFAULT_AGGREGATORS, getDefaultAggregators()
└── index.ts         # Public exports
```

---

## Summary

1. **Three aggregator kinds**: `numeric`, `boolean`, `categorical` (discriminated union)
2. **Type-safe factories**: `defineSingleTurnCode` only accepts `CompatibleAggregator<T>`
3. **Two API patterns**: `define*` for custom, `create*` for prebuilt
4. **Automatic defaults**: `getDefaultAggregators(valueType)` provides sensible defaults
5. **Separate concepts**: Aggregators (statistical) vs Verdict Summaries (pass/fail)
