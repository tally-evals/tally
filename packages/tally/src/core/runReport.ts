import type { TallyRunArtifact, TallyRunReport } from '@tally/core/types';
import { createTargetRunView } from '../view/targetRunView';

export function createTallyRunReport(artifact: TallyRunArtifact): TallyRunReport {
  return {
    runId: artifact.runId,
    createdAt: new Date(artifact.createdAt),
    defs: artifact.defs,
    result: artifact.result,
    ...(artifact.metadata ? { metadata: artifact.metadata } : {}),
    view: () => createTargetRunView(artifact),
    toArtifact: () => artifact,
  };
}

