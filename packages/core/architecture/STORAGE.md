# Storage Architecture

## Overview

Core provides a **two-layer storage architecture**:

1. **Store Layer** (high-level) — `TallyStore`, `ConversationRef`, `RunRef`
   - Backend-agnostic API for consumers
   - See [STORE.md](./STORE.md) for details

2. **Storage Layer** (low-level) — `IStorage` interface + adapters
   - Raw I/O operations
   - Multiple backend implementations
   - **Not used directly by consumers**

---

## When to Use What

| Use Case | API |
|----------|-----|
| CLI reading conversations | `TallyStore` |
| Tally writing reports | `TallyStore` |
| Trajectories saving results | `TallyStore` |
| Building a new adapter | `IStorage` interface |
| Custom storage operations | `createStorage()` + `IStorage` |

**Rule of thumb:** If you're a consumer, use `TallyStore`. Only use `IStorage` for advanced/internal use cases.

---

## IStorage Interface

All storage backends implement this interface:

```typescript
interface IStorage {
  /** List entries in a directory-like path */
  list(dirPath: string): Promise<StorageEntry[]>;
  
  /** Join path segments (filesystem-agnostic) */
  join(...segments: string[]): string;
  
  /** Read content as string */
  read(filePath: string): Promise<string>;
  
  /** Write content (creates parent directories as needed) */
  write(filePath: string, content: string): Promise<void>;
  
  /** Append content (for streaming backends) */
  append?(filePath: string, content: string): Promise<void>;
  
  /** Get metadata about a path */
  stat(filePath: string): Promise<{ isDirectory: boolean } | null>;
  
  /** Delete a path */
  delete(filePath: string): Promise<void>;
}

interface StorageEntry {
  id: string;
  path: string;
  isDirectory?: boolean;
}
```

---

## Backend Implementations

### LocalStorage

Filesystem-based storage using Node.js `fs` module.

```typescript
import { LocalStorage } from '@tally-evals/core';

const storage = new LocalStorage();
await storage.write('/path/to/file.json', JSON.stringify(data));
```

**Best for:** Development, CI pipelines, single-machine deployments.

---

### S2Storage

Cloud-native streaming storage using [S2.dev](https://s2.dev/docs/concepts).

S2 provides:
- **Streams** — Unbounded sequence of records, always durable and totally ordered
- **Basins** — Container for streams (like S3 buckets)
- **Records** — Fundamental unit with seq num, timestamp, headers, and body

```typescript
import { S2Storage } from '@tally-evals/core';

const storage = new S2Storage({
  basin: 'my-basin',
  accessToken: process.env.S2_ACCESS_TOKEN,
});
```

**Best for:** Serverless, cloud-native applications, real-time streaming.

**Reference:** [@s2-dev/streamstore](https://www.npmjs.com/package/@s2-dev/streamstore)

---

### RedisStorage

Redis Streams-based storage using `ioredis`.

Redis Streams provides:
- **XADD** — Append entries to a stream
- **XREAD** — Read entries from streams
- **Consumer Groups** — Distributed processing

```typescript
import { RedisStorage } from '@tally-evals/core';

const storage = new RedisStorage({
  url: 'redis://localhost:6379',
  keyPrefix: 'tally:',
});
```

**Best for:** Real-time systems, distributed architectures, pub/sub patterns.

---

## Storage Factory

Create storage from configuration:

```typescript
import { createStorage } from '@tally-evals/core';

// From resolved config
const storage = createStorage(config.storage);

// Or explicitly
const storage = createStorage({ 
  backend: 's2',
  s2: {
    basin: 'my-basin',
    accessToken: '...',
  }
});
```

**Note:** `TallyStore.open()` calls `createStorage()` internally. You don't need to call it directly.

---

## Logical Data Model

The store layer manages this logical structure across all backends:

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

### Backend Path Mapping

| Logical Path | LocalStorage | S2Storage | RedisStorage |
|--------------|--------------|-----------|--------------|
| `conversations/conv-1/conversation.jsonl` | `.tally/conversations/conv-1/conversation.jsonl` | `conversations/conv-1/conversation` (stream) | `tally:conversations:conv-1:conversation` (stream) |
| `conversations/conv-1/runs/tally/run-1.json` | `.tally/conversations/conv-1/runs/tally/run-1.json` | `conversations/conv-1/runs/tally/run-1` (stream) | `tally:conversations:conv-1:runs:tally:run-1` (stream) |

---

## Backend Comparison

| Feature | Local | S2 | Redis |
|---------|-------|-----|-------|
| Persistence | Disk | Cloud | Memory + AOF |
| Scalability | Single node | Unlimited | Cluster |
| Real-time | No | Yes | Yes |
| Cost | Free | Pay-per-use | Infrastructure |
| Setup | None | Account | Server |
| Streaming | No | Native | Native |
| TTL Support | No | No | Yes |

---

## Configuration

Storage backend is configured in `tally.config.ts`:

```typescript
// tally.config.ts
import { defineConfig } from '@tally-evals/core';

export default defineConfig({
  storage: {
    backend: 's2', // 'local' | 's2' | 'redis'
    
    // Path for local backend (default: '.tally')
    path: '.tally',
    
    // Auto-create directories on write
    autoCreate: true,
    
    // S2 options (required if backend: 's2')
    s2: {
      basin: 'my-tally-basin',
      accessToken: process.env.S2_ACCESS_TOKEN,
    },
    
    // Redis options (required if backend: 'redis')
    redis: {
      url: process.env.REDIS_URL,
      keyPrefix: 'tally:',
      streamMaxLen: 10000, // Max entries per stream
    },
  },
});
```

---

## Adding a New Backend

To add a new storage backend:

1. Create `src/storage/adapters/mybackend.ts`
2. Implement `IStorage` interface
3. Export from `src/storage/adapters/index.ts`
4. Add to `createStorage()` factory in `src/storage/factory.ts`
5. Add config type in `src/config/types.ts`
6. Add tests in `test/e2e/storage-mybackend.test.ts`
