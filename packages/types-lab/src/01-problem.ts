/**
 * 01-problem.ts
 *
 * This file demonstrates the current type-safety problem in Tally reports.
 * The problem: Type information is lost when accessing report results.
 */

// =============================================================================
// Simplified Core Types (mirrors the real Tally types)
// =============================================================================

/** Metric value types */
type MetricScalar = number | boolean | string;

/** Score is always a normalized number [0, 1] */
type Score = number & { readonly __brand: "Score" };

/** Metric definition - strongly typed at definition time */
interface MetricDef<TValue extends MetricScalar = MetricScalar> {
  name: string;
  valueType: TValue extends number
    ? "number"
    : TValue extends boolean
      ? "boolean"
      : "string";
  description?: string;
}

/** Eval wraps a metric with verdict policy */
interface Eval<TValue extends MetricScalar = MetricScalar> {
  name: string;
  kind: "singleTurn" | "multiTurn";
  metric: MetricDef<TValue>;
  // Verdict policy is type-safe at definition time
  verdict?: TValue extends number
    ? { kind: "number"; passAt: number }
    : TValue extends boolean
      ? { kind: "boolean"; passWhen: boolean }
      : { kind: "ordinal"; passWhenIn: string[] };
}

// =============================================================================
// The Problem: Report Types (current implementation)
// =============================================================================

/** Current report structure - all string-keyed */
interface CurrentReport {
  defs: {
    evals: Record<string, { name: string; metric: string }>;
  };
  results: {
    // String keys - no type safety!
    byEval: Record<
      string,
      {
        score: Score;
        rawValue: MetricScalar; // Lost: we don't know the actual type
        verdict: "pass" | "fail" | "unknown";
      }
    >;
  };
}

/** Current Tally - returns untyped report */
interface CurrentTally {
  evals: readonly Eval[];
  run(): Promise<CurrentReport>;
}

// =============================================================================
// Demonstration of the Problem
// =============================================================================

// Define strongly-typed metrics
const relevanceMetric: MetricDef<number> = {
  name: "relevance",
  valueType: "number",
};

const toxicityMetric: MetricDef<boolean> = {
  name: "toxicity",
  valueType: "boolean",
};

// Define strongly-typed evals - TypeScript enforces verdict types!
const relevanceEval: Eval<number> = {
  name: "relevance-eval",
  kind: "singleTurn",
  metric: relevanceMetric,
  verdict: { kind: "number", passAt: 0.7 }, // ✅ TS enforces number verdict
};

const toxicityEval: Eval<boolean> = {
  name: "toxicity-eval",
  kind: "singleTurn",
  metric: toxicityMetric,
  verdict: { kind: "boolean", passWhen: false }, // ✅ TS enforces boolean verdict
};

// But when we create Tally and get the report...
async function demonstrateProblem() {
  const tally: CurrentTally = {
    evals: [relevanceEval, toxicityEval],
    run: async () => ({
      defs: {
        evals: {
          "relevance-eval": { name: "relevance-eval", metric: "relevance" },
          "toxicity-eval": { name: "toxicity-eval", metric: "toxicity" },
        },
      },
      results: {
        byEval: {
          "relevance-eval": {
            score: 0.85 as Score,
            rawValue: 0.85,
            verdict: "pass",
          },
          "toxicity-eval": {
            score: 1.0 as Score,
            rawValue: false,
            verdict: "pass",
          },
        },
      },
    }),
  };

  const report = await tally.run();

  // ❌ PROBLEM 1: No autocomplete for eval names
  const relevance = report.results.byEval["relevance-eval"];
  const typo = report.results.byEval["typooo"]; // No error! Compiles fine.

  // ❌ PROBLEM 2: rawValue is MetricScalar, not the actual type
  if (relevance) {
    // TypeScript thinks this could be number | boolean | string
    const value: MetricScalar = relevance.rawValue;
    // We can't safely use it as a number without type guards
  }

  // ❌ PROBLEM 3: No way to know which evals exist at compile time
  const evalNames = Object.keys(report.defs.evals); // string[]

  console.log("Problem demonstrated:", { relevance, typo, evalNames });
}

// =============================================================================
// What We Want
// =============================================================================

/**
 * Ideally, we want:
 *
 * const report = await tally.run();
 *
 * report.results.byEval['relevance-eval']  // ✅ Autocomplete works
 * report.results.byEval['typo']            // ❌ Compile error
 * report.results.byEval['relevance-eval'].rawValue  // ✅ Known to be number
 * report.results.byEval['toxicity-eval'].rawValue   // ✅ Known to be boolean
 */

export {
  demonstrateProblem,
  relevanceEval,
  toxicityEval,
  type CurrentReport,
  type CurrentTally,
  type Eval,
  type MetricDef,
  type MetricScalar,
  type Score,
};
