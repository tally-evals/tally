/**
 * Evaluation Report Type Definitions
 *
 * Types for evaluation results and reports.
 */

import type {
  MetricScalar,
  Score,
  Metric,
  BaseMetricDef,
} from './metrics';

// ============================================================================
// Verdict Types
// ============================================================================

/**
 * Per-target verdict (pass/fail result)
 */
export interface TargetVerdict {
  verdict: 'pass' | 'fail' | 'unknown';
  score: Score; // Normalized score used for verdict
  rawValue?: MetricScalar; // Original raw value (if available)
}

// ============================================================================
// Per-Target Result Types
// ============================================================================

/**
 * Per-target result
 * Contains raw and derived metrics for a single data point
 */
export interface PerTargetResult {
  targetId: string;
  rawMetrics: Metric[]; // each Metric carries its defining MetricDef
  derivedMetrics: Array<{
    definition: BaseMetricDef<number>;
    value: Score;
  }>;
  // Verdicts per eval
  verdicts: Map<string, TargetVerdict>; // key: eval name
}

// ============================================================================
// Aggregation Types
// ============================================================================

/**
 * Statistical aggregations computed from metric-level aggregators
 * Each aggregator name maps to its computed value
 *
 * - Numeric aggregators (Mean, Percentile, etc.): return number
 * - Categorical aggregators (Distribution): return Record<string, number>
 *
 * ⚠️ This contains ONLY statistical aggregations.
 * Pass/fail rates come from VerdictSummary (separate concept).
 */
export interface Aggregations {
  [aggregatorName: string]: number | Record<string, number>;
}

/**
 * Verdict summary computed from eval's verdict policy
 *
 * This is SEPARATE from statistical aggregations (Aggregations type).
 * - Aggregations: Statistical summaries (Mean, Percentile, etc.)
 * - VerdictSummary: Pass/fail rates from verdict policies
 */
export interface VerdictSummary {
  passRate: Score;
  failRate: Score;
  unknownRate?: Score;
  passCount: number;
  failCount: number;
  unknownCount?: number;
  totalCount: number;
}

/**
 * Aggregate summary
 * Statistical summary of a derived metric across all targets
 */
export interface AggregateSummary {
  metric: BaseMetricDef<number>;
  aggregations: {
    score: Aggregations;
    raw?: Aggregations;
  }; // Always present
  count: number;
  // Legacy field removed - use aggregations.mean instead
  average?: Score; // Deprecated: use aggregations.mean
  percentile?: Record<number, number>; // Deprecated: use aggregations.percentiles
}

/**
 * Eval-level summary in report
 */
export interface EvalSummary {
  evalName: string;
  evalKind: 'singleTurn' | 'multiTurn' | 'scorer';
  /** Statistical aggregations from metric.aggregators */
  aggregations: {
    score: Aggregations;
    raw?: Aggregations;
  };
  /** Verdict summary from eval.verdict policy (SEPARATE from aggregations) */
  verdictSummary?: VerdictSummary;
}

// ============================================================================
// Evaluation Report
// ============================================================================

/**
 * Evaluation report
 * Final output containing per-target results and aggregate summaries
 */
export interface EvaluationReport {
  runId: string;
  timestamp: Date;
  perTargetResults: PerTargetResult[];
  aggregateSummaries: AggregateSummary[];
  /** Eval-level summaries (one per eval) */
  evalSummaries: Map<string, EvalSummary>;
  /** Mapping from source metric names to eval names for verdict lookup */
  metricToEvalMap?: Map<string, string>;
  metadata: Record<string, unknown>;
}
