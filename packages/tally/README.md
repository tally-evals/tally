# Tally

A TypeScript evaluation framework for running model evaluations with datasets, evaluators, metrics, and aggregators.

## Overview

Tally provides a structured approach to evaluating model behavior through:

- **Datasets & Conversations** - Input data for evaluation
- **Evaluators** - Judge what to check and how (Selector + Scorer)
- **Metrics** - Define what to measure (Boolean, Number, Ordinal/Enum)
- **Aggregators** - Summarize many results into meaningful insights
- **EvaluationReport** - Final output with detailed and summary results

## Installation

```bash
npm install tally
# or
pnpm add tally
# or
yarn add tally
```

## Quick Start

```typescript
import { tally } from 'tally'

// Framework implementation coming soon
console.log(tally)
```

## Development

This package is part of a monorepo. To work on it:

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Run tests
pnpm test

# Run in development mode
pnpm dev
```

## License

MIT
