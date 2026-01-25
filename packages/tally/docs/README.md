# Tally Contributor Documentation

Internal documentation for library contributors working on the Tally evaluation framework.

## Documentation Index

### Architecture
- [Overview](./architecture/README.md) - High-level system design
- [Pipeline](./architecture/pipeline.md) - 6-phase evaluation pipeline internals
- [Data Model](./architecture/data-model.md) - Core types and their relationships
- [Type System](./architecture/type-system.md) - TypeScript patterns and design decisions
- [Aggregators](./architecture/aggregators.md) - Aggregator types and execution

### Implementation Guides
- [Contributing](./contributing.md) - Code conventions, testing, PR process
- [Implementing Metrics](./implementing-metrics.md) - How to add new built-in metrics
- [Normalization Internals](./normalization-internals.md) - How normalization and calibration work

## Codebase Overview

```
packages/tally/src/
├── core/                    # Core evaluation engine
│   ├── pipeline.ts          # 6-phase pipeline orchestration
│   ├── tally.ts             # TallyContainer - main entry point
│   ├── types.ts             # Core type re-exports from @tally-evals/core
│   ├── evals/               # Eval API internals
│   │   ├── builder.ts       # Converts Evals → InternalEvaluators
│   │   ├── normalization.ts # Auto-normalization logic
│   │   └── verdict.ts       # Verdict computation
│   ├── primitives/          # Low-level building blocks
│   │   ├── metric.ts        # Metric definition factories
│   │   ├── scorer.ts        # Scorer definition factories
│   │   └── eval.ts          # Eval definition factories
│   ├── normalization/       # Normalization engine
│   │   ├── apply.ts         # Normalizer dispatch
│   │   ├── context.ts       # Calibration resolution
│   │   └── normalizers/     # Individual normalizer implementations
│   └── execution/           # Metric execution
│       ├── runSingleTurn.ts # Single-turn metric execution
│       ├── runMultiTurn.ts  # Multi-turn metric execution
│       └── llm/             # LLM integration
├── evals/                   # Public Eval API
├── metrics/                 # Built-in metrics
│   ├── singleTurn/          # Per-step metrics (answerRelevance, etc.)
│   └── multiTurn/           # Conversation-level metrics
├── aggregators/             # Statistical aggregators
├── normalizers/             # Normalizer factories
├── verdicts/                # Verdict policy helpers
├── views/                   # Report view API (TargetRunView)
└── utils/                   # Shared utilities
```

## Key Concepts

| Concept | Description | Location |
|---------|-------------|----------|
| **Metric** | Measures a single aspect (LLM or code-based) | `core/primitives/metric.ts` |
| **Scorer** | Combines multiple metric scores | `core/primitives/scorer.ts` |
| **Eval** | Metric/Scorer + VerdictPolicy | `evals/index.ts` |
| **Normalization** | Raw value → Score (0-1) | `core/normalization/` |
| **Calibration** | Context data for normalization | `core/normalization/context.ts` |
| **Pipeline** | 6-phase execution engine | `core/pipeline.ts` |
| **TallyContainer** | User-facing API | `core/tally.ts` |

## Quick Links

- [Main package entry](../src/index.ts)
- [Core types (re-exports)](../src/core/types.ts)
- [Pipeline implementation](../src/core/pipeline.ts)
- [Tally container](../src/core/tally.ts)
