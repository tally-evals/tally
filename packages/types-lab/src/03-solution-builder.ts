/**
 * 03-solution-builder.ts
 *
 * Alternative solution: Builder pattern with type accumulation.
 *
 * This approach is more ergonomic when evals are added dynamically,
 * as each .addEval() call returns a new builder with accumulated types.
 */

// =============================================================================
// Core Types
// =============================================================================

type MetricScalar = number | boolean | string;
type Score = number & { readonly __brand: "Score" };

interface MetricDef<TValue extends MetricScalar = MetricScalar> {
  name: string;
  valueType: TValue extends number
    ? "number"
    : TValue extends boolean
      ? "boolean"
      : "string";
}

interface EvalDef<
  TName extends string = string,
  TValue extends MetricScalar = MetricScalar,
> {
  name: TName;
  kind: "singleTurn" | "multiTurn";
  metric: MetricDef<TValue>;
}

// =============================================================================
// Type Accumulation Utilities
// =============================================================================

/**
 * Accumulated eval definitions as a type-level map
 * Key = eval name, Value = value type
 */
type EvalMap = Record<string, MetricScalar>;

/**
 * Add an eval to the map at type level
 */
type AddEval<
  TMap extends EvalMap,
  TName extends string,
  TValue extends MetricScalar,
> = TMap & Record<TName, TValue>;

/**
 * Result type for a single eval
 */
interface EvalResult<TValue extends MetricScalar> {
  score: Score;
  rawValue: TValue;
  verdict: "pass" | "fail" | "unknown";
}

/**
 * Typed report derived from accumulated eval map
 */
type TypedReport<TMap extends EvalMap> = {
  results: {
    [K in keyof TMap]: EvalResult<TMap[K]>;
  };
};

// =============================================================================
// Builder Pattern
// =============================================================================

/**
 * TallyBuilder: Accumulates eval types through method chaining
 */
class TallyBuilder<TMap extends EvalMap = Record<string, never>> {
  private evals: EvalDef<string, MetricScalar>[] = [];

  /**
   * Add an eval - returns new builder with accumulated type
   */
  addEval<TName extends string, TValue extends MetricScalar>(
    evalDef: EvalDef<TName, TValue>
  ): TallyBuilder<AddEval<TMap, TName, TValue>> {
    // Create new builder with accumulated evals
    const newBuilder = new TallyBuilder<AddEval<TMap, TName, TValue>>();
    // Access private field via cast for builder pattern
    (
      newBuilder as unknown as { evals: EvalDef<string, MetricScalar>[] }
    ).evals = [...this.evals, evalDef];
    return newBuilder;
  }

  /**
   * Build the tally - ready for .run()
   */
  build(): TypedTally<TMap> {
    return new TypedTally<TMap>(this.evals);
  }
}

/**
 * TypedTally with run() that returns typed report
 */
class TypedTally<TMap extends EvalMap> {
  constructor(private evals: EvalDef<string, MetricScalar>[]) {}

  async run(): Promise<TypedReport<TMap>> {
    // Mock implementation - in reality this would execute the pipeline
    const results = {} as TypedReport<TMap>["results"];

    for (const evalDef of this.evals) {
      // Cast for mock - real impl would construct properly
      (results as Record<string, unknown>)[evalDef.name] = {
        score: 0.85 as Score,
        rawValue: evalDef.metric.valueType === "boolean" ? true : 0.85,
        verdict: "pass",
      };
    }

    return { results };
  }
}

/**
 * Factory function to start building
 */
function createTallyBuilder(): TallyBuilder<Record<string, never>> {
  return new TallyBuilder();
}

// =============================================================================
// Convenience: Define functions
// =============================================================================

function defineEval<TName extends string, TValue extends MetricScalar>(
  def: EvalDef<TName, TValue>
): EvalDef<TName, TValue> {
  return def;
}

// =============================================================================
// Usage Demonstration
// =============================================================================

// Define evals
const relevanceEval = defineEval({
  name: "relevance" as const, // 'as const' is important for literal type
  kind: "singleTurn",
  metric: { name: "relevance-metric", valueType: "number" as const },
});

const toxicityEval = defineEval({
  name: "toxicity" as const,
  kind: "singleTurn",
  metric: { name: "toxicity-metric", valueType: "boolean" as const },
});

const clarityEval = defineEval({
  name: "clarity" as const,
  kind: "singleTurn",
  metric: { name: "clarity-metric", valueType: "number" as const },
});

// Build tally with type accumulation
const tally = createTallyBuilder()
  .addEval(relevanceEval)
  .addEval(toxicityEval)
  .addEval(clarityEval)
  .build();

async function demonstrateBuilderSolution() {
  const report = await tally.run();

  // ✅ Autocomplete works!
  const relevance = report.results.relevance;
  const toxicity = report.results.toxicity;
  const clarity = report.results.clarity;

  // ✅ Types are correct! (In real impl these would be properly typed)
  const relevanceValue = relevance.rawValue;
  const toxicityValue = toxicity.rawValue;
  const clarityValue = clarity.rawValue;

  // Note: In this simplified demo, the intersection type approach
  // doesn't fully restrict unknown keys. The array-based solution (04)
  // handles this better with mapped tuple types.
  const _typo = report.results.typo; // Would error with proper implementation

  console.log("Builder solution demonstrated:", {
    relevanceValue,
    toxicityValue,
    clarityValue,
  });
}

export {
  createTallyBuilder,
  defineEval,
  demonstrateBuilderSolution,
  TallyBuilder,
  TypedTally,
  type EvalDef,
  type EvalMap,
  type EvalResult,
  type TypedReport,
};
