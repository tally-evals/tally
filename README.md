<div align="center">
  <br/>
  <h1>Tally</h1>
  <p><b>Typesafe agent evaluations and simulated conversations</b></p>
  <p>
    Tally is a TypeScript library to <b>simulate conversations</b> with your agents and <b>evaluate</b> them with reusable, composable building blocks.
    Ship agents with confidence using concise, expressive, <b>type-safe</b> APIs.
  </p>
  <p>
    <a href="#getting-started">Quickstart</a> •
    <a href="#concepts">Concepts</a> •
    <a href="./packages/tally">Package</a> •
    <a href="./apps/examples/ai-sdk">AI SDK Examples</a>
  </p>
</div>

## Why Tally

- **Typesafe by design**: Strongly-typed metrics, evals, verdicts, and reports
- **Composable primitives**: Reuse metrics, scorers, and evals across tests
- **Single-turn + Multi-turn**: Measure steps and whole conversations
- **Realistic testing**: Generate simulated conversations (optional) and evaluate end-to-end
- **Actionable reports**: Built-in summaries and verdicts ready for CI



## Concepts

- **Conversation**: A multi-turn exchange used as the evaluation target — *enables testing realistic multi-turn interactions*
- **MetricDef**: A definition of what to measure (LLM-based or code-based) — *reusable measurement logic*
  - **Single-Turn**: Measures individual conversation steps or dataset items — *evaluate per-turn quality*
  - **Multi-Turn**: Measures entire conversations — *evaluate overall conversation quality*
- **Scorer**: Combines/normalizes multiple metrics into a single score — *create composite quality scores*
- **Eval**: A metric + verdict policy that defines pass/fail criteria — *enables automated pass/fail decisions*
  - **Single-Turn Eval**: Evaluates individual steps with a threshold or custom policy — *per-turn quality gates*
  - **Multi-Turn Eval**: Evaluates entire conversations with a threshold or custom policy — *conversation-level quality gates*
  - **Scorer Eval**: Combines multiple metrics via a scorer, then applies a verdict — *composite quality gates*
- **Evaluator**: A set of evals + a run policy (which steps/items to evaluate) — *groups related evaluations together*
- **Report**: The output, including per-target details and eval summaries with aggregations — *actionable results for CI/CD*

## Getting Started

```bash
bun add @tally-evals/tally
# Optional: conversation generation
bun add @tally-evals/trajectories
bun add @tally-evals/core
```

## Packages

This monorepo contains:

- **[`@tally-evals/tally`](./packages/tally)** - Core evaluation framework
- **[`@tally-evals/trajectories`](./packages/trajectories)** - Generate simulated conversations
- **[Examples](./apps/examples)** - Example agents (AI SDK, Mastra, Agent Kit)

## Quick Start

### Trajectory Generation

Generate multi-turn conversation trajectories using AI-as-user simulation:

```typescript
import {
  createTrajectory,
  runTrajectory,
  withAISdkAgent,
  toConversation,
} from '@tally-evals/trajectories'
import { TallyStore } from '@tally-evals/core'
import { weatherAgent } from '@tally-evals/examples-ai-sdk'
import { google } from '@ai-sdk/google'

// Wrap your agent
const agent = withAISdkAgent(weatherAgent)

// Define trajectory with goal, persona, and steps
const trajectory = createTrajectory(
  {
    goal: 'Get weather information for multiple locations',
    persona: {
      name: 'Weather Inquirer',
      description: 'You need weather information for different locations.',
      guardrails: [
        'Ask naturally and conversationally',
        'Provide location names clearly',
      ],
    },
    steps: {
      steps: [
        { id: 'step-1', instruction: 'Ask for current weather in San Francisco' },
        { id: 'step-2', instruction: 'Ask for weather in New York in celsius' },
        { id: 'step-3', instruction: 'Ask for weather forecast in Paris, France' },
      ],
      start: 'step-1',
      terminals: ['step-3'],
    },
    maxTurns: 10,
    userModel: google('models/gemini-2.5-flash-lite'),
  },
  agent
)

// Run the trajectory
const store = await TallyStore.open({ cwd: process.cwd() })
const result = await runTrajectory(trajectory, {
  store,
  trajectoryId: 'weather-trajectory',
})

// Convert to Tally Conversation format
const conversation = toConversation(result, 'weather-trajectory')
```

### Evaluation with Tally

Evaluate your agents using datasets and conversations with evals (recommended approach):

```typescript
import {
  createTally,
  createEvaluator,
  defineInput,
  defineBaseMetric,
  runAllTargets,
  defineSingleTurnEval,
  defineMultiTurnEval,
  defineScorerEval,
  thresholdVerdict,
  formatReportAsTables,
} from '@tally-evals/tally'
import { createWeightedAverageScorer } from '@tally-evals/tally/scorers'
import {
  createAnswerRelevanceMetric,
  createCompletenessMetric,
  createRoleAdherenceMetric,
  createGoalCompletionMetric,
} from '@tally-evals/tally/metrics'
import { google } from '@ai-sdk/google'

// Prepare your data (from trajectory or dataset)
const conversations = [
  {
    id: 'weather-1',
    steps: [
      {
        stepIndex: 0,
        input: { role: 'user', content: 'What is the weather in San Francisco?' },
        output: [{ role: 'assistant', content: 'The weather in San Francisco is sunny, 72°F.' }],
        timestamp: new Date(),
      },
      {
        stepIndex: 1,
        input: { role: 'user', content: 'What about New York?' },
        output: [{ role: 'assistant', content: 'New York is currently cloudy with a temperature of 65°F.' }],
        timestamp: new Date(),
      },
    ],
  },
]

const model = google('models/gemini-2.5-flash-lite')

// Create single-turn metrics
const relevanceMetric = createAnswerRelevanceMetric({ provider: model })
const completenessMetric = createCompletenessMetric({ provider: model })

// Create multi-turn metric
const roleAdherenceMetric = createRoleAdherenceMetric({
  expectedRole: 'weather information assistant',
  provider: model,
})

const goalCompletionMetric = createGoalCompletionMetric({
  goal: 'Provide accurate weather information for requested locations',
  provider: model,
})

// Create scorer combining multiple metrics with weights
const overallQualityMetric = defineBaseMetric({ name: 'overallQuality', valueType: 'number' })
const qualityScorer = createWeightedAverageScorer({
  name: 'OverallQualityScorer',
  output: overallQualityMetric,
  inputs: [
    defineInput({ metric: relevanceMetric, weight: 0.3 }),
    defineInput({ metric: completenessMetric, weight: 0.3 }),
    defineInput({ metric: roleAdherenceMetric, weight: 0.2 }),
    defineInput({ metric: goalCompletionMetric, weight: 0.2 }),
  ],
})

// Define evals (combine metrics with verdict policies)
const relevanceEval = defineSingleTurnEval({
  name: 'Answer Relevance',
  metric: relevanceMetric,
  verdict: thresholdVerdict(0.7), // Pass if score >= 0.7
})

const completenessEval = defineSingleTurnEval({
  name: 'Completeness',
  metric: completenessMetric,
  verdict: thresholdVerdict(0.6), // Pass if score >= 0.6
})

const roleAdherenceEval = defineMultiTurnEval({
  name: 'Role Adherence',
  metric: roleAdherenceMetric,
  verdict: thresholdVerdict(0.8), // Pass if score >= 0.8
})

const goalCompletionEval = defineMultiTurnEval({
  name: 'Goal Completion',
  metric: goalCompletionMetric,
  verdict: thresholdVerdict(0.7), // Pass if score >= 0.7
})

const overallQualityEval = defineScorerEval({
  name: 'Overall Quality',
  scorer: qualityScorer,
  verdict: thresholdVerdict(0.7), // Pass if score >= 0.7
})

// Create evaluator with evals
const evaluator = createEvaluator({
  name: 'Agent Quality Evaluation',
  evals: [
    relevanceEval,
    completenessEval,
    roleAdherenceEval,
    goalCompletionEval,
    overallQualityEval,
  ],
  context: runAllTargets(), // Evaluate all conversation steps
})

// Create Tally instance and run evaluation
const tally = createTally({
  data: conversations,
  evaluators: [evaluator],
})

const report = await tally.run()

// Format and display results as tables
formatReportAsTables(report, conversations)

// Access results programmatically
console.log('Eval summaries:', report.evalSummaries)
console.log('Per-target results:', report.perTargetResults)

// Check eval summaries
report.evalSummaries.forEach((summary, evalName) => {
  console.log(`${evalName}:`)
  console.log(`  Mean score: ${summary.aggregations.score.mean}`)
  if (summary.verdictSummary) {
    console.log(`  Pass rate: ${summary.verdictSummary.passRate}`)
  }
})

// Check verdicts for each target
report.perTargetResults.forEach((result) => {
  console.log(`Target ${result.targetId}:`)
  result.verdicts.forEach((verdict, evalName) => {
    console.log(`  ${evalName}: ${verdict.verdict} (score: ${verdict.score})`)
  })
})
```

## Evals API

**Evals** are the recommended way to define evaluations in Tally. They combine metrics with verdict policies to define what to evaluate and how to determine pass/fail.

### Types of Evals

1. **Single-Turn Evals** - Evaluate individual conversation steps or dataset items
2. **Multi-Turn Evals** - Evaluate entire conversations
3. **Scorer Evals** - Combine multiple metrics using a scorer (the eval automatically uses the scorer's configured inputs)

### Verdict Policies

Verdict policies define pass/fail criteria:

- `thresholdVerdict(threshold)` - Pass if normalized score >= threshold (0-1)
- `booleanVerdict(passWhen)` - Pass if boolean value matches (true/false)
- `rangeVerdict(min, max)` - Pass if score is within range
- `ordinalVerdict(categories)` - Pass if value matches allowed categories
- `customVerdict(fn)` - Custom pass/fail logic function

### Aggregators

Aggregators compute summary statistics across evaluation results. They are type-safe and discriminated by `kind`:

```typescript
import {
  // Custom aggregator definitions
  defineNumericAggregator,
  defineBooleanAggregator,
  defineCategoricalAggregator,
  // Prebuilt aggregators
  createMeanAggregator,
  createPercentileAggregator,
  createThresholdAggregator,
  createTrueRateAggregator,
  createDistributionAggregator,
  // Default aggregators by value type
  getDefaultAggregators,
} from '@tally-evals/tally'
```

- **Numeric**: `createMeanAggregator()`, `createPercentileAggregator()`, `createThresholdAggregator()`
- **Boolean**: `createTrueRateAggregator()`, `createFalseRateAggregator()`
- **Categorical**: `createDistributionAggregator()`, `createModeAggregator()`

### Report Structure

`tally.run()` returns a **`TallyRunReport`** (SDK-facing). It contains:

- `result.summaries.byEval[evalName]` — per-eval summary rollups
- `result.singleTurn[evalName].byStepIndex[stepIndex]` — single-turn results (step-indexed, with `null` holes)
- `result.multiTurn[evalName]` — conversation-level (multi-turn) results
- `result.scorers[evalName]` — scorer outputs (explicitly scalar vs series)

For read-only tooling (CLI/viewer/dev server), persist a **`TallyRunArtifact`** via `report.toArtifact()`.

## Development

This is a monorepo managed with Bun workspaces and Turbo.

### Prerequisites

- Bun 1.2+

### Setup

```bash
# Install dependencies
bun install

# Build all packages
bun run build

# Run tests
bun run test

# Run linting
bun run lint

# Start development mode
bun run dev
```

### Working on Specific Packages

```bash
# Build a specific package
bun run --filter=tally build

# Run tests for a specific package
bun run --filter=tally test

# Run in development mode
bun run --filter=tally dev
```

## Project Structure

```
tally/
├── apps/
│   ├── docs/              # Documentation site
│   └── examples/          # Example agents
│       ├── ai-sdk/        # AI SDK examples
│       ├── mastra/        # Mastra examples
│       └── agent-kit/     # Agent Kit examples
├── packages/
│   ├── tally/             # Core evaluation framework
│   ├── trajectories/      # Trajectory generation package
│   ├── biome-config/      # Shared Biome configuration
│   └── typescript-config/ # Shared TypeScript configurations
├── package.json           # Root workspace configuration
├── bun.lock               # Bun lockfile
└── turbo.json            # Turbo pipeline configuration
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Links

- [GitHub Repository](https://github.com/tally-evals/tally)
- [Documentation](./apps/docs) (coming soon)

