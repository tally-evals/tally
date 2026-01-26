import type { TallyRunArtifact, VerdictPolicyInfo } from "@tally-evals/core";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stripInternalMetadata(metadata: unknown): Record<string, unknown> | undefined {
  if (!isRecord(metadata)) return undefined;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(metadata)) {
    // Hide internal keys by default.
    if (k.startsWith("__")) continue;
    out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

function jsonBlock(value: unknown): React.ReactNode {
  return (
    <pre className="code-block overflow-x-auto rounded bg-muted p-2 text-xs">
      {JSON.stringify(value ?? null, null, 2)}
    </pre>
  );
}

function formatAggValue(v: unknown): string {
  if (typeof v === "number") return v.toFixed(3);
  if (isRecord(v)) return JSON.stringify(v);
  if (v === undefined) return "—";
  return String(v);
}

function collectAggregationKeys(args: {
  score: Record<string, unknown> | undefined;
  raw: Record<string, unknown> | undefined;
}): string[] {
  const keys = new Set<string>();
  for (const k of Object.keys(args.score ?? {})) keys.add(k);
  for (const k of Object.keys(args.raw ?? {})) keys.add(k);
  return Array.from(keys).sort((a, b) => a.localeCompare(b));
}

function formatVerdictPolicy(policy: VerdictPolicyInfo): {
  ruleType: string;
  passAt?: string;
  note?: string;
} {
  if (!isRecord(policy) || typeof policy.kind !== "string") {
    return { ruleType: "—" };
  }

  if (policy.kind === "none") return { ruleType: "None" };

  if (policy.kind === "custom") {
    return {
      ruleType: "Custom",
      note: "Custom verdict functions are not serializable.",
    };
  }

  if (policy.kind === "boolean") {
    const passWhen = policy.passWhen;
    return {
      ruleType: "Boolean",
      passAt: typeof passWhen === "boolean" ? String(passWhen) : "—",
    };
  }

  if (policy.kind === "ordinal") {
    const passWhenIn = policy.passWhenIn;
    return {
      ruleType: "Ordinal",
      passAt: Array.isArray(passWhenIn) ? `[${passWhenIn.map(String).join(", ")}]` : "—",
    };
  }

  if (policy.kind === "number") {
    const type = policy.type;

    if (type === "threshold") {
      const passAt = policy.passAt;
      if (typeof passAt === "number") {
        return { ruleType: "Threshold", passAt: `≥ ${passAt}` };
      }
      return { ruleType: "Threshold", passAt: "—" };
    }

    if (type === "range") {
      const min = typeof policy.min === "number" ? policy.min : undefined;
      const max = typeof policy.max === "number" ? policy.max : undefined;

      if (min !== undefined && max !== undefined) {
        return {
          ruleType: "Range",
          passAt: `Between ${min}-${max}`,
        };
      }
      if (min !== undefined) {
        return { ruleType: "Range", passAt: `≥ ${min}` };
      }
      if (max !== undefined) {
        return { ruleType: "Range", passAt: `≤ ${max}` };
      }
      return { ruleType: "Range", passAt: "—" };
    }

    return { ruleType: "Number", passAt: "—" };
  }

  return { ruleType: "—" };
}

export function MetricSummaryPopover(props: {
  run: TallyRunArtifact;
  evalName: string;
  className?: string;
}): React.ReactElement {
  const { run, evalName } = props;

  const content = useMemo(() => {
    const evalDef = run.defs?.evals?.[evalName];
    const summary = run.result?.summaries?.byEval?.[evalName];
    const metricRef = evalDef?.metric;
    const metricDef = metricRef ? run.defs?.metrics?.[metricRef] : undefined;
    const scorerRef = evalDef?.scorerRef;
    const scorerDef = scorerRef ? run.defs?.scorers?.[scorerRef] : undefined;

    const scopedMetricMeta = stripInternalMetadata(metricDef?.metadata);
    const scopedEvalMeta = stripInternalMetadata(evalDef?.metadata);
    const scopedScorerMeta = stripInternalMetadata(scorerDef?.metadata);

    return {
      evalDef,
      summary,
      metricRef,
      metricDef,
      scorerRef,
      scorerDef,
      scopedMetricMeta,
      scopedEvalMeta,
      scopedScorerMeta,
    };
  }, [run, evalName]);

  const kind = content.evalDef?.kind ?? content.summary?.kind ?? "unknown";
  const outputShape = content.evalDef?.outputShape ?? "unknown";

  const verdictPolicy = content.evalDef?.verdict;
  const verdictSummary = content.summary?.verdictSummary;

  const showVerdict = verdictPolicy && verdictPolicy.kind !== "none";
  const scoreAggs = (content.summary?.aggregations?.score ?? undefined) as Record<string, unknown> | undefined;
  const rawAggs = (content.summary?.aggregations?.raw ?? undefined) as Record<string, unknown> | undefined;
  const aggKeys = collectAggregationKeys({ score: scoreAggs, raw: rawAggs });
  const isMultiTurn = kind === "multiTurn";
  const kindLabel =
    kind === "singleTurn"
      ? "Single Turn"
      : kind === "multiTurn"
        ? "Multi Turn"
        : kind === "scorer"
          ? "Scorer"
          : kind;

  const kindTagClass =
    kind === "singleTurn"
      ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
      : kind === "multiTurn"
        ? "bg-purple-500/10 text-purple-700 dark:text-purple-300"
        : kind === "scorer"
          ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "bg-muted text-muted-foreground";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-center rounded p-0.5 text-muted-foreground",
            "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            props.className,
          )}
          title="Show details"
          aria-label={`Show details for ${evalName}`}
          onClick={(e) => {
            // Prevent row-level interactions (e.g. selecting text) from triggering.
            e.stopPropagation();
          }}
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" sideOffset={8}>
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="font-semibold">{evalName}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <span className={["inline-flex items-center rounded px-2 py-0.5 text-xs font-medium", kindTagClass].join(" ")}>
                {kindLabel}
              </span>
              <span>·</span>
              <span className="font-mono">{outputShape}</span>
            </div>
            {content.evalDef?.description ? (
              <div className="text-xs text-muted-foreground">{content.evalDef.description}</div>
            ) : null}
          </div>

          {content.scorerRef ? (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-muted-foreground">Scorer</div>
              <div className="rounded-md border border-border bg-muted/20 p-2">
                <div className="text-xs">
                  <span className="text-muted-foreground">scorer:</span>{" "}
                  <span className="font-mono">{content.scorerRef}</span>
                </div>
                <div className="text-xs">
                  <span className="text-muted-foreground">combine:</span>{" "}
                  <span className="font-mono">
                    {content.scorerDef?.combine?.kind ?? "unknown"}
                  </span>
                </div>
                <div className="text-xs">
                  <span className="text-muted-foreground">normalizeWeights:</span>{" "}
                  <span className="font-mono">
                    {typeof content.scorerDef?.normalizeWeights === "boolean"
                      ? String(content.scorerDef.normalizeWeights)
                      : "—"}
                  </span>
                </div>
                {content.scorerDef?.description ? (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {content.scorerDef.description}
                  </div>
                ) : null}

                {Array.isArray(content.scorerDef?.inputs) && content.scorerDef.inputs.length ? (
                  <div className="mt-2">
                    <div className="text-xs font-semibold text-muted-foreground">Inputs</div>
                    <ul className="mt-1 space-y-1">
                      {content.scorerDef.inputs.map((i, idx) => (
                        <li key={idx} className="text-xs">
                          <span className="font-mono">{i.metricRef}</span>{" "}
                          <span className="text-muted-foreground">·</span>{" "}
                          <span className="text-muted-foreground">w</span>{" "}
                          <span className="font-mono">
                            {typeof i.weight === "number" ? i.weight : "—"}
                          </span>{" "}
                          <span className="text-muted-foreground">·</span>{" "}
                          <span className="text-muted-foreground">required</span>{" "}
                          <span className="font-mono">
                            {typeof i.required === "boolean" ? String(i.required) : "—"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-muted-foreground">Metric</div>
              <div className="rounded-md border border-border bg-muted/20 p-2">
                <div className="text-xs">
                  <span className="text-muted-foreground">Metric:</span>{" "}
                  <span className="font-mono">{content.metricRef ?? "—"}</span>
                </div>
                <div className="text-xs">
                  <span className="text-muted-foreground">Scope:</span>{" "}
                  <span className="font-mono">{content.metricDef?.scope ?? "—"}</span>
                </div>
                <div className="text-xs">
                  <span className="text-muted-foreground">Value type:</span>{" "}
                  <span className="font-mono">{content.metricDef?.valueType ?? "—"}</span>
                </div>
                {content.metricDef?.description ? (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {content.metricDef.description}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {showVerdict ? (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-muted-foreground">Verdict Policy</div>
              <div className="rounded-md border border-border bg-muted/20 p-2 text-xs">
                {(() => {
                  const formatted = formatVerdictPolicy(verdictPolicy);
                  return (
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-muted-foreground">Rule type</span>
                        <span className="font-mono">{formatted.ruleType}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-muted-foreground">Pass at</span>
                        <span className="font-mono">{formatted.passAt ?? "—"}</span>
                      </div>
                      {formatted.note ? (
                        <div className="text-muted-foreground">{formatted.note}</div>
                      ) : null}
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : null}

          <div className="space-y-1">
            <div className="text-xs font-semibold text-muted-foreground">Verdict Summary</div>
            <div className="rounded-md border border-border bg-muted/20 p-2 text-xs">
              {showVerdict && verdictSummary ? (
                <span className="font-mono">
                  <span className="text-muted-foreground">Pass</span>{" "}
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {verdictSummary.passCount}
                  </span>{" "}
                  <span className="text-muted-foreground">·</span>{" "}
                  <span className="text-muted-foreground">Fail</span>{" "}
                  <span className="text-red-600 dark:text-red-400">
                    {verdictSummary.failCount}
                  </span>{" "}
                  <span className="text-muted-foreground">·</span>{" "}
                  <span className="text-muted-foreground">Unknown</span>{" "}
                  <span className="text-muted-foreground">{verdictSummary.unknownCount}</span>{" "}
                  <span className="text-muted-foreground">·</span>{" "}
                  <span className="text-muted-foreground">Total</span>{" "}
                  <span className="text-foreground">{verdictSummary.totalCount}</span>{" "}
                  <span className="text-muted-foreground">·</span>{" "}
                  <span className="text-muted-foreground">Pass rate</span>{" "}
                  <span
                    className={[
                      verdictSummary.passRate >= 0.8
                        ? "text-emerald-600 dark:text-emerald-400"
                        : verdictSummary.passRate >= 0.6
                          ? "text-emerald-500 dark:text-emerald-300"
                          : verdictSummary.passRate >= 0.4
                            ? "text-yellow-600 dark:text-yellow-300"
                            : "text-red-600 dark:text-red-400",
                    ].join(" ")}
                  >
                    {verdictSummary.passRate.toFixed(3)}
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-semibold text-muted-foreground">
              {isMultiTurn ? "Summary" : "Statistical Summary"}
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-2 text-xs">
              {isMultiTurn ? (
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Raw Value</span>
                    <span className="font-mono">{formatAggValue(rawAggs?.value)}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Score Value</span>
                    <span className="font-mono">{formatAggValue(scoreAggs?.value)}</span>
                  </div>
                </div>
              ) : aggKeys.length ? (
                <div className="space-y-1">
                  {aggKeys.map((k) => (
                    <div key={k} className="flex items-start justify-between gap-3">
                      <span className="font-mono text-muted-foreground">{k}</span>
                      <span className="font-mono text-right">
                        <span className="text-muted-foreground">Raw</span>{" "}
                        {formatAggValue(rawAggs?.[k])}
                        <span className="text-muted-foreground"> · Score</span>{" "}
                        {formatAggValue(scoreAggs?.[k])}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          </div>

          <details className="rounded-md border border-border bg-background">
            <summary className="cursor-pointer list-none px-2 py-2 text-xs font-medium">
              Advanced (metadata)
            </summary>
            <div className="border-t border-border p-2 space-y-3">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-muted-foreground">Curated</div>
                {jsonBlock({
                  metric: content.scopedMetricMeta,
                  eval: content.scopedEvalMeta,
                  scorer: content.scopedScorerMeta,
                })}
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-muted-foreground">Raw</div>
                {jsonBlock({
                  metric: content.metricDef?.metadata,
                  eval: content.evalDef?.metadata,
                  scorer: content.scorerDef?.metadata,
                })}
              </div>
            </div>
          </details>
        </div>
      </PopoverContent>
    </Popover>
  );
}
