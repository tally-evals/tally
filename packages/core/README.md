# @tally-evals/core

Core types, configuration, and utilities for the Tally evaluation framework.

## Overview

This package provides the foundational building blocks for the tally ecosystem:

- **Shared Types** — Canonical type definitions for the entire evaluation system
- **Configuration** — Load `tally.config.ts` with type-safe `defineConfig()` helper
- **Storage** — Unified `IStorage` interface with Local, S2, and Redis adapters
- **Codecs** — Zod-based serialization for Conversation (JSONL) and Tally run artifacts (JSON)
- **Message Utilities** — Tool call extraction and text extraction from ModelMessage
- **Conversion** — Transform `StepTrace[]` ↔ `Conversation` for interop

## Installation

```bash
bun add @tally-evals/core
```

## Usage

### Types

The core package exports all canonical type definitions:

```typescript
import type {
  // Primitives
  MetricScalar,
  Score,
  DatasetItem,
  
  // Conversation types
  Conversation,
  ConversationStep,
  ModelMessage,
  
  // Trajectory types
  StepTrace,
  TrajectoryMeta,
  
  // Metric types
  MetricDef,
  SingleTurnMetricDef,
  MultiTurnMetricDef,
  Metric,
  
  // Aggregator types
  NumericAggregatorDef,
  BooleanAggregatorDef,
  CategoricalAggregatorDef,
  Aggregator,
  
  // Evaluator types
  Eval,
  Evaluator,
  VerdictPolicy,
  
  // Run outputs
  TallyRunReport,
  TargetRunView,
  TallyRunArtifact,
  
  // Utility types
  ExtractedToolCall,
  NormalizerSpec,
  ScoringContext,
} from '@tally-evals/core';

// Helper function
import { toScore } from '@tally-evals/core';
```

### Configuration

```typescript
// tally.config.ts
import { defineConfig } from '@tally-evals/core';

export default defineConfig({
  storage: {
    backend: 'local',
    path: '.tally',
  },
});
```

### Storage

```typescript
import { createStorage, LocalStorage } from '@tally-evals/core';

// Create from config
const storage = await createStorage(config);

// Or use directly
const localStorage = new LocalStorage();
await localStorage.write('path/to/file.json', JSON.stringify(data));
```

### Message Utilities

```typescript
import {
  extractToolCallsFromStep,
  extractTextFromMessage,
  hasToolCalls,
  getToolNames,
} from '@tally-evals/core';

const toolCalls = extractToolCallsFromStep(step);
const text = extractTextFromMessage(message);
const hasTools = hasToolCalls(step);
const toolNames = getToolNames(step);
```

### Conversion

```typescript
import {
  stepTracesToConversation,
  conversationToStepTraces,
} from '@tally-evals/core';

const conversation = stepTracesToConversation(stepTraces, 'conv-123');
const traces = conversationToStepTraces(conversation);
```

## Storage Structure

Tally uses a unified storage structure under the `.tally` directory (or your configured path). Everything related to a conversation is stored in a single folder:

```text
.tally/
└── conversations/
    └── <conversation-id>/
        ├── meta.json             # Basic conversation metadata
        ├── conversation.jsonl    # Canonical conversation history
        ├── trajectory.meta.json  # (Optional) Trajectory definition snapshot
        ├── stepTraces.json       # (Optional) Rich step-by-step traces
        └── runs/                 # Evaluation and run results
            ├── tally/            # Tally evaluation reports (.json)
            └── trajectory/       # Trajectory run metadata (.json)
```

## Dependencies

- **Required**: `zod`, `ai` (peer)
- **Optional**: `@s2-dev/streamstore` (for S2 storage), `ioredis` (for Redis storage)

## License

MIT
