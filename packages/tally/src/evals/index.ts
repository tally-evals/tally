/**
 * Eval API - User-Facing Exports
 *
 * Public API for defining evals with type-safe verdict policies
 */

export type {
  Eval,
  SingleTurnEval,
  MultiTurnEval,
  ScorerEval,
  VerdictPolicy,
  VerdictPolicyFor,
  AutoNormalizer,
  MetricValueType,
} from '../core/evals/types';

export {
  defineSingleTurnEval,
  defineMultiTurnEval,
  defineScorerEval,
} from '../core/primitives/eval';

export {
  runAllTargets,
  runSelectedSteps,
  runSelectedItems,
} from './context';

export {
  booleanVerdict,
  thresholdVerdict,
  rangeVerdict,
  ordinalVerdict,
  customVerdict,
} from '../verdicts/helpers';
