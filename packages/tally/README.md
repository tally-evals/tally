# Tally

A TypeScript framework for evaluating LLM agents with datasets, metrics, scorers, and evals.

## Why Tally?
- Compose evaluations from real objects (metrics, scorers, evals) — not string IDs
- Evaluate single-turn and multi-turn behavior over datasets or conversations
- Define pass/fail criteria with verdict policies
- Summarize results with built-in aggregations (mean, percentile, pass-rate, etc.)
- Produce a structured `EvaluationReport` for analysis and CI

## Install

```bash
bun add @tally-evals/tally
```

## Getting started

Minimal end-to-end example using evals (recommended approach):

```ts
import {
  createTally,
  createEvaluator,
  runAllTargets,
  defineBaseMetric,
  defineInput,
  defineSingleTurnEval,
  defineMultiTurnEval,
  defineScorerEval,
  thresholdVerdict,
} from '@tally-evals/tally'
import {
  createAnswerRelevanceMetric,
  createCompletenessMetric,
  createRoleAdherenceMetric,
} from '@tally-evals/tally/metrics'
import { createWeightedAverageScorer } from '@tally-evals/tally/scorers'
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
const relevance = createAnswerRelevanceMetric({ provider: model })
const completeness = createCompletenessMetric({ provider: model })
const roleAdherence = createRoleAdherenceMetric({ 
  expectedRole: 'weather assistant',
  provider: model 
})

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

// Define evals (combine metrics with verdict policies)
const relevanceEval = defineSingleTurnEval({
  name: 'Answer Relevance',
  metric: relevance,
  verdict: thresholdVerdict(0.7), // Pass if score >= 0.7
})

const completenessEval = defineSingleTurnEval({
  name: 'Completeness',
  metric: completeness,
  verdict: thresholdVerdict(0.6), // Pass if score >= 0.6
})

const roleAdherenceEval = defineMultiTurnEval({
  name: 'Role Adherence',
  metric: roleAdherence,
  verdict: thresholdVerdict(0.8), // Pass if score >= 0.8
})

const overallQualityEval = defineScorerEval({
  name: 'Overall Quality',
  inputs: [relevance, completeness, roleAdherence],
  scorer: qualityScorer,
  verdict: thresholdVerdict(0.7), // Pass if score >= 0.7
})

// Create evaluator with evals
const evaluator = createEvaluator({
  name: 'Agent Quality',
  evals: [relevanceEval, completenessEval, roleAdherenceEval, overallQualityEval],
  context: runAllTargets(), // evaluate all conversation steps
})

// Run
const tally = createTally({ data: conversations, evaluators: [evaluator] })
const report = await tally.run()

// Access results
console.log('Eval summaries:', report.evalSummaries)
console.log('Per-target results:', report.perTargetResults)
console.log('Verdicts:', report.perTargetResults[0]?.verdicts)
```

## Evals API

**Evals** combine metrics with verdict policies to define what to evaluate and how to determine pass/fail. There are three types:

### Single-Turn Evals

Evaluate individual conversation steps or dataset items:

```ts
const relevanceEval = defineSingleTurnEval({
  name: 'Answer Relevance',
  metric: answerRelevanceMetric,
  verdict: thresholdVerdict(0.7), // Pass if normalized score >= 0.7
  description: 'Measures how relevant the response is to the query',
})
```

### Multi-Turn Evals

Evaluate entire conversations:

```ts
const roleAdherenceEval = defineMultiTurnEval({
  name: 'Role Adherence',
  metric: roleAdherenceMetric,
  verdict: thresholdVerdict(0.8), // Pass if normalized score >= 0.8
  description: 'Measures how well the assistant adheres to its role',
})
```

### Scorer Evals

Combine multiple metrics using a scorer:

```ts
const overallQualityEval = defineScorerEval({
  name: 'Overall Quality',
  inputs: [relevanceMetric, completenessMetric, roleAdherenceMetric],
  scorer: weightedAverageScorer,
  verdict: thresholdVerdict(0.7), // Pass if score >= 0.7
})
```

### Verdict Policies

Define pass/fail criteria using verdict helpers:

- `thresholdVerdict(threshold)` - Pass if score >= threshold
- `booleanVerdict()` - Pass if value is true
- `rangeVerdict(min, max)` - Pass if value is in range
- `ordinalVerdict(categories)` - Pass if value matches categories
- `customVerdict(fn)` - Custom pass/fail logic

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
  steps: {
    steps: [{ id: 'step-1', instruction: 'Ask for current weather in San Francisco' }],
    start: 'step-1',
  },
  userModel: google('models/gemini-2.5-flash-lite'),
}, agent)

const result = await runTrajectory(trajectory)
const conversation = toConversation(result, 'weather-trajectory')
```

Now pass `conversation` into Tally as shown above.

## API at a glance
- **Metrics**: `createAnswerRelevanceMetric`, `createCompletenessMetric`, `createToxicityMetric`, `createRoleAdherenceMetric`, `defineBaseMetric`
- **Scorers**: `createWeightedAverageScorer`, `defineInput`
- **Evals**: `defineSingleTurnEval`, `defineMultiTurnEval`, `defineScorerEval`
- **Verdicts**: `thresholdVerdict`, `booleanVerdict`, `rangeVerdict`, `ordinalVerdict`, `customVerdict`
- **Evaluator**: `createEvaluator`, `runAllTargets`
- **Core**: `createTally`
- **Report Formatting**: `formatReportAsTables`

## Development

This package is part of the Tally monorepo.

```bash
bun install
bun run build
bun run test
```

## License

MIT
