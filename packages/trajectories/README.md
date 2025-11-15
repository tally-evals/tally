# @tally-evals/trajectories

Framework-agnostic trajectory generation for multi-turn conversations. Simulate users, run agents, and record conversations for evaluation.

## Why use this?
- Build realistic, multi-turn conversations quickly
- Use existing agents (AI SDK, Mastra) via small wrappers
- Generate both “good” and intentionally “bad” trajectories to test robustness
- Export JSONL or Tally `Conversation` for downstream evaluation

## Install

```bash
pnpm add @tally-evals/trajectories
# or npm/yarn
```

## Getting started

```ts
import { createTrajectory, runTrajectory, withAISdkAgent, toConversation, toJSONL } from '@tally-evals/trajectories'
import { weatherAgent } from '@tally-evals/examples-ai-sdk'
import { google } from '@ai-sdk/google'

// 1) Wrap your agent
const agent = withAISdkAgent(weatherAgent) // also supports LanguageModel directly

// 2) Define a trajectory with step graph
const trajectory = createTrajectory({
  goal: 'Get weather information for multiple locations',
  persona: {
    name: 'Weather Inquirer',
    description: 'Ask concise weather questions and follow up if unclear.',
    guardrails: ['Be concise', 'Provide city names clearly'],
  },
  steps: {
    steps: [
      { id: 'step-1', instruction: 'Ask for current weather in San Francisco' },
      { id: 'step-2', instruction: 'Ask for weather in New York in celsius' },
    ],
    start: 'step-1',
    terminals: ['step-2'],
  },
  maxTurns: 10,
  userModel: google('models/gemini-2.5-flash-lite'),
}, agent)

// 3) Run it
const result = await runTrajectory(trajectory, {
  generateLogs: true,  // Optional: pretty console logging
})

// 4) Record outputs
const conversation = toConversation(result, 'weather-trajectory')  // Tally format
const jsonlLines = toJSONL(result)                                 // one step per line
```

## Step Selection

The system uses a unified step selection approach that combines deterministic and LLM-based selection:

1. **Precondition-First Selection**: Steps with satisfied preconditions are prioritized and selected in graph order (deterministic, no LLM required)
2. **LLM Fallback**: If no next step with preconditions is found, the system falls back to LLM-based ranking of all eligible steps
3. **Graceful Continuation**: If no high-confidence step match is found (scores ≤ 0.5 are filtered), the conversation continues naturally without forcing a step

This approach works well for both structured flows (onboarding, forms, checklists) and natural, exploratory conversations.

## Step Graph Architecture

Trajectories use a **step graph** to define conversation flow:

```ts
steps: {
  steps: [
    {
      id: 'step-1',
      instruction: 'Ask for weather in San Francisco',
      hints: ['Include city and state', 'Be specific about location'],
      preconditions: [], // No prerequisites
    },
    {
      id: 'step-2',
      instruction: 'Ask for weather in New York in celsius',
      preconditions: [
        { type: 'stepSatisfied', stepId: 'step-1' }, // Wait for step-1 to complete
      ],
    },
  ],
  start: 'step-1',        // Starting step ID
  terminals: ['step-2'],  // Terminal/end step IDs
}
```

### Step Definition

Each step can include:
- `id`: Unique identifier (required)
- `instruction`: What the user should do (required)
- `hints`: Optional hints for the user model
- `preconditions`: Steps that must be satisfied first (supports async evaluation)
- `maxAttempts`: Maximum retry attempts for this step
- `timeoutMs`: Timeout for step completion
- `isSatisfied`: Custom function to determine if step is complete

### Preconditions

Preconditions control step eligibility:

```ts
// Declarative: Wait for another step to be satisfied
preconditions: [
  { type: 'stepSatisfied', stepId: 'step-1' }
]

// Custom: Use your own logic (supports async)
preconditions: [
  {
    type: 'custom',
    name: 'userProvidedLocation',
    evaluate: async (ctx) => {
      const lastMessage = ctx.history[ctx.history.length - 1];
      return lastMessage?.role === 'user' && 
             lastMessage.content.includes('location');
    }
  }
]
```

### LLM-Based Step Ranking

When no deterministic next step is available, the system uses LLM-based ranking:

- Ranks all eligible steps based on conversation context (including tool messages)
- Filters out candidates with scores ≤ 0.5 (low confidence threshold)
- If no high-confidence match is found, gracefully continues without a step
- Uses step traces (not raw history) for richer context

## Storage and user model
- Built-in storage is on by default (`strategy: 'local'`)
- You can disable or limit it
- Provide an AI SDK `LanguageModel` as `userModel` to simulate the user

```ts
storage: { strategy: 'local', conversationId: 'my-run' }
// or
storage: { strategy: 'none' } // stateless generation
```

## Loop Detection

Trajectories include built-in loop detection to prevent repetitive conversations:

```ts
loopDetection: {
  maxConsecutiveSameStep: 3,  // Stop after N consecutive same step selections (default: 3)
}
```

The system detects:
- **Consecutive same step**: Same step selected N times in a row (configurable, default: 3)
- Stops the trajectory with reason `'agent-loop'` when threshold is exceeded

## Generate “bad” trajectories (robustness testing)
Use adversarial personas or conflicting steps to stress-test your agent.

```ts
import { google } from '@ai-sdk/google'

// Adversarial persona: ambiguous and contradictory behavior
const adversarial = createTrajectory({
  goal: 'Confuse the agent about travel plans',
  persona: {
    description: 'Be ambiguous, change details mid-conversation, and provide partial info.',
    guardrails: ['Avoid giving all details at once', 'Introduce contradictions occasionally'],
  },
  steps: {
    steps: [
      { id: 'step-1', instruction: 'Ask for flights without origin or date' },
      { id: 'step-2', instruction: 'Change destination mid-way' },
    ],
    start: 'step-1',
    terminals: ['step-2'],
  },
  userModel: google('models/gemini-2.5-flash-lite'),
}, agent)

const adversarialResult = await runTrajectory(adversarial)
const adversarialJsonl = toJSONL(adversarialResult)
```

Export the results the same way (JSONL or Tally `Conversation`) and feed them to your evaluation pipeline.

## Minimal API

```ts
// Wrap agents
withAISdkAgent(agent)                    // AI SDK Agent instance
withAISdkAgent(config)                   // generateText config (without messages/prompt)
withMastraAgent(agent)

// Build & run
createTrajectory(def, agent)             // -> Trajectory
runTrajectory(trajectory, options?)      // -> TrajectoryResult

// Prompt utilities
buildPromptFromHistory(options)          // Build Prompt from history
historyToMessages(history)               // Convert history to messages array

// Record
toConversation(result, conversationId?)  // -> Tally Conversation
toJSONL(result)                          // -> string[] (one line per step)
```

Types (essentials):
```ts
interface StepDefinition {
  id: string
  instruction: string
  hints?: readonly string[]
  preconditions?: readonly Precondition[]
  maxAttempts?: number
  timeoutMs?: number
  isSatisfied?: (ctx: SatisfactionContext) => boolean | Promise<boolean>
}

interface StepGraph {
  steps: readonly StepDefinition[]
  start: string
  terminals?: readonly string[]
}

type Precondition =
  | { type: 'stepSatisfied'; stepId: string }
  | {
      type: 'custom'
      name?: string
      evaluate: (ctx: PreconditionContext) => boolean | Promise<boolean>
    }

interface Trajectory {
  goal: string
  persona: { name?: string; description: string; guardrails?: readonly string[] }
  steps?: StepGraph
  maxTurns?: number
  storage?: { strategy: 'local' | 'none'; ttlMs?: number; capacity?: number; conversationId?: string }
  userModel?: LanguageModel
  metadata?: Record<string, unknown>
  loopDetection?: {
    maxConsecutiveSameStep?: number
  }
}
```

## Examples

See the example agents in the monorepo:
- `apps/examples/ai-sdk/` - AI SDK agent examples (weather, travel planner, demand letter)
- `apps/examples/mastra/` - Mastra agent examples
- `test/e2e/weather.e2e.test.ts` - E2E test examples showing trajectory usage

These show end-to-end runs and saving JSONL/Tally outputs.

## Development
This package lives in the Tally monorepo: https://github.com/tally-evals/tally

```bash
pnpm install
pnpm build
pnpm test
```

## License
MIT


