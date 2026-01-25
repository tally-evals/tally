# Directory Structure

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
├── docs/                          # Documentation
│   ├── OVERVIEW.md                # Package overview and architecture
│   ├── STRUCTURE.md               # This file
│   ├── CONFIG.md                  # Configuration guide
│   ├── STORAGE.md                 # Storage and Store APIs
│   └── TYPES.md                   # Type system reference
│
├── test/
│   ├── fixtures/                  # Test fixtures
│   ├── unit/                      # Unit tests
│   └── e2e/                       # End-to-end tests
│
├── package.json
├── tsconfig.json
└── tsup.config.ts
```
