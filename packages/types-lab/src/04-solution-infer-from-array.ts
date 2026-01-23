/**
 * 04-solution-infer-from-array.ts
 *
 * Solution: Infer types from a const array of evals.
 *
 * This is closest to the current Tally API where evals are passed as an array.
 * The key is using `as const` and a carefully typed factory function.
 */

// =============================================================================
// Core Types
// =============================================================================

type MetricScalar = number | boolean | string;
type Score = number & { readonly __brand: "Score" };

interface MetricDef<TValue extends MetricScalar = MetricScalar> {
  readonly name: string;
  readonly valueType: TValue extends number
    ? "number"
    : TValue extends boolean
      ? "boolean"
      : "string";
}

interface EvalDef<
  TName extends string = string,
  TValue extends MetricScalar = MetricScalar,
> {
  readonly name: TName;
  readonly kind: "singleTurn" | "multiTurn";
  readonly metric: MetricDef<TValue>;
}

// =============================================================================
// Type Utilities for Array Inference
// =============================================================================

/**
 * Extract eval name from an EvalDef
 */
type EvalName<E> = E extends EvalDef<infer N, MetricScalar> ? N : never;

/**
 * Extract value type from an EvalDef
 */
type EvalValue<E> = E extends EvalDef<string, infer V> ? V : never;

/**
 * Convert an array of EvalDefs to a type-level map
 *
 * Example:
 * [EvalDef<"a", number>, EvalDef<"b", boolean>]
 * => { a: number; b: boolean }
 */
type EvalsToMap<T extends readonly EvalDef<string, MetricScalar>[]> = {
  [E in T[number] as EvalName<E>]: EvalValue<E>;
};

/**
 * Result for a single eval
 */
interface EvalResult<TValue extends MetricScalar> {
  score: Score;
  rawValue: TValue;
  verdict: "pass" | "fail" | "unknown";
}

/**
 * Typed report from eval map
 */
type TypedReport<TMap extends Record<string, MetricScalar>> = {
  results: {
    [K in keyof TMap]: EvalResult<TMap[K]>;
  };
};

// =============================================================================
// Typed Tally
// =============================================================================

interface TypedTally<TMap extends Record<string, MetricScalar>> {
  run(): Promise<TypedReport<TMap>>;
}

/**
 * Create a typed tally from an array of evals
 *
 * The magic is in the generic constraint:
 * - TEvals extends readonly EvalDef<string, MetricScalar>[]
 * - We infer the exact tuple type when `as const` is used
 * - Then EvalsToMap extracts the name->value mapping
 */
function createTally<
  const TEvals extends readonly EvalDef<string, MetricScalar>[],
>(evals: TEvals): TypedTally<EvalsToMap<TEvals>> {
  return {
    async run(): Promise<TypedReport<EvalsToMap<TEvals>>> {
      // Mock implementation
      const results = {} as TypedReport<EvalsToMap<TEvals>>["results"];

      for (const evalDef of evals) {
        // @ts-expect-error - mock implementation
        results[evalDef.name] = {
          score: 0.85 as Score,
          rawValue: evalDef.metric.valueType === "boolean" ? true : 0.85,
          verdict: "pass",
        };
      }

      return { results };
    },
  };
}

// =============================================================================
// Helper: Define functions for better inference
// =============================================================================

/**
 * Define a number-valued eval
 */
function defineNumberEval<TName extends string>(args: {
  name: TName;
  kind: "singleTurn" | "multiTurn";
  metricName: string;
}): EvalDef<TName, number> {
  return {
    name: args.name,
    kind: args.kind,
    metric: { name: args.metricName, valueType: "number" },
  };
}

/**
 * Define a boolean-valued eval
 */
function defineBooleanEval<TName extends string>(args: {
  name: TName;
  kind: "singleTurn" | "multiTurn";
  metricName: string;
}): EvalDef<TName, boolean> {
  return {
    name: args.name,
    kind: args.kind,
    metric: { name: args.metricName, valueType: "boolean" },
  };
}

/**
 * Define a string-valued eval
 */
function defineStringEval<TName extends string>(args: {
  name: TName;
  kind: "singleTurn" | "multiTurn";
  metricName: string;
}): EvalDef<TName, string> {
  return {
    name: args.name,
    kind: args.kind,
    metric: { name: args.metricName, valueType: "string" },
  };
}

// =============================================================================
// Usage Demonstration
// =============================================================================

// Define evals using helper functions
const relevanceEval = defineNumberEval({
  name: "relevance",
  kind: "singleTurn",
  metricName: "relevance-metric",
});

const toxicityEval = defineBooleanEval({
  name: "toxicity",
  kind: "singleTurn",
  metricName: "toxicity-metric",
});

const clarityEval = defineNumberEval({
  name: "clarity",
  kind: "singleTurn",
  metricName: "clarity-metric",
});

const sentimentEval = defineStringEval({
  name: "sentiment",
  kind: "singleTurn",
  metricName: "sentiment-metric",
});

// Create tally with array - use `as const` for tuple type inference
const tally = createTally([
  relevanceEval,
  toxicityEval,
  clarityEval,
  sentimentEval,
] as const);

async function demonstrateArraySolution() {
  const report = await tally.run();

  // ✅ Autocomplete works for all eval names!
  const relevance = report.results.relevance;
  const toxicity = report.results.toxicity;
  const clarity = report.results.clarity;
  const sentiment = report.results.sentiment;

  // ✅ Types are correctly inferred!
  const relevanceValue: number = relevance.rawValue;
  const toxicityValue: boolean = toxicity.rawValue;
  const clarityValue: number = clarity.rawValue;
  const sentimentValue: string = sentiment.rawValue;

  // ❌ Compile error - 'typo' doesn't exist
  // @ts-expect-error
  const typo = report.results.typo;

  // ❌ Compile error - wrong type
  // @ts-expect-error
  const wrongType: string = relevance.rawValue;

  console.log("Array solution demonstrated:", {
    relevanceValue,
    toxicityValue,
    clarityValue,
    sentimentValue,
  });
}

export {
  createTally,
  defineBooleanEval,
  defineNumberEval,
  defineStringEval,
  demonstrateArraySolution,
  type EvalDef,
  type EvalResult,
  type EvalsToMap,
  type TypedReport,
  type TypedTally,
};
