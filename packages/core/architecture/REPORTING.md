---
title: Reporting & Run Artifacts
status: spec
package: "@tally-evals/core"
---

## Goals

- **SDK-first**: primary usage is as an SDK in tests and user code.
- **Runs stored separately**: persisted run artifacts are for **read-only** TUI/dev server (debugging/reporting).
- **No duplicated definitions**: metric/eval definitions should not be repeated per turn.
- **Turn-addressable**: single-turn results must be addressable by `stepIndex`.
- **Clear separation of concepts**:
  - **Measurement**: what was measured (raw/score/debug).
  - **EvalOutcome**: verdict computed from a policy (pass/fail/unknown) + policy info.
- **Single-turn summaries only**: aggregate + verdict summaries are needed for **single-turn** evals; not needed for multi-turn evals.

## Non-goals

- This document does **not** implement changes. It defines the intended structure and dev-facing API.
- No new “id system” (no `evalId`/`metricId`). **Names are ref IDs**.

## Terminology

- **Metric**: produces a raw value (and optionally confidence/reasoning) and a normalized `score`.
- **Eval**: attaches a verdict policy to a metric/scorer output.
- **Single-turn eval**: evaluated per `ConversationStep` (turn).
- **Multi-turn eval**: evaluated per `Conversation` (conversation-level).
- **Scorer eval**: combines multiple metrics into a score (may be per-step or scalar).

## Naming conventions (proposal)

These conventions are meant to make the SDK feel “obvious” and reduce overloaded words.

- **Definitions vs runtime values**
  - **`*Def`** means authored configuration (serializable): `MetricDef`, `Eval`, `Scorer`.
  - **`Measurement`** means runtime output from executing a metric/scorer (rawValue/score/confidence/reasoning).
  - **`EvalOutcome`** means runtime verdict output from applying an eval policy (pass/fail/unknown + policy info).

- **Indexing**
  - Prefer **`stepIndex`** (matches `ConversationStep.stepIndex`) over “turn number”.
  - Prefer the noun **Step** over “turn” in type names when referring to `ConversationStep`.

- **Avoid “target” in public-facing shapes**
  - “Target” is ambiguous (could be step, conversation, dataset item).
  - Prefer explicit nouns: `Step*`, `Conversation*`, `Item*`.
  - If a generic term is needed internally, prefer **`Unit`** over `Target`.

- **Stored vs in-memory**
  - Anything persisted for TUI/dev-server should use **`*Artifact`**.
  - Anything returned from SDK execution should use **`*Report`** / **`*Result`**.

## DX notes (why some shapes look the way they do)

- **Names are ref IDs**: we avoid introducing `evalId`/`metricId`; names are used as stable keys in `defs` and `results`.
- **Avoid redundant refs in results**: results should be as small as possible while still being renderable.
  - UIs can join `eval -> defs.evals[eval] -> metric` and `defs.metrics[metric]` for labels/metadata.
  - If we store both `eval` and `metric` in every result row, we duplicate data and risk inconsistency.
- **One obvious lookup**: SDK/devs should not need to know “buckets” (single vs multi) just to query a verdict.
  - Tooling can group at render time via `defs.evals[eval].kind`.

## Key observation about current pipeline

Today, derived scores and verdicts are computed as arrays (`Score[]`, `TargetVerdict[]`) but are serialized in a way that:
- **flattens** derived metrics (loses step index),
- duplicates metric definitions across entries,
- and currently makes verdicts ambiguous for consumers (single vs list).

This spec re-orients report data around:
- **defs** (deduped, name-keyed),
- **results** (step-indexed arrays and scalar values),
- and a **test-friendly view** that does not require a `conversationId` parameter.

---

## Core data types

### IDs (names-as-IDs)

```ts
export type MetricName = string; // MetricDef.name
export type EvalName = string;   // Eval.name
export type RunId = string;
export type ConversationId = string;
```

### Optional type-safety upgrade (recommended for SDK DX)

Without introducing separate ids, we can still make `EvalName` and `MetricName` strongly typed
by parameterizing report/view types over a **const eval registry**.

```ts
export type EvalKind = "singleTurn" | "multiTurn" | "scorer";

/** Minimal compile-time “registry” for name literals */
export type EvalRegistry = Record<string, { kind: EvalKind; metric: MetricName }>;

export type EvalNameOf<TEvals extends EvalRegistry> = Extract<keyof TEvals, string>;
export type MetricNameOf<TEvals extends EvalRegistry> = TEvals[EvalNameOf<TEvals>]["metric"];

/** Helper to preserve literal keys (`as const`) while staying ergonomic */
export function defineEvalRegistry<const T extends EvalRegistry>(t: T): T {
  return t;
}
```

Example:

```ts
const evals = defineEvalRegistry({
  "Answer Relevance": { kind: "singleTurn", metric: "answerRelevance" },
  "Role Adherence": { kind: "multiTurn", metric: "roleAdherence" },
  "Overall Quality": { kind: "scorer", metric: "overallQuality" },
} as const);

// EvalNameOf<typeof evals> becomes:
// "Answer Relevance" | "Role Adherence" | "Overall Quality"
```

### Measurement vs EvalOutcome

```ts
export type Verdict = "pass" | "fail" | "unknown";
export type Score = number; // normalized 0..1 (when present)
export type MetricScalar = number | boolean | string | null;

/**
 * Measurement = what we measured (metric/scorer output) + debug metadata.
 * No policy semantics live here.
 */
export interface Measurement {
  /**
   * Normalized score (0..1) used for aggregation/curves when applicable.
   * Optional because some evaluators may only yield raw values or ordinal labels.
   */
  score?: Score;
  executionTimeMs?: number;
  timestamp?: string; // ISO

  /** original metric value (number/boolean/string) when available */
  rawValue?: MetricScalar;
  confidence?: number;
  reasoning?: string;
}

/**
 * Serializable policy info for explaining a verdict in UI/TUI/tests.
 * (Custom verdict functions are not serializable.)
 */
export type VerdictPolicyInfo =
  | { kind: "none" }
  | { kind: "boolean"; passWhen: boolean }
  | { kind: "number"; type: "threshold"; passAt: number }
  | { kind: "number"; type: "range"; min?: number; max?: number }
  | { kind: "ordinal"; passWhenIn: readonly string[] }
  | { kind: "custom"; note: "not-serializable" };

/**
 * EvalOutcome = verdict computed from policy + measurement.
 * Only pass/fail/unknown semantics live here.
 */
export interface EvalOutcome {
  verdict: Verdict;
  policy: VerdictPolicyInfo;
  /**
   * Optional copy of observed values used for the decision.
   * This avoids “why did this fail?” needing a join into `measurement`,
   * but should stay optional to prevent duplication.
   */
  observed?: { rawValue?: MetricScalar; score?: Score };
}
```

### Result records (compact; refs are names)

```ts
export interface StepEvalResult {
  /** name refs (no separate IDs) */
  eval: EvalName;
  measurement: Measurement;
  outcome?: EvalOutcome; // absent if no verdict policy
}

export interface ConversationEvalResult {
  eval: EvalName;
  measurement: Measurement;
  outcome?: EvalOutcome;
}
```

Typed variants (when using an eval registry):

```ts
export interface StepEvalResultFor<TEvals extends EvalRegistry> {
  eval: EvalNameOf<TEvals>;
  measurement: Measurement;
  outcome?: EvalOutcome;
}

export interface ConversationEvalResultFor<TEvals extends EvalRegistry> {
  eval: EvalNameOf<TEvals>;
  measurement: Measurement;
  outcome?: EvalOutcome;
}
```

---

## Deduped definitions (`defs`) for UI/TUI/debugging

Persist rich definitions once; results reference by name.

```ts
export interface MetricDefSnap {
  name: MetricName;
  scope: "single" | "multi";
  valueType: "number" | "boolean" | "string" | "ordinal";
  description?: string;
  metadata?: Record<string, unknown>;

  // Optional debug payloads (LLM prompt/rubric/provider) – stored once.
  llm?: {
    provider?: Record<string, unknown>;
    prompt?: { instruction: string; variables?: readonly string[] };
    rubric?: Record<string, unknown>;
  };

  aggregators?: Array<{ kind: string; name: string; description?: string; config?: unknown }>;
  normalization?: unknown;
}

export interface EvalDefSnap {
  name: EvalName;
  kind: "singleTurn" | "multiTurn" | "scorer";

  /**
   * Storage shape:
   * - singleTurn: series-by-stepIndex
   * - multiTurn: scalar
   * - scorer: either series or scalar, explicitly declared
   */
  outputShape: "seriesByStepIndex" | "scalar";

  /** which metric this eval is about */
  metric: MetricName;

  /** scorer-specific config */
  scorer?: {
    name: string;
    inputs: readonly MetricName[];
    weights?: readonly number[];
  };

  verdict?: VerdictPolicyInfo;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface RunDefs {
  metrics: Record<MetricName, MetricDefSnap>;
  evals: Record<EvalName, EvalDefSnap>;
}
```

---

## Persisted run artifact (read-only tooling)

### Why a “stored run” format?

- Dev server/TUI needs stable files to read for debugging/reporting.
- Tests primarily assert against **in-memory** output; storage is secondary.

### Stored run shape (single conversation target)

Single-turn results are indexed by step index (`ConversationStep.stepIndex`).

```ts
export interface SingleTurnEvalSeries {
  /** Array index == stepIndex; null means “not evaluated / not selected” */
  byStepIndex: Array<StepEvalResult | null>;
}

export interface ConversationResult {
  stepCount: number;

  singleTurn: Record<EvalName, SingleTurnEvalSeries>;
  multiTurn: Record<EvalName, ConversationEvalResult>;

  /** scorers can be per-step or scalar; make it explicit */
  scorers: Record<
    EvalName,
    | { shape: "seriesByStepIndex"; series: SingleTurnEvalSeries }
    | { shape: "scalar"; result: ConversationEvalResult }
  >;

  /**
   * Summaries are keyed by eval name (DX-first).
   * - single-turn: includes aggregations + verdictSummary (useful)
   * - multi-turn/scorers: may include aggregations, but verdictSummary is optional
   *
   * NOTE: Tooling can group by `kind` at render time; the stored shape stays simple.
   */
  summaries?: Summaries;
}

export type AggregationValue = number | Record<string, number>;
export interface Aggregations { [name: string]: AggregationValue }

export interface VerdictSummary {
  passRate: Score;
  failRate: Score;
  unknownRate: Score;
  passCount: number;
  failCount: number;
  unknownCount: number;
  totalCount: number;
}

export interface SingleTurnEvalSummary {
  eval: EvalName;
  count: number;
  aggregations: { score: Aggregations; raw?: Aggregations };
  verdictSummary?: VerdictSummary;
}

/** Summary entry for ANY eval kind; verdictSummary is optional. */
export interface EvalSummarySnap {
  eval: EvalName;
  kind: "singleTurn" | "multiTurn" | "scorer";
  count: number;
  aggregations?: { score: Aggregations; raw?: Aggregations };
  verdictSummary?: VerdictSummary;
}

/**
 * DX-first summary map (single lookup by eval name).
 * Tooling can group by `kind` if needed.
 */
export interface Summaries {
  byEval: Record<EvalName, EvalSummarySnap>;
}

export interface StoredRunArtifact {
  schemaVersion: 1;
  runId: RunId;
  createdAt: string;

  /**
   * Optional store locator for tooling. SDK code should not depend on it.
   * - local: absolute basePath
   * - s2/redis: key prefix
   */
  store?: { backend: "local" | "s2" | "redis"; basePath: string };
  artifacts?: {
    conversationId: ConversationId;
    runPath?: string; // conversations/<id>/runs/tally/<runId>.json
    conversationJsonlPath?: string;
    stepTracesPath?: string;
  };

  defs: RunDefs;
  result: ConversationResult;

  metadata?: Record<string, unknown>;
}
```

### Notes / improvements over current stored shape

- **`Measurement.metricRef` is required**: row measurements can join directly into `defs.metrics[metricRef]` for UI/TUI.
- **`Measurement.score` is optional**: makes this future-proof for evaluators that only yield raw/ordinal values.
- **Scorers stay explicit**: `shape` is required so consumers never guess “series vs scalar”.

---

## SDK/Test-facing public API (no `conversationId` parameter)

Tests want: “verdict at step X for eval Y” and “conversation verdict for eval Y”.

```ts
export interface TargetRunView {
  stepCount(): number;

  step(stepIndex: number, eval: EvalName): StepEvalResult | undefined;
  conversation(eval: EvalName): ConversationEvalResult | undefined;

  // convenience
  stepVerdict(stepIndex: number, eval: EvalName): Verdict | undefined;
  conversationVerdict(eval: EvalName): Verdict | undefined;

  // optional conveniences for UI/tests
  evalDef(eval: EvalName): EvalDefSnap | undefined;
  metricDefForEval(eval: EvalName): MetricDefSnap | undefined;
}

/**
 * Build a view bound to ONE target in an in-memory report.
 * - In common tests, report contains a single conversation, so default is index 0.
 */
export function createTargetRunView(
  report: unknown,
  opts?: { targetIndex?: number }
): TargetRunView;
```

Typed variant (when using an eval registry):

```ts
export interface TargetRunViewFor<TEvals extends EvalRegistry> {
  stepCount(): number;

  step(stepIndex: number, eval: EvalNameOf<TEvals>): StepEvalResultFor<TEvals> | undefined;
  conversation(eval: EvalNameOf<TEvals>): ConversationEvalResultFor<TEvals> | undefined;

  stepVerdict(stepIndex: number, eval: EvalNameOf<TEvals>): Verdict | undefined;
  conversationVerdict(eval: EvalNameOf<TEvals>): Verdict | undefined;

  evalDef(eval: EvalNameOf<TEvals>): EvalDefSnap | undefined;
  metricDefForEval(eval: EvalNameOf<TEvals>): MetricDefSnap | undefined;
}

export function createTargetRunViewFor<TEvals extends EvalRegistry>(
  report: unknown,
  evals: TEvals,
  opts?: { targetIndex?: number }
): TargetRunViewFor<TEvals>;
```

### Example usage in tests

```ts
const view = createTargetRunView(report);
expect(view.conversationVerdict("Role Adherence")).toBe("pass");
expect(view.stepVerdict(0, "Answer Relevance")).toBe("pass");
```

### Example usage in UI/TUI

```ts
const step0 = view.step(0, "Answer Relevance");
if (step0) {
  const evalDef = view.evalDef(step0.evalRef);
  const metricDef = view.metricDefForEval(step0.evalRef);
  // Render labels from defs; render values from result
}
```

---

## Notes (implementation choices)

- **Scorer output shape**: scorers may produce either:
  - per-step series (if computed per step), or
  - scalar reduction (if computed over a conversation),
  and must declare `outputShape` in `EvalDefSnap`.

- **Name collisions**: if multiple evaluators define the same `EvalName`, enforce a namespacing convention (e.g. `"EvaluatorName / EvalName"`).

