# Contributing to Tally

Guide for contributors working on the Tally evaluation framework.

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm 8+

### Getting Started

```bash
# Clone the repository
git clone https://github.com/your-org/tally.git
cd tally

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

### Package Structure

```
packages/
├── tally/           # Core evaluation framework (this package)
├── typescript-config/   # Shared TypeScript configurations
└── biome-config/        # Shared Biome linting/formatting
```

## Code Conventions

### TypeScript

- **Strict mode:** All files use `strict: true`
- **exactOptionalPropertyTypes:** Enabled - use `| undefined` for nullable properties
- **No any:** Avoid `any`, use `unknown` with type guards
- **Const assertions:** Use `as const` for literal type preservation

### File Organization

```
src/
├── core/            # Core engine (pipeline, tally, primitives)
├── evals/           # Eval API (user-facing)
├── metrics/         # Built-in metrics
├── aggregators/     # Aggregator implementations
├── normalizers/     # Normalizer factories
├── verdicts/        # Verdict policy helpers
├── views/           # Report view API
└── utils/           # Shared utilities
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Factory functions | `define*`, `create*` | `defineSingleTurnEval`, `createMeanAggregator` |
| Type definitions | PascalCase | `MetricDef`, `VerdictPolicy` |
| Discriminators | `kind` or `type` | `{ kind: 'singleTurn' }` |
| Internal types | `Internal*` or `Pipeline*` | `InternalEvaluator`, `PipelineResult` |

### API Patterns

```typescript
// ✅ Factory function with options object
export function defineSingleTurnEval<const TName extends string>(
  options: SingleTurnEvalOptions<TName>
): SingleTurnEval<TName> { ... }

// ❌ Avoid: positional parameters
export function defineSingleTurnEval(name, metric, verdict) { ... }
```

### Error Handling

```typescript
// ✅ Descriptive error messages
throw new Error(`Metric "${metricName}" not found in evaluator "${evalName}"`);

// ❌ Avoid: generic errors
throw new Error('Invalid metric');
```

## Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run specific test file
pnpm test src/core/pipeline.test.ts
```

### Test Structure

```typescript
import { describe, it, expect } from 'vitest';

describe('phaseMeasure', () => {
  it('should execute metrics on all targets', async () => {
    // Arrange
    const data = [createTestConversation()];
    const evaluators = [createTestEvaluator()];

    // Act
    const result = await phaseMeasure(data, evaluators);

    // Assert
    expect(result.size).toBe(1);
    expect(result.get('target-0')).toHaveLength(1);
  });
});
```

### Test Helpers

Located in `src/__tests__/helpers/`:

```typescript
import { 
  createTestConversation,
  createTestMetric,
  createTestEvaluator,
} from './__tests__/helpers';
```

## Making Changes

### Adding New Features

1. **Understand the architecture:** Read [Architecture Overview](./architecture/README.md)
2. **Check existing patterns:** Look at similar implementations
3. **Write tests first:** TDD encouraged
4. **Update types:** Ensure type safety
5. **Add documentation:** Update relevant docs

### Modifying Core Types

When changing types in `@tally-evals/core`:

1. Update type definitions in `@tally-evals/core`
2. Update re-exports in `src/core/types.ts`
3. Update affected implementations
4. Run full test suite

### Adding Built-in Metrics

See [Implementing Metrics](./implementing-metrics.md) for detailed guide.

## Pull Request Process

### Before Submitting

1. **Run linting:** `pnpm lint`
2. **Run tests:** `pnpm test`
3. **Build:** `pnpm build`
4. **Update docs:** If changing public API

### PR Requirements

- [ ] Tests pass
- [ ] No linting errors
- [ ] Documentation updated (if applicable)
- [ ] Changelog entry (for user-facing changes)

### Commit Messages

Follow conventional commits:

```
feat: add threshold verdict policy
fix: handle empty metric arrays in pipeline
docs: update normalization internals
refactor: simplify scorer execution
test: add pipeline edge case tests
```

## Code Review

### What Reviewers Look For

1. **Type safety:** No `any`, proper generics
2. **Error handling:** Descriptive messages, graceful failures
3. **Performance:** No unnecessary allocations, O(n) complexity
4. **Testing:** Edge cases covered
5. **Documentation:** Public APIs documented

### Common Feedback

- "Add type narrowing for this union"
- "Use `readonly` for immutable arrays"
- "Extract this into a helper function"
- "Add test for edge case: empty array"

## Architecture Decisions

Major architectural decisions are documented in:

- [Pipeline](./architecture/pipeline.md) - Why 6 phases
- [Type System](./architecture/type-system.md) - TypeScript patterns
- [Data Model](./architecture/data-model.md) - Type relationships

When proposing architectural changes, create an issue first for discussion.

## Getting Help

- Read existing documentation in `docs/`
- Look at similar code in the codebase
- Ask in PR comments for clarification
- Create an issue for complex questions
