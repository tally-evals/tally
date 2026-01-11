import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { ChevronLeft, GitBranch, Play, Wrench } from "lucide-react";

interface ContentPart {
  type: string;
  text?: string;
  toolCallId?: string;
  toolName?: string;
  input?: object;
  output?: object;
}

interface Message {
  role: string;
  content: string | ContentPart[];
}

interface Step {
  stepIndex: number;
  input: Message;
  output: Message[];
  timestamp?: string;
}

interface Conversation {
  id: string;
  steps: Step[];
}

interface Run {
  id: string;
  type: string;
}

interface ConversationViewProps {
  id: string;
}

function renderContent(content: string | ContentPart[]) {
  if (typeof content === "string") {
    return <p className="whitespace-pre-wrap">{content}</p>;
  }

  return (
    <div className="space-y-2">
      {content.map((part, i) => {
        if (part.type === "text" && part.text) {
          return (
            <p key={i} className="whitespace-pre-wrap">
              {part.text}
            </p>
          );
        }
        if (part.type === "tool-call") {
          return (
            <div key={i} className="bg-background p-3 rounded border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Wrench className="h-4 w-4 text-primary" />
                <span className="font-mono text-sm font-medium text-primary">
                  {part.toolName}
                </span>
              </div>
              <pre className="code-block text-xs overflow-x-auto">
                {JSON.stringify(part.input, null, 2)}
              </pre>
            </div>
          );
        }
        if (part.type === "tool-result") {
          return (
            <div key={i} className="bg-background p-3 rounded border border-border">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-muted-foreground">Tool Result:</span>
                <span className="font-mono text-sm">{part.toolName}</span>
              </div>
              <pre className="code-block text-xs overflow-x-auto">
                {JSON.stringify(part.output, null, 2)}
              </pre>
            </div>
          );
        }
        return (
          <pre key={i} className="code-block text-xs overflow-x-auto">
            {JSON.stringify(part, null, 2)}
          </pre>
        );
      })}
    </div>
  );
}

export function ConversationView({ id }: ConversationViewProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/conversations/${id}`).then((r) => r.json()),
      fetch(`/api/conversations/${id}/runs`).then((r) => r.json()),
    ])
      .then(([convData, runsData]) => {
        setConversation(convData);
        setRuns(runsData);
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
        <div className="animate-pulse text-muted-foreground">Loading conversation...</div>
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
        <a href="#/" className="hover:text-foreground transition-colors flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" />
          Conversations
        </a>
        <span>/</span>
        <span className="text-foreground font-medium">{id}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{id}</h1>
        <a
          href={`#/conversations/${id}/trajectory`}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors"
        >
          <GitBranch className="h-4 w-4" />
          View Trajectory
        </a>
      </div>

      {/* Runs */}
      {runs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Evaluation Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <Play className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-sm">{run.id}</span>
                  </div>
                  <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded">
                    {run.type}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conversation Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Conversation Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {conversation?.steps.map((step, i) => (
              <div key={i} className="space-y-3">
                {/* Step header */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="bg-primary text-primary-foreground text-xs font-medium px-2 py-0.5 rounded-full">
                    Step {step.stepIndex + 1}
                  </span>
                  {step.timestamp && (
                    <span className="text-xs">
                      {new Date(step.timestamp).toLocaleString()}
                    </span>
                  )}
                </div>

                {/* User input */}
                <div className="p-4 bg-muted/50 rounded-lg turn-user">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {step.input.role}
                    </span>
                  </div>
                  <div className="text-sm">{renderContent(step.input.content)}</div>
                </div>

                {/* Output messages */}
                {step.output.map((msg, j) => (
                  <div
                    key={j}
                    className={`p-4 bg-muted/50 rounded-lg turn-${msg.role}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {msg.role}
                      </span>
                    </div>
                    <div className="text-sm">{renderContent(msg.content)}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
