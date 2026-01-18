/**
 * Tally Run Artifact Types
 *
 * Canonical stored run shape for read-only tooling (TUI / viewer) and a stable
 * schema for SDK outputs.
 *
 * This intentionally avoids Maps in persisted fields: everything is object-keyed.
 */

import type { MetricScalar, Score } from './primitives';

// ============================================================================
// Common primitives
// ============================================================================

export type MetricName = string; // MetricDef.name
export type EvalName = string; // Eval.name
export type RunId = string;
export type ConversationId = string;

export type Verdict = 'pass' | 'fail' | 'unknown';

/**
 * NOTE: Historically some raw values have been stored as `null` (e.g. verdict rawValue),
 * so the artifact permits null for rawValue even though MetricScalar excludes it.
 */
export type MetricScalarOrNull = MetricScalar | null;

// ============================================================================
// Measurement vs Outcome
// ============================================================================

/**
 * Measurement = what we measured (metric/scorer output) + debug metadata.
 * No policy semantics live here.
 */
export interface Measurement {
  /**
   * Normalized score (0..1) used for aggregation/curves when applicable.
   * Optional because some evaluators may only yield raw values or ordinal labels.
   */
  score?: Score;

  /** Original value (number/boolean/string) when available */
  rawValue?: MetricScalarOrNull;

  /** Optional LLM fields */
  confidence?: number;
  reasoning?: string;

  /** Execution metadata */
  executionTimeMs?: number;
  timestamp?: string; // ISO

  /** Arbitrary additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Serializable policy info for explaining a verdict in UI/TUI/tests.
 * (Custom verdict functions are not serializable.)
 */
export type VerdictPolicyInfo =
  | { kind: 'none' }
  | { kind: 'boolean'; passWhen: boolean }
  | { kind: 'number'; type: 'threshold'; passAt: number; inclusive?: true }
  | { kind: 'number'; type: 'range'; min?: number; max?: number; inclusive?: true }
  | { kind: 'ordinal'; passWhenIn: readonly string[] }
  | { kind: 'custom'; note: 'not-serializable' };

/**
 * EvalOutcome = verdict computed from policy + measurement.
 * Only pass/fail/unknown semantics live here.
 */
export interface EvalOutcome {
  verdict: Verdict;
  policy: VerdictPolicyInfo;
  /**
   * Optional copy of observed values used for the decision.
   * Keep optional to avoid duplication.
   */
  observed?: { rawValue?: MetricScalarOrNull; score?: Score };
}

// ============================================================================
// Result records (compact; refs are names)
// ============================================================================

export interface StepEvalResult {
  eval: EvalName;
  measurement: Measurement;
  outcome?: EvalOutcome;
}

export interface ConversationEvalResult {
  eval: EvalName;
  measurement: Measurement;
  outcome?: EvalOutcome;
}

export interface SingleTurnEvalSeries {
  /** Array index == stepIndex; null means “not evaluated / not selected” */
  byStepIndex: Array<StepEvalResult | null>;
}

export interface ConversationResult {
  stepCount: number;

  singleTurn: Record<EvalName, SingleTurnEvalSeries>;
  multiTurn: Record<EvalName, ConversationEvalResult>;

  /** scorers can be per-step or scalar; make it explicit */
  scorers: Record<
    EvalName,
    | { shape: 'seriesByStepIndex'; series: SingleTurnEvalSeries }
    | { shape: 'scalar'; result: ConversationEvalResult }
  >;

  /** Optional eval summaries keyed by eval name */
  summaries?: Summaries;
}

// ============================================================================
// Deduped definitions (`defs`)
// ============================================================================

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

  normalization?: unknown;
}

export interface EvalDefSnap {
  name: EvalName;
  kind: 'singleTurn' | 'multiTurn' | 'scorer';

  /**
   * Storage shape:
   * - singleTurn: series-by-stepIndex
   * - multiTurn: scalar
   * - scorer: either series or scalar, explicitly declared
   */
  outputShape: 'seriesByStepIndex' | 'scalar';

  /** which metric this eval is about */
  metric: MetricName;

  /** scorer-specific config */
  scorer?: {
    name: string;
    inputs: readonly MetricName[];
    weights?: readonly number[];
  };

  verdict?: VerdictPolicyInfo;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface RunDefs {
  metrics: Record<MetricName, MetricDefSnap>;
  evals: Record<EvalName, EvalDefSnap>;
}

// ============================================================================
// Summaries
// ============================================================================

export type AggregationValue = number | Record<string, number>;
export interface Aggregations {
  [name: string]: AggregationValue;
}

export interface VerdictSummary {
  passRate: Score;
  failRate: Score;
  unknownRate: Score;
  passCount: number;
  failCount: number;
  unknownCount: number;
  totalCount: number;
}

export interface EvalSummarySnap {
  eval: EvalName;
  kind: 'singleTurn' | 'multiTurn' | 'scorer';
  count: number;
  aggregations?: { score: Aggregations; raw?: Aggregations };
  verdictSummary?: VerdictSummary;
}

export interface Summaries {
  byEval: Record<EvalName, EvalSummarySnap>;
}

// ============================================================================
// Stored artifact (tally)
// ============================================================================

export interface TallyRunArtifact {
  schemaVersion: 1;
  runId: RunId;
  createdAt: string; // ISO

  store?: { backend: 'local' | 's2' | 'redis'; basePath: string };
  artifacts?: {
    conversationId: ConversationId;
    runPath?: string;
    conversationJsonlPath?: string;
    stepTracesPath?: string;
  };

  defs: RunDefs;
  result: ConversationResult;

  metadata?: Record<string, unknown>;
}

