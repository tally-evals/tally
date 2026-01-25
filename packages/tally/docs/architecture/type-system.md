# Type System

This document describes the TypeScript patterns and design decisions in Tally.

## Design Goals

1. **Type-safe eval names:** Report access uses literal types for autocomplete
2. **Compile-time validation:** Invalid eval references caught at compile time
3. **Generic propagation:** Types flow from definition to result
4. **Discriminated unions:** Runtime type narrowing via `kind` discriminators

## Core Patterns

### 1. Const Type Parameters

Tally uses `const` type parameters to preserve literal types:

```typescript
// Without const: name becomes 'string'
function defineEval<TName extends string>(name: TName) { ... }
defineEval('relevance'); // TName = string ❌

// With const: name preserves literal
function defineEval<const TName extends string>(name: TName) { ... }
defineEval('relevance'); // TName = 'relevance' ✅
```

This pattern is used in:
- `createTally<const TEvals>()` - Preserves eval tuple types
- `defineSingleTurnEval<const TName>()` - Preserves eval name literals

### 2. Generic Propagation

Types flow through the system:

```typescript
// 1. Define eval with literal name
const relevanceEval = defineSingleTurnEval({
  name: 'relevance', // TName = 'relevance'
  metric: answerRelevanceMetric,
});

// 2. Create tally with tuple
const tally = createTally({
  data: [conversation],
  evals: [relevanceEval], // TEvals = readonly [typeof relevanceEval]
});

// 3. Run produces typed report
const report = await tally.run();
// TallyRunReport<readonly [typeof relevanceEval]>

// 4. Access with autocomplete
report.result.singleTurn.relevance; // ✅ Known key
report.result.singleTurn.typo;      // ❌ Compile error
```

### 3. Discriminated Unions

Many types use `kind` or `type` discriminators for narrowing:

```typescript
// VerdictPolicy
type VerdictPolicy =
  | { kind: 'none' }
  | { kind: 'boolean'; passWhen: boolean }
  | { kind: 'number'; type: 'threshold'; passAt: number }
  | { kind: 'number'; type: 'range'; min?: number; max?: number }
  | { kind: 'ordinal'; passWhenIn: string[] }
  | { kind: 'custom'; evaluate: VerdictFn };

// Usage with narrowing
function describe(policy: VerdictPolicy) {
  switch (policy.kind) {
    case 'none':
      return 'No verdict';
    case 'boolean':
      return `Pass when ${policy.passWhen}`; // passWhen available ✅
    case 'number':
      if (policy.type === 'threshold') {
        return `Pass at ${policy.passAt}`; // passAt available ✅
      }
      // ...
  }
}
```

Other discriminated unions:
- `Eval` (kind: 'singleTurn' | 'multiTurn' | 'scorer')
- `NormalizerSpec` (type: 'identity' | 'min-max' | ...)
- `AggregatorDef` (kind: 'numeric' | 'boolean' | 'categorical')

### 4. Mapped Types for Results

Result types are mapped from eval definitions:

```typescript
// Extract eval names by kind
type EvalNamesOfKind<TEvals, K> = {
  [I in keyof TEvals]: TEvals[I] extends { kind: K; name: infer N } ? N : never;
}[number];

// Example
type Evals = [
  { kind: 'singleTurn'; name: 'relevance' },
  { kind: 'multiTurn'; name: 'goal' },
];
type SingleTurnNames = EvalNamesOfKind<Evals, 'singleTurn'>; // 'relevance'

// Result type uses mapped names
interface ConversationResult<TEvals> {
  singleTurn: {
    [K in EvalNamesOfKind<TEvals, 'singleTurn'>]: SingleTurnEvalSeries;
  };
  multiTurn: {
    [K in EvalNamesOfKind<TEvals, 'multiTurn'>]: ConversationEvalResult;
  };
}
```

### 5. Conditional Types for Compatibility

Type-level logic ensures compatibility:

```typescript
// Aggregator compatibility with metric value type
type CompatibleAggregator<T extends MetricScalar> =
  T extends number ? NumericAggregatorDef :
  T extends boolean ? NumericAggregatorDef | BooleanAggregatorDef :
  T extends string ? NumericAggregatorDef | CategoricalAggregatorDef :
  never;

// Normalization context by value type
type NormalizationContextFor<T> =
  T extends number ? NumericNormalizationContext :
  T extends boolean ? BooleanNormalizationContext :
  T extends string ? OrdinalNormalizationContext :
  never;
```

### 6. Branded Types

Some types use branding for semantic meaning:

```typescript
// Score is a branded number (0-1 range)
type Score = number & { readonly __brand: 'Score' };

// Factory function validates range
function toScore(value: number): Score {
  if (value < 0 || value > 1) {
    throw new Error(`Score must be 0-1, got ${value}`);
  }
  return value as Score;
}
```

## Type Extraction Utilities

```typescript
// Extract eval name from eval definition
type ExtractEvalName<T> = T extends { name: infer N } ? N : never;

// Extract value type from metric
type ExtractValueType<T> = T extends { valueType: infer V } ? V : never;

// Extract eval kind
type ExtractEvalKind<T> = T extends { kind: infer K } ? K : never;

// Filter evals by kind
type FilterByKind<TEvals, K> = TEvals extends readonly (infer E)[]
  ? E extends { kind: K } ? E : never
  : never;

// Check if evals contain a specific kind
type HasEvalsOfKind<TEvals, K> = FilterByKind<TEvals, K> extends never ? false : true;
```

## exactOptionalPropertyTypes

Tally uses `exactOptionalPropertyTypes: true` for stricter optional handling:

```typescript
// With exactOptionalPropertyTypes
interface Foo {
  bar?: string;
}

const foo: Foo = { bar: undefined }; // ❌ Error!
const foo: Foo = {};                 // ✅ OK
```

This requires explicit `| undefined` for properties that can be `undefined`:

```typescript
interface InternalEvaluator {
  description: string | undefined; // Explicitly allows undefined
  context: EvaluationContext | undefined;
}
```

## Pattern: Factory Functions

All public types use factory functions instead of class constructors:

```typescript
// ❌ Avoid: class with complex generics
class Tally<TContainer, TEvals> { ... }

// ✅ Prefer: factory function with inference
function createTally<TContainer, const TEvals>(args: {
  data: readonly TContainer[];
  evals: TEvals;
}): Tally<TContainer, TEvals> {
  return new TallyContainer(args.data, args.evals);
}
```

Benefits:
- Better type inference (no explicit type parameters needed)
- `const` type parameter support
- Simpler call sites

## Pattern: Builder Composition

Metrics use composition via builder functions:

```typescript
// Base metric
const base = defineBaseMetric({
  name: 'relevance',
  valueType: 'number',
});

// Add normalization
const withNorm = withNormalization(base, {
  normalizer: { type: 'min-max' },
});

// Complete metric
const metric = defineSingleTurnLLM({
  base: withNorm,
  promptTemplate: (input, output) => `...`,
  model: openai('gpt-4'),
});
```

## Runtime Type Guards

For runtime type checking, use discriminated unions with guards:

```typescript
// Type guard using discriminator
function isConversation(c: DatasetItem | Conversation): c is Conversation {
  return 'steps' in c && Array.isArray(c.steps);
}

function isDatasetItem(c: DatasetItem | Conversation): c is DatasetItem {
  return !('steps' in c);
}

// ts-pattern for exhaustive matching
import { match, P } from 'ts-pattern';

const result = match(eval)
  .with({ kind: 'singleTurn' }, (e) => handleSingleTurn(e))
  .with({ kind: 'multiTurn' }, (e) => handleMultiTurn(e))
  .with({ kind: 'scorer' }, (e) => handleScorer(e))
  .exhaustive();
```

## Common Pitfalls

### 1. Losing Literal Types

```typescript
// ❌ Loses literal type
const evalNames = ['relevance', 'toxicity']; // string[]

// ✅ Preserves literals
const evalNames = ['relevance', 'toxicity'] as const; // readonly ['relevance', 'toxicity']
```

### 2. Generic Constraints

```typescript
// ❌ Too loose - allows any object
function process<T extends object>(val: T) { ... }

// ✅ Constrained to expected shape
function process<T extends Eval>(val: T) { ... }
```

### 3. Optional vs Undefined

```typescript
// With exactOptionalPropertyTypes
interface Config {
  cache?: MemoryCache; // Can omit, cannot be undefined
}

// If undefined is valid:
interface Config {
  cache: MemoryCache | undefined; // Required, can be undefined
}
```

## Source Files

- `@tally-evals/core` - Core type definitions
- `src/core/types.ts` - Re-exports from core
- `src/evals/index.ts` - Eval type definitions
- `src/core/primitives/` - Primitive type factories
