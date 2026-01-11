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
import { TallyStore } from '@tally-evals/core'

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
const store = await TallyStore.open({ cwd: process.cwd() })
const result = await runTrajectory(trajectory, {
  generateLogs: true,  // Optional: pretty console logging
  store,               // Optional: persist artifacts via core store
  trajectoryId: 'weather-trajectory',
})

// 4) Record outputs
// If 'store' was provided, artifacts are already saved under:
// .tally/conversations/weather-trajectory/
//   ├── meta.json             # Basic metadata
//   ├── conversation.jsonl    # Canonical history
//   ├── trajectory.meta.json  # Trajectory definition
//   └── stepTraces.json       # Rich StepTrace[] data

const conversation = toConversation(result, 'weather-trajectory')  // Tally format
const jsonlLines = toJSONL(result)                                 // one step per line
```

## Step Selection & Tracing

Each turn in a trajectory produces a `StepTrace`, which is the single source of truth for the execution history. Traces now include rich metadata:

- **Selection Method**: Tracks if a step was picked via `start`, `preconditions-ordered`, `llm-ranked`, or if `none` matched.
- **Candidates**: For LLM ranking, it stores the scores and reasons for all evaluated steps.
- **End Marker**: The final step trace carries the `end` property with the stop reason and completion status.

The system uses a unified step selection approach:

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
      const lastTrace = ctx.stepTraces[ctx.stepTraces.length - 1]
      const lastUser = lastTrace?.userMessage
      return lastUser?.role === 'user' &&
        typeof lastUser.content === 'string' &&
        lastUser.content.includes('location')
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

## Persistence and user model
- Agent invocation uses an internal in-memory buffer (AgentMemory) by default.
- Durable persistence (StepTrace[] + TrajectoryMeta) is handled by passing a core `TallyStore` into `runTrajectory`.
- Provide an AI SDK `LanguageModel` as `userModel` to simulate the user

```ts
conversationId: 'my-run'
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
buildPromptFromMessages(options)         // Build Prompt from messages (AgentMemory snapshot)
messagesToMessages(messages)             // Clone messages array

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
  conversationId?: string
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


