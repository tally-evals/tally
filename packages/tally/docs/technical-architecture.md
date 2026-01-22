# Tally Evaluation Framework - Technical Architecture
 
## 2025 Refresh: High-Level Architecture Outline

This section provides a concise, implementation-accurate outline aligned with the current codebase. The detailed, legacy content below remains for reference and will be iteratively reconciled with this outline.

### Overview
- Tally is a value-composed LLM evaluation framework: you wire actual objects (metrics, scorers, aggregators, evaluators), not string IDs.
- Two container modes:
  - `Tally<DatasetItem[]>` for single-turn examples.
  - `Tally<Conversation[]>` for multi-turn conversations.

### Architecture Goals
- Type safety and composability (first-class values).
- Deterministic, phased execution.
- Extensibility without registries or global state.
- Clear invariants and actionable error messages.

### Core Concepts and Types
- Data
  - `DatasetItem`, `Conversation`, `ConversationStep`
- Metrics
  - `MetricDef`: single-turn or multi-turn; LLM-based or code-based.
  - `Metric`: runtime result with `value`, optional `confidence` and `reasoning`, plus timing.
  - `MetricNormalization`: default normalizer and optional context resolver.
  - `Score`: branded number constrained to [0, 1].
- Scorers
  - `Scorer`, `ScorerInput`, `InputScores` (maps metric names to Scores).
- Evaluators
  - `Evaluator` = `metrics` + `scorer` + optional `EvaluationContext` (target selection for single-turn).
- Aggregators
  - `Aggregator` consumes scorer output metrics to produce summaries.
- Reports
  - `PerTargetResult`, `AggregateSummary`, `EvaluationReport`.

### Orchestration: Tally Container
- `createTally(data, evaluators, aggregators)` returns a `TallyContainer`.
- `TallyContainer.run()` executes the full pipeline and returns `EvaluationReport`.
- Validates inputs and attaches metadata (counts, timestamp, runId).

### Execution Pipeline (5 Phases)
1) Measure
   - Single-turn: select targets via `EvaluationContext.singleTurn`, run each metric (`runSingleTurnMetrics`).
   - Multi-turn: run once per conversation (`runMultiTurnMetric`), optional `preprocessContainer`.
   - LLM metrics use AI SDK `generateObject`; code metrics use `compute`/`runOnSelected`.
   - Optional memory cache for code metrics.
2) Resolve Context
   - Collect raw values per metric across targets.
   - Resolve/caches per-metric `ScoringContext` (static or dynamic resolver over dataset + rawValues).
3) Normalize
   - Apply per-metric default normalization (identity fallback when unspecified).
   - Enforce `Score` [0, 1] invariants (`applyNormalization`).
4) Score
   - For each evaluator, gather required input Scores and compute derived metric (e.g., weighted average).
5) Aggregate
   - Group derived Scores by the scorer’s output metric.
   - Run aggregators (mean, pass rate, percentile) to produce summaries.

### LLM Integration
- LLM metric fields: `provider` (LanguageModel or factory), `prompt` (with `{{variables}}` and few-shot examples), optional rubric and post-processing transform.
- `generateObject` wrapper validates structured outputs with zod and returns `{ value, confidence?, reasoning? }`.

### Normalization
- Built-in normalizers: identity, min-max, z-score, threshold, linear, ordinal-map, custom.
- `MetricDef` owns normalization defaults. Scorers consume normalized values; overrides are not applied by the pipeline.
- `resolveContext` produces context (range, distribution, thresholds) and caches per metric.

### Evaluator Context and Target Selection
- `SingleTurnRunPolicy`: `all`, `selectedSteps` (conversations), `selectedItems` (datasets).
- Helpers: `runAllTargets`, `runSpecificSteps`, `runSpecificItems`.
- Validators and selection metadata ensure safe, explicit targeting.

### Extensibility Patterns
- Preferred: functional factories from `core/factory.ts`
  - `defineBaseMetric`, `withNormalization`, `createSingleTurnCode/LLM`, `createMultiTurnCode/LLM`.
  - `defineScorer`, `defineInput` (or OOB `createWeightedAverageScorer`).
  - Custom normalizers via `createCustomNormalizer`.
- Out-of-the-box components:
  - Scorer: weighted average.
  - Aggregators: mean, percentile, pass rate.
- Deprecation note: `MetricDefBuilder` and `ScorerBuilder` are present for compatibility, but factory APIs are the recommended path going forward.

### Data Ingestion and Validation
- JSONL loaders for dataset and conversations (streaming, `validate`, `skipInvalid`, shape adapters).
- `validate.ts` provides runtime guards and assertions.
- `shape.ts` adapts arbitrary sources with field mappings and ID generation.

### Public API Surface (index.ts)
- Re-exports: types, `createTally`, factory helpers, OOB metrics/scorers/aggregators, normalization, loaders, context helpers, execution (advanced), and utilities.
- Guidance: import from the package root; treat internal paths as implementation details.

### Error Handling and Guarantees
- Strong runtime guards for data shapes and `Score` domain.
- Clear exceptions for missing required metrics, invalid policies, unresolved contexts.
- Normalizers must return values in [0, 1]; violations are surfaced early.

### Performance and Caching
- Parallel target execution (Promise.all) for both single-turn and multi-turn runs.
- Memory cache for code metrics keyed by metric + target/prepared payload.
- Context caching per metric to avoid recomputation in a run.

### Examples (Doc Stubs to Fill)
- End-to-end “hello world”: define metric → define scorer → evaluator → aggregators → `createTally().run()`.
- LLM metric with `{{variables}}`, rubric, and transform; shows `confidence`/`reasoning` in `Metric`.
- Single-turn selection vs multi-turn execution examples.
- Custom normalizer example (function-based).

### Diagrams (Placeholders)
- Component flow: data → metrics → scorers → aggregators → report.
- Five-phase pipeline with artifacts between phases.
- Target selection decision tree.

### Glossary and FAQ
- Glossary: MetricDef, Metric, Score, Derived Metric, Aggregate Summary.
- FAQ: normalization override precedence, caching scope, when to choose conversation vs dataset.

### File Map (For Contributors)
- `src/core/types.ts`: foundational types (data, metrics, normalization, scorers, evaluators, aggregators, reports).
- `src/core/pipeline.ts`: five-phase orchestration.
- `src/core/tally.ts`: container and `run()`.
- `src/core/execution/*`: single/multi-turn runners, LLM wrapper, cache.
- `src/core/normalization/*`: normalizers, dispatcher, context, factories.
- `src/core/evaluators/*`: context helpers and selection.
- `src/aggregators/*`: mean, percentile, pass rate.
- `src/scorers/*`: weighted average scorer.
- `src/data/*`: JSONL loaders, validation, shape adapters.
- `src/index.ts`: public API surface.

---

Tally’s technical design centers on **value-based composability**: configuration objects (metrics, scorers, aggregators, evaluators) move through the system as first-class values, eliminating the need for string identifiers or registries.

## 📝 Core Type Definitions (TypeScript)

### Data Types
```ts
// Reuse AI SDK's ModelMessage for framework-agnostic conversation messages
import type { ModelMessage } from 'ai';

interface DatasetItem {
  id: string;
  prompt: string;
  completion: string;
  metadata?: Record<string, unknown>;
}

interface ConversationStep {
  stepIndex: number; // stable ordering within the conversation
  input: ModelMessage; // user (or tool) request
  output: ModelMessage; // assistant response
  id?: string; // provider message id if available
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}

interface Conversation {
  id: string;
  steps: readonly ConversationStep[];
  metadata?: Record<string, unknown>;
}
```

### Metric System (Type-Safe with Inheritance)
```ts
type MetricScalar = number | boolean | string;

// Score domain: normalized [0, 1] values
type Score = number & { readonly __brand: 'Score' };
const toScore = (n: number): Score => n as Score;

// Output value type aligned with T
type ValueTypeFor<T> =
  T extends number ? 'number' | 'ordinal'
  : T extends boolean ? 'boolean'
  : 'string';

type MetricScope = 'single' | 'multi';

type SingleTargetFor<TContainer> =
  TContainer extends Conversation ? ConversationStep :
  TContainer extends DatasetItem ? DatasetItem :
  never;

// Base Metric Definition (passed around as a value)
interface BaseMetricDef<T extends MetricScalar = MetricScalar> {
  name: string;
  description?: string;
  valueType: ValueTypeFor<T>;
  metadata?: Record<string, unknown>;
  // Normalization is owned by the metric definition
  normalization?: MetricNormalization<T, ScoringContext>;
}

// Shared fields for LLM-based metrics
type LanguageModelLike = import('ai').LanguageModel;
type ModelProvider = LanguageModelLike | (() => LanguageModelLike);

type VarsTuple = readonly string[];
type PromptTemplate<V extends VarsTuple = readonly []> = {
  instruction: string; // Template with {{variable}} substitutions
  variables?: V; // Available substitution variables
  examples?: Array<{
    input: Record<V[number], unknown>;
    expectedOutput: string;
  }>;
};

interface LLMMetricFields<T extends MetricScalar = number, V extends VarsTuple = readonly []> {
  type: 'llm-based';
  // AI SDK provider: pass a LanguageModel instance or factory used for generation
  // e.g., openai('gpt-4.1') from '@ai-sdk/openai'
  provider: ModelProvider;
  prompt: PromptTemplate<V>;
  rubric?: {
    criteria: string;
    scale?: string;
    examples?: Array<{
      score: number;
      reasoning: string;
    }>;
  };
  postProcessing?: {
    normalize?: boolean;
    transform?: (rawOutput: string) => T;
  };
}

/**
 * Implementation note:
 * LLM-based metrics internally use AI SDK's generateObject to produce structured outputs.
 * See: https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-object
 */

// Shared fields for code-based metrics
interface CodeMetricFields<T extends MetricScalar = MetricScalar> {
  type: 'code-based';
  compute: (args: { data: unknown; metadata?: Record<string, unknown> }) => T;
  dependencies?: BaseMetricDef[];
  cacheable?: boolean;
}

interface SingleTurnMetricDef<T extends MetricScalar, TContainer>
  extends BaseMetricDef<T> {
  scope: 'single';
  runOnSelected: (selected: SingleTargetFor<TContainer>) => Promise<T> | T;
}

interface MultiTurnMetricDef<T extends MetricScalar, TContainer extends Conversation>
  extends BaseMetricDef<T> {
  scope: 'multi';
  /**
   * Preferred: prepare a serializable payload for execution (LLM/code).
   */
  preprocessContainer?: (container: TContainer) => Promise<unknown> | unknown;
  /**
   * @deprecated Use preprocessContainer instead.
   */
  runOnContainer?: (container: TContainer) => Promise<unknown> | unknown;
}

type SingleTurnMetricVariants<
  T extends MetricScalar,
  TContainer,
  V extends VarsTuple = readonly []
> =
  | (SingleTurnMetricDef<T, TContainer> & LLMMetricFields<T, V>)
  | (SingleTurnMetricDef<T, TContainer> & CodeMetricFields<T>);

type MultiTurnMetricVariants<
  T extends MetricScalar,
  V extends VarsTuple = readonly []
> =
  | (MultiTurnMetricDef<T, Conversation> & LLMMetricFields<T, V>)
  | (MultiTurnMetricDef<T, Conversation> & CodeMetricFields<T>);

type MetricDef<
  T extends MetricScalar = MetricScalar,
  TContainer = unknown
> =
  | SingleTurnMetricVariants<T, TContainer>
  | (TContainer extends Conversation ? MultiTurnMetricVariants<T> : never);

type MetricDefFor<TContainer> = MetricDef<MetricScalar, TContainer>;

// Runtime Metric (result of executing a MetricDef)
interface Metric<T extends MetricScalar = MetricScalar> {
  metricDef: MetricDef<T, any>; // Direct reference to the definition that produced this value
  value: T;
  confidence?: number; // For LLM metrics
  reasoning?: string; // For LLM metrics
  executionTime: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// Normalization types
type NormalizeToScore<T extends MetricScalar = number, C = unknown> = (
  value: T,
  args: { context: C; metric: MetricDef<T, any> }
) => Score; // must return [0,1] Score

interface ScoringContext {
  direction?: 'higher' | 'lower';
  range?: { min: number; max: number };
  distribution?: { mean: number; stdDev: number };
  thresholds?: { pass: number; warn?: number };
  ordinalMap?: Record<string | number, number>;
  unit?: string;
  clip?: boolean;
  extra?: Record<string, unknown>;
}

type NormalizerSpec<T = any, C = any> =
  | { type: 'identity' }
  | { type: 'min-max'; min?: number; max?: number; clip?: boolean; direction?: 'higher' | 'lower' }
  | { type: 'z-score'; mean?: number; stdDev?: number; to?: '0-1' | '0-100'; clip?: boolean; direction?: 'higher' | 'lower' }
  | { type: 'threshold'; threshold: number; above?: number; below?: number }
  | { type: 'linear'; slope: number; intercept: number; clip?: [number, number]; direction?: 'higher' | 'lower' }
  | { type: 'ordinal-map'; map: Record<string | number, number> }
  | { type: 'custom'; normalize: NormalizeToScore<T, C> };

interface MetricNormalization<T extends MetricScalar = MetricScalar, C = ScoringContext> {
  default: NormalizerSpec<T, C> | NormalizeToScore<T, C>;
  context?: C | ((args: { dataset: readonly unknown[]; rawValues: readonly T[] }) => Promise<C> | C);
}
```

### Scorer System (Normalization & Combination)
```ts
// Metric inputs compose definitions directly
interface ScorerInput {
  metric: MetricDef<number, any>; // Direct reference to the MetricDef being combined
  weight: number;
  // Optional override; metrics own normalization by default
  normalizerOverride?: NormalizerSpec<number, any> | NormalizeToScore<number, any>;
  required?: boolean; // default true
}

// Scorer produces a derived metric definition
type InputScores<I extends readonly ScorerInput[]> = {
  [K in I[number] as K['metric']['name']]: Score;
};

interface Scorer<I extends readonly ScorerInput[] = readonly ScorerInput[]> {
  name: string;
  description?: string;
  output: BaseMetricDef<number>;
  inputs: I;
  normalizeWeights?: boolean; // default true
  combineScores?: (scores: InputScores<I>) => Score; // Optional custom combiner over Scores
  fallbackScore?: Score;
  metadata?: Record<string, unknown>;
}
```

### Normalization Context Resolution (Run Phases)
1) Measure: compute raw metric values for all targets.
2) Resolve Context: for each MetricDef, resolve normalization context (static value or resolver using `dataset` and `rawValues`).
3) Normalize: transform raw values to [0,1] using the metric’s default normalizer (identity fallback when unspecified).
4) Score: scorers combine already-normalized values via weights/combination function.
5) Aggregate: aggregators summarize derived metric values.

Normalization fallback:
- `MetricDef.normalization.default` if provided, otherwise identity.

Single-turn metrics respect `EvaluationContext.singleTurn` when selecting targets. Multi-turn metrics execute exactly once per container and ignore the single-turn run policy.

### Evaluator System
```ts
type SingleTurnRunPolicy =
  | { run: 'all' }
  | { run: 'selectedSteps'; stepIndices: readonly number[] }
  | { run: 'selectedItems'; itemIndices: readonly number[] };

interface EvaluationContext {
  singleTurn?: SingleTurnRunPolicy;
  metadata?: Record<string, unknown>;
}

interface Evaluator<
  TContainer,
  I extends readonly MetricDefFor<TContainer>[]
> {
  name: string;
  description?: string;
  metrics: I; // May mix single-turn and multi-turn metric definitions
  scorer: Scorer; // Combine normalized results emitted by the listed metrics
  context?: EvaluationContext; // Applied to single-turn metrics only
}
```

### Aggregator System
```ts
interface Aggregator {
  name: string;
  description?: string;
  metric: BaseMetricDef<number>; // Derived metric produced by a scorer
  aggregate: (values: readonly Score[]) => Score;
  metadata?: Record<string, unknown>;
}
```

### Functional Composition Patterns
Preferred (factory-first; builders are deprecated but shown below for compatibility):
```ts
import {
  defineBaseMetric,
  withNormalization,
  createSingleTurnCode,
  defineScorer,
  defineInput,
  createIdentityNormalizer,
} from '@tally/core';

// Base metric + normalization
const rawQuality = defineBaseMetric<number>({
  name: 'rawQuality',
  valueType: 'number',
});
const quality = withNormalization(
  rawQuality,
  createIdentityNormalizer<number>()
);

// Single-turn code metric
const qualityMetric = createSingleTurnCode<number, DatasetItem>({
  base: quality,
  runOnSelected: (item) => /* compute a number 0..1 */ 0.8,
  compute: ({ data }) => /* optional reusable compute path */ 0.8,
  cacheable: true,
});

// Scorer combining one or more normalized metrics
const finalScoreDef = defineBaseMetric<number>({
  name: 'finalScore',
  valueType: 'number',
});
const scorer = defineScorer({
  name: 'final',
  output: finalScoreDef,
  inputs: [defineInput(qualityMetric, 1)],
});
```
```ts
// Builder pattern for Scorer composition (keeps value references intact)
class ScorerBuilder {
  private scorer: Scorer;

  static create(name: string, output: BaseMetricDef<number>): ScorerBuilder;
  addMetric(metric: MetricDef<number, any>, weight: number, normalizer?: NormalizerSpec<number, any>, required?: boolean): ScorerBuilder;
  withCombineScores(fn: Scorer['combineScores']): ScorerBuilder;
  withFallbackScore(value: Score): ScorerBuilder;
  withMetadata(metadata: Record<string, unknown>): ScorerBuilder;
  build(): Scorer;
}

// Helper functions for common compositions
function createWeightedScorer(
  name: string,
  output: BaseMetricDef<number>,
  inputs: Array<{
    metric: MetricDef<number, any>;
    weight: number;
    normalizer?: NormalizerSpec<number, any>;
    required?: boolean;
  }>,
  options?: {
    normalizeWeights?: boolean;
    combineScores?: Scorer['combineScores'];
    fallbackScore?: Score;
    metadata?: Record<string, unknown>;
  }
): Scorer;

// MetricDef composition with normalization (value-first)
class MetricDefBuilder<
  T extends MetricScalar = MetricScalar,
  TContainer = unknown
> {
  static singleTurn<TMetric extends MetricScalar, TScope>(
    base: BaseMetricDef<TMetric>
  ): MetricDefBuilder<TMetric, TScope>;
  static multiTurn<TMetric extends MetricScalar>(
    base: BaseMetricDef<TMetric>
  ): MetricDefBuilder<TMetric, Conversation>;
  asLLM(
    config: Omit<LLMMetricFields<T>, 'type'>
  ): MetricDefBuilder<T, TContainer>;
  asCode(
    config: Omit<CodeMetricFields<T>, 'type'>
  ): MetricDefBuilder<T, TContainer>;
  runOnSelected(
    fn: SingleTurnMetricDef<T, TContainer>['runOnSelected']
  ): MetricDefBuilder<T, TContainer>;
  runOnContainer(
    fn: MultiTurnMetricDef<T, Conversation>['runOnContainer']
  ): MetricDefBuilder<T, Conversation>;
  withNormalization(
    defaultNormalizer: NormalizerSpec<T, ScoringContext> | NormalizeToScore<T, ScoringContext>,
    context?: ScoringContext | ((args: { dataset: readonly unknown[]; rawValues: readonly T[] }) => Promise<ScoringContext> | ScoringContext)
  ): MetricDefBuilder<T, TContainer>;
  withMetadata(metadata: Record<string, unknown>): MetricDefBuilder<T, TContainer>;
  build(): MetricDef<T, TContainer>;
}

// Pre-built normalizer factories (return NormalizerSpec value objects)
function createMinMaxNormalizer(min: number, max: number): MinMaxNormalizer;
function createThresholdNormalizer(threshold: number, above: number, below: number): ThresholdNormalizer;
function createZScoreNormalizer(mean: number, stdDev: number): ZScoreNormalizer;
function createLinearNormalizer(slope: number, intercept: number): LinearNormalizer;

// Execution context helpers
function runAllTargets(): EvaluationContext;
function runSpecificSteps(stepIndices: readonly number[]): EvaluationContext;
function runSpecificItems(itemIndices: readonly number[]): EvaluationContext;
```

### Main Container
```ts
interface Tally<TContainer> {
  data: readonly TContainer[];
  evaluators: readonly Evaluator<
    TContainer,
    readonly MetricDefFor<TContainer>[]
  >[];
  aggregators: readonly Aggregator[];
  run(): Promise<EvaluationReport>;
}
```

### Report System
```ts
interface PerTargetResult {
  targetId: string;
  rawMetrics: Metric[]; // each Metric carries its defining MetricDef
  derivedMetrics: Array<{
    definition: BaseMetricDef<number>;
    value: Score;
  }>;
}

interface AggregateSummary {
  metric: BaseMetricDef<number>;
  average: Score;
  percentile?: Record<number, number>;
  count: number;
}

interface EvaluationReport {
  runId: string;
  timestamp: Date;
  perTargetResults: PerTargetResult[];
  aggregateSummaries: AggregateSummary[];
  metadata: Record<string, unknown>;
}
```

---



## 🎯 Key Design Principles

* **Value-Based Composability** – Configuration objects circulate as values; no string identifiers required
* **Type-Safe Architecture** – Discriminated unions and inheritance provide compile-time safety
* **Functional Composition** – Direct metric composition in Scorers without ID indirection
* **Unified Container** – Everything you need for evaluation in one `Tally<T>` instance
* **Self-Contained** – Each Tally manages its own data, evaluators, and aggregators
* **Generic Data Support** – `Tally<DatasetItem>` vs `Tally<Conversation>` with full TypeScript support
* **Inheritance-Based Metrics** – Base `MetricDef` with specialized `LLMMetricDef` and `CodeMetricDef`
* **Pre-built Normalizers** – Common normalization patterns are provided and extensible via custom normalizers
* **Normalization Enforcement** – Metrics normalize to 0–1 before scoring; scorers combine normalized values
* **Composable Components** – Evaluators mix single-turn and multi-turn metrics with scorers and execution context
* **Factory-First APIs** – Prefer factory helpers; builders are deprecated but available for compatibility
* **Extensible** – Easy to add new MetricDefs, Scorers, and custom logic
* **Developer Experience** – Rich intellisense, type checking, and clear error messages
* **Human-Readable** – Intuitive container pattern that maps to familiar testing/analytics workflows

## 🔧 Type Safety Features

* **Discriminated Unions** – `MetricDef` and `NormalizerSpec` use `type` fields for safe narrowing
* **Generic Constraints** – `CodeMetricDef<T>` ensures type-safe computation
* **Direct Composition** – Value references enforce compile-time validation without lookups
* **Template Substitution** – LLM prompts support `{{variable}}` with compile-time validation
* **Normalization Guarantees** – Scorer output is constrained to 0-1 range
* **Factory Helper Safety** – Factory helpers are strongly typed for safe composition; builders are deprecated
* **Runtime Validation** – Type guards ensure data integrity during execution
* **Comprehensive Metadata** – Rich typing for confidence, reasoning, and execution details

## 🧱 Type-Safety Enhancements (API-friendly naming)

* **Score domain** – Branded `Score` type models normalized [0–1] values; helper `toScore(...)`.
* **ScoringContext** – Structured context for normalization; no unsafe index signatures.
* **NormalizerSpec / NormalizeToScore** – Normalizers return `Score`, ensuring downstream invariants.
* **valueType** – Output value type (`'number'|'boolean'|'string'|'ordinal'`) is aligned to `T`.
* **ModelProvider & PromptTemplate** – Clear LLM inputs with optional lazy model factories and typed variables/examples.
* **Scorers** – `combineScores` receives typed `InputScores` and returns a `Score`; `fallbackScore` is a `Score`.
* **Aggregators** – Operate strictly on `readonly Score[]` and return a `Score`.

## 🔌 Platform Compatibility

* **AI SDK ModelMessage** – `ConversationTurn.message` wraps AI SDK Core `ModelMessage` for system/user/assistant/tool roles and tool calling via `ToolCallPart`/`ToolResultPart`. See: [AI SDK ModelMessage](https://ai-sdk.dev/docs/reference/ai-sdk-core/model-message)
* **OpenAI Tool Calls Alignment** – Tool-calling semantics are preserved through AI SDK message parts (no underscores; e.g., `toolCallId`).
* **Framework-Agnostic** – Works seamlessly with Mastra agents and Vercel agents (Mastra is built on AI SDK), avoiding lock-in.

## 📦 Dependencies

```bash
pnpm -w add ai
```
