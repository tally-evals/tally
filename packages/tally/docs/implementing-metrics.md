# Implementing Built-in Metrics

Guide for adding new built-in metrics to Tally.

## Overview

Built-in metrics are pre-configured metrics that users can use directly without defining prompts or compute functions.

**Location:** `src/metrics/`

```
src/metrics/
├── singleTurn/           # Per-step metrics
│   ├── answerRelevance.ts
│   ├── answerSimilarity.ts
│   ├── completeness.ts
│   ├── toxicity.ts
│   └── toolCallAccuracy.ts
├── multiTurn/            # Conversation-level metrics
│   ├── goalCompletion.ts
│   ├── roleAdherence.ts
│   └── topicAdherence.ts
├── common/
│   └── utils.ts          # Shared utilities
└── index.ts              # Public exports
```

## Metric Types

| Type | Scope | Runs On | Example |
|------|-------|---------|---------|
| Single-turn LLM | `single` | Each step | Answer relevance |
| Single-turn Code | `single` | Each step | Word count |
| Multi-turn LLM | `multi` | Whole conversation | Goal completion |
| Multi-turn Code | `multi` | Whole conversation | Step count |

## Step 1: Define the Metric

### Single-Turn LLM Metric

```typescript
// src/metrics/singleTurn/myMetric.ts
import type { LanguageModelLike } from '@tally/core/types';
import { 
  defineBaseMetric, 
  defineSingleTurnLLM,
  withNormalization,
} from '../../core/primitives';
import { DEFAULT_NUMERIC_AGGREGATORS } from '../../aggregators';

/**
 * My Metric - measures something about the response
 * 
 * @param model - Language model to use for evaluation
 * @returns Configured metric definition
 */
export function createMyMetric(model: LanguageModelLike) {
  // 1. Define base metric
  const base = defineBaseMetric({
    name: 'myMetric',
    valueType: 'number',
    description: 'Measures something on a 0-1 scale',
  });

  // 2. Add normalization
  const normalized = withNormalization(base, {
    normalizer: { type: 'identity' }, // Already 0-1
  });

  // 3. Create LLM metric
  return defineSingleTurnLLM({
    base: normalized,
    model,
    promptTemplate: (input, output, expected) => `
You are evaluating a response for [quality being measured].

## Input
${input}

## Response
${output}

${expected ? `## Expected\n${expected}\n` : ''}

## Task
Rate the response on a scale from 0 to 1 where:
- 0 = [bad description]
- 1 = [good description]

Provide your rating.
`,
    aggregators: DEFAULT_NUMERIC_AGGREGATORS,
  });
}
```

### Single-Turn Code Metric

```typescript
// src/metrics/singleTurn/wordCount.ts
import { defineBaseMetric, defineSingleTurnCode } from '../../core/primitives';
import { DEFAULT_NUMERIC_AGGREGATORS } from '../../aggregators';

/**
 * Word Count - counts words in the output
 */
export function createWordCountMetric() {
  const base = defineBaseMetric({
    name: 'wordCount',
    valueType: 'number',
    description: 'Number of words in the output',
  });

  return defineSingleTurnCode({
    base,
    compute: ({ output }) => {
      return output.split(/\s+/).filter(Boolean).length;
    },
    aggregators: DEFAULT_NUMERIC_AGGREGATORS,
  });
}
```

### Multi-Turn LLM Metric

```typescript
// src/metrics/multiTurn/goalCompletion.ts
import type { LanguageModelLike, Conversation } from '@tally/core/types';
import { 
  defineBaseMetric, 
  defineMultiTurnLLM,
  withNormalization,
} from '../../core/primitives';

/**
 * Goal Completion - measures if conversation achieved its goal
 */
export function createGoalCompletionMetric(
  model: LanguageModelLike,
  options: { goal: string }
) {
  const base = defineBaseMetric({
    name: 'goalCompletion',
    valueType: 'number',
    description: 'How well the conversation achieved its goal',
  });

  const normalized = withNormalization(base, {
    normalizer: { type: 'identity' },
  });

  return defineMultiTurnLLM({
    base: normalized,
    model,
    promptTemplate: (conversation: Conversation) => {
      const transcript = conversation.steps
        .map(s => `${s.role}: ${s.output}`)
        .join('\n');

      return `
You are evaluating a conversation for goal completion.

## Goal
${options.goal}

## Conversation
${transcript}

## Task
Rate how well the conversation achieved the goal (0-1).
`;
    },
  });
}
```

## Step 2: Add Exports

```typescript
// src/metrics/index.ts
export { createMyMetric } from './singleTurn/myMetric';
export { createWordCountMetric } from './singleTurn/wordCount';
export { createGoalCompletionMetric } from './multiTurn/goalCompletion';
```

## Step 3: Add Tests

```typescript
// src/metrics/singleTurn/__tests__/myMetric.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createMyMetric } from '../myMetric';

describe('createMyMetric', () => {
  it('should create a valid metric definition', () => {
    const mockModel = { modelId: 'test' } as any;
    const metric = createMyMetric(mockModel);

    expect(metric.name).toBe('myMetric');
    expect(metric.valueType).toBe('number');
    expect(metric.scope).toBe('single');
  });

  it('should generate correct prompt', () => {
    const mockModel = { modelId: 'test' } as any;
    const metric = createMyMetric(mockModel);

    const prompt = metric.promptTemplate('input', 'output', 'expected');
    expect(prompt).toContain('input');
    expect(prompt).toContain('output');
    expect(prompt).toContain('expected');
  });
});
```

## Metric Design Guidelines

### Value Types

| Use Case | Value Type | Normalization |
|----------|------------|---------------|
| 0-1 score from LLM | `number` | `identity` |
| Raw count | `number` | `min-max` or `linear` |
| Yes/no judgment | `boolean` | `identity` (1/0) |
| Category | `string` | `ordinal-map` |
| Ordinal rating | `ordinal` | `ordinal-map` |

### Prompt Templates

**Good prompts:**
- Clear criteria definitions
- Explicit rating scale
- Examples when helpful
- Structured format

```typescript
promptTemplate: (input, output) => `
You are evaluating response quality.

## Criteria
- Relevance: Does the response address the input?
- Completeness: Does it cover all aspects?
- Accuracy: Is the information correct?

## Rating Scale
0 = Poor (irrelevant, incomplete, or incorrect)
0.5 = Acceptable (addresses main points)
1 = Excellent (comprehensive and accurate)

## Input
${input}

## Response
${output}

Rate the response (0-1):
`
```

### Aggregators

Choose appropriate aggregators:

```typescript
// Numeric metrics (0-1 scores)
aggregators: [
  createMeanAggregator(),
  createPercentileAggregator({ percentile: 50 }),
  createPercentileAggregator({ percentile: 90 }),
]

// Boolean metrics
aggregators: [
  createTrueRateAggregator(),
  createFalseRateAggregator(),
]

// Ordinal/categorical metrics
aggregators: [
  createDistributionAggregator(),
  createModeAggregator(),
]
```

### Normalization

Common patterns:

```typescript
// Already 0-1 (LLM scores)
{ normalizer: { type: 'identity' } }

// Count → 0-1 based on dataset range
{ 
  normalizer: { type: 'min-max', clamp: true },
  calibrate: 'fromDataset',
}

// Custom mapping
{
  normalizer: { 
    type: 'ordinal-map', 
    values: { 'low': 0, 'medium': 0.5, 'high': 1 }
  }
}
```

## Checklist

Before submitting a new metric:

- [ ] Metric has descriptive `name` and `description`
- [ ] Value type matches output (number/boolean/string)
- [ ] Normalization configured appropriately
- [ ] Aggregators match value type
- [ ] Prompt is clear and structured (for LLM metrics)
- [ ] Tests cover metric creation and prompt generation
- [ ] Exported in `src/metrics/index.ts`
- [ ] Documentation updated

## Examples

For reference implementations, see:

- `src/metrics/singleTurn/answerRelevance.ts` - Basic LLM metric
- `src/metrics/singleTurn/toolCallAccuracy.ts` - Code metric with objects
- `src/metrics/multiTurn/goalCompletion.ts` - Multi-turn LLM metric
