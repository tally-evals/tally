# Tally

A TypeScript framework for evaluating LLM agents with datasets, metrics, scorers, and aggregators.

## Why Tally?
- Compose evaluations from real objects (metrics, scorers, aggregators) — not string IDs
- Evaluate single-turn and multi-turn behavior over datasets or conversations
- Summarize results with reusable aggregators (mean, percentile, pass-rate, etc.)
- Produce a structured `EvaluationReport` for analysis and CI

## Install

```bash
pnpm add tally
# or npm/yarn
```

## Getting started

Minimal end-to-end example using a couple of metrics and a weighted scorer.

```ts
import {
  createTally,
  createEvaluator,
  runAllTargets,
  defineBaseMetric,
  defineInput,
} from '@tally-evals/tally'
import {
  createAnswerRelevanceMetric,
  createCompletenessMetric,
  createRoleAdherenceMetric,
} from '@tally-evals/tally/metrics'
import { createWeightedAverageScorer } from '@tally-evals/tally/scorers'
import {
  createMeanAggregator,
  createPassRateAggregator,
} from '@tally-evals/tally/aggregators'
import { google } from '@ai-sdk/google'

// Your data: either from a dataset or from @tally-evals/trajectories → toConversation()
const conversations = [
  {
    id: 'weather-1',
    steps: [
      {
        stepIndex: 0,
        input: { role: 'user', content: 'What is the weather in San Francisco?' },
        output: [{ role: 'assistant', content: 'Sunny, around 72°F.' }],
        timestamp: new Date(),
      },
    ],
  },
]

const model = google('models/gemini-2.5-flash-lite')

// Define metrics
const relevance = createAnswerRelevanceMetric({ model, prompt: { instruction: 'Rate relevance (0-1)' } })
const completeness = createCompletenessMetric({ model, prompt: { instruction: 'Rate completeness (0-1)' } })
const roleAdherence = createRoleAdherenceMetric({ model, prompt: { instruction: 'Rate role adherence (0-1)' } })

// Define a scorer (weighted average of metrics)
const overallMetric = defineBaseMetric({ name: 'overallQuality', valueType: 'number' })
const qualityScorer = createWeightedAverageScorer({
  name: 'OverallQuality',
  output: overallMetric,
  inputs: [
    defineInput({ metric: relevance, weight: 0.4 }),
    defineInput({ metric: completeness, weight: 0.3 }),
    defineInput({ metric: roleAdherence, weight: 0.3 }),
  ],
})

// Create evaluator
const evaluator = createEvaluator({
  name: 'Agent Quality',
  metrics: [relevance, completeness, roleAdherence],
  scorer: qualityScorer,
  context: runAllTargets(), // evaluate all conversation steps
})

// Add aggregators
const aggregators = [
  createMeanAggregator({ metric: overallMetric }),
  createPassRateAggregator({ metric: overallMetric, threshold: 0.7 }),
]

// Run
const tally = createTally({ data: conversations, evaluators: [evaluator], aggregators })
const report = await tally.run()

console.log('Aggregate summaries:', report.aggregateSummaries)
console.log('Per-target results:', report.perTargetResults)
```

## Generate data with trajectories (optional)
Use `@tally-evals/trajectories` to create multi-turn conversations automatically, then convert to Tally format:

```ts
import { createTrajectory, runTrajectory, withAISdkAgent, toConversation } from '@tally-evals/trajectories'
import { weatherAgent } from '@tally-evals/examples-ai-sdk'
import { google } from '@ai-sdk/google'

const agent = withAISdkAgent(weatherAgent)
const trajectory = createTrajectory({
  goal: 'Get weather information',
  persona: { description: 'Ask concise weather questions.' },
  steps: [{ instruction: 'Ask for current weather in San Francisco' }],
  mode: 'loose',
  userModel: google('models/gemini-2.5-flash-lite'),
}, agent)

const result = await runTrajectory(trajectory)
const conversation = toConversation(result, 'weather-trajectory')
```

Now pass `conversation` into Tally as shown above.

## API at a glance
- Metrics: `createAnswerRelevanceMetric`, `createCompletenessMetric`, `createToxicityMetric`, `createRoleAdherenceMetric`, `defineBaseMetric`
- Scorers: `createWeightedAverageScorer`, `defineInput`
- Evaluator: `createEvaluator`, `runAllTargets`
- Aggregators: `createMeanAggregator`, `createPercentileAggregator`, `createPassRateAggregator`
- Core: `createTally`

## Development

This package is part of the Tally monorepo.

```bash
pnpm install
pnpm build
pnpm test
```

## License

MIT
