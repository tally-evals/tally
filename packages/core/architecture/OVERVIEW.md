# @tally-evals/core — Architecture Overview

## Purpose

Core is the foundational package providing shared types, configuration management, storage APIs, and a high-level store abstraction for the tally ecosystem. All other packages depend on core; core has no internal dependencies.

---

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

---

## Core Responsibilities

| Domain | What Core Provides |
|--------|-------------------|
| **Types** | `Conversation`, `ConversationStep`, `StepTrace`, run metadata types |
| **Config** | `tally.config.ts` resolution, `.tally/` folder detection, defaults |
| **Storage** | Low-level multi-backend I/O (Local, S2, Redis Streams) |
| **Store** | High-level `TallyStore`, `ConversationRef`, `RunRef` abstractions |
| **Codecs** | Zod-based encode/decode for Conversation and Report |
| **Conversion** | `StepTrace[]` ↔ `Conversation` transformations |
| **Message Utils** | Tool call extraction, text extraction from ModelMessage |

---

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

## Type Ownership

Core is the canonical source for shared types. Other packages import from core.

```
core owns:
├── ModelMessage (re-export from 'ai' SDK)
├── Conversation / ConversationStep
├── StepTrace
├── TrajectoryRunMeta / TrajectoryStopReason
├── TallyRunMeta
├── ExtractedToolCall / ExtractedToolResult
├── TallyConfig / StorageConfig
├── IStorage interface + adapters
├── Codecs (ConversationCodec, EvaluationReportCodec)
├── Store (TallyStore, ConversationRef, RunRef)
└── Message utilities (tool call extraction, text extraction)
```

---

## Storage Backends

Core supports multiple storage backends through a unified `IStorage` interface:

| Backend | Use Case | Package |
|---------|----------|---------|
| **LocalStorage** | Development, CI, single-machine | Built-in |
| **S2Storage** | Cloud-native, serverless streams | `@s2-dev/streamstore` |
| **RedisStorage** | Real-time, distributed systems | `ioredis` |

All backends implement the same interface, enabling seamless switching via configuration. **Consumers use `TallyStore` and never interact with backends directly.**

---

## Logical Folder Structure

The store layer manages this logical structure across all backends:

```
{storageRoot}/
├── conversations/
│   └── {conversationId}/
│       ├── meta.json               # Conversation metadata
│       ├── conversation.jsonl      # Conversation steps
│       └── runs/
│           ├── trajectory/
│           │   └── {runId}.json    # Trajectory run results
│           └── tally/
│               └── {runId}.json    # Evaluation reports
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
7. **Streaming-first** — S2 and Redis designed for append-only streams
