# @tally-evals/core — Architecture

## Purpose

Core is the foundational package providing shared types, configuration management, storage APIs, and a high-level store abstraction for the tally ecosystem. All other packages depend on core; core has no internal dependencies.

## Package Dependency Graph

```
                    ┌─────────────────┐
                    │  @tally-evals/  │
                    │      core       │
                    │                 │
                    │  • Types        │
                    │  • Config       │
                    │  • Storage      │
                    │  • Store        │
                    │  • Codecs       │
                    └────────┬────────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
           ▼                 ▼                 ▼
┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐
│ @tally-evals/    │ │ @tally-evals/│ │ @tally-evals/    │
│  trajectories    │ │    tally     │ │      cli         │
│                  │ │              │ │                  │
│ Trajectory exec  │ │ Evaluation   │ │ Showcase/commands│
│ Writes via Store │ │ Writes via   │ │ Reads via Store  │
│                  │ │ Store        │ │                  │
└──────────────────┘ └──────────────┘ └──────────────────┘
```

## Layered Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Consumers (CLI, tally, trajectories)         │
│       TallyStore.open() → conversation.load() / save()      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Store Layer (src/store/)                  │
│  TallyStore, ConversationRef, RunRef                        │
│  • Backend-agnostic domain objects                          │
│  • Owns logical folder structure knowledge                  │
│  • Delegates I/O to Storage, serialization to Codecs        │
└─────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│   IStorage     │  │    Codecs      │  │    Config      │
│ Local/S2/Redis │  │ Conv/Report    │  │ resolveConfig  │
└────────────────┘  └────────────────┘  └────────────────┘
```

---

## Directory Structure

```
packages/core/
├── src/
│   ├── index.ts                   # Public exports
│   │
│   ├── types/                     # Shared type definitions
│   │   ├── index.ts               # Type re-exports
│   │   ├── primitives.ts          # MetricScalar, Score, ValueTypeFor
│   │   ├── messages.ts            # ModelMessage re-export from 'ai'
│   │   ├── conversation.ts        # Conversation, ConversationStep
│   │   ├── stepTrace.ts           # StepTrace, TrajectoryStopReason
│   │   ├── trajectoryMeta.ts      # TrajectoryMeta
│   │   ├── runs.ts                # TrajectoryRunMeta, TallyRunMeta
│   │   ├── toolCalls.ts           # ExtractedToolCall, ExtractedToolResult
│   │   ├── normalization.ts       # Normalization context types
│   │   ├── metrics.ts             # Metric definition types
│   │   ├── scorers.ts             # Scorer types
│   │   ├── evaluators.ts          # Eval types
│   │   ├── results.ts             # Result types (Measurement, EvalOutcome, etc.)
│   │   ├── runArtifact.ts         # TallyRunArtifact (serialization)
│   │   ├── runReport.ts           # TallyRunReport (SDK)
│   │   ├── runView.ts             # TargetRunView
│   │   └── tally.ts               # Tally container type
│   │
│   ├── config/                    # Configuration management
│   │   ├── index.ts               # Config exports
│   │   ├── types.ts               # TallyConfig, TallyConfigInput
│   │   ├── schema.ts              # Zod validation schemas
│   │   ├── defaults.ts            # DEFAULT_CONFIG
│   │   ├── resolver.ts            # resolveConfig, detectConfigFile
│   │   ├── loader.ts              # Load .ts/.js config files
│   │   └── helpers.ts             # defineConfig, isInTallyProject
│   │
│   ├── storage/                   # Low-level storage abstractions
│   │   ├── index.ts               # Storage exports
│   │   ├── storage.interface.ts   # IStorage, StorageEntry
│   │   ├── factory.ts             # createStorage factory
│   │   └── adapters/
│   │       ├── index.ts           # Adapter exports
│   │       ├── local.ts           # LocalStorage (filesystem)
│   │       ├── s2.ts              # S2Storage (s2.dev)
│   │       └── redis.ts           # RedisStorage (ioredis)
│   │
│   ├── store/                     # High-level store abstraction
│   │   ├── index.ts               # Store exports
│   │   ├── TallyStore.ts          # TallyStore class (entry point)
│   │   ├── ConversationRef.ts     # ConversationRef class
│   │   └── RunRef.ts              # RunRef class
│   │
│   ├── codecs/                    # Serialization codecs
│   │   ├── index.ts               # Codec exports
│   │   ├── conversation.ts        # ConversationCodec (JSONL)
│   │   └── runArtifact.ts         # Run artifact codec (JSON)
│   │
│   ├── conversion/                # Type conversions
│   │   ├── index.ts               # Conversion exports
│   │   ├── stepTraceToConversation.ts
│   │   └── conversationToStepTrace.ts
│   │
│   ├── utils/                     # Utilities
│   │   ├── index.ts               # Utility exports
│   │   ├── scan.ts                # scanTallyDirectory
│   │   ├── ids.ts                 # ID generation
│   │   ├── toolCalls.ts           # Tool call extraction utilities
│   │   └── text.ts                # Text extraction from messages
│   │
│   └── constants.ts               # Path constants
│
├── test/
│   ├── fixtures/                  # Test fixtures
│   ├── unit/                      # Unit tests
│   └── e2e/                       # End-to-end tests
│
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── ARCHITECTURE.md                # This file
```

---

## Core Responsibilities

| Domain | What Core Provides |
|--------|-------------------|
| **Types** | `Conversation`, `ConversationStep`, `StepTrace`, run metadata, result types |
| **Config** | `tally.config.ts` resolution, `.tally/` folder detection, defaults |
| **Storage** | Low-level multi-backend I/O (Local, S2, Redis Streams) |
| **Store** | High-level `TallyStore`, `ConversationRef`, `RunRef` abstractions |
| **Codecs** | Zod-based encode/decode for Conversation and Run Artifact |
| **Conversion** | `StepTrace[]` ↔ `Conversation` transformations |
| **Message Utils** | Tool call extraction, text extraction from ModelMessage |

---

## Configuration

### Supported Formats (Priority Order)

1. `tally.config.ts` — TypeScript (recommended)
2. `tally.config.js` — JavaScript ESM
3. `tally.config.mjs` — JavaScript ESM explicit
4. `tally.config.cjs` — JavaScript CommonJS

### Configuration Schema

```typescript
interface TallyConfig {
  storage: {
    backend: 'local' | 's2' | 'redis';
    path?: string;
    autoCreate?: boolean;
    s2?: { basin: string; accessToken: string };
    redis?: { url: string; keyPrefix?: string; streamMaxLen?: number };
  };
  defaults?: { model?: string; temperature?: number; maxRetries?: number };
  trajectories?: { maxTurns?: number; generateLogs?: boolean };
  evaluation?: { parallelism?: number; timeout?: number };
}
```

### Example Configuration

```typescript
// tally.config.ts
import { defineConfig } from '@tally-evals/core';

export default defineConfig({
  storage: {
    backend: 'local',
  },
  defaults: {
    model: 'google:gemini-2.5-flash',
    temperature: 0,
  },
});
```

---

## Storage Architecture

### Two-Layer Design

1. **Store Layer** (high-level) — `TallyStore`, `ConversationRef`, `RunRef`
   - Backend-agnostic API for consumers
   - **Primary API for all packages**

2. **Storage Layer** (low-level) — `IStorage` interface + adapters
   - Raw I/O operations
   - **Not used directly by consumers**

### IStorage Interface

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

### Backend Implementations

| Backend | Use Case | Package |
|---------|----------|---------|
| **LocalStorage** | Development, CI, single-machine | Built-in |
| **S2Storage** | Cloud-native, serverless streams | `@s2-dev/streamstore` |
| **RedisStorage** | Real-time, distributed systems | `ioredis` |

### Logical Data Model

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

## Type System

### Core Types

- **Primitives**: `MetricScalar`, `Score`, `Verdict`
- **Messages**: `ModelMessage` (re-export from AI SDK)
- **Conversation**: `Conversation`, `ConversationStep`
- **Trajectory**: `StepTrace`, `TrajectoryStopReason`
- **Results**: `Measurement`, `EvalOutcome`, `StepEvalResult`, `ConversationResult`

### Result Types

```typescript
interface Measurement<TValue extends MetricScalar = MetricScalar> {
  metricRef: MetricName;
  score?: Score;
  rawValue?: TValue | null;
  confidence?: number;
  reasoning?: string;
}

interface EvalOutcome<TValue extends MetricScalar = MetricScalar> {
  verdict: Verdict;
  policy: VerdictPolicyFor<TValue>;
  observed?: { rawValue?: TValue | null; score?: Score };
}
```

### Run Artifacts

- **`TallyRunArtifact`**: Persisted format for tooling (CLI, Viewer)
- **`TallyRunReport`**: SDK return type with helper methods

---

## External Dependencies

| Dependency | Purpose | Optional |
|-----------|---------|----------|
| `ai` | Re-export `ModelMessage` type | No |
| `zod` | Schema validation and codecs | No |
| `@s2-dev/streamstore` | S2 cloud storage | Yes (peer) |
| `ioredis` | Redis Streams storage | Yes (peer) |

---

## Key Design Decisions

1. **Core has no upward dependencies** — Only depends on `ai` SDK for types
2. **Multi-backend storage** — Unified interface, pluggable implementations
3. **Store abstraction** — Consumers use `TallyStore`/`*Ref`, never raw storage
4. **Ref-based naming** — `ConversationRef`/`RunRef` are storage-agnostic handles
5. **TypeScript config** — `tally.config.ts` over JSON for type safety
6. **Zod codecs** — Type-safe serialization with validation
7. **Names as IDs** — `EvalName`/`MetricName` are string keys; no separate IDs
8. **Step-indexed results** — Single-turn results indexed by `stepIndex`
