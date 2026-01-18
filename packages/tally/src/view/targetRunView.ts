import type {
  TallyRunArtifact,
  StepEvalResult,
  TargetRunView,
} from '@tally/core/types';

export function createTargetRunView(artifact: TallyRunArtifact): TargetRunView {
  return {
    stepCount: () => artifact.result.stepCount,

    step: (stepIndex, evalName) => {
      const stepRes = artifact.result.singleTurn?.[evalName]?.byStepIndex?.[stepIndex] ?? null;
      if (!stepRes) return undefined;
      return stepRes as StepEvalResult;
    },

    conversation: (evalName) => {
      const multi = artifact.result.multiTurn?.[evalName];
      if (multi) return multi;
      const scorer = artifact.result.scorers?.[evalName];
      if (scorer && scorer.shape === 'scalar') return scorer.result;
      return undefined;
    },

    stepVerdict: (stepIndex, evalName) => {
      const s = artifact.result.singleTurn?.[evalName]?.byStepIndex?.[stepIndex] ?? null;
      return s?.outcome?.verdict;
    },

    conversationVerdict: (evalName) => {
      const multi = artifact.result.multiTurn?.[evalName];
      if (multi?.outcome?.verdict) return multi.outcome.verdict;
      const scorer = artifact.result.scorers?.[evalName];
      if (scorer && scorer.shape === 'scalar') return scorer.result.outcome?.verdict;
      return undefined;
    },

    evalDef: (evalName) => artifact.defs.evals?.[evalName],

    metricDefForEval: (evalName) => {
      const ed = artifact.defs.evals?.[evalName];
      if (!ed) return undefined;
      return artifact.defs.metrics?.[ed.metric];
    },
  };
}

