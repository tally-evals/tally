/**
 * Core Primitives
 *
 * Low-level building blocks for defining metrics, scorers, aggregators, and evals.
 * These are the foundation that prebuilt implementations are built on.
 */

// Metric primitives
export {
  defineBaseMetric,
  withNormalization,
  withMetadata,
  withMetric,
  defineSingleTurnCode,
  defineSingleTurnLLM,
  defineMultiTurnCode,
  defineMultiTurnLLM,
} from './metric';

// Scorer primitives
export { defineInput, defineScorer } from './scorer';

// Aggregator primitives
export {
  defineNumericAggregator,
  defineBooleanAggregator,
  defineCategoricalAggregator,
  type DefineNumericAggregatorArgs,
  type DefineBooleanAggregatorArgs,
  type DefineCategoricalAggregatorArgs,
} from './aggregator';

// Eval primitives
export {
  defineSingleTurnEval,
  defineMultiTurnEval,
  defineScorerEval,
} from './eval';
