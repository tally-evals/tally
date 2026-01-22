# Shared Types

## Overview

Core defines canonical types used across the tally ecosystem. All packages import these types from core to ensure consistency.

---

## Message Types

### ModelMessage

Re-exported from the AI SDK for consistency:

```typescript
// Re-export from 'ai' package
export type { ModelMessage } from 'ai';

// ModelMessage shape:
interface ModelMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
}
```

---

## Conversation Types

### ConversationStep

A single turn in a conversation:

```typescript
interface ConversationStep {
  /** Stable ordering within the conversation */
  stepIndex: number;
  
  /** User (or tool) request */
  input: ModelMessage;
  
  /** Assistant response(s) - array to capture tool calls and final response */
  output: readonly ModelMessage[];
  
  /** Provider message ID if available */
  id?: string;
  
  /** When this step occurred */
  timestamp?: Date;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}
```

### Conversation

A complete multi-turn conversation:

```typescript
interface Conversation {
  /** Unique conversation identifier */
  id: string;
  
  /** Ordered steps in the conversation */
  steps: readonly ConversationStep[];
  
  /** Conversation-level metadata */
  metadata?: Record<string, unknown>;
}
```

---

## Trajectory Types

### StepTrace

Raw trace from trajectory execution (before conversion to ConversationStep):

```typescript
interface StepTrace {
  /** Turn index within trajectory */
  turnIndex: number;
  
  /** Generated user message */
  userMessage: ModelMessage;
  
  /** All agent response messages (assistant + tool) */
  agentMessages: readonly ModelMessage[];
  
  /** When this step occurred */
  timestamp: Date;
  
  /** Associated step ID from step graph */
  stepId?: string;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}
```

### TrajectoryStopReason

Why a trajectory ended:

```typescript
type TrajectoryStopReason =
  | 'goal-reached'      // Terminal step reached
  | 'max-turns'         // Maximum turns exceeded
  | 'policy-violation'  // Policy determined violation
  | 'agent-loop'        // Loop detected
  | 'no-step-match'     // No step matches
  | 'error';            // Error occurred
```

---

## Run Metadata Types

### TrajectoryRunMeta

Metadata for a trajectory execution run:

```typescript
interface TrajectoryRunMeta {
  /** Unique run identifier */
  runId: string;
  
  /** Associated conversation ID */
  conversationId: string;
  
  /** When the run occurred */
  timestamp: Date;
  
  /** Trajectory goal */
  goal: string;
  
  /** Persona used */
  persona: {
    name?: string;
    description: string;
  };
  
  /** Whether goal was reached */
  completed: boolean;
  
  /** Why the trajectory ended */
  reason: TrajectoryStopReason;
  
  /** Number of turns executed */
  totalTurns: number;
  
  /** Number of steps in graph */
  stepCount?: number;
  
  /** Number of steps completed */
  stepsCompleted?: number;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}
```

### TallyRunMeta

Metadata for a tally evaluation run:

```typescript
interface TallyRunMeta {
  /** Unique run identifier */
  runId: string;
  
  /** Associated conversation ID */
  conversationId: string;
  
  /** When the run occurred */
  timestamp: Date;
  
  /** Evaluator names used */
  evaluatorNames: string[];
  
  /** Eval names used */
  evalNames: string[];
  
  /** Number of targets evaluated */
  targetCount: number;
  
  /** Quick summary for listings */
  summary: {
    /** Overall pass rate across all evals */
    overallPassRate?: number;
    
    /** Mean score per eval */
    evalMeans: Record<string, number>;
    
    /** Verdict counts */
    verdicts?: {
      pass: number;
      fail: number;
      unknown: number;
      total: number;
    };
  };
  
  /** Tags for filtering */
  tags?: string[];
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}
```

---

## Storage Types

### StorageEntry

Entry returned by storage list operations:

```typescript
interface StorageEntry {
  /** Entry identifier (filename or key) */
  id: string;
  
  /** Full path to entry */
  path: string;
  
  /** Whether this is a directory */
  isDirectory?: boolean;
}
```

### IStorage

Storage backend interface:

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

---

## Configuration Types

### TallyConfig

Full resolved configuration:

```typescript
interface TallyConfig {
  storage: {
    backend: 'local' | 's2' | 'redis';
    path?: string;
    autoCreate?: boolean;
    s2?: S2Config;
    redis?: RedisConfig;
  };
  defaults?: DefaultsConfig;
  trajectories?: TrajectoriesConfig;
  evaluation?: EvaluationConfig;
}

interface S2Config {
  basin: string;
  accessToken: string;
}

interface RedisConfig {
  url: string;
  keyPrefix?: string;
  streamMaxLen?: number;
}

interface DefaultsConfig {
  model?: string;
  temperature?: number;
  maxRetries?: number;
}

interface TrajectoriesConfig {
  maxTurns?: number;
  generateLogs?: boolean;
  loopDetection?: {
    maxConsecutiveSameStep?: number;
  };
}

interface EvaluationConfig {
  parallelism?: number;
  timeout?: number;
}
```

---

## Type Exports

All types are exported from the main entry point:

```typescript
// @tally-evals/core

// Message types
export type { ModelMessage } from './types/messages';

// Conversation types
export type { Conversation, ConversationStep } from './types/conversation';

// Trajectory types
export type { StepTrace, TrajectoryStopReason } from './types/stepTrace';

// Run types
export type { TrajectoryRunMeta, TallyRunMeta } from './types/runs';

// Storage types
export type { IStorage, StorageEntry } from './storage';

// Config types
export type { TallyConfig, S2Config, RedisConfig } from './config';

// Tool call types
export type { ExtractedToolCall, ExtractedToolResult } from './types/toolCalls';

// Utilities
export {
  extractToolCallFromMessage,
  extractToolCallsFromMessages,
  extractToolCallsFromStep,
  extractToolResultsFromMessages,
  matchToolCallsWithResults,
  extractTextFromMessage,
  extractTextFromMessages,
  hasToolCalls,
  hasToolCall,
  getToolNames,
} from './utils/messages';
```

---

## Tool Call Types

### ExtractedToolCall

Unified tool call representation:

```typescript
interface ExtractedToolCall {
  /** Unique tool call identifier */
  toolCallId: string;
  
  /** Name of the tool being invoked */
  toolName: string;
  
  /** Arguments passed to the tool (aliased as 'input' for compatibility) */
  args: unknown;
  
  /** Result from tool execution (populated after matching with tool results) */
  result?: unknown;
}
```

### ExtractedToolResult

Tool result representation:

```typescript
interface ExtractedToolResult {
  /** Tool call ID this result corresponds to */
  toolCallId: string;
  
  /** Name of the tool (if available) */
  toolName?: string;
  
  /** The tool's output */
  output: unknown;
}
```

---

## Message Utilities

### Tool Call Extraction

Core provides unified utilities for extracting tool calls from AI SDK messages:

```typescript
/**
 * Extract tool calls from a single ModelMessage
 * Handles both AI SDK formats:
 * - message.toolCalls array (native AI SDK)
 * - message.content[] with type: 'tool-call' parts (JSONL format)
 */
function extractToolCallFromMessage(message: ModelMessage): ExtractedToolCall[];

/**
 * Extract tool calls from multiple messages
 * Aggregates tool calls from all assistant messages
 */
function extractToolCallsFromMessages(
  messages: readonly ModelMessage[]
): ExtractedToolCall[];

/**
 * Extract tool calls from a ConversationStep
 * Also matches tool results from the output messages
 */
function extractToolCallsFromStep(step: ConversationStep): ExtractedToolCall[];

/**
 * Extract tool results from messages
 * Finds all tool messages and extracts their results
 */
function extractToolResultsFromMessages(
  messages: readonly ModelMessage[]
): ExtractedToolResult[];

/**
 * Match tool calls with their results
 * Returns tool calls with populated 'result' field
 */
function matchToolCallsWithResults(
  toolCalls: ExtractedToolCall[],
  toolResults: ExtractedToolResult[]
): ExtractedToolCall[];
```

### Tool Call Helpers

Convenience utilities for tool call analysis:

```typescript
/** Check if a step contains any tool calls */
function hasToolCalls(step: ConversationStep): boolean;

/** Check if a step contains a specific tool call */
function hasToolCall(step: ConversationStep, toolName: string): boolean;

/** Get all unique tool names used in a step */
function getToolNames(step: ConversationStep): string[];

/** Count tool calls by type across conversation */
function countToolCallsByType(
  conversation: { steps: readonly ConversationStep[] }
): Map<string, number>;

/** Assert all tool calls have matching results */
function assertToolCallSequence(step: ConversationStep): void;
```

### Text Extraction

Utilities for extracting text content from messages:

```typescript
/**
 * Extract text content from a ModelMessage
 * Handles both string content and content part arrays
 */
function extractTextFromMessage(message: ModelMessage): string;

/**
 * Extract text from multiple messages
 * Aggregates text from all messages, filtering empty strings
 */
function extractTextFromMessages(messages: readonly ModelMessage[]): string;

/**
 * Extract text from a tool result content
 * Handles various output formats (text, json, error, content)
 */
function extractToolResultContent(message: ModelMessage): string;
```

---

## Current Duplication Analysis

Tool call utilities are currently duplicated across packages:

| Location | Has Result Matching | Args Field | From Step |
|----------|---------------------|------------|-----------|
| `@tally-evals/tally` metrics/utils | No | `args` | No |
| `@tally-evals/trajectories` logger | Yes | `args` | No |
| `@tally-evals/trajectories` test/utils | Yes | `input` | Yes |
| `@tally-evals/cli` formatters | No | N/A | No |

**Resolution**: Core provides a unified implementation that:
- Supports both `args` and `input` field names (AI SDK uses `args`, JSONL may use `input`)
- Always includes result matching
- Works with both `ModelMessage[]` and `ConversationStep`
- Handles all AI SDK message content formats
