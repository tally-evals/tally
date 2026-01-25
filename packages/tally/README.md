# Tally

A TypeScript framework for evaluating LLM agents with datasets, metrics, scorers, and evals.

## Why Tally?
- Compose evaluations from real objects (metrics, scorers, evals) — not string IDs
- Evaluate single-turn and multi-turn behavior over datasets or conversations
- Define pass/fail criteria with verdict policies
- Type-safe aggregators (numeric, boolean, categorical) for summary statistics
- Produce a structured `TallyRunReport` for tests/CI (and persist a `TallyRunArtifact` for read-only tooling)

## Install

```bash
bun add @tally-evals/tally
```

## Getting started

Minimal end-to-end example using evals (recommended approach):

```ts
import {
  createTally,
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
  scorer: qualityScorer,
  verdict: thresholdVerdict(0.7), // Pass if score >= 0.7
})

// Run with evals passed directly to createTally
const tally = createTally({
  data: conversations,
  evals: [relevanceEval, completenessEval, roleAdherenceEval, overallQualityEval],
})
const report = await tally.run()

// Access eval summaries (single-turn + multi-turn + scorers)
const summary = report.result.summaries?.byEval?.['Answer Relevance']
console.log('summary', summary)

// Type-safe view for test assertions
const view = report.view()
const stepResults = view.step(0) // Get all eval results for step 0
const conversationResults = view.conversation() // Get multi-turn/scorer results
const summaryResults = view.summary() // Get aggregate summaries

// Persist for CLI/viewer
const artifact = report.toArtifact()
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

### Aggregators

Aggregators compute summary statistics. They are type-discriminated by `kind`:

```ts
import {
  createMeanAggregator,
  createPercentileAggregator,
  createTrueRateAggregator,
  createDistributionAggregator,
  getDefaultAggregators,
} from '@tally-evals/tally'

// Default aggregators based on metric value type
const aggregators = getDefaultAggregators('number') // mean, p50, p75, p90
const boolAggregators = getDefaultAggregators('boolean') // + trueRate
const catAggregators = getDefaultAggregators('string') // + distribution
```

### Report Structure

The `TallyRunReport` provides type-safe access to results:

```ts
// Direct result access
report.result.singleTurn['Answer Relevance']     // Step-indexed results
report.result.multiTurn['Role Adherence']        // Conversation-level results  
report.result.scorers['Overall Quality']         // Scorer outputs
report.result.summaries?.byEval?.['Answer Relevance']  // Aggregated summaries

// Type-safe view for test assertions
const view = report.view()
view.step(0)        // { 'Answer Relevance': StepEvalResult, ... }
view.conversation() // { 'Role Adherence': ConversationEvalResult, ... }
view.summary()      // { 'Answer Relevance': EvalSummary, ... }

// Artifact for persistence (CLI/viewer)
const artifact = report.toArtifact()
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

### Core
- `createTally` - Main entry point, accepts `data` and `evals`

### Evals
- `defineSingleTurnEval`, `defineMultiTurnEval`, `defineScorerEval`

### Verdicts
- `thresholdVerdict`, `booleanVerdict`, `rangeVerdict`, `ordinalVerdict`, `customVerdict`

### Metrics (Prebuilt)
- **Single-Turn**: `createAnswerRelevanceMetric`, `createCompletenessMetric`, `createToxicityMetric`, `createAnswerSimilarityMetric`, `createToolCallAccuracyMetric`
- **Multi-Turn**: `createRoleAdherenceMetric`, `createGoalCompletionMetric`, `createTopicAdherenceMetric`

### Metrics (Custom)
- `defineBaseMetric` - Define metric shape (name, valueType)
- `defineSingleTurnCode`, `defineSingleTurnLLM` - Single-turn metric implementations
- `defineMultiTurnCode`, `defineMultiTurnLLM` - Multi-turn metric implementations
- `withNormalization`, `withMetadata` - Metric modifiers

### Scorers
- `createWeightedAverageScorer` - Combine metrics with weights
- `defineInput` - Define scorer input with weight
- `defineScorer` - Custom scorer implementation

### Aggregators
- **Define Custom**: `defineNumericAggregator`, `defineBooleanAggregator`, `defineCategoricalAggregator`
- **Numeric**: `createMeanAggregator`, `createPercentileAggregator`, `createThresholdAggregator`
- **Boolean**: `createTrueRateAggregator`, `createFalseRateAggregator`
- **Categorical**: `createDistributionAggregator`, `createModeAggregator`
- **Defaults**: `getDefaultAggregators(valueType)`, `DEFAULT_NUMERIC_AGGREGATORS`

### Normalizers
- `createMinMaxNormalizer`, `createZScoreNormalizer`, `createThresholdNormalizer`
- `createLinearNormalizer`, `createOrdinalMapNormalizer`, `createIdentityNormalizer`

### Views
- `createTargetRunView` - Type-safe view over run artifact

### Utilities
- `formatReportAsTables` - Format report for console output

## Development

This package is part of the Tally monorepo.

```bash
bun install
bun run build
bun run test
```

## License

MIT
