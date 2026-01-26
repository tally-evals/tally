import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { CheckIcon,
ChevronDownIcon,
ChevronLeft, 
CopyIcon} from "lucide-react";
import type { TallyRunArtifact } from "@tally-evals/core";
import { MetricSummaryPopover } from "../components/MetricSummaryPopover";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "../components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "../components/ai-elements/message";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "../components/ai-elements/tool";

interface RunViewProps {
  convId: string;
  runId: string;
}

type ModelMessage = Record<string, unknown> & { role: string; content: unknown };

type ConversationStep = {
  stepIndex: number;
  input: ModelMessage;
  output: ModelMessage[];
  timestamp?: string;
};

type ConversationData = {
  id: string;
  steps: ConversationStep[];
};

type RunData = TallyRunArtifact;

function getProperty(obj: unknown, key: string): unknown {
  if (obj && typeof obj === "object" && key in obj) return (obj as Record<string, unknown>)[key];
  return undefined;
}

type UIMessagePart =
  | { type: "text"; text: string }
  | { type: "tool"; toolCallId: string; toolName: string; input: unknown; output?: unknown };

type UIMessage = { id: string; role: string; parts: UIMessagePart[] };

function extractToolOutputFromWrapper(outputWrapper: unknown): unknown {
  if (!outputWrapper || typeof outputWrapper !== "object") return outputWrapper;
  const outType = getProperty(outputWrapper, "type");
  const outValue = getProperty(outputWrapper, "value");
  if (outType === "json") return outValue;
  if (outType === "text") return typeof outValue === "string" ? outValue : String(outValue);
  if (outValue !== undefined) return outValue;
  return outputWrapper;
}

function buildAgentPartsFromMessages(messages: ModelMessage[]): UIMessagePart[] {
  // Preserve strict order and merge tool-call + tool-result by toolCallId
  const parts: UIMessagePart[] = [];
  const toolIndexById = new Map<string, number>();

  const pushText = (text: string) => {
    if (text.trim().length === 0) return;
    parts.push({ type: "text", text });
  };

  const ensureTool = (args: { toolCallId: string; toolName: string; input?: unknown; output?: unknown }) => {
    const existingIdx = toolIndexById.get(args.toolCallId);
    if (existingIdx !== undefined) {
      const existing = parts[existingIdx];
      if (existing && existing.type === "tool") {
        if (args.input !== undefined && JSON.stringify(existing.input) === "{}") existing.input = args.input;
        if (args.output !== undefined) existing.output = args.output;
      }
      return;
    }
    const idx = parts.length;
    parts.push({
      type: "tool",
      toolCallId: args.toolCallId,
      toolName: args.toolName,
      input: args.input ?? {},
      ...(args.output !== undefined ? { output: args.output } : {}),
    });
    toolIndexById.set(args.toolCallId, idx);
  };

  for (const msg of messages) {
    const content = msg.content;
    if (typeof content === "string") {
      pushText(content);
      continue;
    }
    if (!Array.isArray(content)) {
      if (content !== undefined) pushText(JSON.stringify(content, null, 2));
      continue;
    }

    for (const part of content as any[]) {
      if (!part || typeof part !== "object") continue;
      const type = part.type;
      if (type === "text" && typeof part.text === "string") {
        pushText(part.text);
        continue;
      }
      if (type === "tool-call") {
        if (typeof part.toolCallId === "string" && typeof part.toolName === "string") {
          ensureTool({ toolCallId: part.toolCallId, toolName: part.toolName, input: part.input ?? part.args ?? {} });
        }
        continue;
      }
      if (type === "tool-result") {
        if (typeof part.toolCallId === "string" && typeof part.toolName === "string") {
          const output = extractToolOutputFromWrapper(part.output ?? part.result);
          ensureTool({ toolCallId: part.toolCallId, toolName: part.toolName, output });
        }
        continue;
      }
    }
  }

  return parts;
}

function buildStepUIMessages(step: ConversationStep): UIMessage[] {
  const msgs: UIMessage[] = [];

  msgs.push({
    id: `step-${step.stepIndex}-user`,
    role: step.input.role,
    parts:
      typeof step.input.content === "string"
        ? [{ type: "text", text: step.input.content }]
        : [{ type: "text", text: JSON.stringify(step.input.content, null, 2) }],
  });

  const agentParts = buildAgentPartsFromMessages([...step.output]);
  if (agentParts.length) {
    msgs.push({
      id: `step-${step.stepIndex}-agent`,
      role: "assistant",
      parts: agentParts,
    });
  }

  return msgs;
}

type StepEvalRow = {
  evalName: string;
  metricName?: string;
  verdict: string;
  score?: number;
  rawValue?: unknown;
  confidence?: number;
  timeMs?: number;
  reasoning?: string;
};

export function RunView({ convId, runId }: RunViewProps) {
  const [run, setRun] = useState<RunData | null>(null);
  const [conversation, setConversation] = useState<ConversationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rawRunCopied, setRawRunCopied] = useState(false);
  const copyRawRun = async () => {
    await navigator.clipboard.writeText(JSON.stringify(run, null, 2));
    setRawRunCopied(true);
    setTimeout(() => setRawRunCopied(false), 2000);
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/conversations/${convId}/runs/${runId}`).then((r) => r.json()),
      fetch(`/api/conversations/${convId}`).then((r) => r.json()),
    ])
      .then(([runData, convData]) => {
        setRun(runData);
        setConversation(convData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [convId, runId]);

  // IMPORTANT: Hooks must run unconditionally on every render (avoid hook-order errors).
  const steps = conversation?.steps ?? [];
  const singleTurn = run?.result?.singleTurn ?? {};
  const scorerResults = run?.result?.scorers ?? {};

  const perStepEvals: StepEvalRow[][] = useMemo(() => {
    const byStep: StepEvalRow[][] = Array.from({ length: steps.length }, () => []);

    const pushStepRow = (args: {
      evalName: string;
      measurement: {
        metricRef?: unknown;
        score?: unknown;
        rawValue?: unknown;
        confidence?: unknown;
        executionTimeMs?: unknown;
        reasoning?: unknown;
      };
      outcome?: { verdict?: unknown };
      stepIndex: number;
    }) => {
      const metricName =
        typeof args.measurement.metricRef === "string"
          ? args.measurement.metricRef
          : run?.defs?.evals?.[args.evalName]?.metric;

      byStep[args.stepIndex]?.push({
        evalName: args.evalName,
        ...(metricName ? { metricName } : {}),
        verdict: typeof args.outcome?.verdict === "string" ? args.outcome.verdict : "unknown",
        ...(typeof args.measurement.score === "number" ? { score: args.measurement.score } : {}),
        ...(args.measurement.rawValue !== undefined ? { rawValue: args.measurement.rawValue } : {}),
        ...(typeof args.measurement.confidence === "number"
          ? { confidence: args.measurement.confidence }
          : {}),
        ...(typeof args.measurement.executionTimeMs === "number"
          ? { timeMs: args.measurement.executionTimeMs }
          : {}),
        ...(typeof args.measurement.reasoning === "string"
          ? { reasoning: args.measurement.reasoning }
          : {}),
      });
    };

    for (const [evalName, series] of Object.entries(singleTurn)) {
      const arr = series?.byStepIndex ?? [];
      for (let stepIndex = 0; stepIndex < Math.min(arr.length, steps.length); stepIndex++) {
        const r = arr[stepIndex];
        if (!r) continue;
        pushStepRow({
          evalName,
          measurement: r.measurement ?? {},
          outcome: r.outcome,
          stepIndex,
        });
      }
    }

    // Include scorers that produce per-step series (shape: seriesByStepIndex)
    for (const [evalName, s] of Object.entries(scorerResults)) {
      if (!s || typeof s !== "object") continue;
      if (!("shape" in s) || (s as any).shape !== "seriesByStepIndex") continue;
      const arr = (s as any).series?.byStepIndex ?? [];
      for (let stepIndex = 0; stepIndex < Math.min(arr.length, steps.length); stepIndex++) {
        const r = arr[stepIndex];
        if (!r) continue;
        pushStepRow({
          evalName,
          measurement: r.measurement ?? {},
          outcome: r.outcome,
          stepIndex,
        });
      }
    }

    for (const rows of byStep) rows.sort((a, b) => a.evalName.localeCompare(b.evalName));
    return byStep;
  }, [singleTurn, scorerResults, steps.length, run?.defs?.evals]);

  const conversationEvalSummary = useMemo(() => {
    let passCount = 0;
    let failCount = 0;
    for (const stepRows of perStepEvals) {
      for (const r of stepRows) {
        if (r.verdict === "pass") passCount++;
        else if (r.verdict === "fail") failCount++;
      }
    }
    return {
      steps: steps.length,
      passCount,
      failCount,
    };
  }, [perStepEvals, steps.length]);

  const evalSummariesEntries = useMemo(() => {
    const summaries = run?.result?.summaries?.byEval ?? {};
    return Object.entries(summaries);
  }, [run?.result?.summaries?.byEval]);

  const endOfConversationEvals = useMemo(() => {
    // Include singleTurn, multiTurn, and scorer summaries in the table.
    return evalSummariesEntries;
  }, [evalSummariesEntries]);

  const evalSummaryRows = useMemo(() => {
    const rows = endOfConversationEvals.map(([name, ev]) => {
      const evalName = ev.eval ?? name;
      const kind = ev.kind ?? "unknown";
      const scoreAggs = ev.aggregations?.score ?? {};
      const rawAggs = ev.aggregations?.raw ?? {};

      const getAgg = (
        aggs: Record<string, unknown>,
        key: string,
      ): number | undefined => {
        const candidates: string[] = [key];
        const lower = key.toLowerCase();
        const upper = key.toUpperCase();
        candidates.push(lower, upper);
        if (lower === "mean") candidates.push("Mean");
        if (/^p\d+$/.test(lower)) candidates.push(`P${lower.slice(1)}`);

        for (const k of candidates) {
          const v = aggs[k];
          if (typeof v === "number") return v;
        }
        return undefined;
      };

      // For multi-turn we store a scalar under `value` (not Mean/Pxx).
      const scoreMeanOrValue =
        getAgg(scoreAggs as Record<string, unknown>, "mean") ??
        getAgg(scoreAggs as Record<string, unknown>, "value");
      const rawMeanOrValue =
        getAgg(rawAggs as Record<string, unknown>, "mean") ??
        getAgg(rawAggs as Record<string, unknown>, "value");

      const scoreP50 = getAgg(scoreAggs as Record<string, unknown>, "p50");
      const scoreP75 = getAgg(scoreAggs as Record<string, unknown>, "p75");
      const scoreP90 = getAgg(scoreAggs as Record<string, unknown>, "p90");

      const rawP50 = getAgg(rawAggs as Record<string, unknown>, "p50");
      const rawP75 = getAgg(rawAggs as Record<string, unknown>, "p75");
      const rawP90 = getAgg(rawAggs as Record<string, unknown>, "p90");

      const passRate =
        ev.verdictSummary && typeof ev.verdictSummary === "object"
          ? (ev.verdictSummary as any).passRate
          : undefined;

      const scorerRef = kind === "scorer" ? run?.defs?.evals?.[evalName]?.scorerRef : undefined;
      const calcKind = scorerRef ? run?.defs?.scorers?.[scorerRef]?.combine?.kind : undefined;

      return {
        evalName,
        kind,
        // score + raw for TUI-like cells
        scoreMeanOrValue,
        rawMeanOrValue,
        scoreP50,
        rawP50,
        scoreP75,
        rawP75,
        scoreP90,
        rawP90,
        passRate,
        ...(calcKind ? { calcKind } : {}),
      };
    });

    return rows;
  }, [endOfConversationEvals, run?.defs]);

  const getHeatClass = (score01: number | undefined): string => {
    if (typeof score01 !== "number") return "text-muted-foreground";
    if (score01 >= 0.8) return "text-emerald-600 dark:text-emerald-400";
    if (score01 >= 0.6) return "text-emerald-500 dark:text-emerald-300";
    if (score01 >= 0.4) return "text-yellow-600 dark:text-yellow-300";
    return "text-red-600 dark:text-red-400";
  };

  const renderKindTag = (kind: string): React.ReactNode => {
    const label =
      kind === "singleTurn"
        ? "Single Turn"
        : kind === "multiTurn"
          ? "Multi Turn"
          : kind === "scorer"
            ? "Scorer"
            : kind;
    const base = "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium";
    const cls =
      kind === "singleTurn"
        ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
        : kind === "multiTurn"
          ? "bg-purple-500/10 text-purple-700 dark:text-purple-300"
          : kind === "scorer"
            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
            : "bg-muted text-muted-foreground";
    return <span className={[base, cls].join(" ")}>{label}</span>;
  };

  const formatDualCell = (args: {
    raw: number | undefined;
    score: number | undefined;
  }): React.ReactNode => {
    const rawText = typeof args.raw === "number" ? args.raw.toFixed(3) : "—";
    const scoreText = typeof args.score === "number" ? args.score.toFixed(3) : "—";
    return (
      <div className="leading-tight">
        <div className={["font-mono text-xs", getHeatClass(args.score)].join(" ")}>
          {rawText}
        </div>
        <div className="font-mono text-[11px] text-muted-foreground">{scoreText}</div>
      </div>
    );
  };

  const formatRateCell = (rate01: number | undefined): React.ReactNode => {
    if (typeof rate01 !== "number") return "—";
    return (
      <span className={["font-mono text-xs", getHeatClass(rate01)].join(" ")}>
        {rate01.toFixed(3)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Loading run...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-destructive">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <a href="#/" className="hover:text-foreground transition-colors">
          Conversations
        </a>
        <span>/</span>
        <a href={`#/conversations/${convId}`} className="hover:text-foreground transition-colors">
          {convId}
        </a>
        <span>/</span>
        <span className="text-foreground font-medium">{runId}</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4">
        <a
          href={`#/conversations/${convId}`}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </a>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Run</h1>
          <div className="text-sm text-muted-foreground">{runId}</div>
        </div>
      </div>

      {/* Conversation thread */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-lg">Conversation</CardTitle>
            <div className="text-xs">
              <span className="text-muted-foreground">Steps</span>{" "}
              <span className="font-mono text-foreground">{conversationEvalSummary.steps}</span>{" "}
              <span className="text-muted-foreground">·</span>{" "}
              <span className="text-muted-foreground">Pass</span>{" "}
              <span className="font-mono text-emerald-600 dark:text-emerald-400">
                {conversationEvalSummary.passCount}
              </span>{" "}
              <span className="text-muted-foreground">·</span>{" "}
              <span className="text-muted-foreground">Fail</span>{" "}
              <span className="font-mono text-red-600 dark:text-red-400">
                {conversationEvalSummary.failCount}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="h-[700px] min-h-0">
          {steps.length === 0 ? (
            <ConversationEmptyState
              title="No conversation steps"
              description="This run has no conversation steps available."
            />
          ) : (
            <div className="relative h-full min-h-0 rounded-lg border border-border">
              <Conversation className="h-full">
                <ConversationContent className="p-4">
                  {steps.map((step) => {
                    const uiMessages = buildStepUIMessages(step);
                    const stepMetrics = perStepEvals[step.stepIndex] ?? [];
                    return (
                      <div key={step.stepIndex} className="space-y-3">
                        {uiMessages.map((message) => (
                          <Message from={message.role} key={message.id}>
                            <MessageContent>
                              {message.parts.map((part, i) => {
                                switch (part.type) {
                                  case "text":
                                    return (
                                      <MessageResponse key={`${message.id}-${i}`}>
                                        {part.text}
                                      </MessageResponse>
                                    );
                                  case "tool":
                                    return (
                                      <Tool
                                        key={`${message.id}-${i}`}
                                        defaultOpen={false}
                                        className="mt-2"
                                      >
                                        <ToolHeader
                                          type={`tool-${part.toolName}`}
                                          state={part.output !== undefined ? "completed" : "running"}
                                        />
                                        <ToolContent>
                                          <ToolInput input={part.input} />
                                          <ToolOutput
                                            output={
                                              <pre className="code-block overflow-x-auto">
                                                {JSON.stringify(part.output ?? null, null, 2)}
                                              </pre>
                                            }
                                          />
                                        </ToolContent>
                                      </Tool>
                                    );
                                  default:
                                    return null;
                                }
                              })}
                            </MessageContent>
                          </Message>
                        ))}

                        {/* Per-step evals */}
                        {stepMetrics.length > 0 ? (
                          <details className="rounded-md border border-border bg-muted/20">
                            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">
                              {(() => {
                                const passCount = stepMetrics.filter(
                                  (m) => m.verdict === "pass",
                                ).length;
                                const failCount = stepMetrics.filter(
                                  (m) => m.verdict === "fail",
                                ).length;
                                return (
                                  <span className="inline-flex items-center gap-3">
                                    <span>Step evals</span>
                                    <span className="text-xs text-muted-foreground">
                                      Evals{" "}
                                      <span className="font-mono text-foreground">
                                        {stepMetrics.length}
                                      </span>
                                    </span>
                                    <span className="text-xs">
                                      <span className="text-muted-foreground">Pass</span>{" "}
                                      <span className="font-mono text-emerald-600 dark:text-emerald-400">
                                        {passCount}
                                      </span>
                                    </span>
                                    <span className="text-xs">
                                      <span className="text-muted-foreground">Fail</span>{" "}
                                      <span className="font-mono text-red-600 dark:text-red-400">
                                        {failCount}
                                      </span>
                                    </span>
                                  </span>
                                );
                              })()}
                            </summary>
                            <div className="border-t border-border px-4 py-3 space-y-3">
                              <div className="overflow-x-auto rounded-md border border-border bg-background">
                                <table className="w-full text-sm">
                                  <thead className="bg-muted/40">
                                    <tr className="border-b border-border">
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                                        Eval
                                      </th>
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                                        Verdict
                                      </th>
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                                        Score
                                      </th>
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                                        Raw
                                      </th>
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                                        Time (ms)
                                      </th>
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                                        Notes
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {stepMetrics.map((m, idx) => {
                                      const verdict = m.verdict ?? "unknown";
                                      const raw =
                                        m.rawValue === undefined ? "—" : JSON.stringify(m.rawValue);
                                      const time =
                                        typeof m.timeMs === "number" ? m.timeMs : undefined;

                                      return (
                                        <tr key={idx} className="border-b border-border/60 last:border-0">
                                          <td className="px-3 py-2 align-top">
                                            <div className="space-y-0.5">
                                              <span className="inline-flex items-center gap-2">
                                                <span className="font-medium">{m.evalName}</span>
                                                {run ? (
                                                  <MetricSummaryPopover
                                                    run={run as TallyRunArtifact}
                                                    evalName={m.evalName}
                                                  />
                                                ) : null}
                                              </span>
                                              <div className="text-xs text-muted-foreground">
                                                {m.metricName ?? "—"}
                                              </div>
                                            </div>
                                          </td>
                                          <td className="px-3 py-2 align-top">
                                            <span
                                              className={[
                                                "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
                                                verdict === "pass"
                                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                                  : verdict === "fail"
                                                    ? "bg-red-500/10 text-red-700 dark:text-red-300"
                                                    : "bg-muted text-muted-foreground",
                                              ].join(" ")}
                                            >
                                              {String(verdict)}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 align-top font-mono text-xs">
                                            {typeof m.score === "number" ? m.score.toFixed(3) : "—"}
                                          </td>
                                          <td className="px-3 py-2 align-top font-mono text-xs">
                                            {raw}
                                          </td>
                                          <td className="px-3 py-2 align-top font-mono text-xs">
                                            {time ?? "—"}
                                          </td>
                                          <td className="px-3 py-2 align-top">
                                            {m.reasoning ? (
                                              <details className="group">
                                                <summary className="cursor-pointer list-none text-xs text-primary hover:underline">
                                                  View reasoning
                                                </summary>
                                                <div className="mt-2 whitespace-pre-wrap rounded bg-muted/30 p-2 text-xs text-muted-foreground">
                                                  {m.reasoning}
                                                </div>
                                              </details>
                                            ) : (
                                              <span className="text-xs text-muted-foreground">—</span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </details>
                        ) : null}
                      </div>
                    );
                  })}
                </ConversationContent>
                <ConversationScrollButton />
              </Conversation>
            </div>
          )}
        </CardContent>
      </Card>

      {/* End-of-conversation eval summary (TUI-inspired table) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Eval Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {evalSummaryRows.length ? (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">Evaluation summaries</div>
              <div className="overflow-x-auto rounded-md border border-border bg-background">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Eval</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Kind</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Mean</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">P50</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">P75</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">P90</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Pass rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evalSummaryRows.map((r) => (
                      <tr key={r.evalName} className="border-b border-border/60 last:border-0">
                        <td className="px-3 py-2 align-top">
                          <span className="inline-flex items-center gap-2">
                            <span className="font-medium">{r.evalName}</span>
                            <MetricSummaryPopover run={run as TallyRunArtifact} evalName={r.evalName} />
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top">{renderKindTag(String(r.kind))}</td>
                        <td className="px-3 py-2 align-top">
                          {formatDualCell({ raw: r.rawMeanOrValue, score: r.scoreMeanOrValue })}
                        </td>
                        <td className="px-3 py-2 align-top">
                          {formatDualCell({ raw: r.rawP50, score: r.scoreP50 })}
                        </td>
                        <td className="px-3 py-2 align-top">
                          {formatDualCell({ raw: r.rawP75, score: r.scoreP75 })}
                        </td>
                        <td className="px-3 py-2 align-top">
                          {formatDualCell({ raw: r.rawP90, score: r.scoreP90 })}
                        </td>
                        <td className="px-3 py-2 align-top">{formatRateCell(r.passRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No end-of-conversation eval summaries.</div>
          )}

          {/* NOTE: Legacy sections (aggregateSummaries/derivedMetrics/verdicts) were removed.
              The new run artifact exposes summaries under `result.summaries` and per-step/per-conversation
              outcomes directly on each eval result. */}

          {/* Keep raw payload available for debugging */}
          <details className="group rounded-md border border-border bg-background">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium flex items-center justify-between">
              Raw run JSON
              <div className="flex items-center gap-2">
              <button
                onClick={copyRawRun}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Copy to clipboard"
              >
                {rawRunCopied ? <CheckIcon className="size-4 text-emerald-500" /> : <CopyIcon className="size-4" />}
              </button>
              <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </div>
            </summary>
            <div className="border-t border-border px-4 py-3">
              <pre className="code-block overflow-x-auto rounded bg-muted p-3 text-xs">
                {JSON.stringify(run, null, 2)}
              </pre>
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}

