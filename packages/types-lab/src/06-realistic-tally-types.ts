/**
 * 06-realistic-tally-types.ts
 *
 * Type-safe report solution aligned with real Tally architecture.
 * This file validates the approach proposed in TYPE_SAFE_REPORTS_PLAN.md
 *
 * ## Key Findings (validated by type tests below)
 *
 * 1. **`const` on factory functions is CRITICAL**
 *    Without `const TName extends string` on factory functions like
 *    `defineSingleTurnEval`, TypeScript widens the name to `string` when
 *    the factory is called inline inside an array expression.
 *
 * 2. **`const` on `createTally` preserves array structure**
 *    The `<const T extends readonly Eval[]>` parameter preserves the
 *    tuple structure of the evals array.
 *
 * 3. **Mapped types with `EvalNamesOfKind` work correctly**
 *    Once literal types are preserved, the mapped type utilities
 *    correctly build typed result accessors.
 *
 * 4. **Type-safe verdicts and normalization**
 *    The `VerdictPolicyFor<T>` conditional type enforces that verdict
 *    policies match the metric value type. `TypedEvalOutcome<T>` preserves
 *    this in the report, enabling type-safe access to verdict configuration.
 *
 * 5. **Normalization context is typed to metric value**
 *    `NormalizationContextFor<T>` maps number→NumericNormalizationContext,
 *    boolean→BooleanNormalizationContext, string→OrdinalNormalizationContext.
 *    This is preserved in `Measurement.normalization` for type-safe access.
 *
 * ## What Works
 * - Pre-defined evals with literal names
 * - Inline eval definitions (with `const` on factories)
 * - Spreading eval arrays (with `as const`)
 * - Mixed single/multi-turn eval separation
 * - Serialization roundtrip with type restoration
 * - Empty evals edge case
 * - Duplicate eval names (creates union type)
 * - **Type-safe verdict policies** (policy.kind matches metric value type)
 * - **Type-safe normalization** (calibration context typed to metric value)
 * - **Type-safe observed values** (outcome.observed.rawValue typed to metric)
 *
 * ## Key Pattern
 * ```typescript
 * function defineSingleTurnEval<const TName extends string>(...)
 * function createTally<const TEvals extends readonly Eval[]>(...)
 *
 * // Type-safe verdict access
 * if (outcome.policy.kind === 'number') {
 *   const threshold = outcome.policy.passAt; // ✅ typed
 * }
 *
 * // Type-safe normalization access
 * if (measurement.normalization?.calibration) {
 *   const range = calibration.range; // ✅ typed to NumericNormalizationContext
 * }
 * ```
 */

// =============================================================================
// Primitive Types (from @tally/core/types/primitives)
// =============================================================================

type MetricScalar = number | boolean | string;
type Score = number & { readonly __brand: "Score" };
type Verdict = "pass" | "fail" | "unknown";

type ValueTypeFor<T> = T extends number
  ? "number" | "ordinal"
  : T extends boolean
    ? "boolean"
    : "string";

// =============================================================================
// Container Types (from @tally/core/types/conversation)
// =============================================================================

interface DatasetItem {
  id: string;
  prompt: string;
  completion: string;
  metadata?: Record<string, unknown>;
}

interface ConversationStep {
  stepIndex: number;
  input: unknown;
  output: readonly unknown[];
}

interface Conversation {
  id: string;
  steps: readonly ConversationStep[];
  metadata?: Record<string, unknown>;
}

type SingleTurnContainer = ConversationStep | DatasetItem;
type MultiTurnContainer = Conversation;
type MetricContainer = SingleTurnContainer | MultiTurnContainer;

// =============================================================================
// Metric Definition (from @tally/core/types/metrics)
// =============================================================================

interface BaseMetricDef<
  TName extends string = string,
  TValue extends MetricScalar = MetricScalar,
> {
  readonly name: TName;
  readonly description?: string;
  readonly valueType: ValueTypeFor<TValue>;
  readonly metadata?: Record<string, unknown>;
}

interface SingleTurnMetricDef<
  TName extends string = string,
  TValue extends MetricScalar = MetricScalar,
> extends BaseMetricDef<TName, TValue> {
  readonly scope: "single";
  readonly type: "llm-based" | "code-based";
}

interface MultiTurnMetricDef<
  TName extends string = string,
  TValue extends MetricScalar = MetricScalar,
> extends BaseMetricDef<TName, TValue> {
  readonly scope: "multi";
  readonly type: "llm-based" | "code-based";
}

type MetricDef<
  TName extends string = string,
  TValue extends MetricScalar = MetricScalar,
> = SingleTurnMetricDef<TName, TValue> | MultiTurnMetricDef<TName, TValue>;

// =============================================================================
// Verdict Policy (from @tally/core/types/evaluators)
// =============================================================================

type VerdictPolicyFor<T extends MetricScalar> = T extends boolean
  ? { kind: "boolean"; passWhen: true | false }
  : T extends number
    ?
        | { kind: "number"; type: "threshold"; passAt: number }
        | { kind: "number"; type: "range"; min?: number; max?: number }
    : T extends string
      ? { kind: "ordinal"; passWhenIn: readonly string[] }
      : { kind: "none" };

// =============================================================================
// Normalization Types (from @tally/core/types/normalization)
// =============================================================================

/** Normalization context for number-valued metrics */
interface NumericNormalizationContext {
  direction?: "higher" | "lower";
  range?: { min: number; max: number };
  distribution?: { mean: number; stdDev: number };
  thresholds?: { pass: number; warn?: number };
  unit?: string;
  clip?: boolean;
}

/** Normalization context for boolean-valued metrics */
interface BooleanNormalizationContext {
  trueScore?: number;
  falseScore?: number;
}

/** Normalization context for string/ordinal-valued metrics */
interface OrdinalNormalizationContext {
  map?: Record<string, number>;
}

/** Maps metric value type to normalization context */
type NormalizationContextFor<T extends MetricScalar> = T extends number
  ? NumericNormalizationContext
  : T extends boolean
    ? BooleanNormalizationContext
    : OrdinalNormalizationContext;

/** Built-in normalizer specifications */
type NormalizerSpec<T extends MetricScalar = MetricScalar> =
  | { type: "identity" }
  | {
      type: "min-max";
      min?: number;
      max?: number;
      clip?: boolean;
      direction?: "higher" | "lower";
    }
  | {
      type: "z-score";
      mean?: number;
      stdDev?: number;
      to?: "0-1" | "0-100";
      clip?: boolean;
      direction?: "higher" | "lower";
    }
  | { type: "threshold"; threshold: number; above?: number; below?: number }
  | {
      type: "linear";
      slope: number;
      intercept: number;
      clip?: [number, number];
      direction?: "higher" | "lower";
    }
  | { type: "ordinal-map"; map: Record<string, number> }
  | { type: "custom"; note: "not-serializable" }; // Serializable snapshot

/** Serializable normalization info in reports */
interface NormalizationInfo<T extends MetricScalar = MetricScalar> {
  normalizer: NormalizerSpec<T>;
  calibration?: NormalizationContextFor<T>;
}

// =============================================================================
// Eval Definitions (from @tally/core/types/evaluators)
// =============================================================================

interface EvalBase<TName extends string = string> {
  readonly name: TName;
  readonly description?: string;
  readonly metadata?: Record<string, unknown>;
}

interface SingleTurnEval<
  TName extends string = string,
  TMetricName extends string = string,
  TValue extends MetricScalar = MetricScalar,
> extends EvalBase<TName> {
  readonly kind: "singleTurn";
  readonly metric: SingleTurnMetricDef<TMetricName, TValue>;
  readonly verdict?: VerdictPolicyFor<TValue>;
}

interface MultiTurnEval<
  TName extends string = string,
  TMetricName extends string = string,
  TValue extends MetricScalar = MetricScalar,
> extends EvalBase<TName> {
  readonly kind: "multiTurn";
  readonly metric: MultiTurnMetricDef<TMetricName, TValue>;
  readonly verdict?: VerdictPolicyFor<TValue>;
}

interface ScorerEval<TName extends string = string> extends EvalBase<TName> {
  readonly kind: "scorer";
  readonly scorerName: string;
  readonly verdict?: VerdictPolicyFor<number>; // Scorers always output numbers
}

type Eval<
  TName extends string = string,
  TMetricName extends string = string,
  TValue extends MetricScalar = MetricScalar,
> =
  | SingleTurnEval<TName, TMetricName, TValue>
  | MultiTurnEval<TName, TMetricName, TValue>
  | ScorerEval<TName>;

// =============================================================================
// Run Artifact Types (from @tally/core/types/runArtifact)
// =============================================================================

/**
 * Type-safe Measurement with value type and normalization info.
 *
 * @typeParam TValue - The metric value type (number, boolean, string)
 */
interface Measurement<TValue extends MetricScalar = MetricScalar> {
  metricRef: string;
  score?: Score;
  rawValue?: TValue | null;
  confidence?: number;
  reasoning?: string;
  executionTimeMs?: number;
  timestamp?: string;
  /** Normalization applied to produce the score - typed to metric value */
  normalization?: NormalizationInfo<TValue>;
}

/**
 * Type-safe EvalOutcome with verdict policy typed to metric value.
 *
 * The policy and observed values are typed based on the metric's value type,
 * enabling type-safe access to verdict configuration.
 *
 * @typeParam TValue - The metric value type
 *
 * @example
 * ```typescript
 * // For a number-valued eval
 * const outcome: TypedEvalOutcome<number> = {
 *   verdict: 'pass',
 *   policy: { kind: 'number', type: 'threshold', passAt: 0.8 }, // ✅ type-safe
 *   observed: { rawValue: 0.85, score: 0.85 as Score },
 * };
 *
 * // Type error: can't use boolean policy with number value
 * const bad: TypedEvalOutcome<number> = {
 *   verdict: 'pass',
 *   policy: { kind: 'boolean', passWhen: true }, // ❌ compile error
 * };
 * ```
 */
interface TypedEvalOutcome<TValue extends MetricScalar = MetricScalar> {
  verdict: Verdict;
  /** Policy typed to metric value - enforces matching policy kind */
  policy: VerdictPolicyFor<TValue> | { kind: "none" };
  /** Observed values typed to metric value */
  observed?: { rawValue?: TValue | null; score?: Score };
}

/**
 * Type-safe StepEvalResult with value type, verdict, and normalization.
 *
 * @typeParam TValue - The metric value type
 */
interface StepEvalResult<TValue extends MetricScalar = MetricScalar> {
  evalRef: string;
  measurement: Measurement<TValue>;
  outcome?: TypedEvalOutcome<TValue>;
}

/**
 * Type-safe ConversationEvalResult with value type, verdict, and normalization.
 *
 * @typeParam TValue - The metric value type
 */
interface ConversationEvalResult<TValue extends MetricScalar = MetricScalar> {
  evalRef: string;
  measurement: Measurement<TValue>;
  outcome?: TypedEvalOutcome<TValue>;
}

/**
 * Type-safe SingleTurnEvalSeries with value type preserved.
 *
 * @typeParam TValue - The metric value type
 */
interface SingleTurnEvalSeries<TValue extends MetricScalar = MetricScalar> {
  byStepIndex: Array<StepEvalResult<TValue> | null>;
}

// =============================================================================
// Type Utilities for Type-Safe Reports
// =============================================================================

/**
 * Extract eval name from any Eval type.
 * Uses direct property access instead of matching against union type.
 */
type ExtractEvalName<E> = E extends { readonly name: infer N extends string }
  ? N
  : never;

/**
 * Extract metric name from SingleTurn/MultiTurn eval
 */
type ExtractMetricName<E> = E extends
  | SingleTurnEval<string, infer M, MetricScalar>
  | MultiTurnEval<string, infer M, MetricScalar>
  ? M
  : never;

/**
 * Extract value type from Eval.
 * Uses direct metric property access for single/multi turn evals.
 */
type ExtractValueType<E> = E extends { kind: "singleTurn" | "multiTurn"; metric: { valueType: infer VT } }
  ? VT extends "number" | "ordinal"
    ? number
    : VT extends "boolean"
      ? boolean
      : string
  : E extends { kind: "scorer" }
    ? number // Scorers always output numbers
    : MetricScalar;

/**
 * Extract eval kind
 */
type ExtractEvalKind<E> = E extends { kind: infer K } ? K : never;

/**
 * Filter evals by kind from a tuple - uses Extract for cleaner filtering
 */
type FilterByKind<T extends readonly Eval[], K extends string> = Extract<
  T[number],
  { kind: K }
>;

/**
 * Get all eval names of a specific kind
 */
type EvalNamesOfKind<T extends readonly Eval[], K extends string> = ExtractEvalName<
  FilterByKind<T, K>
>;

/**
 * Check if a kind has any evals
 */
type HasEvalsOfKind<T extends readonly Eval[], K extends string> =
  FilterByKind<T, K> extends never ? false : true;

/**
 * Build typed single-turn results from eval array.
 * Uses a strict mapped type that only allows defined keys.
 */
type TypedSingleTurnResults<T extends readonly Eval[]> = {
  readonly [K in EvalNamesOfKind<T, "singleTurn">]: SingleTurnEvalSeries<
    ExtractValueType<Extract<FilterByKind<T, "singleTurn">, { name: K }>>
  >;
};

/**
 * Build typed multi-turn results from eval array
 */
type TypedMultiTurnResults<T extends readonly Eval[]> = {
  readonly [K in EvalNamesOfKind<T, "multiTurn">]: ConversationEvalResult<
    ExtractValueType<Extract<FilterByKind<T, "multiTurn">, { name: K }>>
  >;
};

/**
 * Build typed scorer results from eval array
 */
type TypedScorerResults<T extends readonly Eval[]> = {
  readonly [K in EvalNamesOfKind<T, "scorer">]:
    | { shape: "scalar"; result: ConversationEvalResult<number> }
    | { shape: "seriesByStepIndex"; series: SingleTurnEvalSeries<number> };
};

/**
 * Type-safe ConversationResult
 */
interface TypedConversationResult<T extends readonly Eval[]> {
  stepCount: number;
  singleTurn: TypedSingleTurnResults<T>;
  multiTurn: TypedMultiTurnResults<T>;
  scorers: TypedScorerResults<T>;
}

// =============================================================================
// Type Assertion Utilities
// =============================================================================

/**
 * Compile-time assertion that a key exists in a type.
 * Use: `const _: AssertKeyExists<typeof obj, "key"> = true;`
 * Will error if "key" is not a valid key of typeof obj.
 */
type AssertKeyExists<T, K extends string> = K extends keyof T ? true : never;

/**
 * Compile-time assertion that a key does NOT exist in a type.
 * Use: `const _: AssertKeyMissing<typeof obj, "key"> = true;`
 * Will error if "key" IS a valid key of typeof obj.
 */
type AssertKeyMissing<T, K extends string> = K extends keyof T ? never : true;

/**
 * Type-safe accessor that errors at compile time for invalid keys.
 */
function getTyped<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

/**
 * Type-safe TallyRunReport
 */
interface TypedTallyRunReport<T extends readonly Eval[]> {
  readonly runId: string;
  readonly createdAt: Date;
  readonly result: TypedConversationResult<T>;
  readonly metadata?: Record<string, unknown>;
}

// =============================================================================
// Tally Factory with Type Safety
// =============================================================================

interface TypedTally<T extends readonly Eval[]> {
  readonly evals: T;
  run(): Promise<TypedTallyRunReport<T>>;
}

/**
 * Create typed Tally instance.
 *
 * Uses `const` type parameter for literal type inference without `as const`.
 */
function createTally<const T extends readonly Eval[]>(args: {
  data: readonly MetricContainer[];
  evals: T;
}): TypedTally<T> {
  return {
    evals: args.evals,
    async run(): Promise<TypedTallyRunReport<T>> {
      // Mock implementation
      const singleTurn = {} as TypedSingleTurnResults<T>;
      const multiTurn = {} as TypedMultiTurnResults<T>;
      const scorers = {} as TypedScorerResults<T>;

      for (const evalDef of args.evals) {
        if (evalDef.kind === "singleTurn") {
          const rawValue =
            evalDef.metric.valueType === "boolean"
              ? true
              : evalDef.metric.valueType === "number"
                ? 0.85
                : "positive";
          const series: SingleTurnEvalSeries = {
            byStepIndex: [
              {
                evalRef: evalDef.name,
                measurement: {
                  metricRef: evalDef.metric.name,
                  score: 0.85 as Score,
                  rawValue,
                  // Include typed normalization info
                  normalization:
                    evalDef.metric.valueType === "number"
                      ? {
                          normalizer: { type: "min-max" as const, direction: "higher" as const },
                          calibration: { range: { min: 0, max: 1 } },
                        }
                      : evalDef.metric.valueType === "boolean"
                        ? {
                            normalizer: { type: "identity" as const },
                            calibration: { trueScore: 1, falseScore: 0 },
                          }
                        : {
                            normalizer: { type: "ordinal-map" as const, map: { positive: 1, neutral: 0.5, negative: 0 } },
                            calibration: { map: { positive: 1, neutral: 0.5, negative: 0 } },
                          },
                },
                // Include typed verdict outcome
                outcome: {
                  verdict: "pass",
                  policy: evalDef.verdict ?? { kind: "none" },
                  observed: { rawValue, score: 0.85 as Score },
                },
              },
            ],
          };
          (singleTurn as Record<string, unknown>)[evalDef.name] = series;
        } else if (evalDef.kind === "multiTurn") {
          const rawValue =
            evalDef.metric.valueType === "boolean"
              ? false
              : evalDef.metric.valueType === "number"
                ? 0.9
                : "neutral";
          const result: ConversationEvalResult = {
            evalRef: evalDef.name,
            measurement: {
              metricRef: evalDef.metric.name,
              score: 0.9 as Score,
              rawValue,
              normalization:
                evalDef.metric.valueType === "number"
                  ? {
                      normalizer: { type: "min-max" as const, direction: "higher" as const },
                      calibration: { range: { min: 0, max: 1 } },
                    }
                  : evalDef.metric.valueType === "boolean"
                    ? {
                        normalizer: { type: "identity" as const },
                        calibration: { trueScore: 1, falseScore: 0 },
                      }
                    : {
                        normalizer: { type: "ordinal-map" as const, map: { positive: 1, neutral: 0.5, negative: 0 } },
                        calibration: { map: { positive: 1, neutral: 0.5, negative: 0 } },
                      },
            },
            outcome: {
              verdict: "pass",
              policy: evalDef.verdict ?? { kind: "none" },
              observed: { rawValue, score: 0.9 as Score },
            },
          };
          (multiTurn as Record<string, unknown>)[evalDef.name] = result;
        } else if (evalDef.kind === "scorer") {
          const result: ConversationEvalResult<number> = {
            evalRef: evalDef.name,
            measurement: {
              metricRef: evalDef.scorerName,
              score: 0.88 as Score,
              rawValue: 0.88,
              normalization: {
                normalizer: { type: "identity" as const },
                calibration: { direction: "higher" as const },
              },
            },
            outcome: {
              verdict: "pass",
              policy: evalDef.verdict ?? { kind: "none" },
              observed: { rawValue: 0.88, score: 0.88 as Score },
            },
          };
          (scorers as Record<string, unknown>)[evalDef.name] = {
            shape: "scalar" as const,
            result,
          };
        }
      }

      return {
        runId: `run-${Date.now()}`,
        createdAt: new Date(),
        result: {
          stepCount: 1,
          singleTurn,
          multiTurn,
          scorers,
        },
        metadata: {},
      };
    },
  };
}

// =============================================================================
// Eval Factory Functions (matching packages/tally/src/evals/factories.ts)
// =============================================================================

/**
 * Define a single-turn eval with type inference.
 * Uses `const` type parameter to preserve literal name types even when called inline.
 */
function defineSingleTurnEval<
  const TName extends string,
  TMetricName extends string,
  TValue extends MetricScalar,
>(args: {
  name: TName;
  metric: SingleTurnMetricDef<TMetricName, TValue>;
  verdict?: VerdictPolicyFor<TValue>;
  description?: string;
}): SingleTurnEval<TName, TMetricName, TValue> {
  return {
    kind: "singleTurn",
    name: args.name,
    metric: args.metric,
    ...(args.verdict && { verdict: args.verdict }),
    ...(args.description && { description: args.description }),
  };
}

/**
 * Define a multi-turn eval with type inference.
 * Uses `const` type parameter to preserve literal name types even when called inline.
 */
function defineMultiTurnEval<
  const TName extends string,
  TMetricName extends string,
  TValue extends MetricScalar,
>(args: {
  name: TName;
  metric: MultiTurnMetricDef<TMetricName, TValue>;
  verdict?: VerdictPolicyFor<TValue>;
  description?: string;
}): MultiTurnEval<TName, TMetricName, TValue> {
  return {
    kind: "multiTurn",
    name: args.name,
    metric: args.metric,
    ...(args.verdict && { verdict: args.verdict }),
    ...(args.description && { description: args.description }),
  };
}

/**
 * Define a scorer eval.
 * Uses `const` type parameter to preserve literal name types even when called inline.
 */
function defineScorerEval<const TName extends string>(args: {
  name: TName;
  scorerName: string;
  description?: string;
}): ScorerEval<TName> {
  return {
    kind: "scorer",
    name: args.name,
    scorerName: args.scorerName,
    ...(args.description && { description: args.description }),
  };
}

// =============================================================================
// Metric Factory Functions
// =============================================================================

function defineSingleTurnMetric<
  TName extends string,
  TValue extends MetricScalar,
>(args: {
  name: TName;
  valueType: ValueTypeFor<TValue>;
  type?: "llm-based" | "code-based";
  description?: string;
}): SingleTurnMetricDef<TName, TValue> {
  return {
    name: args.name,
    scope: "single",
    valueType: args.valueType,
    type: args.type ?? "code-based",
    ...(args.description && { description: args.description }),
  };
}

function defineMultiTurnMetric<
  TName extends string,
  TValue extends MetricScalar,
>(args: {
  name: TName;
  valueType: ValueTypeFor<TValue>;
  type?: "llm-based" | "code-based";
  description?: string;
}): MultiTurnMetricDef<TName, TValue> {
  return {
    name: args.name,
    scope: "multi",
    valueType: args.valueType,
    type: args.type ?? "code-based",
    ...(args.description && { description: args.description }),
  };
}

// =============================================================================
// CRITICAL TEST 1: Pre-defined Evals (Original Demo)
// =============================================================================

// 1. Define metrics (matching real Tally pattern)
const relevanceMetric = defineSingleTurnMetric<"relevance-metric", number>({
  name: "relevance-metric",
  valueType: "number",
  type: "llm-based",
  description: "LLM-judged relevance score",
});

const toxicityMetric = defineSingleTurnMetric<"toxicity-metric", boolean>({
  name: "toxicity-metric",
  valueType: "boolean",
  type: "llm-based",
  description: "Whether response contains toxic content",
});

const coherenceMetric = defineMultiTurnMetric<"coherence-metric", number>({
  name: "coherence-metric",
  valueType: "number",
  type: "llm-based",
  description: "Conversation-level coherence score",
});

const sentimentMetric = defineMultiTurnMetric<"sentiment-metric", string>({
  name: "sentiment-metric",
  valueType: "string",
  type: "code-based",
  description: "Overall conversation sentiment",
});

// 2. Define evals using metrics (matching real Tally pattern)
const relevanceEval = defineSingleTurnEval({
  name: "relevance",
  metric: relevanceMetric,
  verdict: { kind: "number", type: "threshold", passAt: 0.7 },
});

const toxicityEval = defineSingleTurnEval({
  name: "toxicity",
  metric: toxicityMetric,
  verdict: { kind: "boolean", passWhen: false }, // Pass when NOT toxic
});

const coherenceEval = defineMultiTurnEval({
  name: "coherence",
  metric: coherenceMetric,
  verdict: { kind: "number", type: "range", min: 0.5, max: 1.0 },
});

const sentimentEval = defineMultiTurnEval({
  name: "sentiment",
  metric: sentimentMetric,
  verdict: { kind: "ordinal", passWhenIn: ["positive", "neutral"] },
});

const overallScorer = defineScorerEval({
  name: "overall-quality",
  scorerName: "quality-scorer",
});

// 3. Create tally with all evals - NO `as const` needed!
const tally = createTally({
  data: [{ id: "conv-1", steps: [], metadata: {} }],
  evals: [
    relevanceEval,
    toxicityEval,
    coherenceEval,
    sentimentEval,
    overallScorer,
  ],
});

async function demonstrateTypeSafety() {
  const report = await tally.run();

  // ============================================
  // ✅ Single-turn evals accessed by name
  // ============================================

  // Access relevance (number-valued single-turn)
  const relevanceSeries = report.result.singleTurn.relevance;
  const relevanceStep0 = relevanceSeries.byStepIndex[0];
  if (relevanceStep0) {
    const rawValue: number | null | undefined =
      relevanceStep0.measurement.rawValue;
    const score: Score | undefined = relevanceStep0.measurement.score;
    console.log("Relevance:", { rawValue, score });
  }

  // Access toxicity (boolean-valued single-turn)
  const toxicitySeries = report.result.singleTurn.toxicity;
  const toxicityStep0 = toxicitySeries.byStepIndex[0];
  if (toxicityStep0) {
    const rawValue: boolean | null | undefined =
      toxicityStep0.measurement.rawValue;
    console.log("Is toxic:", rawValue);
  }

  // ============================================
  // ✅ Multi-turn evals accessed by name
  // ============================================

  // Access coherence (number-valued multi-turn)
  const coherenceResult = report.result.multiTurn.coherence;
  const coherenceRaw: number | null | undefined =
    coherenceResult.measurement.rawValue;
  console.log("Coherence:", coherenceRaw);

  // Access sentiment (string-valued multi-turn)
  const sentimentResult = report.result.multiTurn.sentiment;
  const sentimentRaw: string | null | undefined =
    sentimentResult.measurement.rawValue;
  console.log("Sentiment:", sentimentRaw);

  // ============================================
  // ✅ Scorer evals accessed by name
  // ============================================

  const overallResult = report.result.scorers["overall-quality"];
  if (overallResult.shape === "scalar") {
    const score: Score | undefined = overallResult.result.measurement.score;
    console.log("Overall quality score:", score);
  }

  // ============================================
  // ❌ Compile errors for typos and wrong types
  // ============================================

  // @ts-expect-error - 'relevence' typo doesn't exist
  const _typo1 = report.result.singleTurn.relevence;

  // @ts-expect-error - 'coherence' is multi-turn, not single-turn
  const _typo2 = report.result.singleTurn.coherence;

  // @ts-expect-error - 'relevance' is single-turn, not multi-turn
  const _typo3 = report.result.multiTurn.relevance;

  // @ts-expect-error - wrong type (expecting number, got string)
  const _wrongType: string = relevanceStep0?.measurement.rawValue ?? "";

  console.log("Type safety demonstration complete!");
}

// =============================================================================
// CRITICAL TEST 2: Inline Eval Definitions (No Pre-definition)
// Tests if `const` type parameter works when evals are defined inline
// =============================================================================

// =============================================================================
// CRITICAL TEST 2: Inline Eval Definitions (No Pre-definition)
// Tests that `const` type parameter preserves literal types when called inline
// =============================================================================

async function testInlineEvalDefinitions() {
  // Define metric inline
  const inlineMetric = defineSingleTurnMetric<"inline-metric", number>({
    name: "inline-metric",
    valueType: "number",
  });

  // Create tally with inline eval definition
  const inlineTally = createTally({
    data: [{ id: "conv-1", steps: [], metadata: {} }],
    evals: [
      defineSingleTurnEval({
        name: "inline-eval",
        metric: inlineMetric,
      }),
      defineScorerEval({
        name: "inline-scorer",
        scorerName: "test-scorer",
      }),
    ],
  });

  const report = await inlineTally.run();

  // Type inference verification
  type SingleTurnKeys = keyof typeof report.result.singleTurn;
  type ScorerKeys = keyof typeof report.result.scorers;

  // Static assertions - compile only if types are correct
  const _singleTurnKeyIsLiteral: SingleTurnKeys extends "inline-eval" ? true : never = true;
  const _scorerKeyIsLiteral: ScorerKeys extends "inline-scorer" ? true : never = true;

  // ✅ Should have autocomplete for 'inline-eval'
  const inlineResult = report.result.singleTurn["inline-eval"];
  const step0 = inlineResult.byStepIndex[0];
  if (step0) {
    // Should be number type
    const raw: number | null | undefined = step0.measurement.rawValue;
    console.log("Inline eval raw:", raw);
  }

  // ✅ Should have autocomplete for 'inline-scorer'
  const scorerResult = report.result.scorers["inline-scorer"];
  console.log("Inline scorer shape:", scorerResult.shape);

  // ============================================
  // Key Existence Assertions
  // ============================================

  // ✅ Assert valid keys exist
  const _assertInlineEvalExists: AssertKeyExists<
    typeof report.result.singleTurn,
    "inline-eval"
  > = true;

  const _assertInlineScorerExists: AssertKeyExists<
    typeof report.result.scorers,
    "inline-scorer"
  > = true;

  // ✅ Assert invalid keys are missing
  const _assertTypoMissing: AssertKeyMissing<
    typeof report.result.singleTurn,
    "inline-evall"
  > = true;

  const _assertScorerNotInSingleTurn: AssertKeyMissing<
    typeof report.result.singleTurn,
    "inline-scorer"
  > = true;

  // ✅ Using typed accessor - this compiles for valid keys
  const typedResult = getTyped(report.result.singleTurn, "inline-eval");
  console.log("Typed accessor works:", typedResult.byStepIndex.length);

  // This would error if uncommented (key doesn't exist):
  // const _invalid = getTyped(report.result.singleTurn, "inline-evall");

  console.log("Inline eval definition test passed");
}

// =============================================================================
// CRITICAL TEST 3: Spreading Eval Arrays
// Tests the plan's recommendation: [...qualityEvals, ...safetyEvals]
// =============================================================================

async function testSpreadingEvalArrays() {
  // Quality evals group
  const qualityEvals = [
    defineSingleTurnEval({
      name: "quality-relevance",
      metric: defineSingleTurnMetric<"q-rel-metric", number>({
        name: "q-rel-metric",
        valueType: "number",
      }),
    }),
    defineSingleTurnEval({
      name: "quality-coherence",
      metric: defineSingleTurnMetric<"q-coh-metric", number>({
        name: "q-coh-metric",
        valueType: "number",
      }),
    }),
  ] as const; // Note: spreading loses tuple type without `as const`

  // Safety evals group
  const safetyEvals = [
    defineSingleTurnEval({
      name: "safety-toxicity",
      metric: defineSingleTurnMetric<"s-tox-metric", boolean>({
        name: "s-tox-metric",
        valueType: "boolean",
      }),
    }),
  ] as const;

  // Combined via spread - does it work?
  const spreadTally = createTally({
    data: [{ id: "conv-1", steps: [], metadata: {} }],
    evals: [...qualityEvals, ...safetyEvals],
  });

  const report = await spreadTally.run();

  // ✅ Should have access to all spread evals
  const qualityRel = report.result.singleTurn["quality-relevance"];
  const qualityCoh = report.result.singleTurn["quality-coherence"];
  const safetyTox = report.result.singleTurn["safety-toxicity"];

  // Verify types are preserved
  const relRaw: number | null | undefined =
    qualityRel.byStepIndex[0]?.measurement.rawValue;
  const toxRaw: boolean | null | undefined =
    safetyTox.byStepIndex[0]?.measurement.rawValue;

  console.log("Spread arrays work:", { relRaw, toxRaw });
}

// =============================================================================
// CRITICAL TEST 4: Dynamic Access Pattern (Runtime Fallback)
// For scenarios where eval name is not known at compile time
// =============================================================================

/**
 * Sometimes we need runtime dynamic access (e.g., iterating over all evals).
 * The typed report should still allow this via index signature.
 */
type DynamicAccessibleResults<T extends readonly Eval[]> =
  TypedSingleTurnResults<T> & {
    [key: string]: SingleTurnEvalSeries | undefined;
  };

async function testDynamicAccess() {
  const report = await tally.run();

  // Static access - type safe
  const staticResult = report.result.singleTurn.relevance;
  console.log("Static:", staticResult.byStepIndex.length);

  // Dynamic access - for runtime iteration
  const evalNames = ["relevance", "toxicity"] as const;
  for (const name of evalNames) {
    // This works because TypeScript can narrow from the literal union
    const result = report.result.singleTurn[name];
    console.log(`${name}:`, result.byStepIndex.length);
  }

  // Truly dynamic (unknown at compile time) - requires cast
  const dynamicName = "relevance" as string;
  const dynamicResults = report.result.singleTurn as DynamicAccessibleResults<
    typeof tally.evals
  >;
  const dynamicResult = dynamicResults[dynamicName];
  if (dynamicResult) {
    console.log("Dynamic access works:", dynamicResult.byStepIndex.length);
  }
}

// =============================================================================
// CRITICAL TEST 5: Serialization Compatibility
// The typed report should be serializable to JSON (for artifact storage)
// =============================================================================

interface SerializedRunArtifact {
  runId: string;
  createdAt: string;
  result: {
    stepCount: number;
    singleTurn: Record<string, unknown>;
    multiTurn: Record<string, unknown>;
    scorers: Record<string, unknown>;
  };
}

function toArtifact<T extends readonly Eval[]>(
  report: TypedTallyRunReport<T>
): SerializedRunArtifact {
  return {
    runId: report.runId,
    createdAt: report.createdAt.toISOString(),
    result: {
      stepCount: report.result.stepCount,
      // These casts are safe because the runtime structure IS string-keyed
      singleTurn: report.result.singleTurn as unknown as Record<
        string,
        unknown
      >,
      multiTurn: report.result.multiTurn as unknown as Record<string, unknown>,
      scorers: report.result.scorers as unknown as Record<string, unknown>,
    },
  };
}

/**
 * Reconstruct typed report from serialized artifact.
 * This requires knowing the eval types at the deserialization site.
 */
function fromArtifact<const TEvals extends readonly Eval[]>(
  artifact: SerializedRunArtifact,
  _evalTypes: TEvals // For type inference only
): TypedTallyRunReport<TEvals> {
  return {
    runId: artifact.runId,
    createdAt: new Date(artifact.createdAt),
    result: {
      stepCount: artifact.result.stepCount,
      singleTurn: artifact.result.singleTurn as TypedSingleTurnResults<TEvals>,
      multiTurn: artifact.result.multiTurn as TypedMultiTurnResults<TEvals>,
      scorers: artifact.result.scorers as TypedScorerResults<TEvals>,
    },
  };
}

async function testSerializationRoundtrip() {
  const report = await tally.run();

  // Serialize (loses type info)
  const artifact = toArtifact(report);
  const json = JSON.stringify(artifact);
  console.log("Serialized to JSON:", json.slice(0, 100) + "...");

  // Deserialize (recovers type info)
  const parsed = JSON.parse(json) as SerializedRunArtifact;
  const reconstructed = fromArtifact(parsed, tally.evals);

  // ✅ Type safety restored after deserialization
  const relevance = reconstructed.result.singleTurn.relevance;
  const rawValue: number | null | undefined =
    relevance.byStepIndex[0]?.measurement.rawValue;
  console.log("Deserialized rawValue type check:", typeof rawValue);

  // ✅ Key assertions after deserialization
  const _validKey: AssertKeyExists<
    typeof reconstructed.result.singleTurn,
    "relevance"
  > = true;

  const _invalidKey: AssertKeyMissing<
    typeof reconstructed.result.singleTurn,
    "relevence"
  > = true;

  console.log("Serialization roundtrip maintains type safety");
}

// =============================================================================
// CRITICAL TEST 6: Empty Evals Array
// Edge case: what happens with no evals?
// =============================================================================

async function testEmptyEvals() {
  const emptyTally = createTally({
    data: [{ id: "conv-1", steps: [], metadata: {} }],
    evals: [],
  });

  const report = await emptyTally.run();

  // result.singleTurn should be an empty object type {}
  // keyof {} = never, so no keys are valid
  type EmptySingleTurnKeys = keyof typeof report.result.singleTurn;
  // EmptySingleTurnKeys should be never

  // ✅ Any key should be missing
  const _anyKeyMissing: AssertKeyMissing<
    typeof report.result.singleTurn,
    "anything"
  > = true;

  const _noMultiTurn: AssertKeyMissing<
    typeof report.result.multiTurn,
    "something"
  > = true;

  console.log("Empty evals handled correctly - no valid keys exist");
}

// =============================================================================
// CRITICAL TEST 7: Mixed Container Types (Single + Multi Turn)
// Verify kind separation works correctly
// =============================================================================

async function testMixedContainerTypes() {
  const mixedTally = createTally({
    data: [{ id: "conv-1", steps: [], metadata: {} }],
    evals: [
      defineSingleTurnEval({
        name: "single-only",
        metric: defineSingleTurnMetric<"s-metric", number>({
          name: "s-metric",
          valueType: "number",
        }),
      }),
      defineMultiTurnEval({
        name: "multi-only",
        metric: defineMultiTurnMetric<"m-metric", string>({
          name: "m-metric",
          valueType: "string",
        }),
      }),
    ],
  });

  const report = await mixedTally.run();

  // ✅ Correct access patterns
  const singleResult = report.result.singleTurn["single-only"];
  const multiResult = report.result.multiTurn["multi-only"];

  // Type checks
  const singleRaw: number | null | undefined =
    singleResult.byStepIndex[0]?.measurement.rawValue;
  const multiRaw: string | null | undefined = multiResult.measurement.rawValue;

  console.log("Mixed types:", { singleRaw, multiRaw });

  // ============================================
  // Key Existence & Cross-Access Assertions
  // ============================================

  // ✅ Correct keys exist in correct categories
  const _a: AssertKeyExists<typeof report.result.singleTurn, "single-only"> = true;
  const _b: AssertKeyExists<typeof report.result.multiTurn, "multi-only"> = true;

  // ✅ Cross-access: keys don't exist in wrong categories
  const _c: AssertKeyMissing<typeof report.result.singleTurn, "multi-only"> = true;
  const _d: AssertKeyMissing<typeof report.result.multiTurn, "single-only"> = true;

  // ✅ Using typed accessor - compiles for valid keys
  const singleTyped = getTyped(report.result.singleTurn, "single-only");
  const multiTyped = getTyped(report.result.multiTurn, "multi-only");

  console.log("Mixed container types:", {
    singleSteps: singleTyped.byStepIndex.length,
    multiRaw: multiTyped.measurement.rawValue,
  });

  // This would error if uncommented (cross-access):
  // const _wrong = getTyped(report.result.singleTurn, "multi-only");
}

// =============================================================================
// CRITICAL TEST 8: Duplicate Eval Names (Edge Case)
// What happens if two evals have the same name? (Shouldn't happen, but test type behavior)
// =============================================================================

async function testDuplicateEvalNames() {
  // This is a user error, but let's see how types behave
  const duplicateTally = createTally({
    data: [{ id: "conv-1", steps: [], metadata: {} }],
    evals: [
      defineSingleTurnEval({
        name: "duplicate-name",
        metric: defineSingleTurnMetric<"dup-metric-1", number>({
          name: "dup-metric-1",
          valueType: "number",
        }),
      }),
      defineSingleTurnEval({
        name: "duplicate-name", // Same name!
        metric: defineSingleTurnMetric<"dup-metric-2", boolean>({
          name: "dup-metric-2",
          valueType: "boolean",
        }),
      }),
    ],
  });

  const report = await duplicateTally.run();

  // TypeScript will union the value types for the same key
  // This is actually correct behavior - it's a union of both possibilities
  const dupResult = report.result.singleTurn["duplicate-name"];
  const raw = dupResult.byStepIndex[0]?.measurement.rawValue;
  // raw: number | boolean | null | undefined - both types!

  console.log(
    "Duplicate names create union type (expected):",
    typeof raw
  );
}

// =============================================================================
// CRITICAL TEST 9: Type-Safe Verdicts and Normalization
// Tests that verdict policies and normalization are typed to metric value
// =============================================================================

async function testTypeSafeVerdictsAndNormalization() {
  // Create evals with different value types
  const numberMetric = defineSingleTurnMetric<"score-metric", number>({
    name: "score-metric",
    valueType: "number",
  });

  const booleanMetric = defineSingleTurnMetric<"flag-metric", boolean>({
    name: "flag-metric",
    valueType: "boolean",
  });

  const stringMetric = defineMultiTurnMetric<"category-metric", string>({
    name: "category-metric",
    valueType: "string",
  });

  const typedTally = createTally({
    data: [{ id: "conv-1", steps: [], metadata: {} }],
    evals: [
      defineSingleTurnEval({
        name: "score-eval",
        metric: numberMetric,
        verdict: { kind: "number", type: "threshold", passAt: 0.8 },
      }),
      defineSingleTurnEval({
        name: "flag-eval",
        metric: booleanMetric,
        verdict: { kind: "boolean", passWhen: false },
      }),
      defineMultiTurnEval({
        name: "category-eval",
        metric: stringMetric,
        verdict: { kind: "ordinal", passWhenIn: ["good", "excellent"] },
      }),
    ],
  });

  const report = await typedTally.run();

  // ============================================
  // ✅ Type-safe verdict policy access
  // ============================================

  const scoreResult = report.result.singleTurn["score-eval"].byStepIndex[0];
  if (scoreResult?.outcome) {
    // Policy is typed to VerdictPolicyFor<number>
    const policy = scoreResult.outcome.policy;
    if (policy.kind === "number" && policy.type === "threshold") {
      const threshold: number = policy.passAt;
      console.log("Number threshold:", threshold);
    }

    // Observed rawValue is typed as number
    const observed = scoreResult.outcome.observed;
    if (observed) {
      const raw: number | null | undefined = observed.rawValue;
      console.log("Observed number value:", raw);
    }
  }

  const flagResult = report.result.singleTurn["flag-eval"].byStepIndex[0];
  if (flagResult?.outcome) {
    // Policy is typed to VerdictPolicyFor<boolean>
    const policy = flagResult.outcome.policy;
    if (policy.kind === "boolean") {
      const passWhen: true | false = policy.passWhen;
      console.log("Boolean passWhen:", passWhen);
    }

    // Observed rawValue is typed as boolean
    const observed = flagResult.outcome.observed;
    if (observed) {
      const raw: boolean | null | undefined = observed.rawValue;
      console.log("Observed boolean value:", raw);
    }
  }

  const categoryResult = report.result.multiTurn["category-eval"];
  if (categoryResult?.outcome) {
    // Policy is typed to VerdictPolicyFor<string>
    const policy = categoryResult.outcome.policy;
    if (policy.kind === "ordinal") {
      const passWhenIn: readonly string[] = policy.passWhenIn;
      console.log("Ordinal passWhenIn:", passWhenIn);
    }

    // Observed rawValue is typed as string
    const observed = categoryResult.outcome.observed;
    if (observed) {
      const raw: string | null | undefined = observed.rawValue;
      console.log("Observed string value:", raw);
    }
  }

  // ============================================
  // ✅ Type-safe normalization access
  // ============================================

  if (scoreResult?.measurement.normalization) {
    const norm = scoreResult.measurement.normalization;
    // Normalizer is typed to metric value
    if (norm.normalizer.type === "min-max") {
      const direction = norm.normalizer.direction; // 'higher' | 'lower' | undefined
      console.log("Min-max direction:", direction);
    }
    // Calibration is typed as NumericNormalizationContext
    if (norm.calibration) {
      const range = norm.calibration.range; // { min: number, max: number } | undefined
      console.log("Calibration range:", range);
    }
  }

  if (flagResult?.measurement.normalization) {
    const norm = flagResult.measurement.normalization;
    // Calibration is typed as BooleanNormalizationContext
    if (norm.calibration) {
      const trueScore = norm.calibration.trueScore; // number | undefined
      const falseScore = norm.calibration.falseScore; // number | undefined
      console.log("Boolean calibration:", { trueScore, falseScore });
    }
  }

  // ============================================
  // ❌ Compile errors for mismatched types
  // ============================================

  // @ts-expect-error - Can't use boolean policy with number-valued eval
  const _wrongPolicy: VerdictPolicyFor<number> = { kind: "boolean", passWhen: true };

  // @ts-expect-error - Can't use number policy with boolean-valued eval
  const _wrongPolicy2: VerdictPolicyFor<boolean> = { kind: "number", type: "threshold", passAt: 0.5 };

  // @ts-expect-error - Ordinal passWhenIn expects readonly string[], not number[]
  const _wrongOrdinal: VerdictPolicyFor<string> = { kind: "ordinal", passWhenIn: [1, 2, 3] };

  console.log("Type-safe verdicts and normalization test passed", _wrongPolicy, _wrongPolicy2, _wrongOrdinal);
}

// =============================================================================
// CRITICAL TEST 10: Verdict Policy Extraction from Eval
// Tests utility types for extracting typed verdict policies from evals
// =============================================================================

/**
 * Extract the verdict policy type from an eval.
 * Preserves the type safety of the policy based on metric value type.
 */
type ExtractVerdictPolicy<E> = E extends {
  kind: "singleTurn" | "multiTurn";
  metric: { valueType: infer VT };
}
  ? VT extends "number" | "ordinal"
    ? VerdictPolicyFor<number>
    : VT extends "boolean"
      ? VerdictPolicyFor<boolean>
      : VerdictPolicyFor<string>
  : E extends { kind: "scorer" }
    ? VerdictPolicyFor<number>
    : VerdictPolicyFor<MetricScalar>;

/**
 * Extract normalization context type from an eval.
 */
type ExtractNormalizationContext<E> = E extends {
  kind: "singleTurn" | "multiTurn";
  metric: { valueType: infer VT };
}
  ? VT extends "number" | "ordinal"
    ? NumericNormalizationContext
    : VT extends "boolean"
      ? BooleanNormalizationContext
      : OrdinalNormalizationContext
  : E extends { kind: "scorer" }
    ? NumericNormalizationContext
    : NumericNormalizationContext | BooleanNormalizationContext | OrdinalNormalizationContext;

async function testVerdictPolicyExtraction() {
  // Verify extraction works correctly
  type NumberPolicy = ExtractVerdictPolicy<typeof relevanceEval>;
  type BooleanPolicy = ExtractVerdictPolicy<typeof toxicityEval>;
  type StringPolicy = ExtractVerdictPolicy<typeof sentimentEval>;
  type ScorerPolicy = ExtractVerdictPolicy<typeof overallScorer>;

  // These compile only if extraction is correct
  const _numPol: NumberPolicy = { kind: "number", type: "threshold", passAt: 0.5 };
  const _boolPol: BooleanPolicy = { kind: "boolean", passWhen: true };
  const _strPol: StringPolicy = { kind: "ordinal", passWhenIn: ["a", "b"] };
  const _scorerPol: ScorerPolicy = { kind: "number", type: "range", min: 0.5 };

  // Normalization context extraction
  type NumericNorm = ExtractNormalizationContext<typeof relevanceEval>;
  type BooleanNorm = ExtractNormalizationContext<typeof toxicityEval>;
  type OrdinalNorm = ExtractNormalizationContext<typeof sentimentEval>;

  const _numNorm: NumericNorm = { direction: "higher", range: { min: 0, max: 1 } };
  const _boolNorm: BooleanNorm = { trueScore: 1, falseScore: 0 };
  const _ordNorm: OrdinalNorm = { map: { good: 1, bad: 0 } };

  console.log("Verdict policy extraction types verified");
}

// =============================================================================
// RUN ALL CRITICAL TESTS
// =============================================================================

async function runAllCriticalTests() {
  console.log("\n=== CRITICAL TEST 1: Pre-defined Evals ===");
  await demonstrateTypeSafety();

  console.log("\n=== CRITICAL TEST 2: Inline Eval Definitions ===");
  await testInlineEvalDefinitions();

  console.log("\n=== CRITICAL TEST 3: Spreading Eval Arrays ===");
  await testSpreadingEvalArrays();

  console.log("\n=== CRITICAL TEST 4: Dynamic Access ===");
  await testDynamicAccess();

  console.log("\n=== CRITICAL TEST 5: Serialization Roundtrip ===");
  await testSerializationRoundtrip();

  console.log("\n=== CRITICAL TEST 6: Empty Evals ===");
  await testEmptyEvals();

  console.log("\n=== CRITICAL TEST 7: Mixed Container Types ===");
  await testMixedContainerTypes();

  console.log("\n=== CRITICAL TEST 8: Duplicate Eval Names ===");
  await testDuplicateEvalNames();

  console.log("\n=== CRITICAL TEST 9: Type-Safe Verdicts & Normalization ===");
  await testTypeSafeVerdictsAndNormalization();

  console.log("\n=== CRITICAL TEST 10: Verdict Policy Extraction ===");
  await testVerdictPolicyExtraction();

  console.log("\n=== ALL CRITICAL TESTS PASSED ===");
}

// =============================================================================
// Exports
// =============================================================================

export {
  createTally,
  defineMultiTurnEval,
  defineMultiTurnMetric,
  defineScorerEval,
  defineSingleTurnEval,
  defineSingleTurnMetric,
  demonstrateTypeSafety,
  runAllCriticalTests,
  // Serialization helpers
  toArtifact,
  fromArtifact,
  // Types - Core
  type Eval,
  type MetricDef,
  type MultiTurnEval,
  type SingleTurnEval,
  type ScorerEval,
  // Types - Typed Report
  type TypedConversationResult,
  type TypedMultiTurnResults,
  type TypedSingleTurnResults,
  type TypedTally,
  type TypedTallyRunReport,
  type SerializedRunArtifact,
  type DynamicAccessibleResults,
  // Types - Verdict (NEW)
  type VerdictPolicyFor,
  type TypedEvalOutcome,
  type ExtractVerdictPolicy,
  // Types - Normalization (NEW)
  type NormalizerSpec,
  type NormalizationContextFor,
  type NumericNormalizationContext,
  type BooleanNormalizationContext,
  type OrdinalNormalizationContext,
  type NormalizationInfo,
  type ExtractNormalizationContext,
};
