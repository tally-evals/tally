# Tally Evaluation Framework - Examples

## 🚀 Usage Patterns

We demonstrate two usage patterns that highlight value-first composition, mixed metric scopes, and execution context:

1. **Scenario** (`Tally<Conversation>`) — combines a multi-turn Role Adherence metric with a single-turn Answer Relevance metric while targeting specific steps.
2. **Eval** (`Tally<DatasetItem>`) — runs single-turn metrics across all dataset items.

Both examples keep LLM-based and code-based metrics as first-class value objects.

### Example 1: Scenario (`Tally<Conversation>`) – Mixing Scopes with Step Selection

```ts
import {
  createTally,
  defineBaseMetric,
  withNormalization,
  createSingleTurnLLM,
  createMultiTurnLLM,
  createWeightedAverageScorer,
  defineInput,
  createMeanAggregator,
  runSpecificSteps,
  toScore,
  type Conversation,
  type DatasetItem,
  type Score,
  type Evaluator,
  type Aggregator,
  type SingleTurnMetricDef,
  type MultiTurnMetricDef,
} from 'tally';
import { openai } from '@ai-sdk/openai';
import type { ModelMessage } from 'ai';

// Multi-turn: Role Adherence (LLM-based)
const roleAdherenceBase = defineBaseMetric<number>({
  name: 'roleAdherence',
  valueType: 'number',
});
const ROLE_ADHERENCE: MultiTurnMetricDef<number, Conversation> = createMultiTurnLLM({
  base: withNormalization({ metric: roleAdherenceBase, default: { type: 'identity' } }),
  provider: openai('gpt-4.1'),
  prompt: {
    instruction: 'Score the assistant on how well it adheres to system and role instructions (0-1).',
  },
  // Simple demo runner; real usage would rely on structured LLM output
  runOnContainer: async (_conversation) => 0.9,
});

// Single-turn: Answer Relevance (LLM-based)
const answerRelevanceBase = defineBaseMetric<number>({
  name: 'answerRelevance',
  valueType: 'number',
});
const ANSWER_RELEVANCE: SingleTurnMetricDef<number, Conversation> = createSingleTurnLLM({
  base: withNormalization({ metric: answerRelevanceBase, default: { type: 'identity' } }),
  provider: openai('gpt-4.1'),
  prompt: {
    instruction: 'Rate how relevant the assistant reply is to the paired user message (0-1).',
  },
  runOnSelected: async (_step) => 0.82,
});

// Scorer (weighted average) over the two normalized metrics
const CONVERSATION_QUALITY = defineBaseMetric<number>({
  name: 'conversationQuality',
  valueType: 'number',
});

const CONVERSATION_SCORER = createWeightedAverageScorer({
  name: 'ConversationQuality',
  output: CONVERSATION_QUALITY,
  inputs: [defineInput({ metric: ANSWER_RELEVANCE, weight: 0.5 }), defineInput({ metric: ROLE_ADHERENCE, weight: 0.5 })]
});

const conversations: Conversation[] = [
  {
    id: 'conv-1',
    steps: [
      {
        stepIndex: 0,
        input: { role: 'user', content: 'Summarize the policy for me.' } as ModelMessage,
        output: { role: 'assistant', content: 'Sure! The policy...' } as ModelMessage,
        timestamp: new Date()
      },
      {
        stepIndex: 1,
        input: { role: 'user', content: 'Now translate that summary to French.' } as ModelMessage,
        output: { role: 'assistant', content: 'Voici la traduction...' } as ModelMessage,
        timestamp: new Date()
      }
    ]
  }
];

const conversationEvaluator: Evaluator<
  Conversation,
  readonly [typeof ANSWER_RELEVANCE, typeof ROLE_ADHERENCE]
> = {
  name: 'Conversation Quality',
  metrics: [ANSWER_RELEVANCE, ROLE_ADHERENCE],
  scorer: CONVERSATION_SCORER,
  context: runSpecificSteps([1]),
};

const conversationAggregators: readonly Aggregator[] = [
  createMeanAggregator({
    metric: CONVERSATION_SCORER.output,
    options: { description: 'Average conversation quality' },
  }),
];

const scenarioRun = createTally<Conversation>({
  data: conversations,
  evaluators: [conversationEvaluator],
  aggregators: conversationAggregators,
});

const scenarioReport = await scenarioRun.run();
```

### Example 2: Eval (`Tally<DatasetItem>`) – Single-Turn Metrics Across All Items

```ts
import {
  createTally,
  defineBaseMetric,
  withNormalization,
  createSingleTurnCode,
  createWeightedAverageScorer,
  defineInput,
  createMeanAggregator,
  toScore,
  type DatasetItem,
  type Score,
  type Evaluator,
  type Aggregator,
  type SingleTurnMetricDef,
} from 'tally';

const computeAnswerRelevance = (item: DatasetItem) =>
  item.prompt.split(' ').some((word) => item.completion.includes(word)) ? 1 : 0;

const computeLatencyMs = (item: DatasetItem & { latencyMs?: number }) =>
  item.latencyMs ?? 0;

// Single-turn: Answer relevance (code-based)
const answerRelevanceBase = defineBaseMetric<number>({
  name: 'answerRelevanceDataset',
  valueType: 'number',
});
const ANSWER_RELEVANCE_DATASET: SingleTurnMetricDef<number, DatasetItem> = createSingleTurnCode<
  number,
  DatasetItem
>({
  base: withNormalization({ metric: answerRelevanceBase, default: { type: 'identity' } }),
  runOnSelected: (item) => computeAnswerRelevance(item),
  compute: ({ data }) => computeAnswerRelevance(data as DatasetItem),
  cacheable: true,
});

// Single-turn: Latency score (code-based) with min-max normalization (lower is better)
const latencyBase = defineBaseMetric<number>({
  name: 'latencyScore',
  valueType: 'number',
});
const LATENCY_SCORE: SingleTurnMetricDef<number, DatasetItem> = createSingleTurnCode<number, DatasetItem>(
  {
    base: withNormalization({ metric: latencyBase, default: {
      type: 'min-max',
      min: 0,
      max: 1000,
      direction: 'lower',
      clip: true,
    }}),
    runOnSelected: (item) => computeLatencyMs(item),
    compute: ({ data }) => computeLatencyMs(data as DatasetItem & { latencyMs?: number }),
    cacheable: true,
  }
);

const EXAMPLE_QUALITY = defineBaseMetric<number>({
  name: 'exampleQuality',
  valueType: 'number',
});

const DATASET_SCORER = createWeightedAverageScorer({
  name: 'DatasetQuality',
  output: EXAMPLE_QUALITY,
  inputs: [defineInput({ metric: ANSWER_RELEVANCE_DATASET, weight: 0.7 }), defineInput({ metric: LATENCY_SCORE, weight: 0.3 })]
});

const datasetItems: DatasetItem[] = [
  { id: 'item-1', prompt: 'Explain the solar eclipse.', completion: 'A solar eclipse occurs when...' },
  { id: 'item-2', prompt: 'Capital of Japan?', completion: 'Tokyo, Japan.', latencyMs: 120 }
];

const datasetEvaluator: Evaluator<
  DatasetItem,
  readonly [typeof ANSWER_RELEVANCE_DATASET, typeof LATENCY_SCORE]
> = {
  name: 'Dataset Quality',
  metrics: [ANSWER_RELEVANCE_DATASET, LATENCY_SCORE],
  scorer: DATASET_SCORER,
  context: { singleTurn: { run: 'all' } }
};

const datasetAggregators: readonly Aggregator[] = [
  createMeanAggregator({
    metric: DATASET_SCORER.output,
    options: { description: 'Average per-example quality' },
  }),
];

const evalRun = createTally<DatasetItem>({
  data: datasetItems,
  evaluators: [datasetEvaluator],
  aggregators: datasetAggregators,
});

const evalReport = await evalRun.run();
```

Both examples keep metrics, scorers, evaluators, and aggregators as **values**. Multi-turn metrics always consume entire conversations, while the `EvaluationContext` controls which single-turn targets are scored—no runtime shape conversions required.

