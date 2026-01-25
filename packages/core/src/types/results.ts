/**
 * Core Result Types
 *
 * Unified result types with type parameters for type-safe access.
 * These are the foundational types used by both TallyRunReport (SDK) and
 * TallyRunArtifact (serialization).
 *
 * ## Design Principles
 *
 * 1. **Single Source of Truth** - All result types defined here with type params
 * 2. **Defaults for Flexibility** - Type params default to base types for untyped usage
 * 3. **No Duplication** - runReport.ts and runArtifact.ts import from here
 *
 * ## Type Safety Features
 *
 * - **Eval names** - Literal types preserved via `const` type parameters
 * - **Metric value types** - `rawValue` typed to number/boolean/string
 * - **Verdict policies** - `policy.kind` matches metric value type
 * - **Normalization context** - Typed to metric value type
 * - **Aggregations** - Typed based on aggregator definitions
 */

import type { MetricScalar, Score } from './primitives';
import type { Eval, VerdictPolicyFor } from './evaluators';
import type { NormalizationContextFor, NormalizerSpec } from './normalization';
import type { CategoricalAggregatorDef } from './metrics';
import type { Scorer, ScorerInput } from './scorers';

// ─────────────────────────────────────────────────────────────────────────────
// Common Primitives
// ─────────────────────────────────────────────────────────────────────────────

export type MetricName = string;
export type EvalName = string;
export type ScorerName = string;
export type RunId = string;
export type ConversationId = string;

/** Verdict result */
export type Verdict = 'pass' | 'fail' | 'unknown';

/**
 * Metric value that may be null.
 * Historically some raw values have been stored as null.
 */
export type MetricScalarOrNull = MetricScalar | null;

// ─────────────────────────────────────────────────────────────────────────────
// Normalization Info (serializable snapshot)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serializable normalizer snapshot.
 * Custom normalizers (functions) are represented as `{ type: 'custom', note: 'not-serializable' }`.
 */
export type NormalizerSpecSnap =
  | Exclude<NormalizerSpec, { type: 'custom' }>
  | { type: 'custom'; note: 'not-serializable' };

/**
 * Type-safe normalization info with context typed to metric value.
 *
 * @typeParam TValue - The metric value type
 */
export interface NormalizationInfo<TValue extends MetricScalar = MetricScalar> {
  /** The normalizer specification (or 'custom' for functions) */
  normalizer: NormalizerSpecSnap;
  /** Calibration context typed to metric value type */
  calibration?: NormalizationContextFor<TValue>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Verdict Policy Info (serializable)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serializable verdict policy info.
 * Custom verdict functions are represented as `{ kind: 'custom', note: 'not-serializable' }`.
 */
export type VerdictPolicyInfo =
  | { kind: 'none' }
  | { kind: 'boolean'; passWhen: boolean }
  | { kind: 'number'; type: 'threshold'; passAt: number }
  | { kind: 'number'; type: 'range'; min?: number; max?: number }
  | { kind: 'ordinal'; passWhenIn: readonly string[] }
  | { kind: 'custom'; note: 'not-serializable' };

// ─────────────────────────────────────────────────────────────────────────────
// Measurement
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Measurement = what we measured (metric/scorer output) + debug metadata.
 *
 * @typeParam TValue - The metric value type (number, boolean, or string)
 */
export interface Measurement<TValue extends MetricScalar = MetricScalar> {
  /** Reference to the metric in `defs.metrics` */
  metricRef: MetricName;

  /** Normalized score (0..1) for aggregation */
  score?: Score;

  /** Original value typed to metric value type */
  rawValue?: TValue | null;

  /** Optional LLM fields */
  confidence?: number;
  reasoning?: string;

  /** Execution metadata */
  executionTimeMs?: number;
  timestamp?: string; // ISO

  /** Normalization info typed to metric value */
  normalization?: NormalizationInfo<TValue>;

  /** Arbitrary additional metadata */
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Eval Outcome
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Eval outcome with typed verdict policy.
 *
 * Enforces that the verdict policy kind matches the metric's value type:
 * - `number` → threshold/range policy
 * - `boolean` → boolean policy
 * - `string` → ordinal policy
 *
 * @typeParam TValue - The metric value type
 */
export interface EvalOutcome<TValue extends MetricScalar = MetricScalar> {
  /** The verdict result */
  verdict: Verdict;

  /**
   * Policy typed to metric value.
   * Uses VerdictPolicyInfo for serialization compatibility.
   */
  policy: VerdictPolicyFor<TValue> | { kind: 'none' } | { kind: 'custom'; note: 'not-serializable' };

  /** Observed values typed to metric value */
  observed?: { rawValue?: TValue | null; score?: Score };
}

// ─────────────────────────────────────────────────────────────────────────────
// Result Records
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Step evaluation result with typed value.
 *
 * @typeParam TValue - The metric value type
 */
export interface StepEvalResult<TValue extends MetricScalar = MetricScalar> {
  evalRef: EvalName;
  measurement: Measurement<TValue>;
  outcome?: EvalOutcome<TValue>;
}

/**
 * Single-turn eval series with typed value.
 *
 * @typeParam TValue - The metric value type
 */
export interface SingleTurnEvalSeries<TValue extends MetricScalar = MetricScalar> {
  /** Array index == stepIndex; null means "not evaluated / not selected" */
  byStepIndex: Array<StepEvalResult<TValue> | null>;
}

/**
 * Conversation eval result with typed value.
 *
 * @typeParam TValue - The metric value type
 */
export interface ConversationEvalResult<TValue extends MetricScalar = MetricScalar> {
  evalRef: EvalName;
  measurement: Measurement<TValue>;
  outcome?: EvalOutcome<TValue>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Type Extraction Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts the eval name as a literal type from an Eval.
 */
export type ExtractEvalName<TEval> = TEval extends { readonly name: infer N extends string } ? N : never;

/**
 * Extracts the metric value type from an Eval.
 */
export type ExtractValueType<TEval> = TEval extends {
  kind: 'singleTurn' | 'multiTurn';
  metric: { valueType: infer VT };
}
  ? VT extends 'number' | 'ordinal'
    ? number
    : VT extends 'boolean'
      ? boolean
      : string
  : TEval extends { kind: 'scorer' }
    ? number
    : MetricScalar;

/**
 * Extracts the eval kind from an Eval type.
 */
export type ExtractEvalKind<TEval> = TEval extends { kind: infer K } ? K : never;

/**
 * Filters evals by kind from a tuple/array type.
 */
export type FilterByKind<TEvals extends readonly Eval[], TKind extends string> = Extract<
  TEvals[number],
  { kind: TKind }
>;

/**
 * Gets all eval names of a specific kind.
 */
export type EvalNamesOfKind<TEvals extends readonly Eval[], TKind extends string> = ExtractEvalName<
  FilterByKind<TEvals, TKind>
>;

/**
 * Checks if a kind has any evals.
 */
export type HasEvalsOfKind<TEvals extends readonly Eval[], TKind extends string> =
  FilterByKind<TEvals, TKind> extends never ? false : true;

/**
 * Extracts the typed verdict policy from an eval.
 */
export type ExtractVerdictPolicy<TEval> = TEval extends {
  kind: 'singleTurn' | 'multiTurn';
  metric: { valueType: infer VT };
}
  ? VT extends 'number' | 'ordinal'
    ? VerdictPolicyFor<number>
    : VT extends 'boolean'
      ? VerdictPolicyFor<boolean>
      : VerdictPolicyFor<string>
  : TEval extends { kind: 'scorer' }
    ? VerdictPolicyFor<number>
    : VerdictPolicyFor<MetricScalar>;

/**
 * Extracts the typed normalization context from an eval.
 */
export type ExtractNormalizationContext<TEval> = TEval extends {
  kind: 'singleTurn' | 'multiTurn';
  metric: { valueType: infer VT };
}
  ? VT extends 'number' | 'ordinal'
    ? NormalizationContextFor<number>
    : VT extends 'boolean'
      ? NormalizationContextFor<boolean>
      : NormalizationContextFor<string>
  : TEval extends { kind: 'scorer' }
    ? NormalizationContextFor<number>
    : NormalizationContextFor<MetricScalar>;

// ─────────────────────────────────────────────────────────────────────────────
// Mapped Result Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps single-turn evals to typed results, keyed by eval name.
 */
export type SingleTurnResults<TEvals extends readonly Eval[]> = {
  readonly [K in EvalNamesOfKind<TEvals, 'singleTurn'>]: SingleTurnEvalSeries<
    ExtractValueType<Extract<FilterByKind<TEvals, 'singleTurn'>, { name: K }>>
  >;
};

/**
 * Maps multi-turn evals to typed results, keyed by eval name.
 */
export type MultiTurnResults<TEvals extends readonly Eval[]> = {
  readonly [K in EvalNamesOfKind<TEvals, 'multiTurn'>]: ConversationEvalResult<
    ExtractValueType<Extract<FilterByKind<TEvals, 'multiTurn'>, { name: K }>>
  >;
};

/**
 * Maps scorer evals to typed results, keyed by eval name.
 */
export type ScorerResults<TEvals extends readonly Eval[]> = {
  readonly [K in EvalNamesOfKind<TEvals, 'scorer'>]:
    | { shape: 'scalar'; result: ConversationEvalResult<number> }
    | { shape: 'seriesByStepIndex'; series: SingleTurnEvalSeries<number> };
};

// ─────────────────────────────────────────────────────────────────────────────
// View Result Types (for TargetRunView)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Type-safe step results object for a single step.
 * Keys are literal eval names with autocomplete.
 *
 * - Single-turn evals: guaranteed to exist at step level
 * - Scorers: optional (only present if scorer produced seriesByStepIndex shape)
 *
 * @typeParam TEvals - The evals tuple for type-safe key inference
 */
export type StepResults<TEvals extends readonly Eval[]> = {
  readonly [K in EvalNamesOfKind<TEvals, 'singleTurn'>]: StepEvalResult<
    ExtractValueType<Extract<FilterByKind<TEvals, 'singleTurn'>, { name: K }>>
  >;
} & {
  readonly [K in EvalNamesOfKind<TEvals, 'scorer'>]?: StepEvalResult<number>;
};

/**
 * Step results with index, yielded by steps() generator.
 *
 * @typeParam TEvals - The evals tuple for type-safe key inference
 */
export type StepResultsWithIndex<TEvals extends readonly Eval[]> = StepResults<TEvals> & {
  readonly index: number;
};

/**
 * Type-safe conversation-level results.
 * Keys are literal eval names with autocomplete.
 *
 * - Multi-turn evals: guaranteed to exist at conversation level
 * - Scorers: optional (only present if scorer produced scalar shape)
 *
 * @typeParam TEvals - The evals tuple for type-safe key inference
 */
export type ConversationResults<TEvals extends readonly Eval[]> = {
  readonly [K in EvalNamesOfKind<TEvals, 'multiTurn'>]: ConversationEvalResult<
    ExtractValueType<Extract<FilterByKind<TEvals, 'multiTurn'>, { name: K }>>
  >;
} & {
  readonly [K in EvalNamesOfKind<TEvals, 'scorer'>]?: ConversationEvalResult<number>;
};

/**
 * Summary results keyed directly by eval name.
 * Flat structure without byEval wrapper for ergonomic access.
 *
 * @typeParam TEvals - The evals tuple for type-safe key inference
 */
export type SummaryResults<TEvals extends readonly Eval[]> = {
  readonly [K in ExtractEvalName<TEvals[number]>]: EvalSummary<
    Extract<TEvals[number], { name: K }>
  >;
};

// ─────────────────────────────────────────────────────────────────────────────
// Aggregations
// ─────────────────────────────────────────────────────────────────────────────

/** Aggregation result value */
export type AggregationValue = number | Record<string, number>;

/**
 * Extract aggregator names from a metric definition.
 */
export type ExtractAggregatorNames<TMetric> = TMetric extends {
  aggregators: readonly (infer A)[];
}
  ? A extends { readonly name: infer N extends string }
    ? N
    : never
  : never;

/**
 * Extract aggregator names from an eval (through its metric).
 */
export type ExtractEvalAggregatorNames<TEval> = TEval extends {
  kind: 'singleTurn' | 'multiTurn';
  metric: infer M;
}
  ? ExtractAggregatorNames<M>
  : TEval extends { kind: 'scorer' }
    ? DefaultNumericAggregatorNames
    : never;

/** Default numeric aggregator names */
export type DefaultNumericAggregatorNames = 'Mean' | 'P50' | 'P95';

/** Default boolean raw aggregator names */
export type DefaultBooleanAggregatorNames = 'TrueRate' | 'FalseRate';

/** Default categorical raw aggregator names */
export type DefaultCategoricalAggregatorNames = 'Distribution';

/**
 * Maps aggregator kind to result type.
 */
export type AggregationResultFor<TAgg> = TAgg extends CategoricalAggregatorDef<string>
  ? Record<string, number>
  : number;

/**
 * Typed score aggregations for an eval.
 * Score aggregations are always numeric.
 */
export type ScoreAggregations<TEval> = {
  readonly [K in ExtractEvalAggregatorNames<TEval> | DefaultNumericAggregatorNames]: number;
};

/**
 * Typed raw value aggregations for an eval.
 * Based on metric value type.
 */
export type RawAggregations<TEval> = TEval extends {
  kind: 'singleTurn' | 'multiTurn';
  metric: { valueType: infer VT };
}
  ? VT extends 'number' | 'ordinal'
    ? { readonly [K in DefaultNumericAggregatorNames]?: number }
    : VT extends 'boolean'
      ? { readonly [K in DefaultBooleanAggregatorNames]?: number }
      : { readonly [K in DefaultCategoricalAggregatorNames]?: Record<string, number> }
  : { readonly [key: string]: number | Record<string, number> };

// ─────────────────────────────────────────────────────────────────────────────
// Summaries
// ─────────────────────────────────────────────────────────────────────────────

/** Verdict summary statistics */
export interface VerdictSummary {
  passRate: Score;
  failRate: Score;
  unknownRate: Score;
  passCount: number;
  failCount: number;
  unknownCount: number;
  totalCount: number;
}

/**
 * Eval summary with typed aggregations.
 *
 * @typeParam TEval - The eval type
 */
export interface EvalSummary<TEval = Eval> {
  /** Eval name */
  eval: ExtractEvalName<TEval>;
  /** Eval kind */
  kind: ExtractEvalKind<TEval>;
  /** Number of data points */
  count: number;
  /** Typed aggregations */
  aggregations?: {
    /** Score aggregations (always numeric) */
    score: ScoreAggregations<TEval>;
    /** Raw value aggregations (typed based on metric value type) */
    raw?: RawAggregations<TEval>;
  };
  /** Verdict summary (pass/fail rates) */
  verdictSummary?: VerdictSummary;
}

/**
 * Typed summaries keyed by eval name.
 *
 * @typeParam TEvals - The evals tuple
 */
export interface Summaries<TEvals extends readonly Eval[] = readonly Eval[]> {
  byEval: {
    readonly [K in ExtractEvalName<TEvals[number]>]: EvalSummary<
      Extract<TEvals[number], { name: K }>
    >;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversation Result (Main Container)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Type-safe conversation result structure.
 *
 * Provides typed accessors for eval results based on the evals tuple.
 * Enables autocomplete and compile-time error detection.
 *
 * @typeParam TEvals - The evals tuple
 *
 * @example
 * ```typescript
 * const result: ConversationResult<typeof evals>;
 * result.singleTurn.relevance; // ✅ autocomplete works
 * result.singleTurn.typo;      // ❌ compile error
 * ```
 */
export interface ConversationResult<TEvals extends readonly Eval[] = readonly Eval[]> {
  /** Number of steps in the conversation */
  stepCount: number;
  /** Single-turn eval results keyed by eval name */
  singleTurn: SingleTurnResults<TEvals>;
  /** Multi-turn eval results keyed by eval name */
  multiTurn: MultiTurnResults<TEvals>;
  /** Scorer eval results keyed by eval name */
  scorers: ScorerResults<TEvals>;
  /** Optional eval summaries with aggregations */
  summaries?: Summaries<TEvals>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Definition Snapshots (for serialization)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serializable metric normalization snapshot.
 */
export type MetricNormalizationSnap = {
  normalizer: NormalizerSpecSnap;
  calibrate?: unknown | { note: 'not-serializable' };
};

/** Serializable metric definition snapshot */
export interface MetricDefSnap {
  name: MetricName;
  scope: 'single' | 'multi';
  valueType: 'number' | 'boolean' | 'string' | 'ordinal';
  description?: string;
  metadata?: Record<string, unknown>;

  llm?: {
    provider?: Record<string, unknown>;
    prompt?: { instruction: string; variables?: readonly string[] };
    rubric?: Record<string, unknown>;
  };

  aggregators?: Array<{
    kind: string;
    name: string;
    description?: string;
    config?: unknown;
  }>;

  normalization?: MetricNormalizationSnap;
}

/** Serializable eval definition snapshot */
export interface EvalDefSnap {
  name: EvalName;
  kind: 'singleTurn' | 'multiTurn' | 'scorer';
  outputShape: 'seriesByStepIndex' | 'scalar';
  metric: MetricName;
  scorerRef?: ScorerName;
  verdict?: VerdictPolicyInfo;
  description?: string;
  metadata?: Record<string, unknown>;
}

/** Scorer combine kind */
export type ScorerCombineKind = 'weightedAverage' | 'identity' | 'custom' | 'unknown';

/** Serializable scorer input snapshot */
export type ScorerInputSnap = Omit<ScorerInput, 'metric' | 'normalizerOverride'> & {
  metricRef: MetricName;
  hasNormalizerOverride?: boolean;
};

/** Serializable scorer definition snapshot */
export type ScorerDefSnap = Omit<Scorer, 'inputs' | 'output' | 'combineScores'> & {
  name: ScorerName;
  inputs: readonly ScorerInputSnap[];
  fallbackScore?: Score;
  combine?: { kind: ScorerCombineKind; note?: string };
};

/** Run definitions container */
export interface RunDefs {
  metrics: Record<MetricName, MetricDefSnap>;
  evals: Record<EvalName, EvalDefSnap>;
  scorers: Record<ScorerName, ScorerDefSnap>;
}
