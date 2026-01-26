# Evaluation Pipeline

The evaluation pipeline is the core execution engine that processes data through 6 distinct phases.

## Pipeline Overview

```
Data + InternalEvaluators
          │
          ▼
┌──────────────────┐
│   1. Measure     │  Execute all metrics
└────────┬─────────┘
         │ Map<targetId, Metric[]>
         ▼
┌──────────────────┐
│  2. Calibrate    │  Resolve normalization context
└────────┬─────────┘
         │ Map<metricName, CalibrationContext>
         ▼
┌──────────────────┐
│  3. Normalize    │  Transform raw values → Scores
└────────┬─────────┘
         │ Map<targetId, Map<metricName, Score[]>>
         ▼
┌──────────────────┐
│    4. Score      │  Execute scorers
└────────┬─────────┘
         │ Map<targetId, Map<scorerName, DerivedScoreEntry>>
         ▼
┌──────────────────┐
│   5. Verdict     │  Compute pass/fail verdicts
└────────┬─────────┘
         │ Map<targetId, Map<evalName, PipelineVerdict[]>>
         ▼
┌──────────────────┐
│   6. Aggregate   │  Compute summaries
└────────┴─────────┘
         │
         ▼
    PipelineResult
```

## Phase 1: Measure

**Purpose:** Execute all metrics on all targets.

**Input:** `data[]`, `InternalEvaluator[]`
**Output:** `Map<targetId, Metric[]>`

```typescript
const phaseMeasure = async (data, internalEvaluators, options) => {
  // For each data item (target)
  for (const container of data) {
    const targetId = getTargetId(container);
    
    // Deduplicate metrics (same metric used by multiple evals)
    const seenMetrics = new Set<string>();
    
    for (const { metrics, context } of internalEvaluators) {
      for (const metricDef of metrics) {
        if (seenMetrics.has(metricDef.name)) continue;
        seenMetrics.add(metricDef.name);
        
        // Dispatch by scope
        if (metricDef.scope === 'single') {
          // Run on selected steps/items
          const targets = selectTargets(container, runPolicy);
          await runSingleTurnMetrics(metricDef, targets);
        } else {
          // Run on entire conversation
          await runMultiTurnMetric(metricDef, container);
        }
      }
    }
  }
};
```

**Key behaviors:**
- Metrics are deduplicated by name (executed once even if used by multiple evals)
- Run policy determines which steps to evaluate for single-turn metrics
- LLM metrics use structured output with schema validation
- Results include `value`, `confidence`, `reasoning`, `executionTime`, `timestamp`

## Phase 2: Resolve Calibration

**Purpose:** Compute calibration context needed for normalization.

**Input:** Raw metrics, metric definitions
**Output:** `Map<metricName, CalibrationContext>`

```typescript
const phaseResolveCalibration = async (data, internalEvaluators, rawMetrics) => {
  for (const { metricName, metricDef } of uniqueMetrics) {
    // Collect all raw values for this metric
    const rawValues = [...allRawMetrics]
      .filter(m => m.metricDef.name === metricName)
      .map(m => m.value);
    
    // Resolve calibration based on normalization config
    const calibration = await resolveCalibration(
      metricDef.normalization,
      data,
      rawValues,
      metricName,
      cache
    );
    
    calibrations.set(metricName, calibration);
  }
};
```

**Calibration types:**

| Normalizer | Calibration Context |
|------------|---------------------|
| `identity` | `{}` (none needed) |
| `min-max` | `{ min, max }` |
| `z-score` | `{ mean, stdDev }` |
| `threshold` | `{ threshold }` |
| `ordinal-map` | `{ values: [...] }` |
| `linear` | `{ inputRange, outputRange }` |

**Calibration sources:**
1. **Static:** Hardcoded in metric definition
2. **Computed:** Derived from dataset (`calibrate: 'fromDataset'`)
3. **Custom:** User-provided function

## Phase 3: Normalize

**Purpose:** Transform raw values to normalized Scores (0-1).

**Input:** Raw metrics, calibration contexts
**Output:** `Map<targetId, Map<metricName, Score[]>>`

```typescript
const phaseNormalize = (rawMetrics, calibrations) => {
  for (const [targetId, metrics] of rawMetrics) {
    for (const metric of metrics) {
      const calibration = calibrations.get(metric.metricDef.name);
      
      const score = applyNormalization(
        metric.value,           // Raw value
        normalizer,             // Normalizer spec
        calibration,            // Calibration context
        metricDef               // For metadata
      );
      
      // Store score indexed by metric name
    }
  }
};
```

**Normalizer dispatch (`applyNormalization`):**

```typescript
const applyNormalization = (value, normalizer, context, metricDef) => {
  switch (normalizer.type) {
    case 'identity':
      return identityNormalizer(value);
    case 'min-max':
      return minMaxNormalizer(value, context);
    case 'z-score':
      return zScoreNormalizer(value, context);
    case 'threshold':
      return thresholdNormalizer(value, context);
    case 'linear':
      return linearNormalizer(value, context);
    case 'ordinal-map':
      return ordinalMapNormalizer(value, context);
    case 'custom':
      return normalizer.normalize(value, context);
  }
};
```

## Phase 4: Score

**Purpose:** Execute scorers to combine metric scores into derived scores.

**Input:** Normalized scores, evaluators
**Output:** `Map<targetId, Map<scorerName, DerivedScoreEntry>>`

```typescript
const phaseScore = (internalEvaluators, normalizedScores, rawMetrics) => {
  for (const { scorer, evalName } of internalEvaluators) {
    for (const [targetId, targetScores] of normalizedScores) {
      // Build input scores for each step
      const derivedScores = [];
      
      for (let i = 0; i < maxLen; i++) {
        const inputScores = {};
        for (const input of scorer.inputs) {
          inputScores[input.metric.name] = targetScores.get(input.metric.name)?.[i];
        }
        
        // Apply scorer's combine function
        derivedScores.push(scorer.combineScores(inputScores));
      }
      
      // Store derived scores
    }
  }
};
```

**Scorer types:**

| Kind | Description |
|------|-------------|
| Identity | Passthrough (single metric → single score) |
| Weighted Average | `Σ(weight * score) / Σ(weight)` |
| Custom | User-provided `combineScores` function |

## Phase 5: Compute Verdicts

**Purpose:** Apply verdict policies to determine pass/fail status.

**Input:** Derived scores, eval metadata
**Output:** `Map<targetId, Map<evalName, PipelineVerdict[]>>`

```typescript
const phaseComputeVerdicts = (evalMetadata, derivedScores) => {
  for (const [targetId, scorerMap] of derivedScores) {
    for (const { scores, rawValues, evalName } of scorerMap.values()) {
      const metadata = evalMetadata.get(evalName);
      
      if (!metadata?.verdictPolicy) continue;
      
      const verdicts = scores.map((score, i) => ({
        verdict: computeVerdict(score, rawValues[i], verdictPolicy),
        score,
        rawValue: rawValues[i],
      }));
    }
  }
};
```

**Verdict computation (`computeVerdict`):**

```typescript
const computeVerdict = (score, rawValue, policy) => {
  switch (policy.kind) {
    case 'none':
      return 'unknown';
    case 'boolean':
      return rawValue === policy.passWhen ? 'pass' : 'fail';
    case 'number':
      if (policy.type === 'threshold') {
        return score >= policy.passAt ? 'pass' : 'fail';
      }
      // range: check min/max bounds
      break;
    case 'ordinal':
      return policy.passWhenIn.includes(rawValue) ? 'pass' : 'fail';
    case 'custom':
      return policy.evaluate(score, rawValue);
  }
};
```

## Phase 6: Aggregate

**Purpose:** Compute summary statistics and verdict summaries.

**Input:** Derived scores, verdicts, eval metadata
**Output:** `Map<evalName, PipelineEvalSummary>`

```typescript
const phaseAggregate = (evalMetadata, derivedScores, verdicts) => {
  // Collect all scores by eval
  const scoresByEval = collectScoresByEval(derivedScores);
  
  for (const [evalName, { scores, rawValues, inputMetrics }] of scoresByEval) {
    // Score aggregations (always numeric)
    const scoreAggregations = calculateScoreAggregations(scores, inputMetrics);
    
    // Raw value aggregations (type-matched)
    const rawAggregations = calculateRawValueAggregations(rawValues, valueType);
    
    // Verdict summary
    const verdictSummary = calculateVerdictSummary(evalName, verdicts);
    
    // Combine into EvalSummary
  }
};
```

**Aggregation output:**

```typescript
interface PipelineEvalSummary {
  evalKind: 'singleTurn' | 'multiTurn' | 'scorer';
  aggregations: {
    score: { Mean: 0.85, P50: 0.87, P90: 0.92 };
    raw?: { TrueRate: 0.73 }; // For boolean metrics
  };
  verdictSummary?: {
    passRate: 0.85;
    failRate: 0.12;
    unknownRate: 0.03;
    passCount: 17;
    failCount: 2;
    unknownCount: 1;
    totalCount: 20;
  };
}
```

## Pipeline State

The pipeline maintains immutable state between phases:

```typescript
interface PipelineState {
  rawMetrics: Map<targetId, Metric[]>;
  calibrations: Map<metricName, unknown>;
  normalizedScores: Map<targetId, Map<metricName, Score[]>>;
  derivedScores: Map<targetId, Map<scorerName, DerivedScoreEntry>>;
  verdicts: Map<targetId, Map<evalName, PipelineVerdict[]>>;
  evalSummaries: Map<evalName, PipelineEvalSummary>;
}
```

## Error Handling

| Phase | Error | Behavior |
|-------|-------|----------|
| Measure | LLM failure | Throws (no fallback) |
| Calibrate | Missing values | Uses defaults or throws |
| Normalize | Missing calibration | Throws |
| Score | Missing required metric | Throws |
| Verdict | Invalid policy | Returns 'unknown' |
| Aggregate | Empty values | Returns empty aggregations |

## Performance Considerations

1. **Metric deduplication:** Same metric is executed once per target
2. **Parallel execution:** Metrics for different targets run in parallel
3. **Caching:** Optional `MemoryCache` for LLM calls
4. **Lazy calibration:** Computed only if needed

## Source Files

- `src/core/pipeline.ts` - Main pipeline orchestration
- `src/core/normalization/apply.ts` - Normalizer dispatch
- `src/core/normalization/context.ts` - Calibration resolution
- `src/core/evals/verdict.ts` - Verdict computation
- `src/core/execution/runSingleTurn.ts` - Single-turn metric execution
- `src/core/execution/runMultiTurn.ts` - Multi-turn metric execution
