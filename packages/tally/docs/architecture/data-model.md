# Data Model

This document describes the core types and their relationships in Tally.

## Type Hierarchy

```
                    ┌─────────────────┐
                    │  MetricScalar   │
                    │ number|bool|str │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ BaseMetricDef │  │  NormalizerSpec │  │  AggregatorDef  │
│ name,valueType│  │  type,config    │  │  kind,aggregate │
└───────┬───────┘  └────────┬────────┘  └────────┬────────┘
        │                   │                    │
        └───────────────────┼────────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │      MetricDef        │
                │ base + scope + impl   │
                └───────────┬───────────┘
                            │
           ┌────────────────┼────────────────┐
           │                │                │
           ▼                ▼                ▼
   ┌──────────────┐ ┌──────────────┐ ┌─────────────┐
   │SingleTurnEval│ │MultiTurnEval │ │  ScorerEval │
   │metric+verdict│ │metric+verdict│ │scorer+verdi │
   └──────────────┘ └──────────────┘ └─────────────┘
```

## Data Containers

### MetricScalar

The fundamental value type produced by metrics:

```typescript
type MetricScalar = number | boolean | string;
```

### Score

Normalized value between 0 and 1:

```typescript
type Score = number; // 0.0 - 1.0 (branded type in @tally-evals/core)
```

### DatasetItem

Single-turn input/output pair:

```typescript
interface DatasetItem {
  id?: string;
  input: string;
  output: string;
  expected?: string;
  metadata?: Record<string, unknown>;
}
```

### Conversation

Multi-turn conversation with steps:

```typescript
interface Conversation {
  id?: string;
  steps: ConversationStep[];
  systemPrompt?: string;
  metadata?: Record<string, unknown>;
}

interface ConversationStep {
  role: 'user' | 'assistant' | 'system' | 'tool';
  input?: string;
  output: string;
  toolCalls?: ToolCall[];
  metadata?: Record<string, unknown>;
}
```

### Container Type Helpers

```typescript
type SingleTurnContainer = DatasetItem | Conversation;
type MultiTurnContainer = Conversation;
type MetricContainer = DatasetItem | Conversation;
```

## Metric Types

### BaseMetricDef

Core metric definition (value type metadata):

```typescript
interface BaseMetricDef<T extends MetricScalar> {
  name: string;
  valueType: 'number' | 'boolean' | 'string' | 'ordinal';
  description?: string;
  metadata?: Record<string, unknown>;
}
```

### MetricScope

Where the metric operates:

```typescript
type MetricScope = 'single' | 'multi';
// single: per-step (runs on each ConversationStep or DatasetItem)
// multi: per-conversation (runs on entire Conversation)
```

### SingleTurnMetricDef

Metric that runs on individual steps:

```typescript
// LLM-based
interface SingleTurnMetricDef<T, Vars> {
  scope: 'single';
  name: string;
  valueType: 'number' | 'boolean' | 'string' | 'ordinal';
  promptTemplate: (...vars: Vars) => string;
  model: LanguageModelLike;
  // ... plus normalization, aggregators
}

// Code-based
interface SingleTurnMetricDef<T> {
  scope: 'single';
  name: string;
  valueType: 'number' | 'boolean' | 'string' | 'ordinal';
  compute: (target: SingleTargetFor<Container>) => T | Promise<T>;
  // ... plus normalization, aggregators
}
```

### MultiTurnMetricDef

Metric that runs on entire conversations:

```typescript
interface MultiTurnMetricDef<T> {
  scope: 'multi';
  name: string;
  valueType: 'number' | 'boolean' | 'string' | 'ordinal';
  // LLM or code implementation
}
```

### Metric (Result)

Runtime result of executing a metric:

```typescript
interface Metric<T extends MetricScalar> {
  metricDef: MetricDef<T, MetricContainer>;
  value: T;
  confidence?: number;  // LLM metrics only
  reasoning?: string;   // LLM metrics only
  executionTime: number;
  timestamp: Date;
}
```

## Normalization Types

### NormalizerSpec

Discriminated union of normalizer configurations:

```typescript
type NormalizerSpec =
  | { type: 'identity' }
  | { type: 'min-max'; clamp?: boolean }
  | { type: 'z-score'; clamp?: boolean }
  | { type: 'threshold'; passAt: number }
  | { type: 'linear'; inputRange: [number, number]; outputRange?: [number, number] }
  | { type: 'ordinal-map'; values: Record<string, number> }
  | { type: 'custom'; normalize: NormalizeToScore<T> };
```

### MetricNormalization

Full normalization configuration:

```typescript
interface MetricNormalization<T extends MetricScalar> {
  normalizer: NormalizerSpec;
  calibrate?: CalibrationSpec<T>;
}
```

### Calibration Contexts

Type-safe calibration data by normalizer:

```typescript
// For min-max, z-score
interface NumericNormalizationContext {
  min?: number;
  max?: number;
  mean?: number;
  stdDev?: number;
}

// For boolean metrics
interface BooleanNormalizationContext {
  // Empty - no calibration needed
}

// For ordinal-map
interface OrdinalNormalizationContext {
  values: string[];
}
```

## Scorer Types

### ScorerInput

A metric input to a scorer:

```typescript
interface ScorerInput {
  metric: MetricDef<MetricScalar, MetricContainer>;
  weight: number;
  required?: boolean;
  normalizerOverride?: NormalizerSpec;
}
```

### InputScores

Type-safe map of metric names to scores:

```typescript
type InputScores<TInputs extends readonly ScorerInput[]> = {
  [K in TInputs[number]['metric']['name']]: Score;
};
```

### Scorer

Combines multiple scores into one:

```typescript
interface Scorer<TInputs extends readonly ScorerInput[] = readonly ScorerInput[]> {
  name: string;
  output: BaseMetricDef<number>;
  inputs: TInputs;
  combineScores: (scores: InputScores<TInputs>) => Score;
  normalizeWeights?: boolean;
  fallbackScore?: Score;
  description?: string;
  metadata?: Record<string, unknown>;
}
```

## Aggregator Types

Discriminated union by `kind`:

```typescript
interface NumericAggregatorDef {
  kind: 'numeric';
  name: string;
  aggregate: (values: readonly number[]) => number;
}

interface BooleanAggregatorDef {
  kind: 'boolean';
  name: string;
  aggregate: (values: readonly boolean[]) => number;
}

interface CategoricalAggregatorDef {
  kind: 'categorical';
  name: string;
  aggregate: (values: readonly string[]) => Record<string, number>;
}

type AggregatorDef = NumericAggregatorDef | BooleanAggregatorDef | CategoricalAggregatorDef;
```

### Type Compatibility

```typescript
type CompatibleAggregator<T extends MetricScalar> =
  T extends number ? NumericAggregatorDef :
  T extends boolean ? NumericAggregatorDef | BooleanAggregatorDef :
  T extends string ? NumericAggregatorDef | CategoricalAggregatorDef :
  never;
```

## Eval Types

### VerdictPolicy

Discriminated union of verdict policies:

```typescript
type VerdictPolicy =
  | { kind: 'none' }
  | { kind: 'boolean'; passWhen: boolean }
  | { kind: 'number'; type: 'threshold'; passAt: number }
  | { kind: 'number'; type: 'range'; min?: number; max?: number }
  | { kind: 'ordinal'; passWhenIn: string[] }
  | { kind: 'custom'; evaluate: (score: Score, raw: MetricScalar) => Verdict };
```

### Eval

Union of eval types:

```typescript
type Eval = SingleTurnEval | MultiTurnEval | ScorerEval;

interface SingleTurnEval<TName, TContainer, TValue> {
  kind: 'singleTurn';
  name: TName;
  metric: SingleTurnMetricDef<TValue, TContainer>;
  verdict?: VerdictPolicy;
  autoNormalize?: AutoNormalizer;
  context?: EvaluationContext;
  description?: string;
  metadata?: Record<string, unknown>;
}

interface MultiTurnEval<TName, TContainer, TValue> {
  kind: 'multiTurn';
  name: TName;
  metric: MultiTurnMetricDef<TValue, TContainer>;
  verdict?: VerdictPolicy;
  autoNormalize?: AutoNormalizer;
  context?: EvaluationContext;
  description?: string;
  metadata?: Record<string, unknown>;
}

interface ScorerEval<TName> {
  kind: 'scorer';
  name: TName;
  scorer: Scorer;
  verdict?: VerdictPolicy;
  context?: EvaluationContext;
  description?: string;
  metadata?: Record<string, unknown>;
}
```

## Result Types

### Measurement

Single measurement from a metric:

```typescript
interface Measurement {
  metricRef: string;
  score?: Score;
  rawValue?: MetricScalarOrNull;
  confidence?: number;
  reasoning?: string;
  executionTimeMs?: number;
  timestamp?: string;
  normalization?: NormalizationInfo;
}
```

### EvalOutcome

Verdict result:

```typescript
interface EvalOutcome {
  verdict: 'pass' | 'fail' | 'unknown';
  policy: VerdictPolicyInfo;
  observed: {
    score?: Score;
    rawValue?: MetricScalarOrNull;
  };
}
```

### StepEvalResult / ConversationEvalResult

Per-step and per-conversation results:

```typescript
interface StepEvalResult {
  evalRef: string;
  measurement: Measurement;
  outcome?: EvalOutcome;
}

interface ConversationEvalResult {
  evalRef: string;
  measurement: Measurement;
  outcome?: EvalOutcome;
}
```

### ConversationResult

Complete result for a conversation:

```typescript
interface ConversationResult<TEvals> {
  stepCount: number;
  singleTurn: {
    [evalName]: SingleTurnEvalSeries;
  };
  multiTurn: {
    [evalName]: ConversationEvalResult;
  };
  scorers: {
    [evalName]: { shape: 'scalar' | 'seriesByStepIndex'; ... };
  };
  summaries?: Summaries;
}
```

## Artifact Types

### TallyRunArtifact

Serializable run output:

```typescript
interface TallyRunArtifact {
  schemaVersion: 1;
  runId: string;
  createdAt: string;
  defs: RunDefs;
  result: ConversationResult;
  metadata?: Record<string, unknown>;
}

interface RunDefs {
  metrics: Record<string, MetricDefSnap>;
  evals: Record<string, EvalDefSnap>;
  scorers: Record<string, ScorerDefSnap>;
}
```

### TallyRunReport

Type-safe report wrapper:

```typescript
interface TallyRunReport<TEvals extends readonly Eval[]> {
  artifact: TallyRunArtifact;
  defs: RunDefs;
  result: ConversationResult<TEvals>;
  view: TargetRunView<TEvals>;
}
```

## Type Relationships Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        User Input                            │
│  createTally({ data: Conversation[], evals: Eval[] })       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Eval Definitions                         │
│  SingleTurnEval ──────────────────────────────────────────┐ │
│    └── metric: SingleTurnMetricDef                        │ │
│        └── normalization?: MetricNormalization            │ │
│            └── normalizer: NormalizerSpec                 │ │
│            └── calibrate?: CalibrationSpec                │ │
│        └── aggregators?: CompatibleAggregator[]           │ │
│    └── verdict?: VerdictPolicy                            │ │
│                                                           │ │
│  ScorerEval ──────────────────────────────────────────────┤ │
│    └── scorer: Scorer                                     │ │
│        └── inputs: ScorerInput[]                          │ │
│            └── metric: MetricDef                          │ │
│        └── combineScores: InputScores → Score             │ │
│    └── verdict?: VerdictPolicy                            │ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Pipeline Execution                       │
│  Metric[] → Score[] → DerivedScore[] → Verdict[] → Summary │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     TallyRunReport                           │
│  .artifact: TallyRunArtifact (serializable)                 │
│  .result: ConversationResult<TEvals> (type-safe access)     │
│  .view: TargetRunView<TEvals> (iteration helpers)           │
└─────────────────────────────────────────────────────────────┘
```
