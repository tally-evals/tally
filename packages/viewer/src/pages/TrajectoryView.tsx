import { UIMessageBlock } from '@/components/UIMessageBlock';
import type { UIMessage, UIMessagePart } from '@/types';
import { ChevronLeft, Info } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '../components/ai-elements/conversation';
import { MessageResponse } from '../components/ai-elements/message';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';

type ExtractedToolCall = {
  toolCallId: string;
  toolName: string;
  args: unknown;
  result?: unknown;
};

type ExtractedToolResult = {
  toolCallId: string;
  toolName?: string;
  output: unknown;
};

function getProperty(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && key in obj) return (obj as Record<string, unknown>)[key];
  return undefined;
}

function extractToolCallsFromMessages(
  messages: ReadonlyArray<Record<string, unknown>>
): ExtractedToolCall[] {
  const toolCalls: ExtractedToolCall[] = [];
  const seenIds = new Set<string>();

  for (const message of messages) {
    if (message.role !== 'assistant') continue;

    // Format 1: message.toolCalls (native AI SDK style)
    const maybeToolCalls = getProperty(message, 'toolCalls');
    if (Array.isArray(maybeToolCalls)) {
      for (const tc of maybeToolCalls) {
        if (!tc || typeof tc !== 'object') continue;
        const id = getProperty(tc, 'toolCallId');
        const name = getProperty(tc, 'toolName');
        if (typeof id !== 'string' || typeof name !== 'string') continue;
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        toolCalls.push({
          toolCallId: id,
          toolName: name,
          args: getProperty(tc, 'args') ?? {},
        });
      }
    }

    // Format 2: message.content[] parts with type: 'tool-call'
    const content = getProperty(message, 'content');
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== 'object') continue;
      const type = getProperty(part, 'type');
      if (type !== 'tool-call') continue;
      const toolCallId = getProperty(part, 'toolCallId');
      const toolName = getProperty(part, 'toolName');
      if (typeof toolCallId !== 'string' || typeof toolName !== 'string') continue;
      if (seenIds.has(toolCallId)) continue;
      seenIds.add(toolCallId);
      const inputVal = getProperty(part, 'input');
      const argsVal = getProperty(part, 'args');
      toolCalls.push({
        toolCallId,
        toolName,
        args: inputVal !== undefined ? inputVal : argsVal !== undefined ? argsVal : {},
      });
    }
  }

  return toolCalls;
}

function extractToolResultContent(message: Record<string, unknown>): unknown {
  const content = getProperty(message, 'content');
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const part of content) {
      if (typeof part === 'string') {
        parts.push(part);
      } else if (part && typeof part === 'object') {
        const type = getProperty(part, 'type');
        if (type === 'text') {
          const text = getProperty(part, 'text');
          if (typeof text === 'string') parts.push(text);
        } else if (type === 'tool-result') {
          // AI SDK JSONL format: tool-result part carries { output: { type, value } }.
          const output = getProperty(part, 'output');
          if (output && typeof output === 'object') {
            const outType = getProperty(output, 'type');
            const outValue = getProperty(output, 'value');
            if (outType === 'json') return outValue;
            if (outType === 'text')
              return typeof outValue === 'string' ? outValue : String(outValue);
            // fallthrough for other output types
            if (outValue !== undefined) return outValue;
          }

          // Some formats embed the result directly
          const result = getProperty(part, 'result');
          if (result !== undefined) return result;
        }
      }
    }
    return parts.length > 0 ? parts.join('\n') : content;
  }
  if (content !== undefined) return content;
  const result = getProperty(message, 'result');
  if (result !== undefined) return result;
  return undefined;
}

function extractToolResultsFromMessages(
  messages: ReadonlyArray<Record<string, unknown>>
): ExtractedToolResult[] {
  const results: ExtractedToolResult[] = [];
  for (const message of messages) {
    if (message.role !== 'tool') continue;

    // Format A: tool message has top-level toolCallId/toolName (some AI SDK shapes)
    const topLevelToolCallId = getProperty(message, 'toolCallId');
    if (typeof topLevelToolCallId === 'string') {
      const toolName = getProperty(message, 'toolName');
      results.push({
        toolCallId: topLevelToolCallId,
        toolName: typeof toolName === 'string' ? toolName : undefined,
        output: extractToolResultContent(message),
      });
      continue;
    }

    // Format B (your trace): tool message content[] contains tool-result parts with toolCallId/toolName/output
    const content = getProperty(message, 'content');
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== 'object') continue;
      const type = getProperty(part, 'type');
      if (type !== 'tool-result') continue;

      const toolCallId = getProperty(part, 'toolCallId');
      if (typeof toolCallId !== 'string') continue;
      const toolName = getProperty(part, 'toolName');

      // Prefer decoding from part.output if available; fallback to whole-message extraction.
      const output = (() => {
        const out = getProperty(part, 'output');
        if (out && typeof out === 'object') {
          const outType = getProperty(out, 'type');
          const outValue = getProperty(out, 'value');
          if (outType === 'json') return outValue;
          if (outType === 'text') return typeof outValue === 'string' ? outValue : String(outValue);
          if (outValue !== undefined) return outValue;
          return out;
        }
        return extractToolResultContent(message);
      })();

      results.push({
        toolCallId,
        toolName: typeof toolName === 'string' ? toolName : undefined,
        output,
      });
    }
  }
  return results;
}

function matchToolCallsWithResults(
  toolCalls: ExtractedToolCall[],
  toolResults: ExtractedToolResult[]
): ExtractedToolCall[] {
  const resultMap = new Map<string, unknown>();
  for (const r of toolResults) resultMap.set(r.toolCallId, r.output);
  return toolCalls.map((tc) => {
    const res = resultMap.get(tc.toolCallId);
    if (res !== undefined) return { ...tc, result: res };
    return tc;
  });
}

type StepSelectionMethod = 'start' | 'preconditions-ordered' | 'llm-ranked' | 'none';

type StepSelectionCandidate = {
  stepId: string;
  score: number;
  reasons?: string[];
};

type StepTrace = {
  turnIndex: number;
  userMessage: { role: string; content: unknown };
  agentMessages: Array<Record<string, unknown> & { role: string; content: unknown }>;
  timestamp: string;
  stepId: string | null;
  selection: { method: StepSelectionMethod; candidates?: StepSelectionCandidate[] };
  end?: { isFinal: true; reason: string; completed: boolean; summary?: string };
};

type TrajectoryMeta = {
  trajectoryId: string;
  createdAt: string;
  goal: string;
  persona: { name?: string; description: string; guardrails?: string[] };
  maxTurns?: number;
  stepGraph?: {
    start: string;
    terminals?: string[];
    steps: Array<Record<string, unknown>>;
  };
  metadata?: Record<string, unknown>;
};

type TrajectoryData = {
  meta: TrajectoryMeta | null;
  steps: StepTrace[] | null;
};

interface TrajectoryViewProps {
  id: string;
}

export function TrajectoryView({ id }: TrajectoryViewProps) {
  const [data, setData] = useState<TrajectoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stepFilter, setStepFilter] = useState('');

  useEffect(() => {
    Promise.all([fetch(`/api/conversations/${id}/trajectory`).then((r) => r.json())])
      .then(([trajectoryData]) => {
        setData(trajectoryData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  // IMPORTANT: Hooks must run unconditionally on every render.
  const { meta, steps } = data ?? { meta: null, steps: null };

  const turns = useMemo(() => {
    if (!steps) return [];
    // Ensure stable sort by turnIndex; file order should already match but we don't assume.
    return [...steps].sort((a, b) => a.turnIndex - b.turnIndex);
  }, [steps]);

  const stepById = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    const stepDefs = meta?.stepGraph?.steps ?? [];
    for (const s of stepDefs) {
      const maybeId = s?.id;
      if (typeof maybeId === 'string') map.set(maybeId, s);
    }
    return map;
  }, [meta?.stepGraph?.steps]);

  const filteredStepGraphSteps = useMemo(() => {
    const stepsArr = meta?.stepGraph?.steps ?? [];
    const q = stepFilter.trim().toLowerCase();
    if (!q) return stepsArr;
    return stepsArr.filter((s) => {
      const id = typeof (s as any).id === 'string' ? String((s as any).id) : '';
      const instruction =
        typeof (s as any).instruction === 'string' ? String((s as any).instruction) : '';
      return id.toLowerCase().includes(q) || instruction.toLowerCase().includes(q);
    });
  }, [meta?.stepGraph?.steps, stepFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Loading trajectory...</div>
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

  function renderMessageContent(content: unknown) {
    // Legacy helper kept for non-part content; most rendering now goes through parts.
    if (typeof content === 'string') return <MessageResponse>{content}</MessageResponse>;
    if (Array.isArray(content)) {
      return (
        <pre className="code-block overflow-x-auto rounded bg-muted p-3 text-xs">
          {JSON.stringify(content, null, 2)}
        </pre>
      );
    }
    if (content && typeof content === 'object') {
      return (
        <pre className="code-block overflow-x-auto rounded bg-muted p-3 text-xs">
          {JSON.stringify(content, null, 2)}
        </pre>
      );
    }
    return <MessageResponse>{String(content ?? '')}</MessageResponse>;
  }

  function messageToParts(msg: Record<string, unknown>): UIMessagePart[] {
    const content = getProperty(msg, 'content');
    // String → single text part
    if (typeof content === 'string') return [{ type: 'text', text: content }];

    // Array content → interpret known AI SDK part shapes
    if (Array.isArray(content)) {
      const parts: UIMessagePart[] = [];
      for (const part of content) {
        if (!part || typeof part !== 'object') continue;
        const type = getProperty(part, 'type');

        if (type === 'text') {
          const text = getProperty(part, 'text');
          if (typeof text === 'string') parts.push({ type: 'text', text });
          continue;
        }

        if (type === 'tool-call') {
          const toolCallId = getProperty(part, 'toolCallId');
          const toolName = getProperty(part, 'toolName');
          const input = getProperty(part, 'input') ?? getProperty(part, 'args') ?? {};
          if (typeof toolCallId === 'string' && typeof toolName === 'string') {
            parts.push({ type: 'tool', toolCallId, toolName, input });
          }
          continue;
        }

        if (type === 'tool-result') {
          const toolCallId = getProperty(part, 'toolCallId');
          const toolName = getProperty(part, 'toolName');
          if (typeof toolCallId === 'string' && typeof toolName === 'string') {
            // output wrapper: { type: 'json'|'text', value: ... }
            const outputWrapper = getProperty(part, 'output');
            let output: unknown = undefined;
            if (outputWrapper && typeof outputWrapper === 'object') {
              const outType = getProperty(outputWrapper, 'type');
              const outValue = getProperty(outputWrapper, 'value');
              if (outType === 'json') output = outValue;
              else if (outType === 'text')
                output = typeof outValue === 'string' ? outValue : String(outValue);
              else if (outValue !== undefined) output = outValue;
              else output = outputWrapper;
            } else {
              // fallback to any legacy fields
              output = getProperty(part, 'result') ?? getProperty(part, 'output');
            }
            parts.push({
              type: 'tool',
              toolCallId,
              toolName,
              input: {},
              output,
            });
          }
          continue;
        }
      }
      return parts;
    }

    // Anything else: render as JSON in a "text" part to keep message component usage consistent
    if (content !== undefined) {
      return [{ type: 'text', text: JSON.stringify(content, null, 2) }];
    }

    return [];
  }

  function buildTurnUIMessages(turn: StepTrace): UIMessage[] {
    const msgs: UIMessage[] = [];

    // User
    msgs.push({
      id: `turn-${turn.turnIndex}-user`,
      role: turn.userMessage.role,
      parts: messageToParts(turn.userMessage as any),
    });

    // Agent response: keep strict ordering from step trace by walking agentMessages in order,
    // and merge tool-call + tool-result into a single tool part (by toolCallId).
    const agentParts: UIMessagePart[] = [];
    const toolIndexById = new Map<string, number>();

    const pushText = (text: string) => {
      if (text.trim().length === 0) return;
      agentParts.push({ type: 'text', text });
    };

    const ensureToolPart = (args: {
      toolCallId: string;
      toolName: string;
      input?: unknown;
      output?: unknown;
    }) => {
      const existingIdx = toolIndexById.get(args.toolCallId);
      if (existingIdx !== undefined) {
        const existing = agentParts[existingIdx];
        if (existing && existing.type === 'tool') {
          // Merge fields (prefer existing input if present, then new input; output merges when it arrives).
          existing.input =
            existing.input && Object.keys(existing.input as any).length > 0
              ? existing.input
              : (args.input ?? existing.input ?? {});
          if (args.output !== undefined) existing.output = args.output;
          // Tool name should be stable; keep existing unless missing.
          if (!existing.toolName && args.toolName) existing.toolName = args.toolName;
        }
        return;
      }

      const idx = agentParts.length;
      agentParts.push({
        type: 'tool',
        toolCallId: args.toolCallId,
        toolName: args.toolName,
        input: args.input ?? {},
        ...(args.output !== undefined ? { output: args.output } : {}),
      });
      toolIndexById.set(args.toolCallId, idx);
    };

    for (const m of turn.agentMessages as any[]) {
      const role = m?.role;
      const content = m?.content;

      if (typeof content === 'string') {
        pushText(content);
        continue;
      }

      if (!Array.isArray(content)) {
        // Fallback: show unknown content as JSON text
        if (content !== undefined) pushText(JSON.stringify(content, null, 2));
        continue;
      }

      for (const part of content) {
        if (!part || typeof part !== 'object') continue;
        const type = (part as any).type;

        if (type === 'text' && typeof (part as any).text === 'string') {
          pushText((part as any).text);
          continue;
        }

        if (type === 'tool-call') {
          const toolCallId = (part as any).toolCallId;
          const toolName = (part as any).toolName;
          if (typeof toolCallId === 'string' && typeof toolName === 'string') {
            ensureToolPart({
              toolCallId,
              toolName,
              input: (part as any).input ?? (part as any).args ?? {},
            });
          }
          continue;
        }

        if (type === 'tool-result') {
          const toolCallId = (part as any).toolCallId;
          const toolName = (part as any).toolName;
          if (typeof toolCallId === 'string' && typeof toolName === 'string') {
            const outputWrapper = (part as any).output;
            let output: unknown = undefined;
            if (outputWrapper && typeof outputWrapper === 'object') {
              const outType = (outputWrapper as any).type;
              const outValue = (outputWrapper as any).value;
              if (outType === 'json') output = outValue;
              else if (outType === 'text')
                output = typeof outValue === 'string' ? outValue : String(outValue);
              else if (outValue !== undefined) output = outValue;
              else output = outputWrapper;
            } else if ((part as any).result !== undefined) {
              output = (part as any).result;
            } else if ((part as any).output !== undefined) {
              output = (part as any).output;
            }

            ensureToolPart({ toolCallId, toolName, output });
          }
          continue;
        }
      }
    }

    if (agentParts.length > 0) {
      // If you later want separate assistant/system bubbles, we can split by role here.
      msgs.push({
        id: `turn-${turn.turnIndex}-agent`,
        role: 'assistant',
        parts: agentParts,
      });
    }

    return msgs;
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <a href="#/" className="hover:text-foreground transition-colors">
          Conversations
        </a>
        <span>/</span>
        <a href={`#/conversations/${id}`} className="hover:text-foreground transition-colors">
          {id}
        </a>
        <span>/</span>
        <span className="text-foreground font-medium">Trajectory</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4">
        <a
          href={`#/conversations/${id}`}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </a>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Trajectory</h1>
          <div className="text-sm text-muted-foreground">{id}</div>
        </div>
      </div>

      {/* Trajectory card (top-level) */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Trajectory details</CardTitle>
            <div className="mt-1 text-sm text-muted-foreground">
              {meta?.goal ? meta.goal : 'No goal metadata available.'}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">Persona</div>
            <div className="text-sm">
              <div className="font-medium">{meta?.persona?.name ?? '—'}</div>
              <div className="text-muted-foreground">{meta?.persona?.description ?? '—'}</div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">Created</div>
            <div className="text-sm">
              {meta?.createdAt ? new Date(meta.createdAt).toLocaleString() : '—'}
            </div>
            <div className="text-xs font-semibold text-muted-foreground">Max turns</div>
            <div className="text-sm">{meta?.maxTurns ?? '—'}</div>
          </div>
        </CardContent>

        {/* Steps accordion (collapsed by default) */}
        {meta?.stepGraph?.steps?.length ? (
          <CardContent className="pt-0">
            <details className="group rounded-md border border-border bg-background">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Steps</span>
                  <span className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                    {filteredStepGraphSteps.length}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground group-open:hidden">Show</span>
                <span className="text-xs text-muted-foreground hidden group-open:inline">Hide</span>
              </summary>

              <div className="border-t border-border px-4 py-3 space-y-3">
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-muted-foreground">Start</div>
                    <div className="font-mono text-xs">{meta.stepGraph.start}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-muted-foreground">Terminals</div>
                    <div className="font-mono text-xs">
                      {meta.stepGraph.terminals?.length ? meta.stepGraph.terminals.join(', ') : '—'}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <Input
                      value={stepFilter}
                      onChange={(e) => setStepFilter(e.currentTarget.value)}
                      placeholder="Filter steps by id or instruction…"
                      className="h-9 md:max-w-sm"
                    />
                    {stepFilter.trim() ? (
                      <div className="text-xs text-muted-foreground">
                        Showing {filteredStepGraphSteps.length} of {meta.stepGraph.steps.length}
                      </div>
                    ) : null}
                  </div>

                  {filteredStepGraphSteps.length === 0 ? (
                    <div className="rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                      No steps match “{stepFilter.trim()}”.
                    </div>
                  ) : null}

                  {filteredStepGraphSteps.map((s, idx) => {
                    const id =
                      typeof (s as any).id === 'string' ? ((s as any).id as string) : `step-${idx}`;
                    const instruction =
                      typeof (s as any).instruction === 'string'
                        ? ((s as any).instruction as string)
                        : undefined;
                    const hints = Array.isArray((s as any).hints)
                      ? (((s as any).hints as unknown[]).filter(
                          (h): h is string => typeof h === 'string'
                        ) as string[])
                      : [];
                    const preconditions = Array.isArray((s as any).preconditions)
                      ? ((s as any).preconditions as unknown[])
                      : undefined;
                    const maxAttempts =
                      typeof (s as any).maxAttempts === 'number'
                        ? ((s as any).maxAttempts as number)
                        : undefined;
                    const timeoutMs =
                      typeof (s as any).timeoutMs === 'number'
                        ? ((s as any).timeoutMs as number)
                        : undefined;
                    const hasExtraMeta =
                      (preconditions && preconditions.length > 0) ||
                      maxAttempts !== undefined ||
                      timeoutMs !== undefined;

                    return (
                      <details key={id} className="rounded-md border border-border bg-muted/20">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2">
                          <div className="min-w-0">
                            <div className="font-mono text-xs">{id}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {instruction ?? '—'}
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {[
                              hints.length ? `hints: ${hints.length}` : null,
                              maxAttempts !== undefined ? `maxAttempts: ${maxAttempts}` : null,
                              timeoutMs !== undefined ? `timeout: ${timeoutMs}ms` : null,
                              preconditions?.length
                                ? `preconditions: ${preconditions.length}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join('  •  ')}
                          </span>
                        </summary>

                        <div className="border-t border-border px-3 py-3 space-y-2">
                          <div>
                            <div className="text-xs font-semibold text-muted-foreground">
                              Instruction
                            </div>
                            <div className="mt-1 text-sm whitespace-pre-wrap">
                              {instruction ?? '—'}
                            </div>
                          </div>
                          {hints.length ? (
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground">
                                Hints
                              </div>
                              <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
                                {hints.map((h, i) => (
                                  <li key={i} className="whitespace-pre-wrap">
                                    {h}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}

                          {hasExtraMeta ? (
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-1">
                                <div className="text-xs font-semibold text-muted-foreground">
                                  maxAttempts
                                </div>
                                <div className="text-sm">{maxAttempts ?? '—'}</div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-xs font-semibold text-muted-foreground">
                                  timeoutMs
                                </div>
                                <div className="text-sm">{timeoutMs ?? '—'}</div>
                              </div>
                              <div className="space-y-1 md:col-span-2">
                                <div className="text-xs font-semibold text-muted-foreground">
                                  preconditions
                                </div>
                                {preconditions?.length ? (
                                  <pre className="code-block overflow-x-auto rounded bg-background p-3 text-xs">
                                    {JSON.stringify(preconditions, null, 2)}
                                  </pre>
                                ) : (
                                  <div className="text-sm text-muted-foreground">—</div>
                                )}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </details>
                    );
                  })}
                </div>
              </div>
            </details>
          </CardContent>
        ) : null}
      </Card>

      {/* Trajectory (conversation-like view) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Trajectory</CardTitle>
        </CardHeader>
        <CardContent className="h-[700px] min-h-0">
          {!turns || turns.length === 0 ? (
            <p className="text-muted-foreground">No step traces available.</p>
          ) : (
            <div className="relative h-full min-h-0 rounded-lg border border-border">
              <Conversation className="h-full">
                <ConversationContent className="p-4">
                  {turns.map((turn) => {
                    const candidatesCount = turn.selection?.candidates?.length ?? 0;
                    const stepDef = turn.stepId ? stepById.get(turn.stepId) : undefined;
                    const instruction =
                      stepDef && typeof (stepDef as any).instruction === 'string'
                        ? ((stepDef as any).instruction as string)
                        : undefined;
                    const hints =
                      stepDef && Array.isArray((stepDef as any).hints)
                        ? ((stepDef as any).hints as unknown[]).filter(
                            (h): h is string => typeof h === 'string'
                          )
                        : [];

                    const uiMessages = buildTurnUIMessages(turn);
                    return (
                      <div key={turn.turnIndex} className="space-y-3">
                        {/* Turn context bar (compact, pre-message) */}
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <span className="text-xs font-semibold text-muted-foreground">
                              Turn {turn.turnIndex}
                            </span>
                            <span className="h-4 w-px bg-border" />
                            <span className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                              {turn.selection?.method ?? '—'}
                            </span>
                            <span className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground font-mono">
                              {turn.stepId ?? '—'}
                            </span>
                            <span className="min-w-0 text-xs text-muted-foreground truncate">
                              {instruction ?? '—'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {hints.length > 0 ? (
                              <span className="text-xs text-muted-foreground">
                                hints: {hints.length}
                              </span>
                            ) : null}

                            <details className="relative">
                              <summary
                                className={`list-none text-xs ${
                                  candidatesCount === 0
                                    ? 'cursor-not-allowed text-muted-foreground/60'
                                    : 'cursor-pointer text-primary hover:underline'
                                }`}
                                onClick={(e) => {
                                  if (candidatesCount === 0) {
                                    e.preventDefault();
                                  }
                                }}
                              >
                                <span className="inline-flex items-center gap-1">
                                  <Info className="h-3.5 w-3.5" />
                                  Candidates ({candidatesCount})
                                </span>
                              </summary>

                              {candidatesCount > 0 && turn.selection?.candidates ? (
                                <div className="absolute right-0 top-7 z-50 w-[560px] max-w-[90vw] overflow-hidden rounded-md border border-border bg-background shadow-lg">
                                  <div className="flex items-center justify-between border-b border-border px-3 py-2">
                                    <div className="text-xs font-semibold text-muted-foreground">
                                      Step candidates
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      method: {turn.selection?.method ?? '—'}
                                    </div>
                                  </div>

                                  <div className="max-h-[280px] overflow-auto">
                                    <table className="w-full text-xs">
                                      <thead className="sticky top-0 bg-background">
                                        <tr className="border-b border-border">
                                          <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                                            stepId
                                          </th>
                                          <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                                            score
                                          </th>
                                          <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                                            reasons
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {turn.selection.candidates.map((c) => (
                                          <tr key={c.stepId} className="border-b border-border/60">
                                            <td className="px-3 py-2 font-mono">{c.stepId}</td>
                                            <td className="px-3 py-2">{c.score}</td>
                                            <td className="px-3 py-2 text-muted-foreground">
                                              {c.reasons?.length ? c.reasons.join(' • ') : '—'}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              ) : null}
                            </details>
                          </div>
                        </div>

                        {/* Messages (AI Elements-style parts rendering) */}
                        {uiMessages.map((message) => (
                          <UIMessageBlock key={message.id} message={message} />
                        ))}
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
    </div>
  );
}
