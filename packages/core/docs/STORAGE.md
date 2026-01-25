# Storage Architecture

## Two-Layer Design

1. **Store Layer** (high-level) — `TallyStore`, `ConversationRef`, `RunRef`
   - Backend-agnostic API for consumers
   - **Primary API for all packages**

2. **Storage Layer** (low-level) — `IStorage` interface + adapters
   - Raw I/O operations
   - **Not used directly by consumers**

## IStorage Interface

```typescript
interface IStorage {
  list(dirPath: string): Promise<StorageEntry[]>;
  join(...segments: string[]): string;
  read(filePath: string): Promise<string>;
  write(filePath: string, content: string): Promise<void>;
  append?(filePath: string, content: string): Promise<void>;
  stat(filePath: string): Promise<{ isDirectory: boolean } | null>;
  delete(filePath: string): Promise<void>;
}
```

## Backend Implementations

| Backend | Use Case | Package |
|---------|----------|---------|
| **LocalStorage** | Development, CI, single-machine | Built-in |
| **S2Storage** | Cloud-native, serverless streams | `@s2-dev/streamstore` |
| **RedisStorage** | Real-time, distributed systems | `ioredis` |

## Logical Data Model

```
{storageRoot}/
├── conversations/
│   └── {conversationId}/
│       ├── meta.json               # Conversation metadata
│       ├── conversation.jsonl      # Conversation steps (JSONL)
│       └── runs/
│           ├── trajectory/
│           │   └── {runId}.json    # Trajectory run results
│           └── tally/
│               └── {runId}.json    # Evaluation reports
```

---

## Store API

### TallyStore — Entry Point

```typescript
const store = await TallyStore.open({ cwd: '/path/to/project' });
const conversations = await store.listConversations();
const conv = await store.getConversation('travel-planner-golden');
```

### ConversationRef — Conversation Handle

```typescript
interface ConversationRef {
  readonly id: string;
  load(): Promise<Conversation>;
  save(conversation: Conversation): Promise<void>;
  listRuns(): Promise<RunRef[]>;
  getRun(runId: string): Promise<RunRef | null>;
  createRun(options: { type: 'tally' | 'trajectory' }): Promise<RunRef>;
}
```

### RunRef — Run Handle

```typescript
interface RunRef {
  readonly id: string;
  readonly type: 'tally' | 'trajectory';
  load(): Promise<TallyRunArtifact | TrajectoryRunMeta>;
  save(data: TallyRunArtifact | TrajectoryRunMeta): Promise<void>;
}
```

---

## Usage Examples

### Reading a Conversation

```typescript
import { TallyStore } from '@tally-evals/core';

const store = await TallyStore.open({ cwd: process.cwd() });
const convRef = await store.getConversation('my-conversation');

if (convRef) {
  const conversation = await convRef.load();
  console.log(`Loaded ${conversation.steps.length} steps`);
}
```

### Saving Evaluation Results

```typescript
const store = await TallyStore.open({ cwd: process.cwd() });
const convRef = await store.getConversation('my-conversation');

if (convRef) {
  const runRef = await convRef.createRun({ type: 'tally' });
  await runRef.save(tallyRunArtifact);
  console.log(`Saved run ${runRef.id}`);
}
```

### Listing All Runs

```typescript
const store = await TallyStore.open({ cwd: process.cwd() });
const conversations = await store.listConversations();

for (const convRef of conversations) {
  const runs = await convRef.listRuns();
  console.log(`${convRef.id}: ${runs.length} runs`);
}
```

---

## Creating a Custom Storage Adapter

Implement the `IStorage` interface:

```typescript
import type { IStorage, StorageEntry } from '@tally-evals/core';

class MyCustomStorage implements IStorage {
  async list(dirPath: string): Promise<StorageEntry[]> {
    // Return array of { name: string; isDirectory: boolean }
  }

  join(...segments: string[]): string {
    // Join path segments
  }

  async read(filePath: string): Promise<string> {
    // Return file contents as string
  }

  async write(filePath: string, content: string): Promise<void> {
    // Write content to file
  }

  async stat(filePath: string): Promise<{ isDirectory: boolean } | null> {
    // Return file stats or null if not found
  }

  async delete(filePath: string): Promise<void> {
    // Delete file
  }
}
```
