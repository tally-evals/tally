import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { ChevronLeft, Clock, Wrench } from "lucide-react";

interface ToolCall {
  name: string;
  arguments: object;
  result?: unknown;
}

interface StepTrace {
  turnIndex?: number;
  type?: string;
  duration?: number;
  input?: unknown;
  output?: unknown;
  toolCalls?: ToolCall[];
  userMessage?: { role: string; content: string };
  agentMessages?: Array<{ role: string; content: unknown }>;
}

interface TrajectoryMeta {
  systemPrompt?: string;
  tools?: Array<{ name: string }>;
}

interface TrajectoryData {
  meta: TrajectoryMeta | null;
  steps: StepTrace[] | null;
}

interface TrajectoryViewProps {
  id: string;
}

export function TrajectoryView({ id }: TrajectoryViewProps) {
  const [data, setData] = useState<TrajectoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/conversations/${id}/trajectory`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

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

  const { meta, steps } = data ?? { meta: null, steps: null };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <a href="#/" className="hover:text-foreground transition-colors">Conversations</a>
        <span>/</span>
        <a href={`#/conversations/${id}`} className="hover:text-foreground transition-colors">{id}</a>
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
        <h1 className="text-2xl font-bold">Trajectory</h1>
      </div>

      {/* Metadata */}
      {meta && (meta.systemPrompt || (meta.tools && meta.tools.length > 0)) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {meta.systemPrompt && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">System Prompt</h4>
                <pre className="code-block bg-muted p-3 rounded text-sm">{meta.systemPrompt}</pre>
              </div>
            )}
            {meta.tools && meta.tools.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                  Tools ({meta.tools.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {meta.tools.map((tool, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded text-sm"
                    >
                      <Wrench className="h-3 w-3" />
                      {tool.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Steps Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Steps ({steps?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!steps || steps.length === 0 ? (
            <p className="text-muted-foreground">No step traces available.</p>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

              <div className="space-y-6">
                {steps.map((step, i) => (
                  <div key={i} className="relative pl-12">
                    {/* Step marker */}
                    <div className="absolute left-0 top-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">
                      {i + 1}
                    </div>

                    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                      {/* Step header */}
                      <div className="flex items-center gap-3">
                        {step.type && (
                          <span className="font-semibold capitalize">{step.type}</span>
                        )}
                        {step.turnIndex !== undefined && (
                          <span className="text-xs bg-secondary px-2 py-0.5 rounded">
                            Turn {step.turnIndex}
                          </span>
                        )}
                        {step.duration && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {step.duration}ms
                          </span>
                        )}
                      </div>

                      {/* User message */}
                      {step.userMessage && (
                        <details className="group">
                          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                            User Message
                          </summary>
                          <pre className="code-block bg-background p-3 rounded mt-2 text-xs">
                            {typeof step.userMessage.content === "string"
                              ? step.userMessage.content
                              : JSON.stringify(step.userMessage.content, null, 2)}
                          </pre>
                        </details>
                      )}

                      {/* Agent messages */}
                      {step.agentMessages && step.agentMessages.length > 0 && (
                        <details className="group" open>
                          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                            Agent Messages ({step.agentMessages.length})
                          </summary>
                          <div className="mt-2 space-y-2">
                            {step.agentMessages.map((msg, j) => (
                              <pre key={j} className="code-block bg-background p-3 rounded text-xs">
                                {typeof msg.content === "string"
                                  ? msg.content
                                  : JSON.stringify(msg.content, null, 2)}
                              </pre>
                            ))}
                          </div>
                        </details>
                      )}

                      {/* Input/Output */}
                      {step.input && (
                        <details className="group">
                          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                            Input
                          </summary>
                          <pre className="code-block bg-background p-3 rounded mt-2 text-xs">
                            {JSON.stringify(step.input, null, 2)}
                          </pre>
                        </details>
                      )}

                      {step.output && (
                        <details className="group">
                          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                            Output
                          </summary>
                          <pre className="code-block bg-background p-3 rounded mt-2 text-xs">
                            {JSON.stringify(step.output, null, 2)}
                          </pre>
                        </details>
                      )}

                      {/* Tool Calls */}
                      {step.toolCalls && step.toolCalls.length > 0 && (
                        <details className="group" open>
                          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                            Tool Calls ({step.toolCalls.length})
                          </summary>
                          <div className="mt-2 space-y-2">
                            {step.toolCalls.map((tc, j) => (
                              <div key={j} className="bg-background p-3 rounded">
                                <div className="flex items-center gap-2 mb-2">
                                  <Wrench className="h-4 w-4 text-primary" />
                                  <span className="font-mono text-sm font-medium text-primary">
                                    {tc.name}
                                  </span>
                                </div>
                                <pre className="code-block text-xs mb-2">
                                  {JSON.stringify(tc.arguments, null, 2)}
                                </pre>
                                {tc.result && (
                                  <div className="pt-2 border-t border-border">
                                    <span className="text-xs text-muted-foreground">Result:</span>
                                    <pre className="code-block text-xs mt-1">
                                      {JSON.stringify(tc.result, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
