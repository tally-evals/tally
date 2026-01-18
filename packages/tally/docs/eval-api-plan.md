# Eval API Design Plan - Option 2 Extended

## Overview

This document outlines the comprehensive plan for implementing the new `Eval` API that addresses fundamental issues with the current architecture:

1. **Problem**: Aggregators are separate from evaluators, requiring users to manually match them
2. **Problem**: No first-class pass/fail mechanism - currently handled inconsistently via aggregators
3. **Problem**: Metrics can be boolean, ordinal, or number - pass/fail should be type-aware
4. **Solution**: New `Eval` abstraction with built-in aggregators, auto-calculated metrics, and type-safe verdict policies

## Core Design Principles

1. **Scorers are separate evals** - Never mix scorer definitions with metric lists
2. **Evaluator refactored** - Evaluator now accepts evals (not metrics/scorers directly) and defines context
3. **Aggregators removed** - Built-in aggregations are automatically calculated, no manual aggregator definitions
4. **Type-safe verdicts** - Pass/fail policies match metric value types (boolean, number, ordinal)
5. **Auto-normalization** - Boolean and ordinal metrics auto-normalize to Scores
6. **Always calculate pass/fail** - Every eval with a verdict policy gets global pass/fail rate/percentage
7. **Breaking change** - This is a breaking API change; no backward compatibility maintained

---

## Type Definitions

### 1. Verdict Policy (Type-Safe Pass/Fail with Inference)

```typescript
/**
 * Helper to infer metric value type from metric definition
 */
type MetricValueType<T extends MetricDef<MetricScalar, MetricContainer>> =
  T extends MetricDef<infer TRawValue, MetricContainer> ? TRawValue : never;

/**
 * Type-safe verdict policy inferred from metric value type
 * TypeScript enforces that verdict policy matches the metric's value type
 */
export type VerdictPolicyFor<T extends MetricScalar> =
  T extends boolean
    ? { kind: 'boolean'; passWhen: true | false }
    : T extends number
    ? 
      | { kind: 'number'; type: 'threshold'; passAt: number }  // rawValue >= passAt (often rawValue is already normalized)
      | { kind: 'number'; type: 'range'; min?: number; max?: number }  // min <= rawValue <= max
      | { kind: 'custom'; verdict: (score: Score, rawValue: number) => 'pass' | 'fail' | 'unknown' }
    : T extends string
    ? 
      | { kind: 'ordinal'; passWhenIn: readonly string[] }
      | { kind: 'custom'; verdict: (score: Score, rawValue: string) => 'pass' | 'fail' | 'unknown' }
    : { kind: 'custom'; verdict: (score: Score, rawValue: T) => 'pass' | 'fail' | 'unknown' }
    | { kind: 'none' };

/**
 * Union type for runtime use (when type inference isn't available)
 */
export type VerdictPolicy =
  | { kind: 'boolean'; passWhen: true | false }
  | { kind: 'number'; type: 'threshold'; passAt: number }
  | { kind: 'number'; type: 'range'; min?: number; max?: number }
  | { kind: 'ordinal'; passWhenIn: readonly string[] }
  | { kind: 'custom'; verdict: (score: Score, rawValue: MetricScalar) => 'pass' | 'fail' | 'unknown' }
  | { kind: 'none' };
```

### 2. Auto-Normalization Policies

```typescript
/**
 * Auto-normalization for boolean/ordinal metrics
 * Applied automatically if metric doesn't specify normalization
 */
export type AutoNormalizer =
  | { kind: 'boolean'; trueScore?: number; falseScore?: number }  // default: 1.0/0.0
  | { kind: 'ordinal'; weights: Record<string | number, number> }  // required map
  | { kind: 'number' };  // identity or use metric's normalization
```

### 3. Eval Types (Type-Safe with Inference)

```typescript
/**
 * Base eval properties shared across all eval kinds
 */
interface EvalBase<TContainer extends MetricContainer> {
  name: string;
  description?: string;
  context?: EvaluationContext;  // For single-turn run policies
  metadata?: Record<string, unknown>;
}

/**
 * Single-turn eval: single metric evaluated per target
 * Results are aggregated across all targets (mean, percentiles, pass/fail rates)
 * Type-safe: verdict policy type is inferred from metric value type
 */
export interface SingleTurnEval<
  TContainer extends SingleTurnContainer,
  TMetricValue extends MetricScalar = MetricScalar
> extends EvalBase<TContainer> {
  kind: 'singleTurn';
  metric: MetricDef<TMetricValue, TContainer>;  // Single metric - type inferred
  verdict?: VerdictPolicyFor<TMetricValue>;  // Type-safe verdict (inferred from metric)
  autoNormalize?: AutoNormalizer;  // Override auto-normalization for boolean/ordinal
}

/**
 * Multi-turn eval: single metric evaluated per conversation
 * Results are aggregated across conversations (mean, percentiles, pass/fail rates)
 * Type-safe: verdict policy type is inferred from metric value type
 */
export interface MultiTurnEval<
  TContainer extends MultiTurnContainer,
  TMetricValue extends MetricScalar = MetricScalar
> extends EvalBase<TContainer> {
  kind: 'multiTurn';
  metric: MetricDef<TMetricValue, TContainer>;  // Single metric - type inferred
  verdict?: VerdictPolicyFor<TMetricValue>;  // Type-safe verdict (inferred from metric)
  autoNormalize?: AutoNormalizer;  // Override auto-normalization
}

/**
 * Scorer eval: combines multiple metrics using a scorer
 * Produces normalized Score output (number)
 * Verdict policy is always number-based since Score is number
 */
export interface ScorerEval<TContainer extends MetricContainer> extends EvalBase<TContainer> {
  kind: 'scorer';
  inputs: readonly MetricDefFor<TContainer>[];  // Input metrics (can be multiple)
  scorer: Scorer;  // Scorer definition (outputs normalized Score)
  verdict?: VerdictPolicyFor<number>;  // Always number-based (Score is number)
}

export type Eval<TContainer extends MetricContainer> =
  | SingleTurnEval<TContainer, MetricScalar>
  | MultiTurnEval<TContainer, MetricScalar>
  | ScorerEval<TContainer>;

### 5. Refactored Evaluator Type

```typescript
/**
 * Evaluator definition (REFACTORED)
 * Now accepts evals instead of metrics/scorers directly
 * Defines context that applies to all evals within it
 */
export interface Evaluator<TContainer extends MetricContainer> {
  name: string;
  description?: string;
  evals: readonly Eval<TContainer>[];  // Changed from metrics + scorer
  context: EvaluationContext;  // REQUIRED: Context applies to all evals in this evaluator
  metadata?: Record<string, unknown>;
}
```

### 6. Context Helper Functions

```typescript
/**
 * Create an evaluation context that runs metrics on all targets
 * 
 * @param metadata - Optional metadata to attach to the context
 * @returns EvaluationContext with 'all' run policy
 */
export function runAllTargets(
  metadata?: Record<string, unknown>
): EvaluationContext;

/**
 * Create an evaluation context that runs metrics on specific conversation steps
 * 
 * @param stepIndices - Array of step indices to evaluate (0-based)
 * @param metadata - Optional metadata to attach to the context
 * @returns EvaluationContext with 'selectedSteps' run policy
 */
export function runSelectedSteps(
  stepIndices: readonly number[],
  metadata?: Record<string, unknown>
): EvaluationContext;

/**
 * Create an evaluation context that runs metrics on specific dataset items
 * 
 * @param itemIndices - Array of item indices to evaluate (0-based)
 * @param metadata - Optional metadata to attach to the context
 * @returns EvaluationContext with 'selectedItems' run policy
 */
export function runSelectedItems(
  itemIndices: readonly number[],
  metadata?: Record<string, unknown>
): EvaluationContext;
```

### 6. Refactored Tally Type

```typescript
/**
 * Tally container (REFACTORED)
 * Main evaluation container that orchestrates the entire evaluation flow
 * Now accepts evaluators (which contain evals) - no aggregators needed
 */
export interface Tally<TContainer extends MetricContainer> {
  data: readonly TContainer[];
  evaluators: readonly Evaluator<TContainer>[];  // Changed: no aggregators parameter
  run(options?: TallyRunOptions): Promise<TallyRunReport>;
}
```

### 4. Factory Functions (Define Semantics)

```typescript
/**
 * Factory functions with "define" semantics and shorter names
 * Provide full type inference for verdict policies
 */

/**
 * Define a single-turn eval with type inference
 * Verdict policy type is automatically inferred from metric value type
 */
export function defineSingleTurnEval<
  TContainer extends SingleTurnContainer,
  TMetric extends MetricDef<MetricScalar, TContainer>
>(args: {
  name: string;
  description?: string;
  metric: TMetric;
  verdict?: VerdictPolicyFor<MetricValueType<TMetric>>;
  autoNormalize?: AutoNormalizer;
  context?: EvaluationContext;
  metadata?: Record<string, unknown>;
}): SingleTurnEval<TContainer, MetricValueType<TMetric>>;

/**
 * Define a multi-turn eval with type inference
 * Verdict policy type is automatically inferred from metric value type
 */
export function defineMultiTurnEval<
  TContainer extends MultiTurnContainer,
  TMetric extends MetricDef<MetricScalar, TContainer>
>(args: {
  name: string;
  description?: string;
  metric: TMetric;
  verdict?: VerdictPolicyFor<MetricValueType<TMetric>>;
  autoNormalize?: AutoNormalizer;
  context?: EvaluationContext;
  metadata?: Record<string, unknown>;
}): MultiTurnEval<TContainer, MetricValueType<TMetric>>;

/**
 * Define a scorer eval
 * Verdict policy is always number-based (Score output)
 */
export function defineScorerEval<TContainer extends MetricContainer>(args: {
  name: string;
  description?: string;
  inputs: readonly MetricDefFor<TContainer>[];
  scorer: Scorer;
  verdict?: VerdictPolicyFor<number>;
  context?: EvaluationContext;
  metadata?: Record<string, unknown>;
}): ScorerEval<TContainer>;
```

### 7. Run output (current)

This repo has adopted a canonical reporting schema:

- **`TallyRunReport`**: returned from `tally.run()` (SDK-facing; includes `view()` and `toArtifact()`).
- **`TallyRunArtifact`**: persisted JSON shape for read-only tooling (store/CLI/viewer).

See the canonical spec: `packages/core/architecture/REPORTING.md`.

---

## Implementation Plan

### Phase 1: Core Type System

#### Files to CREATE:
1. `packages/tally/src/core/evals/types.ts`
   - All Eval type definitions
   - VerdictPolicy types
   - AutoNormalizer types

2. `packages/tally/src/core/evals/normalization.ts`
   - Auto-normalization logic for boolean/ordinal
   - Helper to detect metric value type
   - Apply auto-normalizers when metric lacks normalization

#### Files to UPDATE:
1. `packages/tally/src/core/types.ts`
   - Update run output exports (`TallyRunReport`, `TallyRunArtifact`, `TargetRunView`)
   - Keep eval types focused on `Measurement` (what was measured) vs `EvalOutcome` (verdict + policy info)

#### Files to CREATE:
1. `packages/tally/src/core/evals/context.ts` (or update existing helpers)
   - Export `runAllTargets()` helper function
   - Export `runSelectedSteps()` helper function
   - Export `runSelectedItems()` helper function
   - These helpers create EvaluationContext objects with type-safe run policies

### Phase 3: Eval Builder (Converts Evals → Internal Structure)

#### Files to CREATE:
1. `packages/tally/src/core/evals/builder.ts`
   - `buildFromEvals<TContainer>(evals: readonly Eval<TContainer>[]): { internalEvaluators: InternalEvaluator[] }`
   - Logic to:
     - Auto-normalize boolean/ordinal metrics
     - Create internal identity scorer for SingleTurnEval (single metric → single output)
     - Create internal evaluator structure for pipeline execution
     - Map verdict policies to pass/fail calculation logic
     - Note: No aggregators created - built-in aggregations computed directly in pipeline

2. `packages/tally/src/core/evals/verdict.ts`
   - `computeVerdict(score: Score, rawValue: MetricScalar, policy: VerdictPolicy): 'pass' | 'fail' | 'unknown'`
   - Type-safe verdict computation

3. `packages/tally/src/core/evals/aggregations.ts`
   - `calculateBuiltInAggregations(scores: readonly Score[], rawValues?: readonly MetricScalar[]): BuiltInAggregations`
   - Always calculate: mean, percentiles (p50, p75, p90, p95, p99)
   - If ordinal: calculate distribution
   - If verdict policy exists: calculate pass/fail rates

### Phase 4: Enhanced Pipeline

#### Files to UPDATE:
1. `packages/tally/src/core/pipeline.ts`
   - **REFACTOR**: Change `executePipeline` signature to accept `evaluators: readonly Evaluator<TContainer>[]` (no aggregators parameter)
   - Internally extract evals from evaluators and convert using `buildFromEvals`
   - Add verdict computation phase (after normalization, before aggregation)
   - Update `buildPerTargetResults` to include verdicts
   - **REFACTOR**: Replace aggregator phase with built-in aggregation computation (no Aggregator instances)
   - Add eval summary computation

2. `packages/tally/src/core/tally.ts`
   - **REFACTOR**: Change `TallyContainer` to accept `evaluators: readonly Evaluator<TContainer>[]` (remove `aggregators` parameter)
   - Remove `aggregators` field from TallyContainer
   - Internally calls `buildFromEvals` to convert evals → internal structure
   - Update `createTally` factory to match new signature (no aggregators)

### Phase 5: Built-in Aggregation Utilities (No Aggregators)

#### Files to CREATE:
1. `packages/tally/src/core/aggregators/builtin.ts`
   - `calculateBuiltInAggregations(scores: Score[], rawValues?: MetricScalar[], verdictPolicy?: VerdictPolicy): BuiltInAggregations`
   - `calculatePassRate(scores: Score[], verdictPolicy: VerdictPolicy): Score`
   - `calculateDistribution(rawValues: MetricScalar[]): Record<string, number>`
   - `calculatePercentiles(scores: Score[]): { p50, p75, p90, p95, p99 }`
   - Note: These are utility functions, NOT Aggregator instances

#### Files to UPDATE:
1. `packages/tally/src/core/aggregators/base.ts`
   - Keep existing utilities (calculateMean, calculatePercentile, etc.) for internal use
   - Mark as internal-only (not exported for user consumption)

### Phase 6: User-Facing API

#### Files to CREATE:
1. `packages/tally/src/evals/index.ts`
   - Export all Eval types
   - Export factory functions: `defineSingleTurnEval`, `defineMultiTurnEval`, `defineScorerEval`
   - Export context helpers: `runAllTargets`, `runSelectedSteps`, `runSelectedItems`
   - Export verdict policy helpers:
     - `booleanVerdict(passWhen: true | false): VerdictPolicy`
     - `thresholdVerdict(passAt: number): VerdictPolicy`
     - `rangeVerdict(min?: number, max?: number): VerdictPolicy`
     - `ordinalVerdict(passWhenIn: string[]): VerdictPolicy`
     - `customVerdict<T>(fn: (score: Score, raw: T) => 'pass' | 'fail' | 'unknown'): VerdictPolicy`

#### Files to UPDATE:
1. `packages/tally/src/core/factory.ts`
   - **REFACTOR**: Update `createEvaluator` to accept evals (new API)

2. `packages/tally/src/index.ts`
   - Export new Eval types and factories as primary API
   - Remove Aggregator type exports (no longer user-facing)
   - Export refactored Evaluator type (accepts evals)

### Phase 7: Examples and Documentation

#### Files to CREATE:
1. `packages/tally/docs/examples/eval-api-examples.ts`
   - SingleTurnEval examples (boolean, number, ordinal)
   - MultiTurnEval examples
   - ScorerEval examples
   - Custom verdict examples

2. `packages/tally/docs/eval-api-guide.md`
   - User guide for Eval API
   - Best practices

---

## Examples

### Example 1: Single-Turn Eval with Boolean Metric (Type-Safe)

```typescript
import { defineSingleTurnEval, booleanVerdict, runAllTargets } from '@tally/evals';
import { createExactMatchMetric } from '@tally/metrics';
import { createEvaluator, createTally } from '@tally/core';

// Boolean metric: exact match (returns true/false)
const exactMatchMetric = createExactMatchMetric({
  caseSensitive: false,
});

// Type-safe: verdict policy type inferred from metric (boolean → boolean verdict)
const accuracyEval = defineSingleTurnEval({
  name: 'Accuracy',
  metric: exactMatchMetric,  // TypeScript knows this is boolean
  verdict: booleanVerdict(true),  // Type-checked: must be boolean verdict
  // Built-in aggregations automatically calculated:
  // - mean (average accuracy across targets)
  // - percentiles (p50, p75, p90, p95, p99)
  // - passRate (percentage of targets that passed)
  // - failRate (percentage of targets that failed)
});

const evaluator = createEvaluator({
  name: 'Accuracy Evaluator',
  evals: [accuracyEval],
  context: runAllTargets(),  // REQUIRED: Context specifies which targets to evaluate
});

const tally = createTally({
  data: dataset,
  evaluators: [evaluator],
});

const report = await tally.run();

// report.result.summaries.byEval['Accuracy'] contains:
// - aggregations.score.mean (e.g., 0.85)
// - verdictSummary.passRate / failRate / counts (when a verdict policy exists)
```

### Example 2: Single-Turn Eval with Number Metric and Threshold Verdict (Type-Safe)

```typescript
import { defineSingleTurnEval, thresholdVerdict, runAllTargets } from '@tally/evals';
import { createAnswerRelevanceMetric } from '@tally/metrics';
import { createEvaluator, createTally } from '@tally/core';

const relevanceMetric = createAnswerRelevanceMetric({
  provider: openai('gpt-4'),
});

// Type-safe: verdict policy type inferred from metric (number → number verdict)
const relevanceEval = defineSingleTurnEval({
  name: 'Answer Relevance',
  metric: relevanceMetric,  // TypeScript knows this is number
  verdict: thresholdVerdict(0.7),  // Type-checked: must be number verdict
});

const evaluator = createEvaluator({
  name: 'Relevance Evaluator',
  evals: [relevanceEval],
  context: runAllTargets(),  // REQUIRED: Context specifies which targets to evaluate
});

const tally = createTally({
  data: dataset,
  evaluators: [evaluator],
});

const report = await tally.run();

const report = await tally.run();
// Built-in aggregations:
// - aggregations.mean (average relevance score across targets)
// - aggregations.passRate (percentage scoring >= 0.7)
// - aggregations.percentiles (p50, p75, p90, p95, p99)
```

### Example 3: Multi-Turn Eval (Type-Safe)

```typescript
import { defineMultiTurnEval, thresholdVerdict, runAllTargets } from '@tally/evals';
import { createGoalCompletionMetric } from '@tally/metrics';
import { createEvaluator, createTally } from '@tally/core';

const goalCompletionMetric = createGoalCompletionMetric({
  provider: openai('gpt-4'),
  goalDescription: 'Book a flight and hotel',
});

// Type-safe: verdict policy type inferred from metric (number → number verdict)
const goalEval = defineMultiTurnEval({
  name: 'Goal Completion',
  metric: goalCompletionMetric,  // TypeScript knows this is number
  verdict: thresholdVerdict(0.8),  // Type-checked: must be number verdict
  // Results aggregated across conversations:
  // - aggregations.mean (average completion score)
  // - aggregations.passRate (percentage of conversations that passed)
});

const evaluator = createEvaluator({
  name: 'Goal Completion Evaluator',
  evals: [goalEval],
  context: runAllTargets(),  // REQUIRED: Context specifies which targets to evaluate
});

const tally = createTally({
  data: conversations,
  evaluators: [evaluator],
});

const report = await tally.run();
// Each conversation gets a verdict
// report.result.summaries.byEval['Goal Completion'] contains:
// - aggregations.score.mean (average score across conversations)
// - verdictSummary.passRate (when a verdict policy exists)
```

### Example 4: Scorer Eval (Combines Multiple Metrics)

```typescript
import { defineScorerEval, thresholdVerdict, runAllTargets } from '@tally/evals';
import { defineScorer } from '@tally/core/factory';
import { createAnswerRelevanceMetric, createCompletenessMetric } from '@tally/metrics';
import { createEvaluator, createTally } from '@tally/core';

const relevanceMetric = createAnswerRelevanceMetric({ provider: openai('gpt-4') });
const completenessMetric = createCompletenessMetric({ provider: openai('gpt-4') });

const qualityScorer = defineScorer({
  name: 'quality',
  output: { name: 'quality', valueType: 'number' },
  inputs: [
    { metric: relevanceMetric, weight: 0.6 },
    { metric: completenessMetric, weight: 0.4 },
  ],
});

// Scorer eval: verdict is always number-based (Score output)
const qualityEval = defineScorerEval({
  name: 'Overall Quality',
  inputs: [relevanceMetric, completenessMetric],
  scorer: qualityScorer,
  verdict: thresholdVerdict(0.75),  // Pass when quality score >= 0.75
});

const evaluator = createEvaluator({
  name: 'Overall Quality Evaluator',
  evals: [qualityEval],
  context: runAllTargets(),  // REQUIRED: Context specifies which targets to evaluate
});

const tally = createTally({
  data: dataset,
  evaluators: [evaluator],
});

const report = await tally.run();

const report = await tally.run();
// Built-in aggregations on scorer output:
// - aggregations.mean (average quality score across targets)
// - aggregations.passRate (percentage passing threshold)
```

### Example 5: Ordinal Metric with Type-Safe Verdict

```typescript
import { defineSingleTurnEval, ordinalVerdict, runAllTargets } from '@tally/evals';
import { createEvaluator, createTally } from '@tally/core';

// Ordinal metric: returns 'excellent' | 'good' | 'fair' | 'poor'
const qualityMetric = createOrdinalQualityMetric({
  provider: openai('gpt-4'),
  categories: ['excellent', 'good', 'fair', 'poor'],
});

// Type-safe: verdict policy type inferred from metric (string → ordinal verdict)
const qualityEval = defineSingleTurnEval({
  name: 'Quality Rating',
  metric: qualityMetric,  // TypeScript knows this is string (ordinal)
  autoNormalize: {
    kind: 'ordinal',
    weights: {
      'excellent': 1.0,
      'good': 0.75,
      'fair': 0.5,
      'poor': 0.25,
    },
  },
  verdict: ordinalVerdict(['excellent', 'good']),  // Type-checked: must be ordinal verdict
});

const evaluator = createEvaluator({
  name: 'Quality Rating Evaluator',
  evals: [qualityEval],
  context: runAllTargets(),  // REQUIRED: Context specifies which targets to evaluate
});

const tally = createTally({
  data: dataset,
  evaluators: [evaluator],
});

const report = await tally.run();

const report = await tally.run();
// Built-in aggregations:
// - aggregations.mean (average normalized score across targets)
// - aggregations.distribution (counts: { excellent: 10, good: 20, fair: 5, poor: 2 })
// - aggregations.passRate (percentage in 'excellent' or 'good')
```

### Example 6: Custom Verdict Policy (Type-Safe)

```typescript
import { defineSingleTurnEval, customVerdict } from '@tally/evals';

// Type-safe: custom verdict function receives correctly typed rawValue
const customEval = defineSingleTurnEval({
  name: 'Custom Quality',
  metric: qualityMetric,  // TypeScript knows this is string (ordinal)
  verdict: customVerdict((score, rawValue) => {
    // rawValue is typed as string (from metric type)
    // Custom logic: pass if score > 0.8 OR raw value is 'excellent'
    if (score > 0.8) return 'pass';
    if (rawValue === 'excellent') return 'pass';
    return 'fail';
  }),
});
```

---

## Change Summary

### Files to CREATE (New)

1. **Core Types:**
   - `packages/tally/src/core/evals/types.ts` - Eval type definitions
   - `packages/tally/src/core/evals/normalization.ts` - Auto-normalization logic
   - `packages/tally/src/core/evals/verdict.ts` - Verdict computation
   - `packages/tally/src/core/evals/aggregations.ts` - Built-in aggregation calculation
   - `packages/tally/src/core/evals/builder.ts` - Eval → Evaluator converter

2. **Aggregators:**
   - `packages/tally/src/core/aggregators/builtin.ts` - Built-in aggregation utilities

3. **User API:**
   - `packages/tally/src/evals/index.ts` - Public Eval API exports

4. **Documentation:**
   - `packages/tally/docs/eval-api-plan.md` - This document
   - `packages/tally/docs/eval-api-guide.md` - User guide
   - `packages/tally/docs/examples/eval-api-examples.ts` - Code examples

### Files to UPDATE (Modify Existing)

1. **Core Types:**
   - `packages/tally/src/core/types.ts`
     - Add `TargetVerdict` interface
     - Update `PerTargetResult` to include `verdicts: Map<string, TargetVerdict>`
     - Add summary types (`Summaries`, `EvalSummarySnap`) keyed by eval name
     - Update run outputs to `TallyRunReport` / `TallyRunArtifact` (see `REPORTING.md`)

2. **Pipeline:**
   - `packages/tally/src/core/pipeline.ts`
     - Add verdict computation phase
     - Update `buildPerTargetResults` to compute verdicts
     - Update aggregation phase to compute built-in aggregations
     - Add eval summary computation

3. **Tally Container:**
   - `packages/tally/src/core/tally.ts`
     - **REFACTOR**: Update `createTally` to new signature (no aggregators)

4. **Aggregators:**
   - `packages/tally/src/core/aggregators/base.ts`
     - Keep existing utilities for internal use
     - Mark as internal-only (not exported)

5. **Exports:**
   - `packages/tally/src/index.ts`
     - Export new Eval types and factories
     - Export refactored Evaluator type (accepts evals)
     - Remove Aggregator type exports (no longer user-facing)

### Files to DELETE

1. **Aggregator exports**:
   - `packages/tally/src/aggregators/index.ts` - Remove user-facing aggregator exports
   - Aggregator types remain for internal use only (not exported)

2. **Old Evaluator API**:
   - Remove old `Evaluator` interface that accepted metrics + scorer
   - Remove old `createEvaluator` that accepted metrics + scorer

### Breaking Changes

**YES** - This is a breaking API change:

1. **Evaluator API changed**: 
   - `Evaluator` now accepts `evals: readonly Eval<TContainer>[]` instead of `metrics` + `scorer`
   - `createEvaluator` signature changed to accept evals
   - Context is now required (not optional) and defined at Evaluator level

2. **Aggregators removed**:
   - No more manual aggregator definitions
   - Built-in aggregations computed automatically
   - `Aggregator` type no longer user-facing (internal use only)
   - `Tally` no longer accepts `aggregators` parameter

3. **Pipeline API changed**:
   - `executePipeline` no longer accepts aggregators parameter
   - Built-in aggregations computed directly in pipeline

4. **Run output structure changed**:
   - Run outputs are now `TallyRunReport` (SDK) + `TallyRunArtifact` (persisted)
   - Summaries live at `result.summaries.byEval[evalName]`
   - Single-turn results are step-indexed at `result.singleTurn[eval].byStepIndex`

---

## Implementation Checklist

### Phase 1: Core Types ✅
- [ ] Create `packages/tally/src/core/evals/types.ts`
- [ ] Create `packages/tally/src/core/evals/normalization.ts`
- [ ] Update `packages/tally/src/core/types.ts` with enhanced report types

### Phase 2: Evaluator Refactoring ✅
- [ ] Update `packages/tally/src/core/types.ts` - refactor Evaluator interface
- [ ] Update `packages/tally/src/core/factory.ts` - refactor createEvaluator

### Phase 3: Eval Builder ✅
- [ ] Create `packages/tally/src/core/evals/builder.ts`
- [ ] Create `packages/tally/src/core/evals/verdict.ts`
- [ ] Create `packages/tally/src/core/evals/aggregations.ts`

### Phase 4: Enhanced Pipeline ✅
- [ ] Update `packages/tally/src/core/pipeline.ts` - remove aggregators parameter
- [ ] Update `packages/tally/src/core/tally.ts` - remove aggregators parameter

### Phase 5: Built-in Aggregation Utilities ✅
- [ ] Create `packages/tally/src/core/aggregators/builtin.ts`
- [ ] Update `packages/tally/src/core/aggregators/base.ts` if needed

### Phase 6: User-Facing API ✅
- [ ] Create `packages/tally/src/evals/index.ts`
- [ ] Update `packages/tally/src/core/factory.ts` - update createEvaluator
- [ ] Update `packages/tally/src/index.ts` exports

### Phase 7: Tests ✅
- [ ] Unit tests for verdict computation
- [ ] Unit tests for auto-normalization
- [ ] Unit tests for built-in aggregations
- [ ] Integration tests for Eval builder
- [ ] E2E tests with examples

### Phase 7: Documentation ✅
- [ ] Create `packages/tally/docs/eval-api-guide.md`
- [ ] Create `packages/tally/docs/examples/eval-api-examples.ts`
- [ ] Update main README with Eval API examples

---

## Open Questions / Decisions Needed

1. **Percentile defaults**: Should we always calculate p50, p75, p90, p95, p99, or make this configurable?
   - **Decision**: Always calculate standard percentiles (p50, p75, p90, p95, p99) - they're cheap to compute

2. **Distribution calculation**: For ordinal metrics, should distribution be based on raw values or normalized scores?
   - **Decision**: Distribution based on raw values (categories), normalized scores used for aggregations

3. **Report structure**: Should `AggregateSummary.average` be kept or removed?
   - **Decision**: Remove `average` field - use `aggregations.mean` instead (breaking change)

4. **Eval name uniqueness**: Should we enforce unique eval names?
   - **Decision**: Yes, enforce uniqueness (throw error if duplicate names)

5. **Single metric per eval**: SingleTurnEval and MultiTurnEval each have one metric (not multiple)
   - **Decision**: ✅ Confirmed - single metric per eval simplifies API and enables type inference
6. **Factory function naming**: Use "define" semantics with shorter names
   - **Decision**: ✅ Use `defineSingleTurnEval`, `defineMultiTurnEval`, `defineScorerEval` (following `defineScorer` pattern)
7. **Evaluator refactoring**: Evaluator accepts evals (not metrics/scorers directly)
   - **Decision**: ✅ Evaluator refactored to accept evals array, context defined at Evaluator level
8. **Aggregators removal**: Aggregators completely removed from user-facing API
   - **Decision**: ✅ Aggregators removed from Tally, built-in aggregations computed automatically

---

## Success Criteria

1. ✅ Users define evals without manually specifying aggregators
2. ✅ Pass/fail is first-class and type-safe
3. ✅ Built-in aggregations always calculated automatically (mean, percentiles, pass/fail rates)
4. ✅ Boolean and ordinal metrics auto-normalize
5. ✅ Scorers are separate evals (not mixed with metrics)
6. ✅ Evaluator API refactored to accept evals (cleaner API)
7. ✅ Aggregators completely removed from user-facing API
8. ✅ Clean breaking change with no legacy code
9. ✅ Comprehensive examples and documentation

