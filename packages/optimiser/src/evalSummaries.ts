import {
  type EvalSummary,
  type TallyRunArtifact,
  type VerdictSummary,
  toScore,
} from '@tally-evals/tally';
import type { EvalSummaries, EvaluationPolicy, ScopeIssue, ScopeOverview } from './types';

type ByEvalRow = {
  eval: string;
  kind: 'singleTurn' | 'multiTurn' | 'scorer';
  count: number;
  aggregations?: EvalSummary['aggregations'];
  verdictSummary?: VerdictSummary;
};
// Creates an empty overview object for a scope with no eval results.
const emptyOverview = <Name extends string>(): ScopeOverview<Name> => ({
  summary: '',
  issues: [],
  failingEvals: [],
  passingEvals: [],
});
// Creates an empty EvalSummaries object when there is no Tally evidence.
const emptyEvalSummaries = (): EvalSummaries => ({
  singleTurn: {},
  multiTurn: {},
  singleTurnOverview: emptyOverview(),
  multiTurnOverview: emptyOverview(),
});
// Converts one raw Tally byEval row into a normalized EvalSummary.
function toEvalSummary(row: ByEvalRow): EvalSummary {
  return {
    eval: row.eval,
    kind: row.kind,
    count: row.count,
    ...(row.aggregations ? { aggregations: row.aggregations } : {}),
    ...(row.verdictSummary ? { verdictSummary: row.verdictSummary } : {}),
  };
}
/** Whether a single eval is passing (no failing verdicts). Exported for stop / selection / failure analysis. */
export function evalSummaryIsPassing(summary: EvalSummary): boolean {
  const verdict = summary.verdictSummary;
  return verdict ? verdict.failCount === 0 : true;
}
function isPassing(summary: EvalSummary): boolean {
  return evalSummaryIsPassing(summary);
}
// Creates an issue object for a failing eval, including counts and pass rate.
function buildIssue<Name extends string>(name: Name, summary: EvalSummary): ScopeIssue<Name> {
  const verdict = summary.verdictSummary;

  return {
    eval: name,
    reason: verdict
      ? `${verdict.failCount} fail / ${verdict.totalCount} total`
      : 'no verdict summary',
    passRate: verdict ? Number(verdict.passRate) : 0,
    ...(verdict
      ? {
          passedCount: verdict.passCount,
          failedCount: verdict.failCount,
          totalCount: verdict.totalCount,
        }
      : {}),
  };
}
// Builds a readable overview for one scope, such as singleTurn or multiTurn.
function buildScopeOverview<Name extends string>(
  records: Record<string, EvalSummary>
): ScopeOverview<Name> {
  const entries = Object.entries(records) as [Name, EvalSummary][];

  const passingEvals = entries.filter(([, summary]) => isPassing(summary)).map(([name]) => name);

  const failingEntries = entries.filter(([, summary]) => !isPassing(summary));
  const failingEvals = failingEntries.map(([name]) => name);
  const issues = failingEntries.map(([name, summary]) => buildIssue(name, summary));

  const summary =
    entries.length === 0
      ? ''
      : failingEvals.length === 0
        ? `All ${entries.length} eval(s) in this scope are passing.`
        : `${failingEvals.length} of ${entries.length} eval(s) in this scope are failing: ${failingEvals.join(', ')}.`;

  return { summary, issues, failingEvals, passingEvals };
}

/** Map one `TallyRunArtifact` into `EvalSummaries` (single-turn vs multi-turn/scorer scopes). */
export function buildEvalSummariesFromArtifact(artifact: TallyRunArtifact): EvalSummaries {
  const byEval = artifact.result.summaries?.byEval;

  if (!byEval || Object.keys(byEval).length === 0) {
    return emptyEvalSummaries();
  }

  const entries = Object.entries(byEval) as [string, ByEvalRow][];

  const singleTurn: Record<string, EvalSummary> = {};
  const multiTurn: Record<string, EvalSummary> = {};

  for (const [name, row] of entries) {
    const summary = toEvalSummary(row);

    if (row.kind === 'singleTurn') {
      singleTurn[name] = summary;
    } else {
      multiTurn[name] = summary;
    }
  }

  return {
    singleTurn,
    multiTurn,
    singleTurnOverview: buildScopeOverview(singleTurn),
    multiTurnOverview: buildScopeOverview(multiTurn),
  };
}

/** Merge verdicts as pass/fail only; `unknownCount` stays 0 for the Tally shape. */
function mergeVerdicts(
  a: VerdictSummary | undefined,
  b: VerdictSummary | undefined
): VerdictSummary | undefined {
  if (!a && !b) {
    return undefined;
  }

  const passCount = (a?.passCount ?? 0) + (b?.passCount ?? 0);
  const failCount = (a?.failCount ?? 0) + (b?.failCount ?? 0);
  const totalCount = passCount + failCount;

  return {
    passCount,
    failCount,
    unknownCount: 0,
    totalCount,
    passRate: toScore(totalCount > 0 ? passCount / totalCount : 0),
    failRate: toScore(totalCount > 0 ? failCount / totalCount : 0),
    unknownRate: toScore(0),
  } as VerdictSummary;
}
// Merges two EvalSummary objects for the same eval.
function mergeEvalSummary(a: EvalSummary, b: EvalSummary): EvalSummary {
  const verdictSummary = mergeVerdicts(a.verdictSummary, b.verdictSummary);

  return {
    eval: a.eval,
    kind: a.kind,
    count: a.count + b.count,
    ...(a.aggregations ? { aggregations: a.aggregations } : {}),
    ...(verdictSummary ? { verdictSummary } : {}),
  };
}
// Merges a record of eval summaries into an accumulated record by eval name.
function mergeEvalRecords(
  acc: Record<string, EvalSummary>,
  next: Record<string, EvalSummary>
): Record<string, EvalSummary> {
  const out: Record<string, EvalSummary> = { ...acc };
  for (const [name, summary] of Object.entries(next)) {
    out[name] = out[name] ? mergeEvalSummary(out[name], summary) : { ...summary };
  }
  return out;
}

/**
 Pool per-run `EvalSummaries` into one aggregate EvalSummaries.
 */
export function poolEvalSummaries(pool: ReadonlyArray<EvalSummaries>): EvalSummaries {
  if (pool.length === 0) {
    return emptyEvalSummaries();
  }

  const singleTurn = pool.reduce(
    (acc, current) => mergeEvalRecords(acc, current.singleTurn),
    {} as Record<string, EvalSummary>
  );

  const multiTurn = pool.reduce(
    (acc, current) => mergeEvalRecords(acc, current.multiTurn),
    {} as Record<string, EvalSummary>
  );

  return {
    singleTurn,
    multiTurn,
    singleTurnOverview: buildScopeOverview(singleTurn),
    multiTurnOverview: buildScopeOverview(multiTurn),
  };
}

export function allEvalSummariesList(evalSummaries: EvalSummaries): EvalSummary[] {
  return [...Object.values(evalSummaries.singleTurn), ...Object.values(evalSummaries.multiTurn)];
}
// Derives the pass rate from one EvalSummary using its verdict counts.
function passRate(summary: EvalSummary): number | undefined {
  const verdict = summary.verdictSummary;

  if (!verdict || verdict.totalCount === 0) {
    return undefined;
  }

  return verdict.passCount / verdict.totalCount;
}
// Computes the fallback unweighted mean pass rate across all evals.
function meanPassRateAllEvals(evalSummaries: EvalSummaries): number {
  const rates = allEvalSummariesList(evalSummaries)
    .map(passRate)
    .filter((rate): rate is number => rate !== undefined);

  return rates.length === 0 ? 0 : rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
}

/**
 * Weighted aggregate pass rate from `evalWeights`; falls back to an unweighted mean when no weights apply.
 */
export function computeAggregatedPassRate(
  evalSummaries: EvalSummaries,
  evaluationPolicy: EvaluationPolicy
): number {
  const weightedRates = Object.entries(evaluationPolicy.evalWeights)
    .map(([name, weight]) => {
      const summary = evalSummaries.singleTurn[name] ?? evalSummaries.multiTurn[name];
      const rate = summary ? passRate(summary) : undefined;

      return { weight, rate };
    })
    .filter(
      (item): item is { weight: number; rate: number } =>
        Number.isFinite(item.weight) && item.weight > 0 && item.rate !== undefined
    );

  if (weightedRates.length === 0) {
    return meanPassRateAllEvals(evalSummaries);
  }

  const numerator = weightedRates.reduce((sum, item) => sum + item.weight * item.rate, 0);
  const denominator = weightedRates.reduce((sum, item) => sum + item.weight, 0);

  return numerator / denominator;
}
