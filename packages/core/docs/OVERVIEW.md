# @tally-evals/core — Overview

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

## External Dependencies

| Dependency | Purpose | Optional |
|-----------|---------|----------|
| `ai` | Re-export `ModelMessage` type | No |
| `zod` | Schema validation and codecs | No |
| `@s2-dev/streamstore` | S2 cloud storage | Yes (peer) |
| `ioredis` | Redis Streams storage | Yes (peer) |

## Key Design Decisions

1. **Core has no upward dependencies** — Only depends on `ai` SDK for types
2. **Multi-backend storage** — Unified interface, pluggable implementations
3. **Store abstraction** — Consumers use `TallyStore`/`*Ref`, never raw storage
4. **Ref-based naming** — `ConversationRef`/`RunRef` are storage-agnostic handles
5. **TypeScript config** — `tally.config.ts` over JSON for type safety
6. **Zod codecs** — Type-safe serialization with validation
7. **Names as IDs** — `EvalName`/`MetricName` are string keys; no separate IDs
8. **Step-indexed results** — Single-turn results indexed by `stepIndex`

## Documentation Index

- [OVERVIEW.md](./OVERVIEW.md) — This file
- [STRUCTURE.md](./STRUCTURE.md) — Directory structure
- [CONFIG.md](./CONFIG.md) — Configuration management
- [STORAGE.md](./STORAGE.md) — Storage and Store APIs
- [TYPES.md](./TYPES.md) — Type system and type safety
