import { ArrowRight, MessageSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

interface ConversationSummary {
  id: string;
  runCount: number;
}

export function ConversationList() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/conversations')
      .then((res) => res.json())
      .then((data) => {
        setConversations(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Loading conversations...</div>
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

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No conversations found</h2>
        <p className="text-muted-foreground">Run some evaluations to see results here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Conversations</h1>
        <span className="bg-primary text-primary-foreground text-sm font-medium px-2.5 py-0.5 rounded-full">
          {conversations.length}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {conversations.map((conv) => (
          <a key={conv.id} href={`#/conversations/${conv.id}`} className="group block">
            <Card className="h-full transition-all hover:border-primary hover:shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="truncate">{conv.id}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardTitle>
                <CardDescription>
                  {conv.runCount} evaluation {conv.runCount === 1 ? 'run' : 'runs'}
                </CardDescription>
              </CardHeader>
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
}
