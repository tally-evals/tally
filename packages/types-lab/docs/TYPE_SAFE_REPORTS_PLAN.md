# Type-Safe Reports Implementation Plan

## Goal

Make `tally.run()` return a type-safe report where:
- Eval names have autocomplete
- Typos cause compile errors  
- `rawValue` types are preserved from metric definitions
- Single-turn vs multi-turn access is enforced

**Scope:** Focus on eval-name-keyed access (`report.result.singleTurn.evalName`). Metric-name-keyed access can be a follow-up.

**Non-goals:** Backward compatibility. We will modify existing types/functions directly.

---

## Current Type Flow (Where Erasure Happens)

```
SingleTurnEval<C, number>  ──┐
                             ├──▶  Eval<C> (uses any)  ──▶  Evaluator.evals  ──▶  TallyRunReport
MultiTurnEval<C, boolean>  ──┘                                                      │
                                                                                    ▼
                                                              Record<string, ...> (no type info)
```

### Erasure Point #1: `Eval` Union Type

**File:** `packages/core/src/types/evaluators.ts` (lines 174-180)
```typescript
export type Eval<_TContainer extends MetricContainer = MetricContainer> =
  | SingleTurnEval<SingleTurnContainer, any>  // ← TMetricValue erased to `any`
  | MultiTurnEval<MultiTurnContainer, any>    // ← TMetricValue erased to `any`
  | ScorerEval;
```

**Why it exists:** TypeScript variance issues with `Aggregator<TValue>` in function parameter position. 

**Fix:** We don't need to fix this. Instead, we use `const` type parameter at `createTally` to infer exact tuple type before it gets widened to `Eval[]`.

### Erasure Point #2: `Evaluator` Wrapper

**File:** `packages/core/src/types/evaluators.ts` (lines 191-197)
```typescript
export interface Evaluator<TContainer extends MetricContainer> {
  name: string;
  evals: readonly Eval<TContainer>[];  // Already erased
  context: EvaluationContext;
}
```

**Fix:** Accept evals directly in `createTally`, bypass the `Evaluator` wrapper for the typed path.

### Erasure Point #3: `Tally` Interface

**File:** `packages/core/src/types/tally.ts` (lines 31-36)
```typescript
export interface Tally<TContainer extends MetricContainer> {
  data: readonly TContainer[];
  evaluators: readonly Evaluator<MetricContainer>[];  // No TEvals parameter
  run(options?: TallyRunOptions): Promise<TallyRunReport>;  // Untyped return
}
```

**Fix:** Add `TEvals` generic parameter, return `TallyRunReport<TEvals>`.

### Erasure Point #4: `TallyRunReport` Interface

**File:** `packages/core/src/types/runReport.ts` (lines 11-21)
```typescript
export interface TallyRunReport {
  readonly defs: RunDefs;                   // String-keyed
  readonly result: ConversationResult;      // String-keyed Records
  view(): TargetRunView;                    // String-keyed methods
}
```

**Fix:** Make `TallyRunReport<TEvals>` generic, with typed `result` accessor.

### Erasure Point #5: `ConversationResult` Structure

**File:** `packages/core/src/types/runArtifact.ts` (lines 140-155)
```typescript
export interface ConversationResult {
  singleTurn: Record<EvalName, SingleTurnEvalSeries>;  // String-keyed
  multiTurn: Record<EvalName, ConversationEvalResult>; // String-keyed
  scorers: Record<EvalName, ...>;
}
```

**Fix:** Keep `ConversationResult` as-is (for serialization). Add typed accessors via mapped types.

---

## Implementation Strategy

**Core Insight:** We don't need to change runtime behavior. We need to:
1. Capture eval types at `createTally` call site using `const` type parameter
2. Thread that type through to `TallyRunReport<TEvals>`
3. Use mapped types to provide typed accessors over the string-keyed runtime data

### API Changes Summary

| Current | New |
|---------|-----|
| `createTally({ data, evaluators })` | `createTally({ data, evals })` |
| `Tally<TContainer>` | `Tally<TContainer, TEvals>` |
| `TallyRunReport` | `TallyRunReport<TEvals>` |
| `report.result.singleTurn['name']` | `report.result.singleTurn.name` (typed) |

---

## Detailed Changes

### 1. Type Utilities (New File)

**File:** `packages/core/src/types/typedReport.ts` (NEW)

```typescript
import type { MetricScalar, Score } from './primitives';
import type { SingleTurnEval, MultiTurnEval, ScorerEval, Eval } from './evaluators';
import type { EvalOutcome, SingleTurnEvalSeries, ConversationEvalResult } from './runArtifact';

// ─────────────────────────────────────────────────────────────────────────────
// Type Extraction Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Extract eval name as literal type */
type ExtractEvalName<E> = E extends { readonly name: infer N extends string } ? N : never;

/** Extract raw value type from eval */
type ExtractValueType<E> = 
  E extends SingleTurnEval<any, infer V> ? V :
  E extends MultiTurnEval<any, infer V> ? V :
  E extends ScorerEval ? number :
  MetricScalar;

/** Filter tuple by eval kind */
type FilterByKind<T extends readonly Eval[], K extends string> = 
  Extract<T[number], { kind: K }>;

// ─────────────────────────────────────────────────────────────────────────────
// Typed Result Structures  
// ─────────────────────────────────────────────────────────────────────────────

/** Typed measurement preserving raw value type */
interface TypedMeasurement<TValue extends MetricScalar> {
  metricRef: string;
  score?: Score;
  rawValue?: TValue | null;
  confidence?: number;
  reasoning?: string;
}

/** Typed step result */
interface TypedStepEvalResult<TValue extends MetricScalar> {
  evalRef: string;
  measurement: TypedMeasurement<TValue>;
  outcome?: EvalOutcome;
}

/** Typed series for single-turn evals */
interface TypedSingleTurnEvalSeries<TValue extends MetricScalar> {
  byStepIndex: Array<TypedStepEvalResult<TValue> | null>;
}

/** Typed conversation result for multi-turn evals */
interface TypedConversationEvalResult<TValue extends MetricScalar> {
  evalRef: string;
  measurement: TypedMeasurement<TValue>;
  outcome?: EvalOutcome;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapped Result Types
// ─────────────────────────────────────────────────────────────────────────────

/** Map single-turn evals to typed results, keyed by eval name */
type TypedSingleTurnResults<T extends readonly Eval[]> = {
  [E in FilterByKind<T, 'singleTurn'> as ExtractEvalName<E>]: 
    TypedSingleTurnEvalSeries<ExtractValueType<E>>;
};

/** Map multi-turn evals to typed results, keyed by eval name */
type TypedMultiTurnResults<T extends readonly Eval[]> = {
  [E in FilterByKind<T, 'multiTurn'> as ExtractEvalName<E>]: 
    TypedConversationEvalResult<ExtractValueType<E>>;
};

/** Map scorer evals to typed results */
type TypedScorerResults<T extends readonly Eval[]> = {
  [E in FilterByKind<T, 'scorer'> as ExtractEvalName<E>]:
    | { shape: 'scalar'; result: TypedConversationEvalResult<number> }
    | { shape: 'seriesByStepIndex'; series: TypedSingleTurnEvalSeries<number> };
};

/** Typed conversation result structure */
interface TypedConversationResult<T extends readonly Eval[]> {
  stepCount: number;
  singleTurn: TypedSingleTurnResults<T>;
  multiTurn: TypedMultiTurnResults<T>;
  scorers: TypedScorerResults<T>;
}

export type {
  ExtractEvalName,
  ExtractValueType,
  FilterByKind,
  TypedMeasurement,
  TypedStepEvalResult,
  TypedSingleTurnEvalSeries,
  TypedConversationEvalResult,
  TypedSingleTurnResults,
  TypedMultiTurnResults,
  TypedScorerResults,
  TypedConversationResult,
};
```

### 2. Update `TallyRunReport` Interface

**File:** `packages/core/src/types/runReport.ts`

```typescript
import type { Eval } from './evaluators';
import type { TypedConversationResult } from './typedReport';
import type { RunDefs, TallyRunArtifact } from './runArtifact';
import type { TargetRunView } from './runView';

/**
 * Type-safe run report.
 * 
 * TEvals is the tuple of eval definitions, preserved from createTally().
 */
export interface TallyRunReport<TEvals extends readonly Eval[] = readonly Eval[]> {
  readonly runId: string;
  readonly createdAt: Date;
  
  /** Type-safe result accessors */
  readonly result: TypedConversationResult<TEvals>;
  
  /** Definition snapshots (for serialization/debugging) */
  readonly defs: RunDefs;
  readonly metadata?: Record<string, unknown>;
  
  /** String-keyed view for dynamic access */
  view(): TargetRunView;
  
  /** Serialize to JSON-compatible artifact */
  toArtifact(): TallyRunArtifact;
}
```

### 3. Update `Tally` Interface

**File:** `packages/core/src/types/tally.ts`

```typescript
import type { MetricContainer } from './metrics';
import type { Eval, EvaluationContext } from './evaluators';
import type { TallyRunReport } from './runReport';

export interface TallyRunOptions {
  cache?: unknown;
  llmOptions?: { maxRetries?: number; temperature?: number };
  metadata?: Record<string, unknown>;
}

/**
 * Tally container interface.
 * 
 * @typeParam TContainer - DatasetItem or Conversation
 * @typeParam TEvals - Tuple of eval definitions (inferred from createTally)
 */
export interface Tally<
  TContainer extends MetricContainer,
  TEvals extends readonly Eval[] = readonly Eval[]
> {
  readonly data: readonly TContainer[];
  readonly evals: TEvals;
  readonly context?: EvaluationContext;
  
  run(options?: TallyRunOptions): Promise<TallyRunReport<TEvals>>;
}
```

### 4. Update `createTally` Function

**File:** `packages/tally/src/core/tally.ts`

```typescript
/**
 * Create a Tally instance with type-safe report.
 * 
 * Uses `const` type parameter to preserve eval name literals.
 * No `as const` needed at call site.
 */
export function createTally<
  TContainer extends DatasetItem | Conversation,
  const TEvals extends readonly Eval[]
>(args: {
  data: readonly TContainer[];
  evals: TEvals;
  context?: EvaluationContext;
}): Tally<TContainer, TEvals> {
  return new TallyContainer(args.data, args.evals, args.context);
}
```

**Update `TallyContainer` class:**

```typescript
export class TallyContainer<
  TContainer extends DatasetItem | Conversation,
  TEvals extends readonly Eval[] = readonly Eval[]
> implements Tally<TContainer, TEvals> {
  
  public readonly data: readonly TContainer[];
  public readonly evals: TEvals;
  public readonly context?: EvaluationContext;
  
  constructor(
    data: readonly TContainer[], 
    evals: TEvals,
    context?: EvaluationContext
  ) {
    this.data = data;
    this.evals = evals;
    this.context = context;
  }
  
  async run(options?: TallyRunOptions): Promise<TallyRunReport<TEvals>> {
    // ... existing pipeline execution ...
    // At the end, return typed report:
    return createTallyRunReport<TEvals>(artifact, this.evals);
  }
}
```

### 5. Update `createTallyRunReport` Function

**File:** `packages/tally/src/core/runReport.ts`

```typescript
import type { Eval } from '@tally/core/types';
import type { TallyRunArtifact, TallyRunReport } from '@tally/core/types';
import type { TypedConversationResult } from '@tally/core/types';
import { createTargetRunView } from '../view/targetRunView';

export function createTallyRunReport<TEvals extends readonly Eval[]>(
  artifact: TallyRunArtifact,
  _evals: TEvals  // For type inference only
): TallyRunReport<TEvals> {
  return {
    runId: artifact.runId,
    createdAt: new Date(artifact.createdAt),
    defs: artifact.defs,
    // Cast the string-keyed runtime data to typed accessors
    result: artifact.result as unknown as TypedConversationResult<TEvals>,
    ...(artifact.metadata && { metadata: artifact.metadata }),
    view: () => createTargetRunView(artifact),
    toArtifact: () => artifact,
  };
}
```

---

## File Change Summary

| File | Change |
|------|--------|
| `packages/core/src/types/typedReport.ts` | **NEW** - Type utilities and mapped types |
| `packages/core/src/types/runReport.ts` | Add `TEvals` parameter to `TallyRunReport` |
| `packages/core/src/types/tally.ts` | Add `TEvals` parameter to `Tally`, change `evaluators` → `evals` |
| `packages/core/src/types/index.ts` | Export new types from `typedReport.ts` |
| `packages/tally/src/core/tally.ts` | Update `createTally` with `const` param, update `TallyContainer` |
| `packages/tally/src/core/runReport.ts` | Add `TEvals` parameter to `createTallyRunReport` |
| `packages/tally/src/index.ts` | Re-export updated types |

---

## What About `Evaluator`?

The current `Evaluator` wrapper provides:
1. `name` - grouping label
2. `context` - shared `EvaluationContext` for all evals
3. `evals` - array of evals

For type-safe reports, we have two options:

### Option A: Keep Evaluator for Grouping, Extract Evals for Typing

```typescript
function createTally<const TEvals extends readonly Eval[]>(args: {
  data: readonly TContainer[];
  evaluators: readonly Evaluator<MetricContainer>[];  // Keep for runtime
  _evals?: TEvals;  // Hidden param for type inference
}): Tally<TContainer, TEvals>;

// Usage:
const evals = [relevanceEval, toxicityEval] as const;
const evaluator = { name: 'quality', evals, context: { singleTurn: { run: 'all' } } };
const tally = createTally({ data, evaluators: [evaluator], _evals: evals });
```

**Con:** Awkward duplication of evals.

### Option B: Flatten to Direct Evals (Recommended)

```typescript
function createTally<const TEvals extends readonly Eval[]>(args: {
  data: readonly TContainer[];
  evals: TEvals;
  context?: EvaluationContext;  // Shared context (optional)
}): Tally<TContainer, TEvals>;

// Usage:
const tally = createTally({ 
  data, 
  evals: [relevanceEval, toxicityEval],
  context: { singleTurn: { run: 'all' } }
});
```

**Recommendation:** Option B. Simpler API, type safety works naturally.

If users need eval grouping, they can use array spreading:
```typescript
const qualityEvals = [relevanceEval, coherenceEval];
const safetyEvals = [toxicityEval, biasEval];

const tally = createTally({
  data,
  evals: [...qualityEvals, ...safetyEvals],
});
```

---

## Critical Check: Does This Work?

### Test Case 1: Literal Names Preserved

```typescript
const relevanceEval = defineSingleTurnEval({
  name: 'relevance',  // ← literal 'relevance', not string
  metric: relevanceMetric,
});

const tally = createTally({
  data: [conversation],
  evals: [relevanceEval],  // ← const param infers ['relevance']
});

const report = await tally.run();
report.result.singleTurn.relevance;  // ✅ autocomplete
report.result.singleTurn.typo;       // ✅ error
```

**Works because:** `const` type parameter on `createTally` preserves the tuple type `[typeof relevanceEval]`, which includes `name: 'relevance'`.

### Test Case 2: Value Types Preserved

```typescript
const toxicityEval = defineSingleTurnEval({
  name: 'toxicity',
  metric: booleanMetric,  // MetricDef<boolean>
});

const report = await tally.run();
const raw = report.result.singleTurn.toxicity.byStepIndex[0]?.measurement.rawValue;
// typeof raw = boolean | null | undefined ✅
```

**Works because:** `ExtractValueType` conditional type extracts `boolean` from `SingleTurnEval<C, boolean>`.

### Test Case 3: Eval Kind Separation

```typescript
const singleTurn = defineSingleTurnEval({ name: 'a', metric: numMetric });
const multiTurn = defineMultiTurnEval({ name: 'b', metric: numMetric });

const report = await tally.run();
report.result.singleTurn.a;  // ✅ exists
report.result.singleTurn.b;  // ✅ error (b is multi-turn)
report.result.multiTurn.b;   // ✅ exists
```

**Works because:** `FilterByKind` uses `Extract` to filter union by `kind` discriminant.

---

## Potential Issues

### Issue 1: Factory Functions Must Use `const` Type Parameter

The `defineSingleTurnEval` function must use `const TName` to preserve literal types when called inline.

**Current code (`packages/tally/src/evals/factories.ts`):**
```typescript
export function defineSingleTurnEval<TContainer, TMetric, TMetricValue>({
  name,  // ← inferred as string, not literal
  ...
})
```

**Fix:** Add `const TName extends string` parameter:
```typescript
export function defineSingleTurnEval<
  const TName extends string,  // ← const is critical!
  TContainer extends SingleTurnContainer,
  TMetricValue extends MetricScalar
>(args: {
  name: TName;
  metric: SingleTurnMetricDef<TMetricValue, TContainer>;
  ...
}): SingleTurnEval<TName, TContainer, TMetricValue>
```

**File:** `packages/tally/src/evals/factories.ts` (lines 29-65)

**Why `const` is needed:** Without `const`, TypeScript widens `TName` to `string` when the factory is called inside an array expression (like `createTally({ evals: [...] })`). The `const` modifier forces TypeScript to infer the literal type.

### Issue 2: `SingleTurnEval` Needs `TName` Parameter

**Current (`packages/core/src/types/evaluators.ts`):**
```typescript
export interface SingleTurnEval<
  TContainer extends SingleTurnContainer,
  TMetricValue extends MetricScalar = MetricScalar,
> extends EvalBase {
  kind: 'singleTurn';
  // ...
}

interface EvalBase {
  name: string;  // ← not generic
}
```

**Fix:** Add `TName extends string` to interfaces:
```typescript
interface EvalBase<TName extends string = string> {
  readonly name: TName;
  // ...
}

export interface SingleTurnEval<
  TName extends string = string,
  TContainer extends SingleTurnContainer = SingleTurnContainer,
  TMetricValue extends MetricScalar = MetricScalar,
> extends EvalBase<TName> {
  readonly kind: 'singleTurn';
  // ...
}
```

**File:** `packages/core/src/types/evaluators.ts` (lines 110-133)

---

## Updated File Change Summary

| File | Lines | Change |
|------|-------|--------|
| `packages/core/src/types/typedReport.ts` | NEW | Type utilities, mapped types |
| `packages/core/src/types/evaluators.ts` | 110-180 | Add `TName` param to `EvalBase`, `SingleTurnEval`, `MultiTurnEval`, `ScorerEval` |
| `packages/core/src/types/runReport.ts` | 11-21 | Add `TEvals` param to `TallyRunReport` |
| `packages/core/src/types/tally.ts` | 31-36 | Add `TEvals` param, change `evaluators` → `evals` |
| `packages/core/src/types/index.ts` | - | Export new types |
| `packages/tally/src/evals/factories.ts` | 29-132 | Add `TName` param to factory functions |
| `packages/tally/src/core/tally.ts` | 449-542 | Update `TallyContainer`, `createTally` |
| `packages/tally/src/core/runReport.ts` | 4-14 | Add `TEvals` param |

---

## Implementation Order

1. **`evaluators.ts`** - Add `TName` to eval interfaces (foundational)
2. **`typedReport.ts`** - Add type utilities (no dependencies)
3. **`factories.ts`** - Update factory functions to preserve `TName`
4. **`runReport.ts`** - Make `TallyRunReport` generic
5. **`tally.ts` (core)** - Make `Tally` interface generic
6. **`tally.ts` (tally pkg)** - Update `createTally` and `TallyContainer`
7. **`index.ts` files** - Update exports
8. **Examples** - Update to use new API

---

---

## Key Technical Insight

The solution works because of how TypeScript's `const` type parameter interacts with literal types.

### Critical Discovery: Factory Functions Need `const` Too

Validated in `packages/types-lab/src/06-realistic-tally-types.ts`:

```typescript
// WITHOUT const on factory - name widened to string when called inline
function defineSingleTurnEval<TName extends string>(...): SingleTurnEval<TName, ...>
const tally = createTally({ evals: [defineSingleTurnEval({ name: "relevance", ... })] });
// TName inferred as string ❌

// WITH const on factory - literal preserved even when called inline
function defineSingleTurnEval<const TName extends string>(...): SingleTurnEval<TName, ...>
const tally = createTally({ evals: [defineSingleTurnEval({ name: "relevance", ... })] });
// TName inferred as "relevance" ✅
```

### All Three Changes Required

1. **Add `const` to factory function type parameters** (most critical!)
   ```typescript
   function defineSingleTurnEval<const TName extends string, ...>
   function defineMultiTurnEval<const TName extends string, ...>
   function defineScorerEval<const TName extends string>
   ```

2. **Add `TName` to eval interface generics**
   ```typescript
   interface EvalBase<TName extends string = string>
   interface SingleTurnEval<TName, TContainer, TMetricValue> extends EvalBase<TName>
   ```

3. **Add `const` to `createTally`**
   ```typescript
   function createTally<const TEvals extends readonly Eval[]>(...)
   ```

The `const` modifier on factory functions is the key discovery - without it, TypeScript infers `string` for the name parameter when the factory is called inline inside the `createTally` array.

---

## Verification

After implementation, these should work:

```typescript
// 1. Autocomplete for eval names
report.result.singleTurn.█  // shows: relevance, toxicity

// 2. Error for typos
report.result.singleTurn.relevanc  // ❌ Error: Property 'relevanc' does not exist

// 3. Correct value types
const raw = report.result.singleTurn.toxicity.byStepIndex[0]?.measurement.rawValue;
// raw: boolean | null | undefined

// 4. Eval kind enforcement
report.result.singleTurn.coherence  // ❌ Error (coherence is multi-turn)
report.result.multiTurn.coherence   // ✅ OK
```
