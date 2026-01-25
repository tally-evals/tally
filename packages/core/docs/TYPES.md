# Types and Type Safety

Tally provides a sophisticated type system that enables compile-time safety, IDE autocomplete, and runtime validation. The type system is designed around three key principles:

1. **Single Source of Truth** — All result types defined with type parameters
2. **Defaults for Flexibility** — Type params default to base types for untyped usage
3. **Literal Type Preservation** — Eval names preserved as literal types via `as const`

---

## Primitive Types

```typescript
// Value types that metrics can produce
type MetricScalar = number | boolean | string;

// Normalized score (always 0..1)
type Score = number;

// Verdict result from policy evaluation
type Verdict = 'pass' | 'fail' | 'unknown';

// Value type discriminator for metrics
type ValueTypeFor<T> = T extends number ? 'number' | 'ordinal'
                     : T extends boolean ? 'boolean'
                     : 'string';
```

---

## Type-Safe Results

All result types are parameterized by the metric value type, enabling type-safe access to `rawValue`, verdict policies, and normalization contexts:

```typescript
// Measurement with typed rawValue
interface Measurement<TValue extends MetricScalar = MetricScalar> {
  metricRef: MetricName;
  score?: Score;
  rawValue?: TValue | null;  // ← Typed to number/boolean/string
  confidence?: number;
  reasoning?: string;
  normalization?: NormalizationInfo<TValue>;
}

// Eval outcome with typed policy
interface EvalOutcome<TValue extends MetricScalar = MetricScalar> {
  verdict: Verdict;
  policy: VerdictPolicyFor<TValue>;  // ← Policy kind matches value type
  observed?: { rawValue?: TValue | null; score?: Score };
}
```

---

## Type Extraction Utilities

The framework provides utility types to extract information from eval definitions:

```typescript
// Extract eval name as literal type
type ExtractEvalName<TEval> = TEval extends { readonly name: infer N extends string } ? N : never;

// Extract metric value type from eval
type ExtractValueType<TEval> = TEval extends { metric: { valueType: infer VT } }
  ? VT extends 'number' | 'ordinal' ? number
  : VT extends 'boolean' ? boolean
  : string
  : MetricScalar;

// Filter evals by kind
type FilterByKind<TEvals extends readonly Eval[], TKind> = Extract<TEvals[number], { kind: TKind }>;

// Get eval names of a specific kind
type EvalNamesOfKind<TEvals extends readonly Eval[], TKind> = ExtractEvalName<FilterByKind<TEvals, TKind>>;
```

---

## Mapped Result Types

Results are mapped from the evals tuple, providing type-safe keys with autocomplete:

```typescript
// Single-turn results keyed by eval name
type SingleTurnResults<TEvals extends readonly Eval[]> = {
  readonly [K in EvalNamesOfKind<TEvals, 'singleTurn'>]: SingleTurnEvalSeries<
    ExtractValueType<Extract<FilterByKind<TEvals, 'singleTurn'>, { name: K }>>
  >;
};

// Multi-turn results keyed by eval name
type MultiTurnResults<TEvals extends readonly Eval[]> = {
  readonly [K in EvalNamesOfKind<TEvals, 'multiTurn'>]: ConversationEvalResult<
    ExtractValueType<Extract<FilterByKind<TEvals, 'multiTurn'>, { name: K }>>
  >;
};
```

---

## Using Type-Safe Reports

When using `createTally` with `as const` evals, the report provides full type safety:

```typescript
const evals = [
  defineSingleTurnEval({ name: 'Answer Relevance', metric: relevanceMetric }),
  defineMultiTurnEval({ name: 'Goal Completion', metric: goalMetric }),
] as const;

const tally = createTally({ data: [conversation], evals });
const report = await tally.run();

// ✅ Autocomplete works — only valid eval names accepted
report.result.singleTurn['Answer Relevance'];
report.result.multiTurn['Goal Completion'];

// ❌ Compile error — typo caught at build time
report.result.singleTurn['Anser Relevance'];
```

---

## View API Type Safety

The `TargetRunView` provides type-safe accessors for step and conversation results:

```typescript
// Type-safe step results
type StepResults<TEvals extends readonly Eval[]> = {
  readonly [K in EvalNamesOfKind<TEvals, 'singleTurn'>]: StepEvalResult<
    ExtractValueType<Extract<FilterByKind<TEvals, 'singleTurn'>, { name: K }>>
  >;
} & {
  readonly [K in EvalNamesOfKind<TEvals, 'scorer'>]?: StepEvalResult<number>;
};

// Type-safe conversation results
type ConversationResults<TEvals extends readonly Eval[]> = {
  readonly [K in EvalNamesOfKind<TEvals, 'multiTurn'>]: ConversationEvalResult<
    ExtractValueType<Extract<FilterByKind<TEvals, 'multiTurn'>, { name: K }>>
  >;
} & {
  readonly [K in EvalNamesOfKind<TEvals, 'scorer'>]?: ConversationEvalResult<number>;
};
```

---

## Verdict Policy Type Safety

Verdict policies are typed to match the metric value type:

```typescript
// Policy kind is constrained by value type
type VerdictPolicyFor<TValue extends MetricScalar> =
  TValue extends number
    ? { kind: 'number'; type: 'threshold'; passAt: number }
    | { kind: 'number'; type: 'range'; min?: number; max?: number }
  : TValue extends boolean
    ? { kind: 'boolean'; passWhen: boolean }
  : { kind: 'ordinal'; passWhenIn: readonly string[] };
```

---

## Serializable Snapshots

For persistence, types have serializable "snapshot" variants that handle non-serializable values:

```typescript
// Custom normalizers become placeholders
type NormalizerSpecSnap =
  | Exclude<NormalizerSpec, { type: 'custom' }>
  | { type: 'custom'; note: 'not-serializable' };

// Custom verdict functions become placeholders
type VerdictPolicyInfo =
  | { kind: 'none' }
  | { kind: 'boolean'; passWhen: boolean }
  | { kind: 'number'; type: 'threshold'; passAt: number }
  | { kind: 'number'; type: 'range'; min?: number; max?: number }
  | { kind: 'ordinal'; passWhenIn: readonly string[] }
  | { kind: 'custom'; note: 'not-serializable' };
```

---

## Run Artifacts vs Reports

- **`TallyRunArtifact`**: Persisted format for tooling (CLI, Viewer) — uses snapshot types
- **`TallyRunReport`**: SDK return type with helper methods — preserves full types

```typescript
interface TallyRunReport<TEvals extends readonly Eval[]> {
  runId: RunId;
  result: ConversationResult<TEvals>;
  
  // Helper methods
  toArtifact(): TallyRunArtifact;
  view(): TargetRunView<TEvals>;
}
```
