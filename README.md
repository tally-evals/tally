# Tally

A TypeScript evaluation framework for running model evaluations with datasets, evaluators, metrics, and aggregators.

## Overview

Tally provides a structured approach to evaluating model behavior through:

- **Datasets & Conversations** - Input data for evaluation
- **Evaluators** - Judge what to check and how (Selector + Scorer)
- **Metrics** - Define what to measure (Boolean, Number, Ordinal/Enum)
- **Aggregators** - Summarize many results into meaningful insights
- **EvaluationReport** - Final output with detailed and summary results

## Packages

This is a monorepo containing the following packages:

### Core Packages

- **[`@tally-evals/tally`](./packages/tally)** - Main evaluation framework
- **[`@tally-evals/trajectories`](./packages/trajectories)** - Framework-agnostic trajectory generation for multi-turn conversations

### Example Packages

- **[`@tally-evals/examples-ai-sdk`](./apps/examples/ai-sdk)** - Example agents built with AI SDK
- **[`@tally-evals/examples-mastra`](./apps/examples/mastra)** - Example agents built with Mastra
- **[`@tally-evals/examples-agent-kit`](./apps/examples/agent-kit)** - Example agents built with Agent Kit

### Documentation

- **[`docs`](./apps/docs)** - Documentation site built with Fumadocs

## Installation

Install the packages you need:

```bash
# Core evaluation framework
npm install @tally-evals/tally
# or
pnpm add @tally-evals/tally
# or
yarn add @tally-evals/tally

# Trajectory generation (optional)
npm install @tally-evals/trajectories
# or
pnpm add @tally-evals/trajectories
# or
yarn add @tally-evals/trajectories
```

Or install both at once:

```bash
npm install @tally-evals/tally @tally-evals/trajectories
# or
pnpm add @tally-evals/tally @tally-evals/trajectories
# or
yarn add @tally-evals/tally @tally-evals/trajectories
```

## Quick Start

### Trajectory Generation

Generate multi-turn conversation trajectories using AI-as-user simulation. The trajectories package supports multiple agent patterns:

**Using an AI SDK Agent instance:**

```typescript
import { createTrajectory, runTrajectory, withAISdkAgent, toConversation } from '@tally-evals/trajectories'
import { weatherAgent } from '@tally-evals/examples-ai-sdk'
import { google } from '@ai-sdk/google'

// Wrap your agent (AI SDK Agent instance)
const agent = withAISdkAgent(weatherAgent)

// Define trajectory with goal, persona, and steps
const trajectory = createTrajectory({
  goal: 'Get weather information for multiple locations',
  persona: {
    name: 'Weather Inquirer',
    description: 'You need weather information for different locations.',
    guardrails: [
      'Ask naturally and conversationally',
      'Provide location names clearly',
    ],
  },
  steps: [
    { instruction: 'Ask for current weather in San Francisco' },
    { instruction: 'Ask for weather in New York in celsius' },
    { instruction: 'Ask for weather forecast in Paris, France' },
  ],
  mode: 'loose',
  maxTurns: 10,
  storage: { strategy: 'local', conversationId: 'weather-run' }, // Optional storage config
  userModel: google('models/gemini-2.5-flash-lite'),
}, agent)

// Run the trajectory
const result = await runTrajectory(trajectory)

// Convert to Tally Conversation format
const conversation = toConversation(result, 'weather-trajectory')
console.log(`Completed ${result.steps.length} turns`)
```

**Using generateText config directly:**

```typescript
import { createTrajectory, runTrajectory, withAISdkAgent, toConversation } from '@tally-evals/trajectories'
import { google } from '@ai-sdk/google'

// Wrap using generateText config (without messages/prompt)
const agent = withAISdkAgent({
  model: google('models/gemini-2.5-flash-lite'),
  temperature: 0.7,
  // ... other generateText options
})

const trajectory = createTrajectory({
  goal: 'Get weather information',
  persona: {
    description: 'You need weather information.',
  },
  mode: 'loose',
  maxTurns: 10,
  userModel: google('models/gemini-2.5-flash-lite'),
}, agent)

const result = await runTrajectory(trajectory)
const conversation = toConversation(result)
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
  inputs: [relevanceMetric, completenessMetric, roleAdherenceMetric, goalCompletionMetric],
  scorer: qualityScorer,
  verdict: thresholdVerdict(0.7), // Pass if score >= 0.7
})

// Create evaluator with evals
const evaluator = createEvaluator({
  name: 'Agent Quality Evaluation',
  evals: [relevanceEval, completenessEval, roleAdherenceEval, goalCompletionEval, overallQualityEval],
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

// Check verdicts for each conversation
report.perTargetResults.forEach((result) => {
  console.log(`Conversation ${result.targetId}:`)
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
3. **Scorer Evals** - Combine multiple metrics using a scorer

### Verdict Policies

Verdict policies define pass/fail criteria:

- `thresholdVerdict(threshold)` - Pass if normalized score >= threshold (0-1)
- `booleanVerdict(passWhen)` - Pass if boolean value matches (true/false)
- `rangeVerdict(min, max)` - Pass if score is within range
- `ordinalVerdict(categories)` - Pass if value matches allowed categories
- `customVerdict(fn)` - Custom pass/fail logic function

### Report Structure

The `EvaluationReport` includes:

- `evalSummaries` - Aggregated statistics per eval (mean, percentiles, pass rates)
- `perTargetResults` - Detailed results per conversation/dataset item
  - `rawMetrics` - Raw metric values
  - `derivedMetrics` - Scorer outputs
  - `verdicts` - Pass/fail verdicts per eval
- `aggregateSummaries` - Legacy aggregator results (deprecated, use evalSummaries)

## Development

This is a monorepo managed with pnpm workspaces and Turbo.

### Prerequisites

- Node.js 18+
- pnpm 8.15.0+

### Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run linting
pnpm lint

# Start development mode
pnpm dev
```

### Working on Specific Packages

```bash
# Build a specific package
pnpm --filter=tally build

# Run tests for a specific package
pnpm --filter=tally test

# Run in development mode
pnpm --filter=tally dev
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
├── pnpm-workspace.yaml    # pnpm workspace definition
└── turbo.json            # Turbo pipeline configuration
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Links

- [GitHub Repository](https://github.com/tally-evals/tally)
- [Documentation](./apps/docs) (coming soon)

