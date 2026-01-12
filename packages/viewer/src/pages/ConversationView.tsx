import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { ChevronLeft, GitBranch, Play } from "lucide-react";

interface Run {
  id: string;
  type: string;
}

interface ConversationViewProps {
  id: string;
}

type TrajectoryMeta = {
  trajectoryId: string;
  createdAt: string;
  goal: string;
  persona: { name?: string; description: string; guardrails?: string[] };
  maxTurns?: number;
};

type TrajectoryData = {
  meta: TrajectoryMeta | null;
};

export function ConversationView({ id }: ConversationViewProps) {
  const [trajectory, setTrajectory] = useState<TrajectoryData | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/conversations/${id}/trajectory`).then((r) => r.json()),
      fetch(`/api/conversations/${id}/runs`).then((r) => r.json()),
    ])
      .then(([trajectoryData, runsData]) => {
        setTrajectory(trajectoryData);
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

  const meta = trajectory?.meta ?? null;

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
        <div>
          <h1 className="text-2xl font-bold">Conversation overview</h1>
          <div className="text-sm text-muted-foreground">{id}</div>
        </div>
      </div>

      {/* Trajectory card */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Trajectory</CardTitle>
            <div className="mt-1 text-sm text-muted-foreground">
              {meta?.goal ? meta.goal : "No trajectory metadata available."}
            </div>
          </div>
          <a
            href={`#/conversations/${id}/trajectory`}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors"
          >
            <GitBranch className="h-4 w-4" />
            View trajectory
          </a>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">Persona</div>
            <div className="text-sm">
              <div className="font-medium">{meta?.persona?.name ?? "—"}</div>
              <div className="text-muted-foreground">{meta?.persona?.description ?? "—"}</div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">Created</div>
            <div className="text-sm">
              {meta?.createdAt ? new Date(meta.createdAt).toLocaleString() : "—"}
            </div>
            <div className="text-xs font-semibold text-muted-foreground">Max turns</div>
            <div className="text-sm">{meta?.maxTurns ?? "—"}</div>
          </div>
        </CardContent>
      </Card>

      {/* Runs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tally runs ({runs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <div className="text-sm text-muted-foreground">No runs found for this conversation.</div>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => (
                <a
                  key={run.id}
                  href={`#/conversations/${id}/runs/${run.id}`}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg hover:bg-muted/70 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Play className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-sm">{run.id}</span>
                  </div>
                  <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded">
                    {run.type}
                  </span>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
