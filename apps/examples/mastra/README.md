# @tally/examples-mastra

Example agents built with [Mastra](https://mastra.ai/) for use with the Tally evaluation framework.

This package **declares and exports** native Mastra agents with pre-configured instructions and settings for use in other packages.

## Agents

### Travel Planner Agent

A multi-turn conversation agent that helps users plan trips by searching for flights, accommodations, and weather forecasts.

**Features:**
- Pre-configured instructions for travel planning
- Tool usage: `searchFlights`, `searchAccommodations`, `getWeatherForecast`
- Context-aware responses
- Uses Google Gemini model

**Example Usage:**
```ts
import { travelPlannerAgent } from '@tally/examples-mastra';

// Use the pre-configured agent directly
const result = await travelPlannerAgent.generate({
  messages: [{ role: 'user', content: 'I want to plan a trip to San Francisco' }],
});
```

### Demand Letter Agent

An agent that helps users create legal demand letters through an onboarding flow.

**Features:**
- Pre-configured instructions for legal document creation
- Form field collection and validation
- Template field management
- Preview generation
- Uses Google Gemini model

**Example Usage:**
```ts
import { demandLetterAgent } from '@tally/examples-mastra';

// Use the pre-configured agent directly
const result = await demandLetterAgent.generate({
  messages: [{ role: 'user', content: 'I need to create a demand letter' }],
});
```

## Installation

```bash
bun install
```

## Usage

### Environment Setup

Set your Google AI API key:

```bash
export GOOGLE_GENERATIVE_AI_API_KEY=your-api-key-here
```

Or create a `.env.local` file in the root of the monorepo.

### Building

```bash
# Build TypeScript
bun run build

# Lint
bun run lint
```

## Exports

### Agent Instances

- `travelPlannerAgent` - Pre-configured travel planner agent instance
- `demandLetterAgent` - Pre-configured demand letter agent instance

### Tools

- `travelPlannerTools` - Flight, accommodation, and weather search tools
- `demandLetterTools` - Template fields, validation, and preview tools

### Types

- `Flight`, `Accommodation` - Types from travel planner tools
- `TemplateField`, `DemandLetterData` - Types from demand letter tools

## Integration with Tally

These agents are native Mastra `Agent` instances with pre-configured instructions and can be used directly with Tally:

```ts
import { travelPlannerAgent } from '@tally/examples-mastra';
import { tally } from 'tally';

// Use agent directly in Tally evaluation
const evaluation = tally({
  // ... your evaluation config
  // Use travelPlannerAgent.generate() directly in your dataset or conversation setup
});
```

## Project Structure

Following Mastra's recommended project structure:

```
src/
├── agents/
│   ├── travelPlanner.ts
│   └── demandLetter.ts
├── tools/
│   ├── travelPlanner.ts
│   └── demandLetter.ts
└── index.ts
```

## License

MIT
