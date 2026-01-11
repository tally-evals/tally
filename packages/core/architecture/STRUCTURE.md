# Package Structure

## Directory Layout

```
packages/core/
├── architecture/                  # Architecture documentation
│   ├── README.md
│   ├── OVERVIEW.md
│   ├── STORAGE.md
│   ├── STORE.md                   # Store layer documentation
│   ├── CONFIG.md
│   ├── TYPES.md
│   ├── MIGRATION.md
│   └── STRUCTURE.md
│
├── src/
│   ├── index.ts                   # Public exports
│   │
│   ├── types/                     # Shared type definitions
│   │   ├── index.ts               # Type re-exports
│   │   ├── messages.ts            # ModelMessage re-export from 'ai'
│   │   ├── conversation.ts        # Conversation, ConversationStep
│   │   ├── stepTrace.ts           # StepTrace, TrajectoryStopReason
│   │   ├── runs.ts                # TrajectoryRunMeta, TallyRunMeta
│   │   └── toolCalls.ts           # ExtractedToolCall, ExtractedToolResult
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
│   │   └── report.ts              # EvaluationReportCodec (JSON)
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
├── vitest.config.mts
├── docker-compose.yml             # Redis for e2e tests
├── biome.json
└── README.md
```

---

## Module Responsibilities

### `types/`

Defines canonical shared types. No runtime code, types only.

- `messages.ts` — Re-exports `ModelMessage` from `ai` SDK
- `conversation.ts` — `Conversation`, `ConversationStep` interfaces
- `stepTrace.ts` — `StepTrace`, `TrajectoryStopReason` types
- `runs.ts` — `TrajectoryRunMeta`, `TallyRunMeta` interfaces
- `toolCalls.ts` — `ExtractedToolCall`, `ExtractedToolResult` interfaces

### `config/`

Handles configuration file loading and resolution.

- `types.ts` — Configuration type definitions
- `schema.ts` — Zod schemas for validation
- `defaults.ts` — Default configuration values
- `resolver.ts` — Config detection and merging logic
- `loader.ts` — Dynamic import of `.ts`/`.js` config files
- `helpers.ts` — `defineConfig()` helper, project detection

### `storage/`

Low-level storage backend abstraction layer. **Not used directly by consumers.**

- `storage.interface.ts` — `IStorage` interface definition
- `factory.ts` — `createStorage()` factory function
- `adapters/local.ts` — Filesystem implementation
- `adapters/s2.ts` — S2.dev streaming implementation
- `adapters/redis.ts` — Redis Streams implementation

### `store/`

High-level, backend-agnostic store abstraction. **Primary API for consumers.**

- `TallyStore.ts` — Entry point, resolves config, manages conversations
- `ConversationRef.ts` — Handle for a conversation (load/save/listRuns)
- `RunRef.ts` — Handle for a run (load/save)

### `codecs/`

Zod-based codecs for serialization/deserialization.

- `conversation.ts` — JSONL ↔ `Conversation` codec
- `report.ts` — JSON ↔ `EvaluationReport` codec (handles Maps)

### `conversion/`

Utilities for converting between types.

- `stepTraceToConversation.ts` — `StepTrace[]` → `Conversation`
- `conversationToStepTrace.ts` — `Conversation` → `StepTrace[]`

### `utils/`

Miscellaneous utilities.

- `scan.ts` — `scanTallyDirectory()` function
- `ids.ts` — ID generation utilities (`generateRunId`, etc.)
- `toolCalls.ts` — Tool call extraction from ModelMessage
- `text.ts` — Text content extraction from messages

---

## Export Structure

### Main Entry (`index.ts`)

```typescript
// =============================================================================
// Types
// =============================================================================

export type {
  ModelMessage,
  Conversation,
  ConversationStep,
  StepTrace,
  TrajectoryStopReason,
  TrajectoryRunMeta,
  TallyRunMeta,
  ExtractedToolCall,
  ExtractedToolResult,
} from './types';

// =============================================================================
// Configuration
// =============================================================================

export { defineConfig, resolveConfig, getConfig } from './config';
export type { TallyConfig, TallyConfigInput } from './config';

// =============================================================================
// Storage (low-level, advanced use only)
// =============================================================================

export type { IStorage, StorageEntry } from './storage';
export { LocalStorage, S2Storage, RedisStorage, createStorage } from './storage';

// =============================================================================
// Store (high-level, primary API)
// =============================================================================

export { TallyStore, ConversationRef, RunRef } from './store';
export type { RunType } from './store';

// =============================================================================
// Codecs
// =============================================================================

export {
  ConversationCodec,
  EvaluationReportCodec,
  decodeConversation,
  encodeConversation,
  decodeReport,
  encodeReport,
} from './codecs';

export type { EvaluationReport } from './codecs';

// =============================================================================
// Conversion
// =============================================================================

export { stepTracesToConversation, conversationToStepTraces } from './conversion';

// =============================================================================
// Utils
// =============================================================================

// Tool call extraction
export {
  extractToolCallFromMessage,
  extractToolCallsFromMessages,
  extractToolCallsFromStep,
  extractToolResultsFromMessages,
  matchToolCallsWithResults,
  hasToolCalls,
  hasToolCall,
  getToolNames,
  countToolCallsByType,
  assertToolCallSequence,
} from './utils';

// Text extraction
export {
  extractTextFromMessage,
  extractTextFromMessages,
  extractToolResultContent,
  hasTextContent,
  getFirstTextContent,
} from './utils';

// Directory scanning
export {
  scanTallyDirectory,
  hasTallyDirectory,
  getConversationsPath,
  getConversationPath,
  getRunsPath,
} from './utils';

// ID generation
export {
  generateRunId,
  generateConversationId,
  generateTrajectoryId,
  extractTimestampFromId,
} from './utils';

// =============================================================================
// Constants
// =============================================================================

export {
  CONVERSATIONS,
  CONVERSATION,
  RUNS,
  TRAJECTORY,
  TALLY,
  META,
  RUN_INDEX,
} from './constants';
```

---

## Dependencies

### Runtime Dependencies

```json
{
  "dependencies": {
    "zod": "^3.x"
  },
  "peerDependencies": {
    "ai": "^4.x",
    "@s2-dev/streamstore": "^0.21.x",
    "ioredis": "^5.x"
  },
  "peerDependenciesMeta": {
    "@s2-dev/streamstore": { "optional": true },
    "ioredis": { "optional": true }
  }
}
```

### Dev Dependencies

```json
{
  "devDependencies": {
    "@s2-dev/streamstore": "^0.21.x",
    "@tally-evals/biome-config": "workspace:*",
    "@tally-evals/typescript-config": "workspace:*",
    "@types/node": "^20.x",
    "dotenv": "^17.x",
    "ioredis": "^5.x",
    "tsup": "^8.x",
    "typescript": "^5.x",
    "vitest": "^4.x"
  }
}
```

---

## Build Configuration

### tsup.config.ts

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
});
```

### tsconfig.json

```json
{
  "extends": "@tally-evals/typescript-config/strict.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "test"]
}
```
