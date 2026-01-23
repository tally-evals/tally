/**
 * 02-solution-mapped-types.ts
 *
 * Solution: Use mapped types to preserve eval definitions through to the report.
 *
 * Key insight: Instead of collecting evals into an array (which erases types),
 * we define evals as a const object literal, then use mapped types to derive
 * the report shape.
 */

// =============================================================================
// Core Types (same as before)
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
  verdict?: TValue extends number
    ? { kind: "number"; passAt: number }
    : TValue extends boolean
      ? { kind: "boolean"; passWhen: boolean }
      : { kind: "ordinal"; passWhenIn: string[] };
}

// =============================================================================
// Solution: Eval Registry Pattern
// =============================================================================

/**
 * EvalRegistry: A const object where keys are eval names and values are EvalDefs
 *
 * Example:
 * const registry = {
 *   relevance: { name: 'relevance', ... } as const,
 *   toxicity: { name: 'toxicity', ... } as const,
 * } satisfies EvalRegistry;
 */
type EvalRegistry = Record<string, EvalDef<string, MetricScalar>>;

/**
 * Extract the value type from an EvalDef
 */
type ExtractValueType<E> = E extends EvalDef<string, infer V> ? V : never;

/**
 * Single eval result - parameterized by value type
 */
interface EvalResult<TValue extends MetricScalar> {
  score: Score;
  rawValue: TValue;
  verdict: "pass" | "fail" | "unknown";
}

/**
 * TypedReport: Report type derived from EvalRegistry
 *
 * Each key in the registry becomes a key in the results,
 * with the correct value type preserved.
 */
type TypedReport<TRegistry extends EvalRegistry> = {
  defs: {
    evals: {
      [K in keyof TRegistry]: {
        name: TRegistry[K]["name"];
        valueType: TRegistry[K]["metric"]["valueType"];
      };
    };
  };
  results: {
    byEval: {
      [K in keyof TRegistry]: EvalResult<ExtractValueType<TRegistry[K]>>;
    };
  };
};

/**
 * TypedTally: Tally parameterized by eval registry
 */
interface TypedTally<TRegistry extends EvalRegistry> {
  registry: TRegistry;
  run(): Promise<TypedReport<TRegistry>>;
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Define an eval with full type inference
 */
function defineEval<TName extends string, TValue extends MetricScalar>(
  def: EvalDef<TName, TValue>
): EvalDef<TName, TValue> {
  return def;
}

/**
 * Create a typed tally from an eval registry
 */
function createTypedTally<const TRegistry extends EvalRegistry>(
  registry: TRegistry
): TypedTally<TRegistry> {
  return {
    registry,
    run: async () => {
      // In real implementation, this would execute the pipeline
      // For now, return a mock result
      const results = {} as TypedReport<TRegistry>["results"]["byEval"];
      const defs = {} as TypedReport<TRegistry>["defs"]["evals"];

      for (const key of Object.keys(registry) as (keyof TRegistry)[]) {
        const evalDef = registry[key];
        // Cast needed for mock - real impl would construct properly
        (defs as Record<string, unknown>)[key as string] = {
          name: evalDef.name,
          valueType: evalDef.metric.valueType,
        };
        (results as Record<string, unknown>)[key as string] = {
          score: 0.85 as Score,
          rawValue: evalDef.metric.valueType === "boolean" ? true : 0.85,
          verdict: "pass",
        };
      }

      return { defs: { evals: defs }, results: { byEval: results } };
    },
  };
}

// =============================================================================
// Usage Demonstration
// =============================================================================

// Define evals with full type inference
const relevanceEval = defineEval({
  name: "relevance",
  kind: "singleTurn",
  metric: { name: "relevance-metric", valueType: "number" },
  verdict: { kind: "number", passAt: 0.7 },
});

const toxicityEval = defineEval({
  name: "toxicity",
  kind: "singleTurn",
  metric: { name: "toxicity-metric", valueType: "boolean" },
  verdict: { kind: "boolean", passWhen: false },
});

// Create registry as const object
const evalRegistry = {
  relevance: relevanceEval,
  toxicity: toxicityEval,
} as const;

// Create typed tally
const tally = createTypedTally(evalRegistry);

// Now the report is fully typed!
async function demonstrateSolution() {
  const report = await tally.run();

  // ✅ SOLUTION 1: Autocomplete works for eval names
  const relevance = report.results.byEval.relevance;
  // @ts-expect-error - 'typo' doesn't exist on the registry
  const _typo = report.results.byEval.typo;

  // ✅ SOLUTION 2: rawValue has the correct type
  // Note: In the mock we return MetricScalar, but in real impl these would be properly typed
  const relevanceValue = relevance.rawValue;
  const toxicityValue = report.results.byEval.toxicity.rawValue;

  // ✅ SOLUTION 3: Keys are known at compile time
  type EvalNames = keyof typeof evalRegistry; // "relevance" | "toxicity"
  const _evalNames: EvalNames = "relevance"; // Type-safe

  console.log("Solution demonstrated:", {
    relevanceValue,
    toxicityValue,
  });
}

export {
  createTypedTally,
  defineEval,
  demonstrateSolution,
  evalRegistry,
  tally,
  type EvalDef,
  type EvalRegistry,
  type EvalResult,
  type TypedReport,
  type TypedTally,
};
