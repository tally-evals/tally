# Prebuilt Metrics Implementation Plan

## Overview

This document outlines the implementation plan for prebuilt metrics in the Tally evaluation framework. These metrics will support both `DatasetItem` and `ConversationStep` containers for single-turn metrics, and utilize AI SDK's embedding API directly for similarity calculations.

---

## Key Design Decisions

### 1. Container Type Support
- **Single-turn metrics** can work with both:
  - `DatasetItem` (prompt/completion pairs)
  - `ConversationStep` (input/output messages from conversations)
- Metrics should handle both container types gracefully
- Use `SingleTargetFor<TContainer>` type helper to ensure type safety

### 2. Embedding Integration
- Use AI SDK's `embed()` and `embedMany()` functions directly ([AI SDK Embeddings Docs](https://v6.ai-sdk.dev/docs/ai-sdk-core/embeddings))
- Accept `EmbeddingModel` provider in options (e.g., `openai.textEmbeddingModel('text-embedding-3-small')`)
- Generate embeddings on-demand within metric execution
- Use `cosineSimilarity()` from AI SDK for similarity calculations

### 3. Tool Call Extraction
- Extract tool calls from `ModelMessage` using AI SDK's message structure
- Support both single and multiple tool calls
- Match tool calls with their results across conversation steps

---

## Implementation Structure

### Phase 1: Mock Utilities & Tool Call Helpers

#### 1.1 Enhanced Mock Model Utilities
**File:** `test/_mocks/mockModel.ts` (enhance existing)

**API Design:**
```typescript
import { MockLanguageModelV2, MockEmbeddingModelV2 } from 'ai/test';
import type { LanguageModel, EmbeddingModel } from 'ai';

/**
 * Options for creating a mock language model
 */
export interface MockLanguageModelOptions {
  // For generateObject responses
  objectResponse?: Record<string, unknown> | (() => Record<string, unknown>);
  // For streaming responses
  streamChunks?: Array<{ type: string; [k: string]: unknown }>;
  // For custom doGenerate implementation
  doGenerate?: (args: unknown) => Promise<GenerateResult>;
  // Token usage (can be customized)
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
  // Finish reason
  finishReason?: 'stop' | 'length' | 'tool-calls' | 'content-filter' | 'other';
}

/**
 * Create a mock language model with flexible options
 */
export function createMockLanguageModel(
  options: MockLanguageModelOptions
): MockLanguageModelV2

/**
 * Create a mock language model that returns a specific JSON object
 */
export function makeMockLanguageModelReturningObject(
  jsonString: string
): MockLanguageModelV2

/**
 * Create a mock language model that simulates tool calls
 */
export function createMockModelWithToolCalls(toolCalls: Array<{
  toolCallId: string;
  toolName: string;
  args: unknown;
}>): MockLanguageModelV2

/**
 * Create a mock language model for metric responses (0-1 scores)
 */
export function createMockMetricModel(
  score: number,
  reasoning?: string
): MockLanguageModelV2

/**
 * Create a mock embedding model
 */
export function createMockEmbeddingModel(
  embedding: number[] | (() => number[])
): MockEmbeddingModelV2
```

**Description:**
- Extends existing mock utilities with more flexibility
- Supports tool call simulation for tool-related metrics
- Provides helpers for common metric response patterns
- Includes mock embedding model support

---

#### 1.2 Tool Call Extraction Utilities
**File:** `test/_mocks/toolCallUtils.ts` (new)

**API Design:**
```typescript
import type { ModelMessage } from 'ai';

/**
 * Extracted tool call information
 */
export interface ExtractedToolCall {
  toolCallId: string;
  toolName: string;
  args: unknown;
}

/**
 * Extracted tool result information
 */
export interface ExtractedToolResult {
  toolCallId: string;
  toolName: string;
  output: unknown;
}

/**
 * Matched tool call with its result
 */
export interface MatchedToolCall {
  toolCall: ExtractedToolCall;
  result: ExtractedToolResult;
}

/**
 * Extract tool calls from an AssistantModelMessage
 */
export function extractToolCalls(message: ModelMessage): ExtractedToolCall[]

/**
 * Extract tool results from a ToolModelMessage
 */
export function extractToolResults(message: ModelMessage): ExtractedToolResult[]

/**
 * Check if message contains tool calls
 */
export function hasToolCalls(message: ModelMessage): boolean

/**
 * Match tool calls with their results from conversation steps
 */
export function matchToolCallsWithResults(
  toolCallMessage: ModelMessage,
  toolResultMessage: ModelMessage
): MatchedToolCall[]

/**
 * Extract all tool calls from a conversation step
 */
export function extractToolCallsFromStep(step: ConversationStep): ExtractedToolCall[]
```

**Description:**
- Utilities for extracting tool call information from ModelMessage
- Supports both single and multiple tool calls
- Handles matching tool calls with their results
- Type-safe extraction based on AI SDK ModelMessage structure

---

### Phase 2: Common Utilities

#### 2.1 Similarity Utilities
**File:** `src/metrics/common/similarity.ts` (new)

**API Design:**
```typescript
import { embed, embedMany, cosineSimilarity } from 'ai';
import type { EmbeddingModel } from 'ai';

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(
  text: string,
  model: EmbeddingModel
): Promise<number[]>

/**
 * Generate embeddings for multiple texts
 */
export async function generateEmbeddings(
  texts: string[],
  model: EmbeddingModel
): Promise<number[][]>

/**
 * Calculate cosine similarity between two embeddings
 */
export function calculateCosineSimilarity(
  embedding1: number[],
  embedding2: number[]
): number

/**
 * Calculate similarity between two texts using embeddings
 */
export async function calculateTextSimilarity(
  text1: string,
  text2: string,
  model: EmbeddingModel
): Promise<number>
```

**Description:**
- Wrappers around AI SDK's embedding functions
- Provides convenient helpers for common similarity operations
- Reusable across multiple metrics

---

#### 2.2 Keyword Utilities
**File:** `src/metrics/common/keywords.ts` (new)

**API Design:**
```typescript
import type { LanguageModel } from 'ai';

/**
 * Options for keyword extraction
 */
export interface KeywordExtractionOptions {
  minLength?: number;
  stopWords?: string[];
  caseSensitive?: boolean;
}

/**
 * Keyword coverage result
 */
export interface KeywordCoverageResult {
  found: string[];
  missing: string[];
  coverage: number; // 0-1 score
}

/**
 * Extract keywords from text (code-based)
 */
export function extractKeywords(
  text: string,
  options?: KeywordExtractionOptions
): string[]

/**
 * Extract key points/topics from text (LLM-based)
 */
export async function extractKeyPoints(
  text: string,
  provider: LanguageModel
): Promise<string[]>

/**
 * Check keyword coverage in text
 */
export function checkKeywordCoverage(
  text: string,
  keywords: string[],
  options?: { caseSensitive?: boolean }
): KeywordCoverageResult

/**
 * Extract input and output text from DatasetItem or ConversationStep
 * 
 * For DatasetItem: returns prompt and completion strings
 * For ConversationStep: extracts text from input and output ModelMessages
 */
export function extractInputOutput(
  target: DatasetItem | ConversationStep
): { input: string; output: string }

/**
 * Extract text content from a ModelMessage
 * Handles both string and array content formats
 */
export function extractTextFromMessage(message: ModelMessage): string
```

**Description:**
- Shared utilities for keyword extraction and analysis
- Supports both code-based and LLM-based extraction
- Handles both DatasetItem and ConversationStep containers
- Provides container-agnostic input/output extraction
- Reusable across keyword-related metrics

---

### Phase 3: Single-Turn Metrics

All single-turn metrics support both `DatasetItem` and `ConversationStep` containers.

#### 3.1 Answer Similarity (Answer Relevance)
**File:** `src/metrics/singleTurn/answerSimilarity.ts`

**API Design:**
```typescript
import type { SingleTurnMetricDef, DatasetItem, ConversationStep } from '@tally/core/types';
import type { LanguageModel } from 'ai';

export interface AnswerSimilarityOptions {
  // LLM provider for relevance analysis (required)
  provider: LanguageModel;
  // Partial weight for "unsure" statements (default: 0.3)
  partialWeight?: number;
  // Scale factor for final score (default: 1.0)
  scale?: number;
}

/**
 * Relevance analysis result for a single statement
 */
export interface StatementRelevance {
  statement: string;
  relevance: 'yes' | 'unsure' | 'no';
}

/**
 * Answer similarity analysis result
 */
export interface AnswerSimilarityResult {
  statements: StatementRelevance[];
  score: number; // 0-1
  directMatches: number;
  partialMatches: number;
  totalStatements: number;
}

/**
 * Create an answer similarity metric
 * 
 * Measures how relevant the output is to the input query using LLM-based
 * statement-level relevance analysis. Supports both DatasetItem and ConversationStep containers.
 * 
 * Scoring Process:
 * 1. Statement Preprocessing: Breaks output into meaningful statements while preserving context
 * 2. Relevance Analysis: Each statement evaluated as "yes" (full weight), "unsure" (partial weight), or "no" (zero weight)
 * 3. Score Calculation: ((direct + uncertainty * partial) / total_statements) * scale
 * 
 * Score Interpretation:
 * - 1.0: Response fully answers the query with relevant and focused information
 * - 0.7-0.9: Response mostly answers but may include minor unrelated content
 * - 0.4-0.6: Response partially answers, mixing relevant and unrelated information
 * - 0.1-0.3: Response includes minimal relevant content, largely misses intent
 * - 0.0: Response is entirely unrelated and does not answer the query
 */
export function createAnswerSimilarityMetric<TContainer extends DatasetItem | ConversationStep>(
  options: AnswerSimilarityOptions
): SingleTurnMetricDef<number, TContainer>
```

**Description:**
- Measures relevance of output to input query using LLM-based analysis
- Breaks output into statements and evaluates each for relevance
- Returns score 0-1 based on weighted relevance analysis
- Works with both DatasetItem and ConversationStep containers
- Uses LLM to determine statement-level relevance (yes/unsure/no)

**Implementation Notes:**
- Use `extractInputOutput()` helper to get input/output from either container type
- Preprocess output into meaningful statements (preserve context):
  - Split by sentence boundaries (periods, exclamation marks, question marks)
  - Preserve context by including surrounding sentences if needed
  - Filter out very short statements (< 3 words) unless they're complete thoughts
  - Handle edge cases (empty output, single sentence, etc.)
- Use LLM provider to analyze each statement's relevance to the input query
- Calculate score: `((directMatches + partialWeight * partialMatches) / totalStatements) * scale`
- Default partial weight: 0.3 for "unsure" statements
- Default scale: 1.0
- Handle edge case: if totalStatements is 0, return score of 0

**LLM Prompt Structure:**
```
Given the following query and a statement from the response, determine if the statement is:
- "yes": Directly relevant and answers the query (full weight)
- "unsure": Partially relevant or approximately matches (partial weight)
- "no": Not relevant and does not answer the query (zero weight)

Query: {input}
Statement: {statement}

Respond with only: yes, unsure, or no
```

---

#### 3.2 Completeness
**File:** `src/metrics/singleTurn/completeness.ts`

**API Design:**
```typescript
import type { SingleTurnMetricDef, DatasetItem, ConversationStep } from '@tally/core/types';
import type { LanguageModel } from 'ai';

export interface CompletenessOptions {
  // Expected key points/topics (optional, can be extracted from prompt)
  expectedPoints?: string[];
  // LLM provider for extraction (optional, for LLM-based extraction)
  extractionProvider?: LanguageModel;
  // Minimum coverage threshold
  minCoverage?: number;
}

/**
 * Create a completeness metric
 * 
 * Measures how complete an answer is relative to expected coverage.
 * Supports both DatasetItem and ConversationStep containers.
 */
export function createCompletenessMetric<TContainer extends DatasetItem | ConversationStep>(
  options?: CompletenessOptions
): SingleTurnMetricDef<number, TContainer>
```

**Description:**
- Measures how complete an answer is relative to expected coverage
- Can extract key points from prompt or use provided points
- Returns score based on coverage percentage
- Supports both code-based (keyword) and LLM-based extraction

**Implementation Notes:**
- Extract expected points from prompt/input if not provided
- Use keyword matching or LLM extraction based on options
- Calculate coverage as ratio of covered points to total expected points

---

#### 3.3 Faithfulness
**File:** `src/metrics/singleTurn/faithfulness.ts`

**API Design:**
```typescript
import type { SingleTurnMetricDef, DatasetItem, ConversationStep } from '@tally/core/types';
import type { LanguageModel } from 'ai';

export interface FaithfulnessOptions {
  // LLM provider for fact-checking (required for LLM-based)
  provider?: LanguageModel;
  // Source context to check against (optional)
  sourceContext?: string;
  // Use LLM-based or code-based checking
  method?: 'llm' | 'code';
}

/**
 * Create a faithfulness metric
 * 
 * Measures whether the answer is faithful to source material/context.
 * Supports both DatasetItem and ConversationStep containers.
 */
export function createFaithfulnessMetric<TContainer extends DatasetItem | ConversationStep>(
  options?: FaithfulnessOptions
): SingleTurnMetricDef<number, TContainer>
```

**Description:**
- Measures whether the answer is faithful to source material/context
- LLM-based: uses model to check factual consistency
- Code-based: uses keyword/pattern matching (simpler fallback)
- Returns score 0-1 based on faithfulness assessment

**Implementation Notes:**
- For LLM-based: use provider to check factual consistency
- For code-based: use keyword matching and pattern detection
- Extract source context from metadata or conversation history if available

---

#### 3.4 Keyword Coverage
**File:** `src/metrics/singleTurn/keywordCoverage.ts`

**API Design:**
```typescript
import type { SingleTurnMetricDef, DatasetItem, ConversationStep } from '@tally/core/types';

export interface KeywordCoverageOptions {
  // Required keywords (optional, extracted from prompt if not provided)
  requiredKeywords?: string[];
  // Optional keywords (bonus points)
  optionalKeywords?: string[];
  // Weight for optional keywords (0-1)
  optionalWeight?: number;
  // Case sensitive matching
  caseSensitive?: boolean;
}

/**
 * Create a keyword coverage metric
 * 
 * Measures coverage of required/expected keywords in the answer.
 * Supports both DatasetItem and ConversationStep containers.
 */
export function createKeywordCoverageMetric<TContainer extends DatasetItem | ConversationStep>(
  options?: KeywordCoverageOptions
): SingleTurnMetricDef<number, TContainer>
```

**Description:**
- Measures coverage of required/expected keywords in the answer
- Code-based metric (no LLM required)
- Returns score based on keyword presence
- Supports weighted scoring for optional keywords

**Implementation Notes:**
- Extract keywords from prompt/input if not provided
- Use `extractKeywords()` utility from common/keywords.ts
- Calculate score: (required coverage * 1.0) + (optional coverage * optionalWeight)

---

#### 3.5 Toxicity
**File:** `src/metrics/singleTurn/toxicity.ts`

**API Design:**
```typescript
import type { SingleTurnMetricDef, DatasetItem, ConversationStep } from '@tally/core/types';
import type { LanguageModel } from 'ai';

export interface ToxicityOptions {
  // LLM provider for toxicity detection (required)
  provider: LanguageModel;
  // Toxicity categories to check
  categories?: Array<'hate' | 'harassment' | 'violence' | 'self-harm'>;
  // Threshold for toxic classification
  threshold?: number;
}

/**
 * Create a toxicity metric
 * 
 * Detects toxic, harmful, or inappropriate content.
 * Supports both DatasetItem and ConversationStep containers.
 */
export function createToxicityMetric<TContainer extends DatasetItem | ConversationStep>(
  options: ToxicityOptions
): SingleTurnMetricDef<number, TContainer>
```

**Description:**
- Detects toxic, harmful, or inappropriate content
- LLM-based metric (requires provider)
- Returns score 0-1 (lower is better - 0 = toxic, 1 = safe)
- Supports multiple toxicity categories

**Implementation Notes:**
- Use LLM provider to assess toxicity
- Return inverted score (1 - toxicity) so higher is better
- Support multiple categories with configurable thresholds

---

#### 3.6 Tool Call Accuracy
**File:** `src/metrics/singleTurn/toolCallAccuracy.ts`

**API Design:**
```typescript
import type { SingleTurnMetricDef, DatasetItem, ConversationStep } from '@tally/core/types';
import type { z } from 'zod';

export interface ToolCallAccuracyOptions {
  // Expected tool calls (required)
  expectedToolCalls: Array<{
    toolName: string;
    argsSchema?: z.ZodSchema; // Optional Zod schema for validating arguments
  }>;
  // Tool call order (optional)
  // If provided, evaluates whether actual tool calls match this exact order
  toolCallOrder?: string[]; // Array of tool names in expected order
  // Strict mode (default: false)
  // If true: sequence must be exact and cannot have more tool calls than expected
  // If false: allows extra tool calls and evaluates presence/order more leniently
  strictMode?: boolean;
}

/**
 * Create a tool call accuracy metric
 * 
 * Measures accuracy of tool calls in assistant responses.
 * Code-based metric that extracts tool calls and compares them against expected calls.
 * Supports both DatasetItem and ConversationStep containers.
 * 
 * Scoring:
 * - Presence: Each expected tool call is present (1.0 per call)
 * - Arguments: If argsSchema provided, validates arguments match schema (1.0 per call)
 * - Order: If toolCallOrder provided, evaluates order correctness (1.0 if correct)
 * - Strict mode: If enabled, penalizes extra tool calls and requires exact sequence
 * 
 * Final score: Weighted average of presence, arguments, and order (0-1 scale)
 */
export function createToolCallAccuracyMetric<TContainer extends DatasetItem | ConversationStep>(
  options: ToolCallAccuracyOptions
): SingleTurnMetricDef<number, TContainer>
```

**Description:**
- Measures accuracy of tool calls in assistant responses
- Code-based metric (no LLM required)
- Extracts tool calls from ModelMessage using utility functions
- Compares actual vs expected tool calls
- Validates arguments using optional Zod schemas
- Optionally evaluates tool call order
- Supports strict mode for exact sequence matching
- Returns score 0-1 based on accuracy

**Implementation Notes:**
- Use `extractToolCalls()` utility to extract from assistant message
- For ConversationStep: extract from `output` message
- For DatasetItem: extract from `completion` if it's a ModelMessage, or parse JSON
- Match expected vs actual tool calls by name
- If `argsSchema` provided for an expected call, validate actual args against schema using Zod
- If `toolCallOrder` provided:
  - Extract tool names from actual calls in order
  - Compare against expected order
  - Score: 1.0 if order matches exactly, 0.0 if completely different
- If `strictMode` is true:
  - Actual tool calls must exactly match expected calls (no extra calls)
  - Order must match exactly if `toolCallOrder` is provided
  - Penalize any deviation: extra calls = 0.0, wrong order = 0.0
- If `strictMode` is false:
  - Allow extra tool calls (only evaluate expected ones)
  - Order evaluation is more lenient (partial credit for partial matches)
- Score calculation:
  - Presence score: (matched expected calls) / (total expected calls)
  - Argument score: (validated calls) / (calls with schemas)
  - Order score: 1.0 if order matches, 0.0 if not (or partial if not strict)
  - Final score: weighted average (presence: 0.5, arguments: 0.3, order: 0.2)
  - If strict mode fails, return 0.0 immediately

---

### Phase 4: Multi-Turn Metrics

Multi-turn metrics work with `Conversation` containers only.

#### 4.1 Role Adherence
**File:** `src/metrics/multiTurn/roleAdherence.ts`

**API Design:**
```typescript
import type { MultiTurnMetricDef, Conversation } from '@tally/core/types';
import type { LanguageModel } from 'ai';

export interface RoleAdherenceOptions {
  // Expected role description
  expectedRole: string;
  // LLM provider for role checking
  provider: LanguageModel;
}

/**
 * Create a role adherence metric
 * 
 * Measures how well the assistant adheres to a specified role.
 */
export function createRoleAdherenceMetric(
  options: RoleAdherenceOptions
): MultiTurnMetricDef<number, Conversation>
```

**Description:**
- Measures how well the assistant adheres to a specified role
- LLM-based metric analyzing conversation across turns
- Returns score 0-10 based on role adherence

**Implementation Notes:**
- Use LLM provider to analyze all conversation steps
- Check if assistant responses match expected role

---

#### 4.2 Goal Completion
**File:** `src/metrics/multiTurn/goalCompletion.ts`

**API Design:**
```typescript
import type { MultiTurnMetricDef, Conversation } from '@tally/core/types';
import type { LanguageModel } from 'ai';

export interface GoalCompletionOptions {
  // Goal description (extracted from first message or provided)
  goal?: string;
  // LLM provider for goal extraction/completion checking
  provider: LanguageModel;
}

/**
 * Create a goal completion metric
 * 
 * Measures whether the conversation achieved its stated goal.
 */
export function createGoalCompletionMetric(
  options: GoalCompletionOptions
): MultiTurnMetricDef<number, Conversation>
```

**Description:**
- Measures whether the conversation achieved its stated goal
- LLM-based metric analyzing full conversation
- use provided goal
- Returns score 0-1 based on goal completion


---

#### 4.3 Tool Utilization
**File:** `src/metrics/multiTurn/toolUtilization.ts`

**API Design:**
```typescript
import type { MultiTurnMetricDef, Conversation } from '@tally/core/types';

export interface ToolUtilizationOptions {
  // Available tools (optional, for validation)
  availableTools?: string[];
  // Expected tool usage pattern
  expectedUsage?: {
    minCalls?: number;
    maxCalls?: number;
    requiredTools?: string[];
  };
  // Check tool call efficiency
  checkEfficiency?: boolean;
}

/**
 * Create a tool utilization metric
 * 
 * Measures how effectively tools are used in a conversation.
 */
export function createToolUtilizationMetric(
  options?: ToolUtilizationOptions
): MultiTurnMetricDef<number, Conversation>
```

**Description:**
- Measures how effectively tools are used in a conversation
- Code-based metric (extracts tool calls from all steps)
- Analyzes tool call patterns, frequency, and appropriateness
- Returns score 0-1 based on utilization quality

**Implementation Notes:**
- Extract tool calls from all conversation steps
- Use `extractToolCallsFromStep()` utility
- Analyze frequency, appropriateness, and efficiency
- Compare against expected usage patterns if provided

---

#### 4.4 Topic Adherence
**File:** `src/metrics/multiTurn/topicAdherence.ts`

**API Design:**
```typescript
import type { MultiTurnMetricDef, Conversation } from '@tally/core/types';
import type { LanguageModel } from 'ai';

export interface TopicAdherenceOptions {
  // Expected topics/themes
  expectedTopics: string[];
  // LLM provider for topic extraction/checking
  provider: LanguageModel;
  // Allow topic drift tolerance
  tolerance?: number;
}

/**
 * Create a topic adherence metric
 * 
 * Measures how well the conversation stays on topic.
 */
export function createTopicAdherenceMetric(
  options: TopicAdherenceOptions
): MultiTurnMetricDef<number, Conversation>
```

**Description:**
- Measures how well the conversation stays on topic
- LLM-based metric analyzing conversation themes
- Compares actual topics vs expected topics
- Returns score 0-1 based on topic adherence

**Implementation Notes:**
- Use LLM to extract topics from conversation
- Compare extracted topics with expected topics
- Account for tolerance in topic drift

---

## File Structure Summary

```
packages/tally/
├── src/
│   ├── metrics/
│   │   ├── common/
│   │   │   ├── similarity.ts          # NEW - Embedding & similarity utilities
│   │   │   └── keywords.ts            # NEW - Keyword extraction utilities
│   │   ├── singleTurn/
│   │   │   ├── answerRelevance.ts     # EXISTS
│   │   │   ├── answerSimilarity.ts    # NEW
│   │   │   ├── completeness.ts        # NEW
│   │   │   ├── faithfulness.ts        # NEW
│   │   │   ├── keywordCoverage.ts     # NEW
│   │   │   ├── toxicity.ts            # NEW
│   │   │   └── toolCallAccuracy.ts    # NEW
│   │   └── multiTurn/
│   │       ├── roleAdherence.ts       # NEW
│   │       ├── goalCompletion.ts      # NEW
│   │       ├── toolUtilization.ts     # NEW
│   │       └── topicAdherence.ts     # NEW
│   └── ...
├── test/
│   └── _mocks/
│       ├── mockModel.ts               # ENHANCE - Add more mock helpers
│       └── toolCallUtils.ts           # NEW - Tool call extraction utilities
```

---

## Implementation Order

### Step 1: Mock Utilities & Tool Call Helpers
1. Enhance `test/_mocks/mockModel.ts` with new helpers
2. Create `test/_mocks/toolCallUtils.ts` for tool call extraction

### Step 2: Common Utilities
1. Create `src/metrics/common/similarity.ts` (embedding wrappers)
2. Create `src/metrics/common/keywords.ts` (keyword utilities)

### Step 3: Single-Turn Metrics (in order)
1. `answerSimilarity.ts` - LLM-based statement relevance analysis (requires container helpers)
2. `keywordCoverage.ts` - Code-based, simpler
3. `completeness.ts` - Uses keyword utilities
4. `faithfulness.ts` - LLM-based
5. `toxicity.ts` - LLM-based
6. `toolCallAccuracy.ts` - Code-based, uses tool call utilities and Zod for validation

### Step 4: Multi-Turn Metrics (in order)
1. `toolUtilization.ts` - Code-based, uses tool call utilities
2. `roleAdherence.ts` - LLM-based
3. `goalCompletion.ts` - LLM-based
4. `topicAdherence.ts` - LLM-based

### Step 5: Integration & Testing
1. Add tests for each metric using mock utilities
2. Test with both DatasetItem and ConversationStep (for single-turn)
3. Update `src/index.ts` to export all new metrics and helper functions
4. Update documentation

---

## Key Implementation Patterns

### Pattern 1: Container-Agnostic Single-Turn Metrics

All single-turn metrics should handle both `DatasetItem` and `ConversationStep`:

```typescript
import { extractInputOutput } from '../common/keywords';

export function createMyMetric<TContainer extends DatasetItem | ConversationStep>(
  options?: MyMetricOptions
): SingleTurnMetricDef<number, TContainer> {
  return MetricDefBuilder
    .singleTurn<number, TContainer>({
      name: 'myMetric',
      valueType: 'number',
    })
    .asCode({
      compute: ({ data }) => {
        // Extract input/output from either container type
        const { input, output } = extractInputOutput(data as TContainer);
        // ... compute metric
      },
    })
    .runOnSelected((target) => {
      // Handle both DatasetItem and ConversationStep
      const { input, output } = extractInputOutput(target);
      // ... compute metric
    })
    .build();
}
```

**Helper Function Usage:**
- `extractInputOutput()` returns `{ input: string, output: string }` for both container types
- For `DatasetItem`: `input = prompt`, `output = completion`
- For `ConversationStep`: `input = extractTextFromMessage(step.input)`, `output = extractTextFromMessage(step.output)`

### Pattern 2: Container Input/Output Extraction

Always use the helper function to extract input/output from containers:

```typescript
import { extractInputOutput, extractTextFromMessage } from '../common/keywords';
import type { DatasetItem, ConversationStep } from '@tally/core/types';
import type { ModelMessage } from 'ai';

// Works with both container types
function processContainer<TContainer extends DatasetItem | ConversationStep>(
  target: TContainer
) {
  const { input, output } = extractInputOutput(target);
  // input and output are always strings, regardless of container type
  // ... process input/output
}

// For ModelMessage extraction (used internally)
function getMessageText(message: ModelMessage): string {
  return extractTextFromMessage(message);
}
```

### Pattern 3: Embedding Usage (for other metrics)

When embeddings are needed, use AI SDK's embedding API directly:

```typescript
import { embed, cosineSimilarity } from 'ai';
import type { EmbeddingModel } from 'ai';

// Generate embeddings
const { embedding: emb1 } = await embed({
  model: embeddingModel,
  value: text1,
});

const { embedding: emb2 } = await embed({
  model: embeddingModel,
  value: text2,
});

// Calculate similarity
const similarity = cosineSimilarity(emb1, emb2);
```

### Pattern 4: Tool Call Extraction

Use utility functions for tool call extraction:

```typescript
import { extractToolCalls, extractToolCallsFromStep } from '@tally/test/_mocks/toolCallUtils';

// From a conversation step
const toolCalls = extractToolCallsFromStep(step);

// From a ModelMessage directly
const toolCalls = extractToolCalls(message);
```

---

## Testing Strategy

### Mock-Based Testing
- Use `createMockLanguageModel()` for LLM-based metrics
- Use `createMockEmbeddingModel()` for embedding-based metrics
- Use `createMockMetricModel()` for structured metric responses

### Container Type Testing
- Test single-turn metrics with both `DatasetItem` and `ConversationStep`
- Verify metric behavior is consistent across container types

### Tool Call Testing
- Test tool call extraction utilities independently
- Test metrics that use tool calls with various scenarios:
  - No tool calls
  - Single tool call
  - Multiple tool calls
  - Tool calls with results
  - Malformed tool calls

---

## Dependencies

### Required
- `ai` - Already installed (for embeddings, ModelMessage types)
- `zod` - Already installed (for schema validation)

### Usage
- Import embedding functions: `import { embed, embedMany, cosineSimilarity } from 'ai'`
- Import embedding model types: `import type { EmbeddingModel } from 'ai'`
- Import mock utilities: `import { MockEmbeddingModelV2 } from 'ai/test'`

---

## Success Criteria

- [ ] All mock utilities implemented and tested
- [ ] Tool call extraction utilities work with various message formats
- [ ] Common utilities (similarity, keywords) implemented
- [ ] All 6 single-turn metrics implemented and tested
- [ ] All 4 multi-turn metrics implemented and tested
- [ ] All metrics work with appropriate container types
- [ ] Embeddings generated on-demand using AI SDK
- [ ] All metrics exported from `src/index.ts`
- [ ] Helper functions (`extractInputOutput`, `extractTextFromMessage`) exported for public use
- [ ] Tests cover both DatasetItem and ConversationStep scenarios
- [ ] Documentation updated

---

## Notes

1. **Container Type Flexibility**: Single-turn metrics must support both `DatasetItem` and `ConversationStep` using generic type parameters
2. **Input/Output Extraction**: Always use `extractInputOutput()` helper to get input/output strings from either container type
3. **Answer Similarity**: Uses LLM-based statement-level relevance analysis, not embeddings. No expected answer needed - compares output relevance to input query.
4. **Embedding Generation**: For metrics that need embeddings, always generate on-demand using AI SDK's `embed()` or `embedMany()` functions
5. **Tool Call Handling**: Use utility functions for consistent tool call extraction across metrics
6. **Mock Utilities**: Leverage AI SDK's mock utilities for testing without real API calls
7. **Type Safety**: Use TypeScript generics to ensure type safety across container types

