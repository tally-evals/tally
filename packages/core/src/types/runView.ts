import type {
  ConversationEvalResult,
  EvalDefSnap,
  MetricDefSnap,
  StepEvalResult,
  Verdict,
} from './runArtifact';

/**
 * Developer-facing view for reading verdicts/measurements from a single run.
 *
 * This is intentionally:
 * - name-keyed (names are IDs)
 * - stepIndex-addressable for single-turn evals
 * - uniform for multi-turn + scalar scorers via `conversation(...)`
 */
export interface TargetRunView {
  stepCount(): number;

  step(stepIndex: number, evalName: string): StepEvalResult | undefined;
  conversation(evalName: string): ConversationEvalResult | undefined;

  stepVerdict(stepIndex: number, evalName: string): Verdict | undefined;
  conversationVerdict(evalName: string): Verdict | undefined;

  evalDef(evalName: string): EvalDefSnap | undefined;
  metricDefForEval(evalName: string): MetricDefSnap | undefined;
}

