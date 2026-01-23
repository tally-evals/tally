/**
 * 05-solution-auto-registry.ts
 *
 * Refined solution: Auto-build registry from eval names.
 *
 * Key improvements:
 * 1. No duplication - keys come from eval.name, not object keys
 * 2. No `as const` needed at call site - uses `const` type parameter
 * 3. Functional API - just pass evals to createTally()
 */

// =============================================================================
// Core Types
// =============================================================================

type MetricScalar = number | boolean | string;
type Score = number & { readonly __brand: "Score" };

interface MetricDef<
  TName extends string = string,
  TValue extends MetricScalar = MetricScalar,
> {
  readonly name: TName;
  readonly valueType: TValue extends number
    ? "number"
    : TValue extends boolean
      ? "boolean"
      : "string";
}

interface EvalDef<
  TName extends string = string,
  TMetricName extends string = string,
  TValue extends MetricScalar = MetricScalar,
> {
  readonly name: TName;
  readonly kind: "singleTurn" | "multiTurn";
  readonly metric: MetricDef<TMetricName, TValue>;
}

// =============================================================================
// Type Utilities
// =============================================================================

/**
 * Extract eval name from EvalDef
 */
type ExtractEvalName<E> = E extends EvalDef<infer N, string, MetricScalar>
  ? N
  : never;

/**
 * Extract metric name from EvalDef
 */
type ExtractMetricName<E> = E extends EvalDef<string, infer M, MetricScalar>
  ? M
  : never;

/**
 * Extract value type from EvalDef
 */
type ExtractValueType<E> = E extends EvalDef<string, string, infer V>
  ? V
  : never;

/**
 * Build eval registry type from array of evals
 * Keys are the eval names (from eval.name), values are the value types
 */
type EvalRegistryFromArray<T extends readonly EvalDef[]> = {
  [E in T[number] as ExtractEvalName<E>]: EvalResult<ExtractValueType<E>>;
};

/**
 * Build metric registry type from array of evals
 * Keys are the metric names (from eval.metric.name)
 */
type MetricRegistryFromArray<T extends readonly EvalDef[]> = {
  [E in T[number] as ExtractMetricName<E>]: {
    evalName: ExtractEvalName<E>;
    value: ExtractValueType<E>;
  };
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
 * Typed report with both eval-keyed and metric-keyed access
 */
interface TypedReport<T extends readonly EvalDef[]> {
  /** Access results by eval name */
  byEval: EvalRegistryFromArray<T>;
  /** Access results by metric name */
  byMetric: MetricRegistryFromArray<T>;
}

// =============================================================================
// Tally Factory
// =============================================================================

interface TypedTally<T extends readonly EvalDef[]> {
  readonly evals: T;
  run(): Promise<TypedReport<T>>;
}

/**
 * Create a typed tally from an array of evals.
 *
 * The `const` type parameter ensures literal types are preserved
 * WITHOUT requiring `as const` at the call site.
 */
function createTally<const T extends readonly EvalDef[]>(
  evals: T
): TypedTally<T> {
  return {
    evals,
    async run(): Promise<TypedReport<T>> {
      // Build results keyed by eval name
      const byEval = {} as EvalRegistryFromArray<T>;
      const byMetric = {} as MetricRegistryFromArray<T>;

      for (const evalDef of evals) {
        const result = {
          score: 0.85 as Score,
          rawValue: (
            evalDef.metric.valueType === "boolean" ? false : 0.85
          ) as ExtractValueType<(typeof evals)[number]>,
          verdict: "pass" as const,
        };

        // Key by eval name
        (byEval as Record<string, unknown>)[evalDef.name] = result;

        // Key by metric name
        (byMetric as Record<string, unknown>)[evalDef.metric.name] = {
          evalName: evalDef.name,
          value: result.rawValue,
        };
      }

      return { byEval, byMetric };
    },
  };
}

// =============================================================================
// Eval Definition Helpers
// =============================================================================

/**
 * Define an eval with inferred types.
 * No need for separate defineNumberEval, defineBooleanEval, etc.
 */
function defineEval<
  TName extends string,
  TMetricName extends string,
  TValue extends MetricScalar,
>(args: {
  name: TName;
  kind: "singleTurn" | "multiTurn";
  metric: {
    name: TMetricName;
    valueType: TValue extends number
      ? "number"
      : TValue extends boolean
        ? "boolean"
        : "string";
  };
}): EvalDef<TName, TMetricName, TValue> {
  return {
    name: args.name,
    kind: args.kind,
    metric: args.metric as MetricDef<TMetricName, TValue>,
  };
}

/**
 * Convenience: Define a number-valued eval
 */
function defineNumberEval<TName extends string, TMetricName extends string>(
  name: TName,
  metricName: TMetricName,
  kind: "singleTurn" | "multiTurn" = "singleTurn"
): EvalDef<TName, TMetricName, number> {
  return {
    name,
    kind,
    metric: { name: metricName, valueType: "number" },
  };
}

/**
 * Convenience: Define a boolean-valued eval
 */
function defineBooleanEval<TName extends string, TMetricName extends string>(
  name: TName,
  metricName: TMetricName,
  kind: "singleTurn" | "multiTurn" = "singleTurn"
): EvalDef<TName, TMetricName, boolean> {
  return {
    name,
    kind,
    metric: { name: metricName, valueType: "boolean" },
  };
}

/**
 * Convenience: Define a string-valued eval
 */
function defineStringEval<TName extends string, TMetricName extends string>(
  name: TName,
  metricName: TMetricName,
  kind: "singleTurn" | "multiTurn" = "singleTurn"
): EvalDef<TName, TMetricName, string> {
  return {
    name,
    kind,
    metric: { name: metricName, valueType: "string" },
  };
}

// =============================================================================
// Usage Demonstration
// =============================================================================

// Define evals - names are embedded in the definition
const relevanceEval = defineNumberEval("relevance", "relevance-metric");
const toxicityEval = defineBooleanEval("toxicity", "is-toxic");
const sentimentEval = defineStringEval("sentiment", "sentiment-label");

// Create tally - NO `as const` needed!
const tally = createTally([relevanceEval, toxicityEval, sentimentEval]);

async function demonstrateAutoRegistry() {
  const report = await tally.run();

  // ✅ Access by EVAL NAME - autocomplete works!
  const relevance = report.byEval.relevance;
  const toxicity = report.byEval.toxicity;
  const sentiment = report.byEval.sentiment;

  // ✅ Types are correct!
  const relevanceScore: number = relevance.rawValue;
  const isToxic: boolean = toxicity.rawValue;
  const sentimentLabel: string = sentiment.rawValue;

  // ✅ Access by METRIC NAME - also typed!
  const relevanceMetric = report.byMetric["relevance-metric"];
  const toxicMetric = report.byMetric["is-toxic"];

  // ❌ Compile errors for typos
  // @ts-expect-error - 'typo' doesn't exist in byEval
  const _typoEval = report.byEval.typo;

  // @ts-expect-error - 'typo' doesn't exist in byMetric
  const _typoMetric = report.byMetric["typo-metric"];

  // @ts-expect-error - wrong type assignment
  const _wrongType: string = relevance.rawValue;

  console.log("Auto-registry demonstrated:", {
    relevanceScore,
    isToxic,
    sentimentLabel,
    relevanceMetric,
    toxicMetric,
  });
}

// =============================================================================
// Exports
// =============================================================================

export {
  createTally,
  defineBooleanEval,
  defineEval,
  defineNumberEval,
  defineStringEval,
  demonstrateAutoRegistry,
  tally,
  type EvalDef,
  type EvalRegistryFromArray,
  type EvalResult,
  type MetricRegistryFromArray,
  type TypedReport,
  type TypedTally,
};
