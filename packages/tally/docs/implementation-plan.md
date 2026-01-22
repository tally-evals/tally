# Tally Implementation Plan

## Overview

This document maps the technical architecture to a concrete implementation plan. The core principle: **implement base/generic functionality in `core/` and dedicated folders, while `metrics/`, `scorers/`, `aggregators/`, and `data/` contain out-of-the-box (OOB) definitions that follow the same patterns.**

**Key Architectural Decisions:**
- **Base types live in `core/types.ts`** - All foundational types are centralized
- **Builders live in `core/builders/`** - Composition utilities are core infrastructure
- **Dedicated folders contain only OOB implementations** - `metrics/`, `scorers/`, `aggregators/` are for prebuilt definitions
- **Public API stability** - `src/index.ts` re-exports from `core/` to maintain stable external imports
- **Dependency order matters** - Metrics must be built before scorers; execution/pipeline come last

---

## Implementation Strategy

### Phase 1: Core Type System & Infrastructure
**Goal:** Establish the foundation that everything else builds upon.

### Phase 2: Normalization System
**Goal:** Build the normalization infrastructure and factories.

### Phase 3: Metric Infrastructure (Core + Minimal OOB)
**Goal:** Implement MetricDefBuilder and prove it with simple code-based metrics.

### Phase 4: Scorer Infrastructure (Core + Minimal OOB)
**Goal:** Implement ScorerBuilder and prove it with weighted average scorer.

### Phase 5: Evaluator & Context (Core)
**Goal:** Implement evaluation context and target selection logic.

### Phase 6: Aggregators (OOB)
**Goal:** Ship prebuilt aggregators (mean, percentile, passRate).

### Phase 7: Execution Runtime (Core - LAST-1)
**Goal:** Implement metric execution engine with LLM integration.

### Phase 8: Pipeline + Container + Reporting + Data + Public API (LAST)
**Goal:** Wire everything together in the Tally container with full reporting.

---

## Detailed File Structure & Implementation Order

```
packages/tally/src/
├── index.ts                          # [Phase 8] Public API exports (re-exports from core/)
│
├── core/                             # Core infrastructure (base types, builders, runtime)
│   ├── types.ts                      # [Phase 1] All base type definitions
│   │
│   ├── normalization/                # [Phase 2] Normalization infrastructure
│   │   ├── normalizers/              # Base normalizer implementations
│   │   │   ├── identity.ts           # Identity normalizer
│   │   │   ├── minMax.ts             # Min-max normalization
│   │   │   ├── zScore.ts             # Z-score normalization
│   │   │   ├── threshold.ts          # Threshold-based normalization
│   │   │   ├── linear.ts             # Linear transformation
│   │   │   ├── ordinalMap.ts         # Ordinal mapping
│   │   │   └── custom.ts             # Custom normalizer wrapper
│   │   ├── apply.ts                  # Core normalization application logic
│   │   ├── context.ts                # Context resolution utilities
│   │   └── factory.ts                # Normalizer factory functions
│   │
│   ├── builders/                     # [Phase 3-4] Composition builders
│   │   ├── MetricDefBuilder.ts      # [Phase 3] MetricDef builder
│   │   └── ScorerBuilder.ts         # [Phase 4] Scorer builder
│   │
│   ├── evaluators/                   # [Phase 5] Evaluator system
│   │   ├── context.ts                # EvaluationContext helpers & validation
│   │   └── helpers.ts                # runAllTargets, runSpecificSteps, etc.
│   │
│   ├── aggregators/                  # [Phase 6] Base aggregation utilities
│   │   └── base.ts                   # Shared aggregation helpers
│   │
│   ├── execution/                    # [Phase 7] Metric execution runtime (LAST-1)
│   │   ├── runSingleTurn.ts          # Execute single-turn metrics
│   │   ├── runMultiTurn.ts           # Execute multi-turn metrics
│   │   ├── cache/
│   │   │   └── memoryCache.ts        # Optional result caching
│   │   └── llm/
│   │       ├── generateObject.ts     # AI SDK wrapper
│   │       ├── prompts.ts            # Shared prompt fragments
│   │       └── parse.ts              # LLM output parsing/validation
│   │
│   ├── pipeline.ts                   # [Phase 8] 5-phase pipeline state machine (LAST)
│   └── tally.ts                      # [Phase 8] Tally<T> container class (LAST) → returns TallyRunReport
│
├── metrics/                          # [Phase 3,6] OOB metric definitions only
│   ├── common/                       # Shared metric utilities
│   │   ├── similarity.ts             # Cosine/embedding similarity
│   │   └── keywords.ts               # Keyword extraction/coverage
│   ├── singleTurn/                   # Single-turn metric definitions
│   │   ├── answerRelevance.ts        # [Phase 3] Simple code-based proof
│   │   ├── answerSimilarity.ts       # [Phase 6] Answer similarity metric
│   │   ├── completeness.ts           # [Phase 6] Completeness metric
│   │   ├── faithfulness.ts           # [Phase 6] Faithfulness metric
│   │   ├── keywordCoverage.ts        # [Phase 6] Keyword coverage metric
│   │   ├── toxicity.ts               # [Phase 6] Toxicity metric
│   │   └── toolCallAccuracy.ts       # [Phase 6] Tool call accuracy metric
│   └── multiTurn/                    # Multi-turn metric definitions
│       ├── roleAdherence.ts          # [Phase 6] Role adherence metric
│       ├── goalCompletion.ts         # [Phase 6] Goal completion metric
│       ├── toolUtilization.ts        # [Phase 6] Tool utilization metric
│       └── topicAdherence.ts         # [Phase 6] Topic adherence metric
│
├── scorers/                          # [Phase 4,6] OOB scorers only
│   ├── weightedAverage.ts            # [Phase 4] Weighted average scorer (proof)
│   └── passFailThreshold.ts          # [Phase 6] Pass/fail scorer
│
├── aggregators/                      # [Phase 6] OOB aggregators only
│   ├── mean.ts                       # Mean aggregator
│   ├── percentile.ts                 # Percentile aggregator
│   └── passRate.ts                   # Pass rate aggregator
│
├── data/                             # [Phase 8] Data loading & validation (LAST)
│   ├── loaders/
│   │   └── jsonl.ts                  # JSONL loader
│   ├── validate.ts                   # Shape validation/guards
│   └── shape.ts                      # Data shape adapters
│
├── view/                             # [Phase 8] Test/DX helpers (views over run outputs)
│   └── targetRunView.ts              # createTargetRunView / report.view()
│
└── utils/                            # [Phase 1] Shared utilities
    ├── text.ts                       # String/text utilities
    ├── guards.ts                     # Type guards/assertions
    ├── ids.ts                        # ID generation helpers
    └── time.ts                       # Timing utilities
```

---

## Phase-by-Phase Implementation Details

### Phase 1: Core Type System & Infrastructure

**Files to implement:**
- `src/core/types.ts` - Complete type system from technical architecture
- `src/utils/guards.ts` - Type guards for runtime validation
- `src/utils/ids.ts` - ID generation (runId, targetId)
- `src/utils/time.ts` - Timing/stopwatch utilities
- `src/utils/text.ts` - Basic text utilities

**Key types to define in `core/types.ts`:**
```typescript
// Data types
- DatasetItem
- ConversationStep
- Conversation

// Metric system
- MetricScalar
- Score (branded type)
- ValueTypeFor<T>
- MetricScope
- SingleTargetFor<TContainer>
- BaseMetricDef<T>
- LLMMetricFields<T, V>
- CodeMetricFields<T>
- SingleTurnMetricDef<T, TContainer>
- MultiTurnMetricDef<T, TContainer>
- MetricDef<T, TContainer>
- Metric<T>

// Normalization types
- NormalizeToScore<T, C>
- NormalizationContextFor<T>
- NormalizerSpec<T, C>
- MetricNormalization<T, C>

// Scorer types
- ScorerInput
- InputScores<I>
- Scorer<I>

// Evaluator types
- SingleTurnRunPolicy
- EvaluationContext
- Evaluator<TContainer, I>

// Aggregator types
- Aggregator

// Run outputs
- TallyRunReport
- TallyRunArtifact

// Main container
- Tally<TContainer>
```

**Deliverables:**
- ✅ Complete type system with discriminated unions
- ✅ Score branded type with `toScore()` helper
- ✅ Type guards for runtime validation
- ✅ Utility functions for IDs and timing

---

### Phase 2: Normalization System

**Files to implement:**
- `src/core/normalization/normalizers/identity.ts`
- `src/core/normalization/normalizers/minMax.ts`
- `src/core/normalization/normalizers/zScore.ts`
- `src/core/normalization/normalizers/threshold.ts`
- `src/core/normalization/normalizers/linear.ts`
- `src/core/normalization/normalizers/ordinalMap.ts`
- `src/core/normalization/normalizers/custom.ts`
- `src/core/normalization/apply.ts` - Core normalization logic
- `src/core/normalization/context.ts` - Context resolution
- `src/core/normalization/factory.ts` - Factory functions

**Key responsibilities:**

**Each normalizer file:**
- Implement the specific normalization algorithm
- Return a `Score` (0-1 range)
- Handle edge cases (division by zero, out of range, etc.)
- Support `clip` option where applicable

**`apply.ts`:**
- Accept: raw value, NormalizerSpec, context, metric
- Dispatch to appropriate normalizer based on `type` field
- Handle custom normalizers
- Enforce Score range [0, 1]
- Return: `Score`

**`context.ts`:**
- Resolve static vs dynamic context
- For dynamic: call resolver with dataset and rawValues
- Compute distribution stats if needed (mean, stdDev)
- Cache resolved contexts per metric

**`factory.ts`:**
- Export factory functions that return `NormalizerSpec` objects:
  - `createMinMaxNormalizer(min, max, options?)`
  - `createZScoreNormalizer(mean, stdDev, options?)`
  - `createThresholdNormalizer(threshold, above, below)`
  - `createLinearNormalizer(slope, intercept, options?)`
  - `createOrdinalMapNormalizer(map)`

**Deliverables:**
- ✅ All 7 normalizer implementations
- ✅ Normalization application logic with type discrimination
- ✅ Context resolution (static and dynamic)
- ✅ Factory functions for easy normalizer creation

---

### Phase 3: Metric Infrastructure (Core + Minimal OOB)

**Files to implement:**
- `src/core/builders/MetricDefBuilder.ts` - MetricDef builder class
- `src/metrics/singleTurn/answerRelevance.ts` - Simple code-based proof metric

**Key responsibilities:**

**`core/builders/MetricDefBuilder.ts`:**
- Fluent API for building MetricDef objects
- Methods:
  - `static singleTurn<T, TContainer>(base): MetricDefBuilder`
  - `static multiTurn<T>(base): MetricDefBuilder`
  - `asLLM(config): this` - Note: LLM runtime not implemented yet, only type definitions
  - `asCode(config): this`
  - `runOnSelected(fn): this`
  - `runOnContainer(fn): this`
  - `withNormalization(normalizer, context?): this`
  - `withMetadata(metadata): this`
  - `build(): MetricDef`

**`metrics/singleTurn/answerRelevance.ts`:**
- Export a simple code-based single-turn metric
- Use MetricDefBuilder to construct it
- Include identity normalization
- Prove the builder works with a minimal example

**Important Notes:**
- LLM-based metric types are defined in `core/types.ts` but runtime execution comes in Phase 7
- This phase focuses on proving the builder pattern works with code-based metrics
- The answerRelevance metric should be simple (e.g., keyword matching) to validate the infrastructure

**Deliverables:**
- ✅ MetricDefBuilder compiles and builds valid MetricDef objects
- ✅ Simple code-based metric compiles and can be instantiated
- ✅ Builder pattern validated with minimal OOB example

---

### Phase 4: Scorer Infrastructure (Core + Minimal OOB)

**Files to implement:**
- `src/core/builders/ScorerBuilder.ts` - Scorer builder class
- `src/scorers/weightedAverage.ts` - Weighted average scorer (proof)

**Key responsibilities:**

**`core/builders/ScorerBuilder.ts`:**
- Fluent API for building Scorer objects
- Methods:
  - `static create(name, output): ScorerBuilder`
  - `addMetric(metric, weight, normalizer?, required?): this`
  - `withCombineScores(fn): this`
  - `withFallbackScore(score): this`
  - `withMetadata(metadata): this`
  - `build(): Scorer`

**`scorers/weightedAverage.ts`:**
- Export factory function that returns Scorer
- Use ScorerBuilder to construct it
- Default weighted average combination logic
- Weight normalization
- Prove the builder works with a minimal example

**Important Notes:**
- Scorers operate on already-normalized Scores (from Phase 2)
- This phase proves scorers can combine normalized metrics
- The weightedAverage scorer validates the composition pattern

**Deliverables:**
- ✅ ScorerBuilder compiles and builds valid Scorer objects
- ✅ Weighted average scorer compiles and can combine normalized Scores
- ✅ Builder pattern validated with minimal OOB example

---

### Phase 5: Evaluator & Context (Core)

**Files to implement:**
- `src/core/evaluators/context.ts` - EvaluationContext helpers & validation
- `src/core/evaluators/helpers.ts` - Context factory functions

**Key responsibilities:**

**`core/evaluators/context.ts`:**
- Context resolution for single-turn run policies
- Target selection logic based on policy type
- Validation of stepIndices/itemIndices
- Ensure indices are within valid ranges
- Handle edge cases (empty arrays, out-of-bounds)

**`core/evaluators/helpers.ts`:**
- `runAllTargets(): EvaluationContext` - Factory for 'all' policy
- `runSpecificSteps(stepIndices): EvaluationContext` - Factory for 'selectedSteps' policy
- `runSpecificItems(itemIndices): EvaluationContext` - Factory for 'selectedItems' policy
- Type-safe helper functions for common patterns

**Important Notes:**
- This phase focuses on the execution context logic, not the actual execution runtime
- Target selection logic must work with both DatasetItem and Conversation containers
- Validation ensures runtime safety when execution happens in Phase 7

**Deliverables:**
- ✅ Evaluation context helpers compile and return valid EvaluationContext objects
- ✅ Target selection logic validates indices correctly
- ✅ Helper functions provide type-safe context creation

---

### Phase 6: Aggregators (OOB)

**Files to implement:**
- `src/core/aggregators/base.ts` - Base aggregation utilities
- `src/aggregators/mean.ts` - Mean aggregator
- `src/aggregators/percentile.ts` - Percentile aggregator
- `src/aggregators/passRate.ts` - Pass rate aggregator

**Key responsibilities:**

**`core/aggregators/base.ts`:**
- Common aggregation utilities
- Score array validation
- Helper functions for statistical operations
- Edge case handling (empty arrays, single values)

**Each OOB aggregator:**
- Export factory function that returns Aggregator
- Implement aggregate function: `(values: readonly Score[]) => Score`
- Handle edge cases (empty arrays return safe default or throw)
- Validate input Scores are in [0, 1] range

**Important Notes:**
- Aggregators operate on derived metric Scores produced by scorers
- They summarize across all data points (per-target results)
- Each aggregator must handle empty input gracefully

**Deliverables:**
- ✅ Base aggregation utilities compile
- ✅ All 3 OOB aggregators implemented and handle edge cases
- ✅ Aggregators validate Score inputs correctly

---

### Phase 7: Execution Runtime (Core - LAST-1)

**Files to implement:**
- `src/core/execution/runSingleTurn.ts` - Single-turn metric execution
- `src/core/execution/runMultiTurn.ts` - Multi-turn metric execution
- `src/core/execution/cache/memoryCache.ts` - Optional caching layer
- `src/core/execution/llm/generateObject.ts` - AI SDK wrapper
- `src/core/execution/llm/prompts.ts` - Shared prompt utilities
- `src/core/execution/llm/parse.ts` - LLM output parsing

**Key responsibilities:**

**`core/execution/runSingleTurn.ts`:**
- Accept: `MetricDef<T, TContainer>` (scope: 'single'), targets, context
- Execute `runOnSelected()` for each target
- Handle both LLM-based and code-based metrics
- Return: `Metric<T>[]` with execution metadata

**`core/execution/runMultiTurn.ts`:**
- Accept: `MetricDef<T, Conversation>` (scope: 'multi'), conversation
- Execute `runOnContainer()` once per conversation
- Handle both LLM-based and code-based metrics
- Return: `Metric<T>` with execution metadata

**`core/execution/llm/generateObject.ts`:**
- Wrap AI SDK's `generateObject` with safe defaults
- Handle provider resolution (direct or factory)
- Template variable substitution (`{{variable}}`)
- Structured output validation using zod
- Error handling and retries

**`core/execution/llm/prompts.ts`:**
- Shared prompt fragments for common patterns
- Rubric templates
- Safety/toxicity prompts
- Few-shot example formatters

**`core/execution/cache/memoryCache.ts`:**
- Simple in-memory cache keyed by metric name + input hash
- Optional TTL support
- Cache hit/miss tracking

**Important Notes:**
- This is where `ai` and `zod` dependencies are actually used
- LLM metrics can now be executed (types were defined in Phase 1, runtime here)
- Execution coordinates with normalization from Phase 2

**Deliverables:**
- ✅ Single-turn metric runner executes code-based and LLM-based metrics
- ✅ Multi-turn metric runner executes code-based and LLM-based metrics
- ✅ LLM execution with AI SDK integration works correctly
- ✅ Prompt template system with variable substitution
- ✅ Optional caching layer functional

---

### Phase 8: Pipeline + Container + Reporting + Data + Public API (LAST)

**Files to implement:**
- `src/core/pipeline.ts` - 5-phase pipeline state machine
- `src/core/tally.ts` - Tally<T> container class
- `src/view/targetRunView.ts` - Test/DX view over run outputs (`report.view()`)
- `src/utils/reportFormatter.ts` - CLI-friendly table formatting for artifacts
- `src/data/loaders/jsonl.ts` - JSONL loader
- `src/data/validate.ts` - Shape validation/guards
- `src/data/shape.ts` - Data shape adapters
- `src/index.ts` - Final public API (re-exports from core/)

**Key responsibilities:**

**`core/pipeline.ts`:**
Implement the 5-phase pipeline:
1. **Measure:** Execute all metrics (single-turn + multi-turn) for all evaluators
2. **Resolve Context:** For each unique MetricDef, resolve normalization context
3. **Normalize:** Transform raw metric values to Scores using normalizers
4. **Score:** Execute scorers to produce derived metrics
5. **Aggregate:** Run aggregators over derived metrics

**`core/tally.ts`:**
- Tally<T> class implementation
- Constructor: accept `{ data, evaluators }`
- `run(options?): Promise<TallyRunReport>` - orchestrate full pipeline
- Validation of inputs
- Error handling and reporting

**Reporting:**
- Construct `TallyRunArtifact` (defs + results + summaries) from pipeline results
- Return `TallyRunReport` (SDK-facing wrapper) with `view()` + `toArtifact()`
- Add metadata and timestamps

**`report/formatters/json.ts`:**
- Serialize report to JSON
- Pretty printing options
- Selective field export

**`report/formatters/csv.ts`:**
- Flatten report to CSV rows
- Per-target view
- Aggregate summary view
- Custom column selection

**`data/loaders/jsonl.ts`:**
- Load DatasetItem[] from JSONL files
- Stream processing for large files
- Validation during load
- Error handling for malformed lines

**`data/validate.ts`:**
- Runtime type guards for DatasetItem
- Runtime type guards for Conversation
- Validation error messages
- Schema checking utilities

**`data/shape.ts`:**
- Adapters from common formats to core types
- Mapping utilities for custom data shapes
- Transformation helpers

**`index.ts`:**
- Re-export all public APIs from `core/`:
  - Types (from `core/types.ts`)
  - Tally container (from `core/tally.ts`)
  - Builders (from `core/builders/`)
  - Normalizer factories (from `core/normalization/factory.ts`)
  - OOB metrics (from `metrics/`)
  - OOB scorers (from `scorers/`)
  - OOB aggregators (from `aggregators/`)
  - Data loaders (from `data/`)
  - Report formatters (from `report/`)
  - Utility functions (from `utils/`)
  - Context helpers (from `core/evaluators/helpers.ts`)

**Important Notes:**
- Public API stability: `index.ts` re-exports ensure external imports don't change
- Pipeline coordinates all previous phases
- Report generation is the final output showcase

**Deliverables:**
- ✅ Complete 5-phase pipeline executes correctly
- ✅ Tally container orchestrates full evaluation flow
- ✅ Reporting produces valid TallyRunArtifact/TallyRunReport
- ✅ JSONL loader handles large files
- ✅ Data validation works for DatasetItem and Conversation
- ✅ Public API exports all necessary components
- ✅ Examples from `examples.md` work with final API

---

### Incremental OOB Definitions (Post-Phase 8)

**Note:** After Phase 8 completes the core framework, remaining OOB metrics, scorers, and aggregators can be implemented incrementally:

**Remaining Metrics:**
- `src/metrics/common/similarity.ts` - Cosine/embedding similarity utilities
- `src/metrics/common/keywords.ts` - Keyword extraction/coverage utilities
- `src/metrics/singleTurn/answerSimilarity.ts` - Answer similarity metric
- `src/metrics/singleTurn/completeness.ts` - Completeness metric
- `src/metrics/singleTurn/faithfulness.ts` - Faithfulness metric
- `src/metrics/singleTurn/keywordCoverage.ts` - Keyword coverage metric
- `src/metrics/singleTurn/toxicity.ts` - Toxicity metric
- `src/metrics/singleTurn/toolCallAccuracy.ts` - Tool call accuracy metric
- `src/metrics/multiTurn/roleAdherence.ts` - Role adherence metric
- `src/metrics/multiTurn/goalCompletion.ts` - Goal completion metric
- `src/metrics/multiTurn/toolUtilization.ts` - Tool utilization metric
- `src/metrics/multiTurn/topicAdherence.ts` - Topic adherence metric

**Remaining Scorers:**
- `src/scorers/passFailThreshold.ts` - Pass/fail threshold scorer

**Note:** Core infrastructure (builders, normalizers, execution) is complete by Phase 8. These OOB definitions follow the same patterns established in Phases 3-6.

---

## Implementation Patterns

### Pattern 1: Base Implementation in Core

**Example: Normalization**
- Core logic: `src/core/normalization/apply.ts` (generic normalization dispatcher)
- Base implementations: `src/core/normalization/normalizers/*.ts` (7 normalizer types)
- Factory helpers: `src/core/normalization/factory.ts` (convenience functions)
- Context utilities: `src/core/normalization/context.ts` (resolution logic)

**Example: Builders**
- MetricDefBuilder: `src/core/builders/MetricDefBuilder.ts` (core composition utility)
- ScorerBuilder: `src/core/builders/ScorerBuilder.ts` (core composition utility)

### Pattern 2: OOB Definitions Follow Same Patterns

**Example: Metrics**
- Builder: `src/core/builders/MetricDefBuilder.ts` (imported from core)
- Common utilities: `src/metrics/common/*.ts` (shared helpers for OOB metrics)
- Single-turn OOB: `src/metrics/singleTurn/*.ts` (prebuilt metrics)
- Multi-turn OOB: `src/metrics/multiTurn/*.ts` (prebuilt metrics)

Each metric follows the same structure:
```typescript
// src/metrics/singleTurn/answerRelevance.ts
import { MetricDefBuilder } from '../../core/builders/MetricDefBuilder';
import type { SingleTurnMetricDef, DatasetItem } from '../../core/types';

export function createAnswerRelevanceMetric(
  options?: { /* ... */ }
): SingleTurnMetricDef<number, DatasetItem> {
  return MetricDefBuilder
    .singleTurn<number, DatasetItem>({ 
      name: 'answerRelevance',
      valueType: 'number'
    })
    .asCode({
      compute: ({ data }) => { /* ... */ }
    })
    .runOnSelected(async (item) => { /* ... */ })
    .withNormalization({ type: 'identity' })
    .build();
}
```

### Pattern 3: Value-Based Composition

All components are first-class values:
- No string-based lookups
- Direct object references
- Type-safe composition
- No global registries

---

## Testing Strategy

### Very Simple Per-Phase Tests

**Phase 1:**
- Types compile without errors
- `toScore(0.5)` is assignable to `Score` type
- Type guards validate correctly

**Phase 2:**
- `apply(identity, 0.7)` returns `Score` in [0, 1]
- `min-max` normalizer with `clip` works at bounds

**Phase 3:**
- Build code-based single-turn metric via `MetricDefBuilder`
- Call `runOnSelected` returns raw number
- Normalization respects `identity` default

**Phase 4:**
- Create scorer with two metric definitions and weights
- Call `combineScores` with two `Score`s
- Verify returned `Score` is in [0, 1]

**Phase 5:**
- `runSpecificSteps([1, 3])` selects correct steps
- Invalid indices throw validation errors

**Phase 6:**
- `mean` aggregator returns `Score` for `[0.2, 0.8]`
- Empty input handled gracefully

**Phase 7:**
- `runSingleTurn` executes code metric over items
- Cache returns hit on second run
- LLM wrapper round-trips mock model

**Phase 8:**
- End-to-end: minimal dataset + scorer + aggregator
- `Tally.run()` returns `TallyRunReport`
- JSON/CSV formatters emit valid strings

### Integration Tests (Post-Phase 8)
- End-to-end Tally runs with DatasetItem
- End-to-end Tally runs with Conversation
- Mixed single-turn + multi-turn metrics
- Custom metrics with OOB scorers
- Full pipeline with all normalizer types

---

## Success Criteria

### Phase 1
- [ ] All types compile without errors
- [ ] Type guards validate correctly
- [ ] Utility functions compile and work

### Phase 2
- [ ] All 7 normalizers return Scores in [0, 1]
- [ ] Context resolution works for static and dynamic
- [ ] Factory functions create valid NormalizerSpecs

### Phase 3
- [ ] MetricDefBuilder compiles and builds valid MetricDef objects
- [ ] Simple code-based metric compiles and instantiates
- [ ] Builder pattern validated with minimal OOB example

### Phase 4
- [ ] ScorerBuilder compiles and builds valid Scorer objects
- [ ] Weighted average scorer combines normalized Scores correctly
- [ ] Builder pattern validated with minimal OOB example

### Phase 5
- [ ] Evaluation context helpers compile and return valid EvaluationContext objects
- [ ] Target selection logic validates indices correctly
- [ ] Helper functions provide type-safe context creation

### Phase 6
- [ ] Base aggregation utilities compile
- [ ] All 3 OOB aggregators implemented and handle edge cases
- [ ] Aggregators validate Score inputs correctly

### Phase 7
- [ ] Single-turn metric runner executes code-based and LLM-based metrics
- [ ] Multi-turn metric runner executes code-based and LLM-based metrics
- [ ] LLM execution with AI SDK integration works correctly
- [ ] Prompt template system with variable substitution
- [ ] Optional caching layer functional

### Phase 8
- [ ] Pipeline executes all 5 phases in order
- [ ] Tally.run() produces valid TallyRunReport
- [ ] Error handling works at each phase
- [ ] JSONL loader handles large files
- [ ] Report formatters produce valid output
- [ ] Public API exports all necessary components
- [ ] Examples from `examples.md` work with final API

---

## Dependencies

### Required (Install Before Phase 7)
- `ai` - AI SDK for LLM integration (used in Phase 7 execution runtime)
- `zod` - Schema validation for LLM outputs (used in Phase 7 LLM parsing)

**Installation:**
```bash
bun add ai zod
```

**Note:** Types for LLM metrics are defined in Phase 1 (`core/types.ts`), but the actual runtime dependencies (`ai` and `zod`) are only needed when implementing the execution engine in Phase 7.

### DevDependencies
- `vitest` - Testing framework
- `tsup` - Build tool
- TypeScript, Biome (already configured)

---

## Timeline Estimate

- **Phase 1:** 2-3 days (foundation - types and utilities)
- **Phase 2:** 2-3 days (normalization infrastructure)
- **Phase 3:** 2 days (metric infrastructure + proof metric)
- **Phase 4:** 2 days (scorer infrastructure + proof scorer)
- **Phase 5:** 1-2 days (evaluator context helpers)
- **Phase 6:** 1-2 days (OOB aggregators)
- **Phase 7:** 3-4 days (execution runtime with LLM integration)
- **Phase 8:** 3-4 days (pipeline, container, reporting, data, public API)

**Total:** ~3-4 weeks for complete core implementation

**Note:** Remaining OOB metrics can be implemented incrementally post-Phase 8.

---

## Notes

1. **No changes to technical architecture** - This plan implements exactly what's documented in `technical-architecture.md`
2. **Core vs OOB separation** - Base functionality in `core/`, prebuilt definitions in dedicated folders (`metrics/`, `scorers/`, `aggregators/`)
3. **Base types in core** - All foundational types live in `core/types.ts`, not at root level
4. **Builders in core** - Composition utilities (`MetricDefBuilder`, `ScorerBuilder`) are core infrastructure
5. **Public API stability** - `src/index.ts` re-exports from `core/` to maintain stable external imports (examples continue to work)
6. **Dependency order matters** - Metrics infrastructure (Phase 3) before scorers (Phase 4); execution/pipeline last (Phases 7-8)
7. **Consistent patterns** - All OOB components follow the same structure established in core
8. **Value-based composition** - No registries, no string lookups
9. **Type safety first** - Leverage TypeScript for compile-time validation
10. **Incremental delivery** - Each phase is independently testable
11. **LLM types vs runtime** - LLM metric types defined in Phase 1, but `ai` dependency only needed in Phase 7
12. **Minimal OOB proofs** - Phases 3-4 include minimal OOB examples to validate infrastructure; remaining OOB definitions come incrementally

---

## Next Steps

1. Review and approve this implementation plan
2. Start with Phase 1 (types and utilities)
3. Implement phases sequentially
4. Write tests alongside implementation
5. Update documentation as needed

