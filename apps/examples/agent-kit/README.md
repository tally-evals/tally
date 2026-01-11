# Agent Kit LLM Evaluation Examples

This directory contains examples demonstrating how to use the Tally evaluation framework with Agent Kit from Ingest for evaluating agent performance.

## Examples

- **Agent Task Completion** - Evaluating how well agents complete assigned tasks
- **Tool Usage Effectiveness** - Testing agent tool selection and usage
- **Multi-Agent Collaboration** - Assessing agent-to-agent interactions
- **Performance Benchmarking** - Measuring agent response times and accuracy

## Running Examples

```bash
# Install dependencies
bun install

# Run examples
bun run dev

# Run tests
bun run test

# Lint code
bun run lint
```

## Integration with Agent Kit

These examples will show how to:

1. Set up Agent Kit agents and workflows
2. Create evaluation datasets from agent interactions
3. Define custom evaluators for agent-specific metrics
4. Generate comprehensive evaluation reports

## Development

This is part of the Tally monorepo. To work on these examples:

```bash
# From the monorepo root
bun install
bun run --filter=@tally/examples-agent-kit dev
```
