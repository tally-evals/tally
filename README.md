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

- **[`tally`](./packages/tally)** - Main evaluation framework
- **[`@tally-evals/trajectories`](./packages/trajectories)** - Framework-agnostic trajectory generation for multi-turn conversations

### Example Packages

- **[`@tally-evals/examples-ai-sdk`](./apps/examples/ai-sdk)** - Example agents built with AI SDK
- **[`@tally-evals/examples-mastra`](./apps/examples/mastra)** - Example agents built with Mastra
- **[`@tally-evals/examples-agent-kit`](./apps/examples/agent-kit)** - Example agents built with Agent Kit

### Documentation

- **[`docs`](./apps/docs)** - Documentation site built with Fumadocs

## Installation

### Core Package

```bash
npm install tally
# or
pnpm add tally
# or
yarn add tally
```

### Trajectories Package

```bash
npm install @tally-evals/trajectories
# or
pnpm add @tally-evals/trajectories
# or
yarn add @tally-evals/trajectories
```

## Quick Start

### Trajectory Generation

Generate multi-turn conversation trajectories using AI-as-user simulation:

```typescript
import { createTrajectory, runTrajectory, withAISdkAgent, toConversation } from '@tally-evals/trajectories'
import { weatherAgent } from '@tally-evals/examples-ai-sdk'
import { google } from '@ai-sdk/google'

// Wrap your agent
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
  userModel: google('models/gemini-2.5-flash-lite'),
}, agent)

// Run the trajectory
const result = await runTrajectory(trajectory)

// Convert to Tally Conversation format
const conversation = toConversation(result, 'weather-trajectory')
console.log(`Completed ${result.steps.length} turns`)
```

### Evaluation with Tally

Evaluate your agents using datasets and conversations with multiple metrics:

```typescript
import { 
  createTally, 
  createEvaluator, 
  createMeanAggregator,
  createPercentileAggregator,
  createPassRateAggregator,
  createWeightedAverageScorer, 
  defineInput, 
  defineBaseMetric,
  createAnswerRelevanceMetric,
  createCompletenessMetric,
  createToxicityMetric,
  createRoleAdherenceMetric,
  runAllTargets
} from 'tally'
import { google } from '@ai-sdk/google'

// Prepare your data (from trajectory or dataset)
const conversations = [
  {
    id: 'weather-1',
    steps: [
      {
        stepIndex: 0,
        input: { role: 'user', content: 'What is the weather in San Francisco?' },
        output: { role: 'assistant', content: 'The weather in San Francisco is sunny, 72°F.' },
        timestamp: new Date(),
      },
      {
        stepIndex: 1,
        input: { role: 'user', content: 'What about New York?' },
        output: { role: 'assistant', content: 'New York is currently cloudy with a temperature of 65°F.' },
        timestamp: new Date(),
      },
    ],
  },
]

const model = google('models/gemini-2.5-flash-lite')

// Create single-turn metrics
const relevanceMetric = createAnswerRelevanceMetric({
  model,
  prompt: {
    instruction: 'Rate how relevant the completion is to the prompt (0-1)',
  },
})

const completenessMetric = createCompletenessMetric({
  model,
  prompt: {
    instruction: 'Rate how complete and thorough the answer is (0-1)',
  },
})

const toxicityMetric = createToxicityMetric({
  model,
  prompt: {
    instruction: 'Rate the toxicity level of the response (0 = safe, 1 = toxic)',
  },
})

// Create multi-turn metric
const roleAdherenceMetric = createRoleAdherenceMetric({
  model,
  prompt: {
    instruction: 'Rate how well the assistant adheres to its role across the conversation (0-1)',
  },
})

// Create scorer combining multiple metrics with weights
const overallQualityMetric = defineBaseMetric({ name: 'overallQuality', valueType: 'number' })
const qualityScorer = createWeightedAverageScorer({
  name: 'OverallQualityScorer',
  output: overallQualityMetric,
  inputs: [
    defineInput({ metric: relevanceMetric, weight: 0.3 }),
    defineInput({ metric: completenessMetric, weight: 0.3 }),
    defineInput({ metric: roleAdherenceMetric, weight: 0.3 }),
    defineInput({ metric: toxicityMetric, weight: 0.1 }), // Lower is better, so inverted in scorer
  ],
})

// Create evaluator with multiple metrics
const evaluator = createEvaluator({
  name: 'Agent Quality Evaluation',
  metrics: [relevanceMetric, completenessMetric, toxicityMetric, roleAdherenceMetric],
  scorer: qualityScorer,
  context: runAllTargets(), // Evaluate all conversation steps
})

// Create multiple aggregators
const aggregators = [
  createMeanAggregator({ 
    metric: overallQualityMetric,
    options: { description: 'Average overall quality score' }
  }),
  createPercentileAggregator(overallQualityMetric, { 
    percentile: 75,
    options: { description: '75th percentile quality score' }
  }),
  createPassRateAggregator({
    metric: overallQualityMetric,
    threshold: 0.7,
    options: { description: 'Pass rate (quality >= 0.7)' }
  }),
]

// Create Tally instance and run evaluation
const tally = createTally({
  data: conversations,
  evaluators: [evaluator],
  aggregators,
})

const report = await tally.run()

// Access results
console.log('Average quality:', report.aggregateSummaries[0]?.value)
console.log('75th percentile:', report.aggregateSummaries[1]?.value)
console.log('Pass rate:', report.aggregateSummaries[2]?.value)

// Per-target results
report.perTargetResults.forEach((result) => {
  console.log(`Conversation ${result.targetId}:`, result.scores)
})
```

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

