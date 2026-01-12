import { TallyStore } from "@tally-evals/core";
import index from "./index.html";

// Initialize store
let store: TallyStore;
try {
  store = await TallyStore.open({
    cwd: process.env.TALLY_CWD ?? process.cwd(),
  });
} catch (err) {
  const msg = err instanceof Error ? err.message : "Unknown error";
  console.error("✗ Cannot open Tally store");
  console.error(msg);
  console.error(
    `\nHint: set TALLY_CWD to the project directory that contains your .tally folder.\n` +
      `      Example: TALLY_CWD=/path/to/project bun --hot src/index.tsx`
  );
  process.exit(1);
}

const server = Bun.serve({
  port: process.env.PORT ? Number.parseInt(process.env.PORT) : 4321,

  routes: {
    // Serve index.html for all unmatched routes (SPA)
    "/*": index,

    // API: List conversations
    "/api/conversations": {
      async GET() {
        const convs = await store.listConversations();
        const data = await Promise.all(
          convs.map(async (c) => {
            const runs = await c.listRuns().catch(() => []);
            return { id: c.id, runCount: runs.length };
          })
        );
        return Response.json(data);
      },
    },

    // API: Get single conversation
    "/api/conversations/:id": {
      async GET(req) {
        const id = req.params.id;
        const conv = await store.getConversation(id);
        if (!conv) {
          return Response.json({ error: "Conversation not found" }, { status: 404 });
        }
        const data = await conv.load();
        return Response.json(data);
      },
    },

    // API: List runs for a conversation
    "/api/conversations/:id/runs": {
      async GET(req) {
        const id = req.params.id;
        const conv = await store.getConversation(id);
        if (!conv) {
          return Response.json({ error: "Conversation not found" }, { status: 404 });
        }
        const runs = await conv.listRuns();
        return Response.json(runs.map((r) => ({ id: r.id, type: r.type })));
      },
    },

    // API: Get single run
    "/api/conversations/:convId/runs/:runId": {
      async GET(req) {
        const { convId, runId } = req.params;
        const conv = await store.getConversation(convId);
        if (!conv) {
          return Response.json({ error: "Conversation not found" }, { status: 404 });
        }
        const runs = await conv.listRuns();
        const run = runs.find((r) => r.id === runId);
        if (!run) {
          return Response.json({ error: "Run not found" }, { status: 404 });
        }
        // IMPORTANT:
        // `run.load()` decodes tally reports into Maps/Sets for in-memory usage.
        // When we `Response.json()` that object, Maps serialize to `{}` and we lose
        // eval summaries, metricToEvalMap, verdicts, etc.
        //
        // For the web API we return the *raw JSON file* for tally runs so the viewer
        // gets a JSON-serializable shape.
        if (run.type === "tally") {
          const content = await Bun.file(run.path).text();
          return new Response(content, {
            headers: { "content-type": "application/json; charset=utf-8" },
          });
        }

        const data = await run.load();
        return Response.json(data);
      },
    },

    // API: Get trajectory data
    "/api/conversations/:id/trajectory": {
      async GET(req) {
        const id = req.params.id;
        const [meta, steps] = await Promise.all([
          store.loadTrajectoryMeta(id),
          store.loadTrajectoryStepTraces(id),
        ]);
        return Response.json({ meta, steps });
      },
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`🚀 Tally Viewer running at ${server.url}`);
