# Type-Safe View API Implementation Plan

## Overview

Refactor the existing `TargetRunView` to `TargetRunView<TEvals>` that provides:
- Type-safe eval name autocomplete
- Typed return values based on metric value types
- Step iteration via generator
- Reference resolution for definitions
- No data duplication (view projects over existing artifact data)

## Current State

### Problems with Current `TargetRunView`

```typescript
// Current - NOT type-safe
interface TargetRunView {
  step(stepIndex: number, evalName: string): StepEvalResult | undefined;  // any string
  conversation(evalName: string): ConversationEvalResult | undefined;     // any string
  stepVerdict(stepIndex: number, evalName: string): Verdict | undefined;
  conversationVerdict(evalName: string): Verdict | undefined;
}
```

Issues:
1. `evalName: string` - no autocomplete, no compile-time validation
2. Generic return types - `rawValue` is `MetricScalar`, not typed to actual metric
3. Must know if eval is single-turn vs multi-turn to pick correct method
4. No iteration support
5. Separate from definition resolution

---

## Target State

### Refactored `TargetRunView<TEvals>`

```typescript
interface TargetRunView<TEvals extends readonly Eval[] = readonly Eval[]> {
  readonly stepCount: number;

  // Result Accessors
  step(index: number): StepResults<TEvals>;
  steps(): Generator<StepResultsWithIndex<TEvals>, void, unknown>;
  conversation(): ConversationResults<TEvals>;
  summary(): SummaryResults<TEvals> | undefined;

  // Definition Accessors
  readonly defs: RunDefs;
  metric(name: string): MetricDefSnap | undefined;
  eval<K extends ExtractEvalName<TEvals[number]>>(name: K): EvalDefSnap | undefined;
  scorer(name: string): ScorerDefSnap | undefined;
  metricForEval<K extends ExtractEvalName<TEvals[number]>>(evalName: K): MetricDefSnap | undefined;
}
```

### Usage Examples

```typescript
const report = await tally.run({ target });
const view = report.view();

// Step access - type-safe, autocomplete works
view.step(0).toolCallAccuracy.outcome?.verdict        // 'pass' | 'fail' | 'unknown'
view.step(0).toolCallAccuracy.measurement.rawValue    // boolean (typed!)

// Iterate all steps
for (const step of view.steps()) {
  console.log(`Step ${step.index}: ${step.toolCallAccuracy.outcome?.verdict}`);
}

// Conversation level
view.conversation().overallQuality.outcome?.verdict
view.conversation().overallQuality.measurement.rawValue  // number (typed!)

// Summary
view.summary()?.toolCallAccuracy.verdictSummary?.passRate

// Definition resolution
view.eval('toolCallAccuracy')                    // EvalDefSnap
view.metricForEval('toolCallAccuracy')           // MetricDefSnap
```

---

## Implementation Tasks

### Phase 1: Core Types (packages/core/src/types)

#### 1.1 Create `StepResults<TEvals>` type

**File:** `packages/core/src/types/results.ts`

```typescript
/**
 * Type-safe step results object.
 * Keys are literal eval names with autocomplete.
 */
export type StepResults<TEvals extends readonly Eval[]> = {
  // Single-turn evals: guaranteed to exist at step level
  readonly [K in EvalNamesOfKind<TEvals, 'singleTurn'>]: StepEvalResult<
    ExtractValueType<Extract<FilterByKind<TEvals, 'singleTurn'>, { name: K }>>
  >;
} & {
  // Scorers: optional (only present if scorer produced seriesByStepIndex)
  readonly [K in EvalNamesOfKind<TEvals, 'scorer'>]?: StepEvalResult<number>;
};

/**
 * Step results with index, yielded by steps() generator.
 */
export type StepResultsWithIndex<TEvals extends readonly Eval[]> = 
  StepResults<TEvals> & { readonly index: number };
```

#### 1.2 Create `ConversationResults<TEvals>` type

**File:** `packages/core/src/types/results.ts`

```typescript
/**
 * Type-safe conversation-level results.
 * Keys are literal eval names with autocomplete.
 */
export type ConversationResults<TEvals extends readonly Eval[]> = {
  // Multi-turn evals: always conversation-level
  readonly [K in EvalNamesOfKind<TEvals, 'multiTurn'>]: ConversationEvalResult<
    ExtractValueType<Extract<FilterByKind<TEvals, 'multiTurn'>, { name: K }>>
  >;
} & {
  // Scorers: optional (only present if scorer produced scalar result)
  readonly [K in EvalNamesOfKind<TEvals, 'scorer'>]?: ConversationEvalResult<number>;
};
```

#### 1.3 Create `SummaryResults<TEvals>` type

**File:** `packages/core/src/types/results.ts`

```typescript
/**
 * Summary results keyed directly by eval name.
 */
export type SummaryResults<TEvals extends readonly Eval[]> = {
  readonly [K in ExtractEvalName<TEvals[number]>]: EvalSummary<
    Extract<TEvals[number], { name: K }>
  >;
};
```

#### 1.4 Refactor `TargetRunView<TEvals>` interface

**File:** `packages/core/src/types/runView.ts` (refactor existing)

```typescript
import type { Eval } from './evaluators';
import type { 
  StepResults, 
  StepResultsWithIndex, 
  ConversationResults,
  SummaryResults,
  ExtractEvalName,
  RunDefs,
  MetricDefSnap,
  EvalDefSnap,
  ScorerDefSnap,
} from './results';

/**
 * Type-safe view for accessing run results.
 * All methods are lazy projections over the underlying result data.
 *
 * @typeParam TEvals - Tuple of eval definitions for type-safe access.
 */
export interface TargetRunView<TEvals extends readonly Eval[] = readonly Eval[]> {
  /** Total number of steps in the conversation */
  readonly stepCount: number;

  // ─────────────────────────────────────────────────────────────────────────
  // Result Accessors
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get step results by index.
   * @param index - Step index (0-based)
   * @returns Type-safe step results with eval name autocomplete
   */
  step(index: number): StepResults<TEvals>;

  /**
   * Generator for iterating all steps.
   * Lazy evaluation - builds each step result on demand.
   * @yields Step results with index property
   */
  steps(): Generator<StepResultsWithIndex<TEvals>, void, unknown>;

  /**
   * Get conversation-level results.
   * Includes multi-turn evals and scalar scorers.
   * @returns Type-safe conversation results with eval name autocomplete
   */
  conversation(): ConversationResults<TEvals>;

  /**
   * Get summary/aggregation results.
   * @returns Summary results keyed by eval name, or undefined if not computed
   */
  summary(): SummaryResults<TEvals> | undefined;

  // ─────────────────────────────────────────────────────────────────────────
  // Definition Accessors (Reference Resolution)
  // ─────────────────────────────────────────────────────────────────────────

  /** All definitions (metrics, evals, scorers) */
  readonly defs: RunDefs;

  /** Resolve metric definition by name */
  metric(name: string): MetricDefSnap | undefined;

  /** Resolve eval definition by name (type-safe) */
  eval<K extends ExtractEvalName<TEvals[number]>>(name: K): EvalDefSnap | undefined;

  /** Resolve scorer definition by name */
  scorer(name: string): ScorerDefSnap | undefined;

  /** 
   * Get metric definition for an eval.
   * Shorthand for: metric(eval(evalName)?.metric)
   */
  metricForEval<K extends ExtractEvalName<TEvals[number]>>(
    evalName: K
  ): MetricDefSnap | undefined;
}
```

#### 1.5 Update `TallyRunReport` interface

**File:** `packages/core/src/types/runReport.ts`

```typescript
import type { TargetRunView } from './runView';

export interface TallyRunReport<TEvals extends readonly Eval[] = readonly Eval[]> {
  readonly runId: string;
  readonly createdAt: Date;
  readonly defs: RunDefs;
  readonly metadata?: Record<string, unknown>;

  /** Raw result data with full type safety */
  readonly result: ConversationResult<TEvals>;

  /**
   * Type-safe view for ergonomic access.
   * Returns lazy accessors over result data.
   */
  view(): TargetRunView<TEvals>;

  /** Serialize to artifact for persistence */
  toArtifact(): TallyRunArtifact;
}
```

#### 1.6 Update exports

**File:** `packages/core/src/types/index.ts`

Add exports for new types:
- `StepResults`
- `StepResultsWithIndex`
- `ConversationResults`
- `SummaryResults`
- `TargetRunView` (now generic)

---

### Phase 2: Implementation (packages/tally/src/view)

#### 2.1 Refactor `TargetRunViewImpl` class

**File:** `packages/tally/src/view/targetRunView.ts` (refactor existing)

```typescript
import type { 
  TallyRunArtifact, 
  TargetRunView,
  StepResults,
  StepResultsWithIndex,
  ConversationResults,
  SummaryResults,
  RunDefs,
  MetricDefSnap,
  EvalDefSnap,
  ScorerDefSnap,
  Eval,
  StepEvalResult,
  ConversationEvalResult,
} from '@tally-evals/core';

export class TargetRunViewImpl<TEvals extends readonly Eval[]> 
  implements TargetRunView<TEvals> {
  
  constructor(private readonly artifact: TallyRunArtifact) {}

  get stepCount(): number {
    return this.artifact.result.stepCount;
  }

  get defs(): RunDefs {
    return this.artifact.defs;
  }

  step(index: number): StepResults<TEvals> {
    const result: Record<string, StepEvalResult> = {};
    
    // Single-turn evals
    for (const [evalName, series] of Object.entries(
      this.artifact.result.singleTurn ?? {}
    )) {
      const stepResult = series.byStepIndex?.[index];
      if (stepResult) result[evalName] = stepResult;
    }
    
    // Scorers with step-indexed shape
    for (const [evalName, scorer] of Object.entries(
      this.artifact.result.scorers ?? {}
    )) {
      if (scorer.shape === 'seriesByStepIndex') {
        const stepResult = scorer.series?.byStepIndex?.[index];
        if (stepResult) result[evalName] = stepResult;
      }
    }
    
    return result as StepResults<TEvals>;
  }

  *steps(): Generator<StepResultsWithIndex<TEvals>, void, unknown> {
    for (let i = 0; i < this.stepCount; i++) {
      yield { index: i, ...this.step(i) } as StepResultsWithIndex<TEvals>;
    }
  }

  conversation(): ConversationResults<TEvals> {
    const result: Record<string, ConversationEvalResult> = {};
    
    // Multi-turn evals
    for (const [evalName, convResult] of Object.entries(
      this.artifact.result.multiTurn ?? {}
    )) {
      result[evalName] = convResult;
    }
    
    // Scorers with scalar shape
    for (const [evalName, scorer] of Object.entries(
      this.artifact.result.scorers ?? {}
    )) {
      if (scorer.shape === 'scalar') {
        result[evalName] = scorer.result;
      }
    }
    
    return result as ConversationResults<TEvals>;
  }

  summary(): SummaryResults<TEvals> | undefined {
    if (!this.artifact.result.summaries?.byEval) return undefined;
    return this.artifact.result.summaries.byEval as SummaryResults<TEvals>;
  }

  metric(name: string): MetricDefSnap | undefined {
    return this.artifact.defs.metrics?.[name];
  }

  eval(name: string): EvalDefSnap | undefined {
    return this.artifact.defs.evals?.[name];
  }

  scorer(name: string): ScorerDefSnap | undefined {
    return this.artifact.defs.scorers?.[name];
  }

  metricForEval(evalName: string): MetricDefSnap | undefined {
    const evalDef = this.eval(evalName);
    if (!evalDef?.metric) return undefined;
    return this.metric(evalDef.metric);
  }
}

/**
 * Create a type-safe view over a run artifact.
 */
export function createTargetRunView<TEvals extends readonly Eval[]>(
  artifact: TallyRunArtifact,
  _evals?: TEvals  // For type inference only
): TargetRunView<TEvals> {
  return new TargetRunViewImpl<TEvals>(artifact);
}
```

#### 2.2 Update `createTallyRunReport`

**File:** `packages/tally/src/core/runReport.ts`

```typescript
import { createTargetRunView } from '../view/targetRunView';

export function createTallyRunReport<TEvals extends readonly Eval[] = readonly Eval[]>(
  artifact: TallyRunArtifact,
  _evals?: TEvals,
): TallyRunReport<TEvals> {
  return {
    runId: artifact.runId,
    createdAt: new Date(artifact.createdAt),
    defs: artifact.defs,
    result: artifact.result as unknown as ConversationResult<TEvals>,
    ...(artifact.metadata ? { metadata: artifact.metadata } : {}),
    view: () => createTargetRunView<TEvals>(artifact, _evals),
    toArtifact: () => artifact,
  };
}
```

#### 2.3 Update exports

**File:** `packages/tally/src/index.ts`

```typescript
export { createTargetRunView, TargetRunViewImpl } from './view/targetRunView';
export type { TargetRunView } from '@tally-evals/core';
```

---

### Phase 3: Update Existing Usages

#### 3.1 Update internal usages

Search and update any internal usages to use the new type-safe API:
- Replace `view.step(i, evalName)` → `view.step(i).evalName`
- Replace `view.stepVerdict(i, evalName)` → `view.step(i).evalName.outcome?.verdict`
- Replace `view.conversation(evalName)` → `view.conversation().evalName`
- Replace `view.conversationVerdict(evalName)` → `view.conversation().evalName.outcome?.verdict`

---

### Phase 4: Testing

#### 4.1 Type tests

Create type-level tests to verify:
- Eval name autocomplete works
- `rawValue` is typed correctly based on metric valueType
- Scorers are optional on step/conversation
- Generator yields correct types

#### 4.2 Runtime tests

- `step(i)` returns correct data for single-turn evals
- `step(i)` returns scorer data when shape is seriesByStepIndex
- `steps()` yields all steps with correct index
- `conversation()` returns multi-turn and scalar scorers
- `summary()` returns summaries keyed by eval name
- Definition resolution methods work correctly

---

## File Changes Summary

| File | Action |
|------|--------|
| `packages/core/src/types/results.ts` | Add `StepResults`, `StepResultsWithIndex`, `ConversationResults`, `SummaryResults` |
| `packages/core/src/types/runView.ts` | Refactor `TargetRunView` to be generic with new API |
| `packages/core/src/types/runReport.ts` | Update `view()` return type to `TargetRunView<TEvals>` |
| `packages/core/src/types/index.ts` | Add new type exports |
| `packages/tally/src/view/targetRunView.ts` | Refactor implementation to match new interface |
| `packages/tally/src/core/runReport.ts` | Update to use refactored view |
| `packages/tally/src/index.ts` | Update exports |

---

## Migration Guide

### Before (untyped)

```typescript
const view = report.view();
const verdict = view.stepVerdict(0, 'toolCallAccuracy');  // string param
const result = view.step(0, 'toolCallAccuracy');          // string param
```

### After (type-safe)

```typescript
const view = report.view();
const verdict = view.step(0).toolCallAccuracy.outcome?.verdict;  // autocomplete!
const result = view.step(0).toolCallAccuracy;                     // typed result
const rawValue = result.measurement.rawValue;                     // boolean (typed!)
```

---

## Non-Goals

- No changes to data storage format (`TallyRunArtifact`)
- No changes to serialization
- No data duplication (view is projection layer)
