/**
 * Embedded viewer server for the CLI.
 * Serves pre-built static assets and provides TallyStore API routes.
 */

import { TallyStore } from '@tally-evals/core';
import { resolve } from 'node:path';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function getContentType(filePath: string): string {
  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'));
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

async function serveStaticFile(distDir: string, pathname: string): Promise<Response | null> {
  let filePath = pathname === '/' ? '/index.html' : pathname;

  filePath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
  const fullPath = resolve(distDir, filePath);

  try {
    const file = Bun.file(fullPath);
    const exists = await file.exists();

    if (!exists) {
      if (!filePath.startsWith('api')) {
        const indexFile = Bun.file(resolve(distDir, 'index.html'));
        if (await indexFile.exists()) {
          return new Response(indexFile, {
            headers: { 'content-type': getContentType('.html') },
          });
        }
      }
      return null;
    }

    return new Response(file, {
      headers: { 'content-type': getContentType(fullPath) },
    });
  } catch {
    return null;
  }
}

interface ViewerServerOptions {
  port: number;
  cwd: string;
}

export async function startViewerServer(
  options: ViewerServerOptions
): Promise<ReturnType<typeof Bun.serve>> {
  const { port, cwd } = options;

  let store: TallyStore;
  try {
    store = await TallyStore.open({
      cwd,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    throw new Error(
      `Cannot open Tally store: ${msg}\n` +
        `Hint: ensure the directory contains a .tally/ folder or tally.config.ts`
    );
  }

  const distDir = resolve(import.meta.dir, '..', 'dist', 'viewer');

  const server = Bun.serve({
    port,
    development: false,

    async fetch(req) {
      const url = new URL(req.url);
      const pathname = url.pathname;

      // API: List conversations
      if (pathname === '/api/conversations' && req.method === 'GET') {
        const convs = await store.listConversations();
        const data = await Promise.all(
          convs.map(async (c) => {
            const runs = await c.listRuns().catch(() => []);
            return { id: c.id, runCount: runs.length };
          })
        );
        return Response.json(data);
      }

      // API: Get single conversation
      const convMatch = pathname.match(/^\/api\/conversations\/([^/]+)$/) && req.method === 'GET';
      if (convMatch) {
        const match = pathname.match(/^\/api\/conversations\/([^/]+)$/);
        if (match?.[1]) {
          const id = match[1];
          const conv = await store.getConversation(id);
          if (!conv) {
            return Response.json({ error: 'Conversation not found' }, { status: 404 });
          }
          const data = await conv.load();
          return Response.json(data);
        }
      }

      // API: List runs for a conversation
      const runsMatch = pathname.match(/^\/api\/conversations\/([^/]+)\/runs$/);
      if (runsMatch && req.method === 'GET') {
        const id = runsMatch[1];
        if (id) {
          const conv = await store.getConversation(id);
          if (!conv) {
            return Response.json({ error: 'Conversation not found' }, { status: 404 });
          }
          const runs = await conv.listRuns();
          return Response.json(
            runs.map((r) => ({
              id: r.id,
              type: r.type,
              timestamp: r.timestamp ?? null,
            }))
          );
        }
      }

      // API: Get single run
      const runMatch = pathname.match(/^\/api\/conversations\/([^/]+)\/runs\/([^/]+)$/);
      if (runMatch && req.method === 'GET') {
        const convId = runMatch[1];
        const runId = runMatch[2];
        if (convId && runId) {
          const conv = await store.getConversation(convId);
          if (!conv) {
            return Response.json({ error: 'Conversation not found' }, { status: 404 });
          }
          const runs = await conv.listRuns();
          const run = runs.find((r) => r.id === runId);
          if (!run) {
            return Response.json({ error: 'Run not found' }, { status: 404 });
          }

          if (run.type === 'tally') {
            const content = await Bun.file(run.path).text();
            return new Response(content, {
              headers: { 'content-type': 'application/json; charset=utf-8' },
            });
          }

          const data = await run.load();
          return Response.json(data);
        }
      }

      // API: Get trajectory data
      const trajMatch = pathname.match(/^\/api\/conversations\/([^/]+)\/trajectory$/);
      if (trajMatch && req.method === 'GET') {
        const id = trajMatch[1];
        if (id) {
          const [meta, steps] = await Promise.all([
            store.loadTrajectoryMeta(id),
            store.loadTrajectoryStepTraces(id),
          ]);
          return Response.json({ meta, steps });
        }
      }

      // Serve static files
      const staticResponse = await serveStaticFile(distDir, pathname);
      if (staticResponse) {
        return staticResponse;
      }

      return new Response('Not found', { status: 404 });
    },
  });

  return server;
}
