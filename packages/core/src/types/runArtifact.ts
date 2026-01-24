/**
 * Tally Run Artifact Types
 *
 * Canonical stored run shape for read-only tooling (TUI / viewer) and a stable
 * schema for SDK outputs.
 *
 * This is a serialization wrapper around the core result types from results.ts.
 * It adds storage metadata and uses string-keyed defaults for JSON compatibility.
 */

import type {
  ConversationResult,
  RunDefs,
  RunId,
  ConversationId,
} from './results';

// ─────────────────────────────────────────────────────────────────────────────
// Re-export core result types for convenience
// ─────────────────────────────────────────────────────────────────────────────

export type {
  // Primitives
  MetricName,
  EvalName,
  ScorerName,
  RunId,
  ConversationId,
  Verdict,
  MetricScalarOrNull,

  // Normalization
  NormalizerSpecSnap,
  NormalizationInfo,
  MetricNormalizationSnap,

  // Verdict
  VerdictPolicyInfo,

  // Measurement & Outcome
  Measurement,
  EvalOutcome,

  // Result records
  StepEvalResult,
  SingleTurnEvalSeries,
  ConversationEvalResult,
  ConversationResult,

  // Type utilities
  ExtractEvalName,
  ExtractValueType,
  ExtractEvalKind,
  FilterByKind,
  EvalNamesOfKind,
  HasEvalsOfKind,
  ExtractVerdictPolicy,
  ExtractNormalizationContext,

  // Mapped results
  SingleTurnResults,
  MultiTurnResults,
  ScorerResults,

  // Aggregations
  AggregationValue,
  ExtractAggregatorNames,
  ExtractEvalAggregatorNames,
  DefaultNumericAggregatorNames,
  DefaultBooleanAggregatorNames,
  DefaultCategoricalAggregatorNames,
  AggregationResultFor,
  ScoreAggregations,
  RawAggregations,

  // Summaries
  VerdictSummary,
  EvalSummary,
  Summaries,

  // Definition snapshots
  MetricDefSnap,
  EvalDefSnap,
  ScorerCombineKind,
  ScorerInputSnap,
  ScorerDefSnap,
  RunDefs,
} from './results';

// ─────────────────────────────────────────────────────────────────────────────
// Stored Artifact
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stored run artifact for serialization.
 *
 * Uses default (untyped) ConversationResult for JSON compatibility.
 * Type safety is restored when loading via TallyRunReport with evals param.
 */
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
  result: ConversationResult; // Uses default type params (untyped)

  metadata?: Record<string, unknown>;
}
