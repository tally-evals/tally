# Normalization Internals

Deep dive into how normalization and calibration work in Tally.

## Overview

Normalization transforms raw metric values into normalized Scores (0-1):

```
Raw Value → [Calibration] → Normalizer → Score (0-1)
```

## Normalizer Types

### Identity

Passes through numeric values directly (assumes already 0-1):

```typescript
{ type: 'identity' }

// Implementation
const identityNormalizer = (value: number): Score => {
  return toScore(Math.max(0, Math.min(1, value)));
};
```

**Use for:** LLM metrics that output 0-1 scores directly.

### Min-Max

Scales values to 0-1 based on observed range:

```typescript
{ type: 'min-max', clamp?: boolean }

// Requires calibration
interface Context {
  min: number;
  max: number;
}

// Implementation
const minMaxNormalizer = (value: number, ctx: Context): Score => {
  const range = ctx.max - ctx.min;
  if (range === 0) return toScore(0.5);
  
  const normalized = (value - ctx.min) / range;
  return clamp ? toScore(Math.max(0, Math.min(1, normalized))) : toScore(normalized);
};
```

**Use for:** Raw counts, latencies, any numeric range.

### Z-Score

Standardizes values using mean and standard deviation:

```typescript
{ type: 'z-score', clamp?: boolean }

// Requires calibration
interface Context {
  mean: number;
  stdDev: number;
}

// Implementation
const zScoreNormalizer = (value: number, ctx: Context): Score => {
  if (ctx.stdDev === 0) return toScore(0.5);
  
  const zScore = (value - ctx.mean) / ctx.stdDev;
  // Convert to 0-1 using standard normal CDF approximation
  const normalized = 0.5 * (1 + erf(zScore / Math.sqrt(2)));
  return toScore(normalized);
};
```

**Use for:** Comparing across different scales, outlier handling.

### Threshold

Binary 0/1 based on threshold:

```typescript
{ type: 'threshold', passAt: number }

// Implementation
const thresholdNormalizer = (value: number, ctx: { threshold: number }): Score => {
  return toScore(value >= ctx.threshold ? 1 : 0);
};
```

**Use for:** Pass/fail from numeric values.

### Linear

Maps input range to output range:

```typescript
{ 
  type: 'linear', 
  inputRange: [number, number], 
  outputRange?: [number, number] // defaults to [0, 1]
}

// Implementation
const linearNormalizer = (
  value: number, 
  ctx: { inputRange: [number, number]; outputRange: [number, number] }
): Score => {
  const [inMin, inMax] = ctx.inputRange;
  const [outMin, outMax] = ctx.outputRange;
  
  const normalized = (value - inMin) / (inMax - inMin);
  return toScore(outMin + normalized * (outMax - outMin));
};
```

**Use for:** Known fixed ranges (e.g., 1-5 ratings → 0-1).

### Ordinal Map

Maps categorical values to scores:

```typescript
{ type: 'ordinal-map', values: Record<string, number> }

// Implementation
const ordinalMapNormalizer = (
  value: string, 
  ctx: { values: string[] }
): Score => {
  const mapping = ctx.values;
  const score = mapping[value];
  if (score === undefined) {
    throw new Error(`Unknown ordinal value: ${value}`);
  }
  return toScore(score);
};
```

**Use for:** Ordinal scales (poor/fair/good), categories with known ordering.

### Custom

User-provided normalization function:

```typescript
{ type: 'custom', normalize: (value: T, context: C) => Score }

// Example
{
  type: 'custom',
  normalize: (value: number, ctx: { baseline: number }) => {
    return toScore(value / ctx.baseline);
  }
}
```

**Use for:** Complex normalization logic.

## Calibration

Calibration provides context data needed by normalizers.

### Calibration Sources

#### 1. Static Calibration

Hardcoded in metric definition:

```typescript
{
  normalizer: { type: 'min-max' },
  calibrate: { min: 0, max: 100 }, // Static values
}
```

#### 2. Dataset Calibration

Computed from actual data:

```typescript
{
  normalizer: { type: 'min-max' },
  calibrate: 'fromDataset', // Compute min/max from raw values
}
```

Implementation in `resolveCalibration`:

```typescript
const resolveCalibration = async (
  normalization: MetricNormalization,
  data: readonly Container[],
  rawValues: readonly MetricScalar[],
  metricName: string,
  cache: CalibrationCache
) => {
  // Check cache first
  if (cache.has(metricName)) {
    return cache.get(metricName);
  }

  const calibrate = normalization?.calibrate;
  
  if (!calibrate || calibrate === 'none') {
    return {}; // No calibration needed
  }

  if (calibrate === 'fromDataset') {
    // Compute from raw values
    return computeCalibrationFromValues(rawValues, normalization.normalizer);
  }

  if (typeof calibrate === 'function') {
    // User-provided function
    return await calibrate(data, rawValues);
  }

  // Static object
  return calibrate;
};
```

#### 3. Custom Calibration Function

User-provided async function:

```typescript
{
  normalizer: { type: 'min-max' },
  calibrate: async (data, rawValues) => {
    // Fetch baseline from external source
    const baseline = await fetchBaseline();
    return { min: 0, max: baseline };
  },
}
```

### Calibration Computation

For `'fromDataset'` calibration:

```typescript
const computeCalibrationFromValues = (
  values: readonly MetricScalar[],
  normalizer: NormalizerSpec
): CalibrationContext => {
  const numericValues = values.filter((v): v is number => typeof v === 'number');

  switch (normalizer.type) {
    case 'min-max':
      return computeRange(numericValues);
    case 'z-score':
      return computeDistributionStats(numericValues);
    default:
      return {};
  }
};

const computeRange = (values: readonly number[]): { min: number; max: number } => {
  if (values.length === 0) return { min: 0, max: 1 };
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
};

const computeDistributionStats = (values: readonly number[]): { mean: number; stdDev: number } => {
  if (values.length === 0) return { mean: 0, stdDev: 1 };
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  
  return {
    mean,
    stdDev: Math.sqrt(variance),
  };
};
```

### Calibration Caching

Calibration is cached per metric to avoid recomputation:

```typescript
const createCalibrationCache = (): CalibrationCache => {
  const cache = new Map<string, unknown>();
  
  return {
    has: (metricName) => cache.has(metricName),
    get: (metricName) => cache.get(metricName),
    set: (metricName, value) => cache.set(metricName, value),
  };
};
```

## Normalization Dispatch

The `applyNormalization` function routes to the correct normalizer:

```typescript
// src/core/normalization/apply.ts

export const applyNormalization = <T extends MetricScalar>(
  value: T,
  normalizer: NormalizerSpec,
  context: NormalizationContextFor<T>,
  metricDef: MetricDef<T, MetricContainer>
): Score => {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return toScore(0);
  }

  // Dispatch by normalizer type
  switch (normalizer.type) {
    case 'identity':
      return identityNormalizer(value as number);
    
    case 'min-max':
      return minMaxNormalizer(
        value as number, 
        context as NumericNormalizationContext,
        normalizer.clamp
      );
    
    case 'z-score':
      return zScoreNormalizer(
        value as number,
        context as NumericNormalizationContext,
        normalizer.clamp
      );
    
    case 'threshold':
      return thresholdNormalizer(value as number, { threshold: normalizer.passAt });
    
    case 'linear':
      return linearNormalizer(value as number, {
        inputRange: normalizer.inputRange,
        outputRange: normalizer.outputRange ?? [0, 1],
      });
    
    case 'ordinal-map':
      return ordinalMapNormalizer(value as string, normalizer);
    
    case 'custom':
      return normalizer.normalize(value, context);
    
    default:
      throw new Error(`Unknown normalizer type: ${(normalizer as any).type}`);
  }
};
```

## Auto-Normalization

When a metric lacks explicit normalization, auto-normalization applies defaults:

```typescript
// src/core/evals/normalization.ts

const getDefaultAutoNormalizer = (valueType: string): AutoNormalizer | null => {
  switch (valueType) {
    case 'number':
      return 'identity'; // Assume already 0-1
    case 'boolean':
      return 'boolean'; // true=1, false=0
    case 'ordinal':
    case 'string':
      return null; // Requires explicit mapping
  }
};

const applyAutoNormalization = (
  metric: MetricDef,
  autoNormalizer: AutoNormalizer
): MetricNormalization => {
  switch (autoNormalizer) {
    case 'identity':
      return { normalizer: { type: 'identity' } };
    case 'boolean':
      return { normalizer: { type: 'identity' } }; // 1/0 passthrough
    case 'minMax':
      return { 
        normalizer: { type: 'min-max', clamp: true },
        calibrate: 'fromDataset',
      };
    // ...
  }
};
```

## Pipeline Integration

Normalization happens in Phase 3 of the pipeline:

```
Phase 1: Measure
    ↓
Phase 2: Calibrate ← Compute calibration contexts
    ↓
Phase 3: Normalize ← Apply normalizers with contexts
    ↓
Phase 4: Score
```

```typescript
// Phase 2: Resolve calibration for each unique metric
const calibrations = await phaseResolveCalibration(data, evaluators, rawMetrics);
// Map<metricName, CalibrationContext>

// Phase 3: Apply normalization to each raw metric
const normalizedScores = phaseNormalize(rawMetrics, calibrations);
// Map<targetId, Map<metricName, Score[]>>
```

## Type Safety

Calibration contexts are type-safe per normalizer:

```typescript
type NormalizationContextFor<T extends MetricScalar> =
  T extends number ? NumericNormalizationContext :
  T extends boolean ? BooleanNormalizationContext :
  T extends string ? OrdinalNormalizationContext :
  never;

interface NumericNormalizationContext {
  min?: number;
  max?: number;
  mean?: number;
  stdDev?: number;
}

interface BooleanNormalizationContext {
  // Empty - no calibration needed
}

interface OrdinalNormalizationContext {
  values: string[];
}
```

## Source Files

- `src/core/normalization/apply.ts` - Normalizer dispatch
- `src/core/normalization/context.ts` - Calibration resolution
- `src/core/normalization/normalizers/` - Individual normalizer implementations
- `src/core/evals/normalization.ts` - Auto-normalization logic
- `src/normalizers/factories.ts` - User-facing normalizer factories
