# Refactoring Plan: Convert ConversationStep.output to Array

## Problem Statement

Currently, `ConversationStep.output` is defined as a single `ModelMessage`. However, agent responses can contain multiple messages in a single turn:
- Assistant message with tool-call (in content array)
- Tool message with tool-result (in content array)
- Assistant message with final text response

When we only save the first assistant message, we lose:
1. The final text response from the assistant
2. Tool results that may be important for evaluation
3. The complete conversation flow

## Proposed Change

**Current Type:**
```typescript
export interface ConversationStep {
  stepIndex: number;
  input: ModelMessage;
  output: ModelMessage;  // ❌ Single message
  // ...
}
```

**Proposed Type:**
```typescript
export interface ConversationStep {
  stepIndex: number;
  input: ModelMessage;
  output: readonly ModelMessage[];  // ✅ Array of messages
  // ...
}
```

## Impact Analysis

### 1. Core Type Definitions

**File: `packages/tally/src/core/types.ts`**
- **Line 25**: Change `output: ModelMessage` to `output: readonly ModelMessage[]`
- **Impact**: This is the foundational change that propagates throughout the codebase

### 2. Type Guards and Validators

**File: `packages/tally/src/utils/guards.ts`**
- **Line 36-50**: `isConversationStep()` function
  - **Change**: Update validation to check if `output` is an array of ModelMessages
  - **Current**: `typeof step.output === 'object' && step.output !== null`
  - **New**: `Array.isArray(step.output) && step.output.every(isModelMessage)`

**File: `packages/tally/src/data/validate.ts`**
- **Line 48-78**: `isValidConversationStep()` function
  - **Line 62**: Change `if (!isModelMessage(step.output))` to validate array
  - **Change**: Add helper function `isModelMessageArray()` or inline validation
  - **New**: `if (!Array.isArray(step.output) || !step.output.every(isModelMessage))`

**File: `packages/tally/src/data/shape.ts`**
- **Line 113-170**: `adaptToConversationStep()` function
  - **Line 132**: `const output = source[outputField];`
  - **Line 139-142**: Update validation logic
  - **Change**: Handle both single message (backward compat) and array
  - **Strategy**: Normalize single message to array: `Array.isArray(output) ? output : [output]`

### 3. Utility Functions - Text Extraction

**File: `packages/tally/src/metrics/common/utils.ts`**
- **Line 60-78**: `extractInputOutput()` function
  - **Line 76**: `output: extractTextFromMessage(step.output)`
  - **Change**: Extract text from all messages in output array
  - **New**: `output: step.output.map(extractTextFromMessage).join('\n\n')` or similar aggregation

**File: `packages/tally/src/core/execution/runSingleTurn.ts`**
- **Line 121-151**: `defaultPreprocessSingle()` function
  - **Line 142**: `output: extractTextFromMessage(step.output)`
  - **Change**: Extract text from all messages in array
  - **New**: Aggregate text from all output messages

**File: `packages/tally/src/core/execution/executors.ts`**
- **Line 212-246**: `buildSingleTurnLLMContext()` function
  - **Line 236**: `context.output = extractTextFromMessage(step.output);`
  - **Line 239**: `context.outputMessage = step.output;`
  - **Change**: 
    - Aggregate text from all output messages for `context.output`
    - Store array in `context.outputMessages` (plural) for backward compat, keep `outputMessage` as first message or deprecated

### 4. Metrics - Single-Turn

**File: `packages/tally/src/metrics/singleTurn/toolCallAccuracy.ts`**
- **Line 69-102**: `preProcessor` function
  - **Line 95**: `outputMessage = step.output;`
  - **Change**: Extract tool calls from all assistant messages in output array
  - **New**: Iterate through `step.output` array, filter for `role === 'assistant'`, extract tool calls from each

**File: `packages/tally/src/metrics/singleTurn/completeness.ts`**
- **Impact**: Uses `extractInputOutput()` which will be updated, should work automatically
- **Verification**: Ensure completeness calculation works with aggregated text

**File: `packages/tally/src/metrics/singleTurn/answerRelevance.ts`**
- **Impact**: Uses `extractInputOutput()` which will be updated, should work automatically
- **Verification**: Ensure relevance calculation works with aggregated text

**File: `packages/tally/src/metrics/singleTurn/answerSimilarity.ts`**
- **Impact**: Uses `extractInputOutput()` which will be updated, should work automatically
- **Verification**: Ensure similarity calculation works with aggregated text

**File: `packages/tally/src/metrics/singleTurn/toxicity.ts`**
- **Impact**: Uses `extractInputOutput()` which will be updated, should work automatically
- **Verification**: Ensure toxicity detection works with aggregated text

### 5. Metrics - Multi-Turn

**File: `packages/tally/src/metrics/multiTurn/goalCompletion.ts`**
- **Line 87-93**: `runOnContainer` function
  - **Line 90**: `const assistantText = extractTextFromMessage(step.output);`
  - **Change**: Extract text from all messages in output array
  - **New**: Aggregate text from all output messages

**File: `packages/tally/src/metrics/multiTurn/topicAdherence.ts`**
- **Line 87-93**: `runOnContainer` function
  - **Line 90**: `const assistantText = extractTextFromMessage(step.output);`
  - **Change**: Extract text from all messages in output array
  - **New**: Aggregate text from all output messages

**File: `packages/tally/src/metrics/multiTurn/roleAdherence.ts`**
- **Line 80-86**: `runOnContainer` function
  - **Line 83**: `const assistantText = extractTextFromMessage(step.output);`
  - **Change**: Extract text from all messages in output array
  - **New**: Aggregate text from all output messages

### 6. Conversion and Recording Utilities

**File: `packages/tally/debug/utils/recorder.ts`**
- **Line 13-24**: `AgentStep` interface
  - **Line 16**: `output: ModelMessage;`
  - **Change**: Update to `output: ModelMessage[];` to match new structure
  - **Impact**: This is the recording interface, should align with ConversationStep

- **Line 35-55**: `convertToTallyConversation()` function
  - **Line 44**: `output: step.output as ConversationStep['output']`
  - **Change**: Ensure conversion handles array properly
  - **Note**: If AgentStep.output is already array, this should work; if single message, normalize to array

- **Line 60-76**: `convertConversationToDataset()` function
  - **Line 63**: `const outputText = typeof step.output.content === 'string' ? step.output.content : JSON.stringify(step.output.content);`
  - **Change**: Aggregate text from all output messages
  - **New**: Extract text from each message in array and join

**File: `packages/tally/debug/agents/weatherAgent.ts`**
- **Line 35-77**: `runWeatherAgent()` function
  - **Line 59**: `const assistantMessage: ModelMessage = result.response.messages[0];`
  - **Line 64**: `output: assistantMessage,`
  - **Change**: Extract all assistant messages from `result.response.messages`
  - **Strategy**: Filter messages by `role === 'assistant'` and include tool messages if needed
  - **New**: `output: result.response.messages.filter(msg => msg.role === 'assistant' || msg.role === 'tool')`

### 7. Test Fixtures

**File: `packages/tally/test/_fixtures/conversation.examples.ts`**
- **Line 3-18**: `conversationExampleA`
  - **Line 9**: `output: { role: 'assistant', content: 'Hi there, how can I help you today?' },`
  - **Change**: Wrap in array: `output: [{ role: 'assistant', content: 'Hi there, how can I help you today?' }]`
- **Line 13**: Similar change for step 1
- **Line 20-40**: `conversationExampleB`
  - **Line 26, 31, 36**: Wrap all output values in arrays

**File: `packages/tally/debug/test/_fixtures/recorded/conversations/weather.jsonl`**
- **Impact**: Existing recorded conversations will need migration
- **Strategy**: Create migration script or handle backward compatibility in validators

### 8. Execution Context

**File: `packages/tally/src/core/evaluators/context.ts`**
- **Impact**: No direct access to `step.output`, but verify no indirect usage
- **Verification**: Check if any code paths access output through conversation steps

### 9. Documentation

**File: `packages/tally/docs/technical-architecture.md`**
- **Update**: Document that `output` is an array of messages
- **Add**: Explanation of why array is needed (tool calls, multi-message responses)

**File: `packages/tally/README.md`**
- **Update**: Any examples showing ConversationStep structure

## Migration Strategy

### Phase 1: Backward Compatibility (Recommended)
1. Update type definition to array
2. Update validators to accept both single message and array
3. Normalize single message to array in adapters
4. Update all code to handle array

### Phase 2: Update All Access Points
1. Update all `extractTextFromMessage(step.output)` calls to handle arrays
2. Update tool call extraction to iterate over array
3. Update all metrics to aggregate text from array

### Phase 3: Update Recording
1. Update `AgentStep` interface to use array
2. Update agent recording functions to capture all messages
3. Update conversion utilities

### Phase 4: Update Test Fixtures
1. Update all test fixtures to use array format
2. Create migration script for existing recorded conversations

## Helper Functions to Create

### 1. Extract Text from Message Array
```typescript
export function extractTextFromMessages(messages: readonly ModelMessage[]): string {
  return messages
    .map(extractTextFromMessage)
    .filter(text => text.length > 0)
    .join('\n\n');
}
```

### 2. Extract Tool Calls from Message Array
```typescript
export function extractToolCallsFromMessages(messages: readonly ModelMessage[]): ExtractedToolCall[] {
  const toolCalls: ExtractedToolCall[] = [];
  for (const message of messages) {
    if (message.role === 'assistant') {
      toolCalls.push(...extractToolCalls(message));
    }
  }
  return toolCalls;
}
```

### 3. Normalize Output (Backward Compatibility)
```typescript
export function normalizeOutput(output: ModelMessage | readonly ModelMessage[]): readonly ModelMessage[] {
  return Array.isArray(output) ? output : [output];
}
```

## Testing Requirements

1. **Unit Tests**: Update all tests that create ConversationStep objects
2. **Integration Tests**: Verify metrics work with array output
3. **E2E Tests**: Verify full evaluation pipeline works
4. **Backward Compatibility Tests**: Verify single message still works (if supporting)

## Breaking Changes

⚠️ **This is a breaking change** - existing ConversationStep objects with single `output` will need migration.

**Options:**
1. **Strict**: Require array format, fail validation on single message
2. **Compatible**: Accept both formats, normalize to array internally
3. **Migration**: Provide migration utility for existing data

## Files Summary

### Core Changes (Required)
- `packages/tally/src/core/types.ts` - Type definition
- `packages/tally/src/utils/guards.ts` - Type guard
- `packages/tally/src/data/validate.ts` - Validator
- `packages/tally/src/data/shape.ts` - Adapter

### Utility Updates (Required)
- `packages/tally/src/metrics/common/utils.ts` - Text extraction utilities
- `packages/tally/src/core/execution/runSingleTurn.ts` - Preprocessor
- `packages/tally/src/core/execution/executors.ts` - Context builder

### Metric Updates (Required)
- `packages/tally/src/metrics/singleTurn/toolCallAccuracy.ts` - Tool call extraction
- `packages/tally/src/metrics/multiTurn/goalCompletion.ts` - Text extraction
- `packages/tally/src/metrics/multiTurn/topicAdherence.ts` - Text extraction
- `packages/tally/src/metrics/multiTurn/roleAdherence.ts` - Text extraction

### Recording Updates (Required)
- `packages/tally/debug/utils/recorder.ts` - Interface and conversion
- `packages/tally/debug/agents/weatherAgent.ts` - Message extraction

### Test Updates (Required)
- `packages/tally/test/_fixtures/conversation.examples.ts` - Test fixtures

### Documentation Updates (Recommended)
- `packages/tally/docs/technical-architecture.md` - Architecture docs
- `packages/tally/README.md` - Usage examples

## Estimated Impact

- **Total Files**: ~20 files
- **High Impact**: 8 files (core types, validators, utilities)
- **Medium Impact**: 6 files (metrics)
- **Low Impact**: 6 files (tests, docs, recording)

## Risk Assessment

- **High Risk**: Breaking existing conversations, test failures
- **Medium Risk**: Metrics behavior changes, performance impact
- **Low Risk**: Documentation updates

## Recommendations

1. **Start with backward compatibility** - Accept both formats initially
2. **Add helper functions** - Create utilities for common operations
3. **Update tests first** - Ensure test fixtures are updated
4. **Incremental rollout** - Update one module at a time
5. **Migration script** - Provide utility to migrate existing data

