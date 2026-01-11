# Store Layer Architecture

## Overview

The store layer provides a **backend-agnostic API** for reading and writing tally data. Consumers (CLI, tally, trajectories) use `TallyStore`, `ConversationRef`, and `RunRef` without knowing whether data lives on the filesystem, S2 streams, or Redis.

---

## Design Principles

1. **Backend transparency** — Consumers never see `IStorage` or backends
2. **Ref-based handles** — `*Ref` objects are lightweight references, data loaded on demand
3. **Unified read/write** — Same API for CLI (read) and tally/trajectories (write)
4. **Config-driven** — Backend selection via `tally.config.ts`, not code

---

## API Overview

### TallyStore — Entry Point

```typescript
import { TallyStore } from '@tally-evals/core';

// Open store (resolves config, creates appropriate storage backend)
const store = await TallyStore.open({ cwd: '/path/to/project' });

// List all conversations
const conversations = await store.listConversations();  // ConversationRef[]

// Get specific conversation
const conv = await store.getConversation('travel-planner-golden');  // ConversationRef | null

// Create new conversation (for trajectories/tally to write)
const newConv = await store.createConversation('my-new-conv');  // ConversationRef
```

### ConversationRef — Conversation Handle

```typescript
interface ConversationRef {
  readonly id: string;
  readonly path: string;

  // Load conversation data
  load(): Promise<Conversation>;

  // Save conversation data (creates/overwrites)
  save(conversation: Conversation): Promise<void>;

  // List all runs for this conversation
  listRuns(): Promise<RunRef[]>;

  // Get specific run
  getRun(runId: string): Promise<RunRef | null>;

  // Create new run (for writing results)
  createRun(options: { type: 'tally' | 'trajectory'; runId?: string }): Promise<RunRef>;
}
```

### RunRef — Run Handle

```typescript
type RunType = 'tally' | 'trajectory';

interface RunRef {
  readonly id: string;
  readonly path: string;
  readonly type: RunType;

  // Load run data
  load(): Promise<EvaluationReport | TrajectoryRunMeta>;

  // Save run data
  save(data: EvaluationReport | TrajectoryRunMeta): Promise<void>;
}
```

---

## Usage Examples

### CLI — Read Only

```typescript
import { TallyStore } from '@tally-evals/core';

const store = await TallyStore.open({ cwd: options.directory });

// Browse conversations
const conversations = await store.listConversations();
for (const conv of conversations) {
  console.log(conv.id);
}

// Load conversation and report
const conv = await store.getConversation('travel-planner-golden');
const conversation = await conv.load();

const runs = await conv.listRuns();
const report = await runs[0].load();

renderUI({ conversation, report });
```

### Trajectories — Write Results

```typescript
import { TallyStore, stepTracesToConversation } from '@tally-evals/core';

const store = await TallyStore.open();

// Create or get conversation
const conv = await store.getConversation(conversationId)
  ?? await store.createConversation(conversationId);

// Save conversation from step traces
const conversation = stepTracesToConversation(stepTraces, { conversationId });
await conv.save(conversation);

// Create and save trajectory run
const run = await conv.createRun({ type: 'trajectory' });
await run.save({
  runId: run.id,
  conversationId,
  timestamp: new Date(),
  goal,
  persona,
  completed: true,
  reason: 'goal-reached',
  totalTurns: stepTraces.length,
});
```

### Tally — Write Evaluation Report

```typescript
import { TallyStore } from '@tally-evals/core';

const store = await TallyStore.open();

const conv = await store.getConversation(conversationId);
if (!conv) throw new Error('Conversation not found');

// Create and save evaluation run
const run = await conv.createRun({ type: 'tally' });
await run.save(evaluationReport);

console.log(`Saved report: ${run.id}`);
```

---

## Implementation Details

### TallyStore Class

```typescript
class TallyStore {
  private storage: IStorage;
  private basePath: string;

  private constructor(storage: IStorage, basePath: string) {
    this.storage = storage;
    this.basePath = basePath;
  }

  static async open(options?: {
    cwd?: string;
    config?: TallyConfigInput;
  }): Promise<TallyStore> {
    const config = await resolveConfig({
      cwd: options?.cwd,
      overrides: options?.config,
    });
    const storage = createStorage(config.storage);
    const basePath = config.storage.path ?? '.tally';
    return new TallyStore(storage, basePath);
  }

  async listConversations(): Promise<ConversationRef[]> {
    const conversationsPath = this.storage.join(this.basePath, 'conversations');
    const entries = await this.storage.list(conversationsPath).catch(() => []);
    return entries
      .filter(e => e.isDirectory)
      .map(e => new ConversationRef(this.storage, e.path, e.id));
  }

  async getConversation(id: string): Promise<ConversationRef | null> {
    const path = this.storage.join(this.basePath, 'conversations', id);
    const stat = await this.storage.stat(path);
    return stat ? new ConversationRef(this.storage, path, id) : null;
  }

  async createConversation(id: string): Promise<ConversationRef> {
    const path = this.storage.join(this.basePath, 'conversations', id);
    // Ensure directory exists by writing placeholder or meta
    const metaPath = this.storage.join(path, 'meta.json');
    await this.storage.write(metaPath, JSON.stringify({
      id,
      createdAt: new Date().toISOString(),
    }));
    return new ConversationRef(this.storage, path, id);
  }
}
```

### ConversationRef Class

```typescript
class ConversationRef {
  constructor(
    private storage: IStorage,
    public readonly path: string,
    public readonly id: string,
  ) {}

  async load(): Promise<Conversation> {
    const jsonlPath = this.storage.join(this.path, 'conversation.jsonl');
    const content = await this.storage.read(jsonlPath);
    return decodeConversation(content);
  }

  async save(conversation: Conversation): Promise<void> {
    const jsonlPath = this.storage.join(this.path, 'conversation.jsonl');
    const content = encodeConversation(conversation);
    await this.storage.write(jsonlPath, content);
  }

  async listRuns(): Promise<RunRef[]> {
    const runs: RunRef[] = [];

    for (const type of ['tally', 'trajectory'] as const) {
      const runsPath = this.storage.join(this.path, 'runs', type);
      const entries = await this.storage.list(runsPath).catch(() => []);
      for (const e of entries) {
        if (!e.isDirectory) {
          const runId = e.id.replace(/\.json$/, '');
          runs.push(new RunRef(this.storage, e.path, runId, type));
        }
      }
    }

    return runs;
  }

  async getRun(runId: string): Promise<RunRef | null> {
    for (const type of ['tally', 'trajectory'] as const) {
      const runPath = this.storage.join(this.path, 'runs', type, `${runId}.json`);
      const stat = await this.storage.stat(runPath);
      if (stat) return new RunRef(this.storage, runPath, runId, type);
    }
    return null;
  }

  async createRun(options: {
    type: 'tally' | 'trajectory';
    runId?: string;
  }): Promise<RunRef> {
    const runId = options.runId ?? generateRunId();
    const runPath = this.storage.join(
      this.path, 'runs', options.type, `${runId}.json`
    );
    return new RunRef(this.storage, runPath, runId, options.type);
  }
}
```

### RunRef Class

```typescript
class RunRef {
  constructor(
    private storage: IStorage,
    public readonly path: string,
    public readonly id: string,
    public readonly type: 'tally' | 'trajectory',
  ) {}

  async load(): Promise<EvaluationReport | TrajectoryRunMeta> {
    const content = await this.storage.read(this.path);
    if (this.type === 'tally') {
      return decodeReport(content);
    }
    return JSON.parse(content) as TrajectoryRunMeta;
  }

  async save(data: EvaluationReport | TrajectoryRunMeta): Promise<void> {
    const content = this.type === 'tally'
      ? encodeReport(data as EvaluationReport)
      : JSON.stringify(data, null, 2);
    await this.storage.write(this.path, content);
  }
}
```

---

## Storage Structure

Tally uses a unified storage structure under the `.tally` directory (or your configured path). All artifacts for a given conversation ID are grouped together to enable easy discovery and debugging.

```text
.tally/
└── conversations/
    └── <conversation-id>/
        ├── meta.json             # Basic conversation metadata (ID, createdAt)
        ├── conversation.jsonl    # Canonical conversation in JSON Lines format
        ├── trajectory.meta.json  # (Optional) Snapshot of trajectory definition
        ├── stepTraces.json       # (Optional) Rich execution traces (StepTrace[])
        └── runs/                 # Results of evaluations or trajectory runs
            ├── tally/            # Tally evaluation reports (.json)
            └── trajectory/       # Trajectory run summary/metadata (.json)
```

### Artifact Roles

1. **`conversation.jsonl`**: The source of truth for evaluation. Used by Tally to run metrics.
2. **`stepTraces.json`**: Preserves execution context (step IDs, selection methods) for debugging in the CLI.
3. **`trajectory.meta.json`**: Stores the static trajectory definition (goal, persona, steps) for replaying or inspecting the original intent.

---

## Directory Structure in Core

```
src/store/
├── index.ts           # Exports TallyStore, ConversationRef, RunRef
├── TallyStore.ts      # TallyStore class
├── ConversationRef.ts # ConversationRef class
└── RunRef.ts          # RunRef class
```

---

## Exports

```typescript
// From @tally-evals/core

// Store classes
export { TallyStore, ConversationRef, RunRef } from './store';

// Store types (if needed)
export type { RunType } from './store';
```

