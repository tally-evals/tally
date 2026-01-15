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
  createEvaluator,
  defineBaseMetric,
  withNormalization,
  createSingleTurnLLM,
  createMultiTurnLLM,
  defineInput,
  defineSingleTurnEval,
  defineMultiTurnEval,
  defineScorerEval,
  runSelectedSteps,
  thresholdVerdict,
  type Conversation,
  type SingleTurnMetricDef,
  type MultiTurnMetricDef,
} from '@tally-evals/tally';
import { createWeightedAverageScorer } from '@tally-evals/tally/scorers';
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

const answerRelevanceEval = defineSingleTurnEval({
  name: 'Answer Relevance',
  metric: ANSWER_RELEVANCE,
  verdict: thresholdVerdict(0.5),
});

const roleAdherenceEval = defineMultiTurnEval({
  name: 'Role Adherence',
  metric: ROLE_ADHERENCE,
  verdict: thresholdVerdict(0.7),
});

const overallQualityEval = defineScorerEval({
  name: 'Overall Quality',
  inputs: [ANSWER_RELEVANCE, ROLE_ADHERENCE],
  scorer: CONVERSATION_SCORER,
  verdict: thresholdVerdict(0.6),
});

const conversationEvaluator = createEvaluator({
  name: 'Conversation Quality',
  evals: [answerRelevanceEval, roleAdherenceEval, overallQualityEval],
  context: runSelectedSteps([1]),
});

const scenarioRun = createTally<Conversation>({
  data: conversations,
  evaluators: [conversationEvaluator],
});

const scenarioReport = await scenarioRun.run();
```

### Example 2: Eval (`Tally<DatasetItem>`) – Single-Turn Metrics Across All Items

```ts
import {
  createTally,
  createEvaluator,
  defineBaseMetric,
  withNormalization,
  createSingleTurnCode,
  defineInput,
  defineSingleTurnEval,
  defineScorerEval,
  runAllTargets,
  thresholdVerdict,
  type DatasetItem,
  type SingleTurnMetricDef,
} from '@tally-evals/tally';
import { createWeightedAverageScorer } from '@tally-evals/tally/scorers';

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

const answerRelevanceEval = defineSingleTurnEval({
  name: 'Answer Relevance',
  metric: ANSWER_RELEVANCE_DATASET,
});

const latencyEval = defineSingleTurnEval({
  name: 'Latency Score',
  metric: LATENCY_SCORE,
});

const overallQualityEval = defineScorerEval({
  name: 'Overall Quality',
  inputs: [ANSWER_RELEVANCE_DATASET, LATENCY_SCORE],
  scorer: DATASET_SCORER,
  verdict: thresholdVerdict(0.6),
});

const datasetEvaluator = createEvaluator({
  name: 'Dataset Quality',
  evals: [answerRelevanceEval, latencyEval, overallQualityEval],
  context: runAllTargets(),
});

const evalRun = createTally<DatasetItem>({
  data: datasetItems,
  evaluators: [datasetEvaluator],
});

const evalReport = await evalRun.run();
```

Both examples keep metrics, scorers, and evals as **values**. Multi-turn metrics always consume entire conversations, while the `EvaluationContext` controls which single-turn targets are scored—no runtime shape conversions required.

