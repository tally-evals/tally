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

// 2) Define a trajectory
const trajectory = createTrajectory({
  goal: 'Get weather information for multiple locations',
  persona: {
    name: 'Weather Inquirer',
    description: 'Ask concise weather questions and follow up if unclear.',
    guardrails: ['Be concise', 'Provide city names clearly'],
  },
  steps: [
    { instruction: 'Ask for current weather in San Francisco' },
    { instruction: 'Ask for weather in New York in celsius' },
  ],
  mode: 'loose',                        // 'strict' or 'loose'
  maxTurns: 10,
  userModel: google('models/gemini-2.5-flash-lite'),
}, agent)

// 3) Run it
const result = await runTrajectory(trajectory)

// 4) Record outputs
const conversation = toConversation(result, 'weather-trajectory')  // Tally format
const jsonlLines = toJSONL(result)                                 // one step per line
```

## Modes (pick one)
- **strict**: Follow steps exactly (great for onboarding flows, forms, checklists)
- **loose**: Steps are guidance (great for natural, exploratory chats)

```ts
mode: 'strict' // or 'loose'
```

## Memory and user model
- Built-in memory is on by default (`strategy: 'local'`)
- You can disable or limit it
- Provide an AI SDK `LanguageModel` as `userModel` to simulate the user

```ts
memory: { strategy: 'local', conversationId: 'my-run' }
// or
memory: { strategy: 'none' } // stateless generation
```

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
  steps: [
    { instruction: 'Ask for flights without origin or date' },
    { instruction: 'Change destination mid-way' },
  ],
  mode: 'loose',
  userModel: google('models/gemini-2.5-flash-lite'),
}, agent)

const adversarialResult = await runTrajectory(adversarial)
const adversarialJsonl = toJSONL(adversarialResult)
```

Export the results the same way (JSONL or Tally `Conversation`) and feed them to your evaluation pipeline.

## Minimal API

```ts
// Wrap agents
withAISdkAgent(agentOrModel, options?)   // AI SDK agent or LanguageModel
withMastraAgent(agent)

// Build & run
createTrajectory(def, agent)             // -> Trajectory
runTrajectory(trajectory)                // -> TrajectoryResult

// Record
toConversation(result, conversationId?)  // -> Tally Conversation
toJSONL(result)                          // -> string[] (one line per step)
```

Types (essentials):
```ts
type TrajectoryMode = 'strict' | 'loose'
interface Trajectory {
  goal: string
  persona: { name?: string; description: string; guardrails?: readonly string[] }
  steps?: readonly { instruction: string; expectedOutcome?: string }[]
  mode: TrajectoryMode
  maxTurns?: number
  memory?: { strategy: 'local' | 'none'; ttlMs?: number; capacity?: number; conversationId?: string }
  userModel?: LanguageModel
  metadata?: Record<string, unknown>
}
```

## Examples
- `packages/tally/debug/scripts/runWeather.ts`
- `packages/tally/debug/scripts/runTravelPlanner.ts`
- `packages/tally/debug/scripts/runDemandLetter.ts`

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


