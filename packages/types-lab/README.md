# @tally/types-lab

Experimental package for exploring type-safe report patterns in Tally.

## The Problem

Tally has strong type safety at **definition time** but loses type information at **report time**.

```typescript
// At definition - strongly typed
const relevanceEval = defineSingleTurnEval({
  name: 'relevance',
  metric: relevanceMetric, // MetricDef<number>
  verdict: { kind: 'number', passAt: 0.7 } // TS enforces this
});

// At report time - type erased
const report = await tally.run();
report.result.singleTurn['relevance']  // string key, no autocomplete
report.result.singleTurn['typo']       // no error for wrong name!
```

## Solutions Explored

### 1. Registry Pattern (`02-solution-mapped-types.ts`)

Define evals as a const object, use mapped types to derive report shape.

```typescript
const registry = {
  relevance: defineEval({ name: 'relevance', metric: numberMetric }),
  toxicity: defineEval({ name: 'toxicity', metric: booleanMetric }),
} as const;

const tally = createTypedTally(registry);
const report = await tally.run();

report.results.byEval.relevance.rawValue  // number ✅
report.results.byEval.toxicity.rawValue   // boolean ✅
report.results.byEval.typo                // error ✅
```

**Pros**: Clean API, excellent type inference
**Cons**: Requires object literal (can't add evals dynamically)

### 2. Builder Pattern (`03-solution-builder.ts`)

Use method chaining where each `.addEval()` accumulates types.

```typescript
const tally = createTallyBuilder()
  .addEval(relevanceEval)
  .addEval(toxicityEval)
  .build();

const report = await tally.run();
report.results.relevance.rawValue  // number ✅
```

**Pros**: Dynamic addition, familiar pattern
**Cons**: Each call creates new builder instance, more complex internally

### 3. Array Inference (`04-solution-infer-from-array.ts`)

Use `as const` with array to infer tuple type, then extract types.

```typescript
const tally = createTally([
  relevanceEval,
  toxicityEval,
] as const);

const report = await tally.run();
report.results.relevance.rawValue  // number ✅
```

**Pros**: Closest to current API, minimal changes
**Cons**: Requires `as const` on array

### 4. Auto-Registry (`05-solution-auto-registry.ts`)

Uses `const` type parameter to infer types without `as const`.

```typescript
const tally = createTally([relevanceEval, toxicityEval]);  // No as const!

const report = await tally.run();
report.byEval.relevance.rawValue   // number ✅
report.byMetric['relevance-metric'] // also works ✅
```

**Pros**: No `as const` needed, dual access by eval/metric name
**Cons**: Requires TypeScript 5.0+

### 5. Realistic Tally Types (`06-realistic-tally-types.ts`) ⭐ RECOMMENDED

Full alignment with real Tally architecture:
- `SingleTurnEval` / `MultiTurnEval` / `ScorerEval` with kind discriminant
- `TypedConversationResult` with separate `singleTurn`, `multiTurn`, `scorers`
- `TypedMeasurement` with preserved value types
- Complete type-safe report structure

```typescript
// Define metrics and evals (matches real Tally API)
const relevanceMetric = defineSingleTurnMetric<'relevance-metric', number>({
  name: 'relevance-metric',
  valueType: 'number',
});

const relevanceEval = defineSingleTurnEval({
  name: 'relevance',
  metric: relevanceMetric,
  verdict: { kind: 'number', type: 'threshold', passAt: 0.7 },
});

// Create tally - NO `as const` needed!
const tally = createTally({
  data: [conversation],
  evals: [relevanceEval, toxicityEval, coherenceEval],
});

const report = await tally.run();

// Type-safe access by eval kind
report.result.singleTurn.relevance.byStepIndex[0]?.measurement.rawValue  // number ✅
report.result.multiTurn.coherence.measurement.rawValue                    // number ✅

// Errors for typos and wrong access
report.result.singleTurn.typo           // ❌ Error
report.result.singleTurn.coherence      // ❌ Error (it's multi-turn)
report.result.multiTurn.relevance       // ❌ Error (it's single-turn)
```

## Recommendation

**Solution 5 (Realistic Tally Types)** is recommended for implementation because:

1. **Full alignment** with existing Tally type hierarchy
2. **No `as const`** required at call site (uses `const` type parameter)
3. **Separates concerns** - `singleTurn`, `multiTurn`, `scorers` are distinct
4. **Preserves value types** through to measurements
5. **Works with existing serialization** - artifacts remain string-keyed JSON

## Implementation Plan

See [`docs/TYPE_SAFE_REPORTS_PLAN.md`](./docs/TYPE_SAFE_REPORTS_PLAN.md) for detailed implementation plan including:
- Analysis of type erasure points in current codebase
- File-by-file change summary with line numbers
- Phased implementation approach
- Breaking changes assessment
- Migration strategy

## Running Type Checks

```bash
bun tsc --noEmit
# or from monorepo root:
pnpm --filter @tally/types-lab typecheck
```

## Key TypeScript Patterns Used

1. **Branded types**: `Score = number & { readonly __brand: 'Score' }`
2. **Conditional types**: `TValue extends number ? 'number' : ...`
3. **Mapped types**: `{ [K in keyof T]: ... }`
4. **`const` type parameters**: `function fn<const T>()` for literal inference (TS 5.0+)
5. **Tuple inference**: `readonly Eval[]` preserves array element types
6. **Discriminated unions**: `kind: 'singleTurn' | 'multiTurn' | 'scorer'`
7. **Filtered mapped types**: `FilterByKind<T, 'singleTurn'>` extracts subset of union

## File Structure

```
src/
├── 01-problem.ts              # Demonstrates the current type-safety problem
├── 02-solution-mapped-types.ts # Registry pattern with mapped types
├── 03-solution-builder.ts      # Builder pattern with type accumulation
├── 04-solution-infer-from-array.ts # Array with as const
├── 05-solution-auto-registry.ts    # Auto registry from eval names
├── 06-realistic-tally-types.ts     # ⭐ Full Tally alignment (recommended)
└── index.ts                    # Re-exports all solutions

docs/
└── TYPE_SAFE_REPORTS_PLAN.md   # Detailed implementation plan
```
