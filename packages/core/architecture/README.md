# @tally-evals/core — Architecture

This folder contains architectural documentation for the core package.

## Documents

| Document | Description |
|----------|-------------|
| [OVERVIEW.md](./OVERVIEW.md) | High-level architecture and layered design |
| [STRUCTURE.md](./STRUCTURE.md) | Package directory layout and exports |
| [TYPES.md](./TYPES.md) | Shared type definitions |
| [STORE.md](./STORE.md) | High-level store API (TallyStore, ConversationRef, RunRef) |
| [STORAGE.md](./STORAGE.md) | Low-level storage backend abstractions |
| [CONFIG.md](./CONFIG.md) | Configuration management |
| [MIGRATION.md](./MIGRATION.md) | Migration guide from store package |

## Quick Reference

```
┌─────────────────────────────────────────────┐
│              Consumers (CLI, etc.)           │
│     TallyStore.open() → ref.load()/save()   │
└─────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│         Store Layer (src/store/)             │
│   TallyStore, ConversationRef, RunRef       │
└─────────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌─────────────┐ ┌──────────┐ ┌──────────┐
│  IStorage   │ │  Codecs  │ │  Config  │
│ Local/S2/   │ │ Conv/    │ │ resolve  │
│ Redis       │ │ Report   │ │ Config   │
└─────────────┘ └──────────┘ └──────────┘
```

## Dependency Graph

```
@tally-evals/core
    ↑
    ├── @tally-evals/trajectories (writes via Store)
    ├── @tally-evals/tally (writes via Store)
    └── @tally-evals/cli (reads via Store)
```

Core is the foundational package with **zero internal dependencies**.
