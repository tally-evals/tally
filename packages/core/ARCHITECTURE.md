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

## Types and Type Safety

Tally provides a sophisticated type system that enables compile-time safety, IDE autocomplete, and runtime validation. The type system is designed around three key principles:

1. **Single Source of Truth** — All result types defined with type parameters
2. **Defaults for Flexibility** — Type params default to base types for untyped usage
3. **Literal Type Preservation** — Eval names preserved as literal types via `as const`

### Primitive Types

```typescript
// Value types that metrics can produce
type MetricScalar = number | boolean | string;

// Normalized score (always 0..1)
type Score = number;

// Verdict result from policy evaluation
type Verdict = 'pass' | 'fail' | 'unknown';

// Value type discriminator for metrics
type ValueTypeFor<T> = T extends number ? 'number' | 'ordinal'
                     : T extends boolean ? 'boolean'
                     : 'string';
```

### Type-Safe Results

All result types are parameterized by the metric value type, enabling type-safe access to `rawValue`, verdict policies, and normalization contexts:

```typescript
// Measurement with typed rawValue
interface Measurement<TValue extends MetricScalar = MetricScalar> {
  metricRef: MetricName;
  score?: Score;
  rawValue?: TValue | null;  // ← Typed to number/boolean/string
  confidence?: number;
  reasoning?: string;
  normalization?: NormalizationInfo<TValue>;
}

// Eval outcome with typed policy
interface EvalOutcome<TValue extends MetricScalar = MetricScalar> {
  verdict: Verdict;
  policy: VerdictPolicyFor<TValue>;  // ← Policy kind matches value type
  observed?: { rawValue?: TValue | null; score?: Score };
}
```

### Type Extraction Utilities

The framework provides utility types to extract information from eval definitions:

```typescript
// Extract eval name as literal type
type ExtractEvalName<TEval> = TEval extends { readonly name: infer N extends string } ? N : never;

// Extract metric value type from eval
type ExtractValueType<TEval> = TEval extends { metric: { valueType: infer VT } }
  ? VT extends 'number' | 'ordinal' ? number
  : VT extends 'boolean' ? boolean
  : string
  : MetricScalar;

// Filter evals by kind
type FilterByKind<TEvals extends readonly Eval[], TKind> = Extract<TEvals[number], { kind: TKind }>;

// Get eval names of a specific kind
type EvalNamesOfKind<TEvals extends readonly Eval[], TKind> = ExtractEvalName<FilterByKind<TEvals, TKind>>;
```

### Mapped Result Types

Results are mapped from the evals tuple, providing type-safe keys with autocomplete:

```typescript
// Single-turn results keyed by eval name
type SingleTurnResults<TEvals extends readonly Eval[]> = {
  readonly [K in EvalNamesOfKind<TEvals, 'singleTurn'>]: SingleTurnEvalSeries<
    ExtractValueType<Extract<FilterByKind<TEvals, 'singleTurn'>, { name: K }>>
  >;
};

// Multi-turn results keyed by eval name
type MultiTurnResults<TEvals extends readonly Eval[]> = {
  readonly [K in EvalNamesOfKind<TEvals, 'multiTurn'>]: ConversationEvalResult<
    ExtractValueType<Extract<FilterByKind<TEvals, 'multiTurn'>, { name: K }>>
  >;
};
```

### Using Type-Safe Reports

When using `createTally` with `as const` evals, the report provides full type safety:

```typescript
const evals = [
  defineSingleTurnEval({ name: 'Answer Relevance', metric: relevanceMetric }),
  defineMultiTurnEval({ name: 'Goal Completion', metric: goalMetric }),
] as const;

const tally = createTally({ data: [conversation], evals });
const report = await tally.run();

// ✅ Autocomplete works — only valid eval names accepted
report.result.singleTurn['Answer Relevance'];
report.result.multiTurn['Goal Completion'];

// ❌ Compile error — typo caught at build time
report.result.singleTurn['Anser Relevance'];
```

### View API Type Safety

The `TargetRunView` provides type-safe accessors for step and conversation results:

```typescript
// Type-safe step results
type StepResults<TEvals extends readonly Eval[]> = {
  readonly [K in EvalNamesOfKind<TEvals, 'singleTurn'>]: StepEvalResult<
    ExtractValueType<Extract<FilterByKind<TEvals, 'singleTurn'>, { name: K }>>
  >;
} & {
  readonly [K in EvalNamesOfKind<TEvals, 'scorer'>]?: StepEvalResult<number>;
};

// Type-safe conversation results
type ConversationResults<TEvals extends readonly Eval[]> = {
  readonly [K in EvalNamesOfKind<TEvals, 'multiTurn'>]: ConversationEvalResult<
    ExtractValueType<Extract<FilterByKind<TEvals, 'multiTurn'>, { name: K }>>
  >;
} & {
  readonly [K in EvalNamesOfKind<TEvals, 'scorer'>]?: ConversationEvalResult<number>;
};
```

### Verdict Policy Type Safety

Verdict policies are typed to match the metric value type:

```typescript
// Policy kind is constrained by value type
type VerdictPolicyFor<TValue extends MetricScalar> =
  TValue extends number
    ? { kind: 'number'; type: 'threshold'; passAt: number }
    | { kind: 'number'; type: 'range'; min?: number; max?: number }
  : TValue extends boolean
    ? { kind: 'boolean'; passWhen: boolean }
  : { kind: 'ordinal'; passWhenIn: readonly string[] };
```

### Serializable Snapshots

For persistence, types have serializable "snapshot" variants that handle non-serializable values:

```typescript
// Custom normalizers become placeholders
type NormalizerSpecSnap =
  | Exclude<NormalizerSpec, { type: 'custom' }>
  | { type: 'custom'; note: 'not-serializable' };

// Custom verdict functions become placeholders
type VerdictPolicyInfo =
  | { kind: 'none' }
  | { kind: 'boolean'; passWhen: boolean }
  | { kind: 'number'; type: 'threshold'; passAt: number }
  | { kind: 'number'; type: 'range'; min?: number; max?: number }
  | { kind: 'ordinal'; passWhenIn: readonly string[] }
  | { kind: 'custom'; note: 'not-serializable' };
```

### Run Artifacts vs Reports

- **`TallyRunArtifact`**: Persisted format for tooling (CLI, Viewer) — uses snapshot types
- **`TallyRunReport`**: SDK return type with helper methods — preserves full types

```typescript
interface TallyRunReport<TEvals extends readonly Eval[]> {
  runId: RunId;
  result: ConversationResult<TEvals>;
  
  // Helper methods
  toArtifact(): TallyRunArtifact;
  view(): TargetRunView<TEvals>;
}
```

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
