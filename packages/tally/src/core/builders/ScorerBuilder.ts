/**
 * Scorer Builder
 *
 * Fluent API for building Scorer objects that combine normalized metrics
 * into derived composite metrics.
 */

import type {
  BaseMetricDef,
  InputScores,
  MetricContainer,
  MetricDef,
  MetricScalar,
  NormalizeToScore,
  NormalizerSpec,
  Score,
  Scorer,
  ScorerInput,
  ScoringContext,
} from '@tally/core/types';

/**
 * @deprecated Prefer functional factories in '@tally/core/factory'
 * ScorerBuilder will be removed in a future release.
 */
class ScorerBuilder<TInputs extends readonly ScorerInput[] = readonly []> {
  private readonly name: string;
  private readonly output: BaseMetricDef<number>;
  private inputs: ScorerInput[] = [];
  private description: string | undefined;
  private normalizeWeights = true;
  private combineScoresFn: ((scores: InputScores<TInputs>) => Score) | undefined;
  private fallbackScore: Score | undefined;
  private metadata: Record<string, unknown> | undefined;

  private constructor(name: string, output: BaseMetricDef<number>) {
    this.name = name;
    this.output = output;
  }

  /**
   * Create a new ScorerBuilder instance
   */
  static create<TInputs extends readonly ScorerInput[] = readonly []>(
    name: string,
    output: BaseMetricDef<number>
  ): ScorerBuilder<TInputs> {
    return new ScorerBuilder<TInputs>(name, output);
  }

  /**
   * Add a metric input to the scorer
   *
   * @param metric - The metric definition to include
   * @param weight - Weight for this metric in the combination
   * @param normalizerOverride - Optional normalizer override (defaults to metric's normalization)
   * @param required - Whether this metric is required (default: true)
   */
  addMetric<
    TRawValue extends MetricScalar,
    TContainer extends MetricContainer = MetricContainer,
    M extends MetricDef<TRawValue, TContainer> = MetricDef<TRawValue, TContainer>,
  >(
    metric: M,
    weight: number,
    normalizerOverride?:
      | NormalizerSpec<TRawValue, ScoringContext>
      | NormalizeToScore<TRawValue, ScoringContext>,
    required = true
  ): ScorerBuilder<
    readonly [...TInputs, ScorerInput<MetricDef<MetricScalar, MetricContainer>, ScoringContext>]
  > {
    const input = {
      metric: metric as unknown as MetricDef<MetricScalar, MetricContainer>,
      weight,
      required,
      ...(normalizerOverride !== undefined && { normalizerOverride }),
    } as ScorerInput<MetricDef<MetricScalar, MetricContainer>, ScoringContext>;

    const builder = new ScorerBuilder<
      readonly [...TInputs, ScorerInput<MetricDef<MetricScalar, MetricContainer>, ScoringContext>]
    >(this.name, this.output);
    builder.inputs = [...this.inputs, input];
    builder.description = this.description;
    builder.normalizeWeights = this.normalizeWeights;
    builder.combineScoresFn = this.combineScoresFn as
      | ((
          scores: InputScores<
            readonly [
              ...TInputs,
              ScorerInput<MetricDef<MetricScalar, MetricContainer>, ScoringContext>,
            ]
          >
        ) => Score)
      | undefined;
    builder.fallbackScore = this.fallbackScore;
    builder.metadata = this.metadata;
    return builder;
  }

  /**
   * Set a custom score combination function
   * If not provided, defaults to weighted average (when normalizeWeights is true)
   */
  withCombineScores(fn: (scores: InputScores<TInputs>) => Score): ScorerBuilder<TInputs> {
    const builder = new ScorerBuilder<TInputs>(this.name, this.output);
    builder.inputs = [...this.inputs];
    builder.description = this.description;
    builder.normalizeWeights = this.normalizeWeights;
    builder.combineScoresFn = fn;
    builder.fallbackScore = this.fallbackScore;
    builder.metadata = this.metadata;
    return builder;
  }

  /**
   * Set the fallback score to use when required metrics are missing
   */
  withFallbackScore(score: Score): ScorerBuilder<TInputs> {
    const builder = new ScorerBuilder<TInputs>(this.name, this.output);
    builder.inputs = [...this.inputs];
    builder.description = this.description;
    builder.normalizeWeights = this.normalizeWeights;
    builder.combineScoresFn = this.combineScoresFn;
    builder.fallbackScore = score;
    builder.metadata = this.metadata;
    return builder;
  }

  /**
   * Set whether to normalize weights (default: true)
   */
  withNormalizeWeights(normalize: boolean): ScorerBuilder<TInputs> {
    const builder = new ScorerBuilder<TInputs>(this.name, this.output);
    builder.inputs = [...this.inputs];
    builder.description = this.description;
    builder.normalizeWeights = normalize;
    builder.combineScoresFn = this.combineScoresFn;
    builder.fallbackScore = this.fallbackScore;
    builder.metadata = this.metadata;
    return builder;
  }

  /**
   * Set the scorer description
   */
  withDescription(description: string): ScorerBuilder<TInputs> {
    const builder = new ScorerBuilder<TInputs>(this.name, this.output);
    builder.inputs = [...this.inputs];
    builder.description = description;
    builder.normalizeWeights = this.normalizeWeights;
    builder.combineScoresFn = this.combineScoresFn;
    builder.fallbackScore = this.fallbackScore;
    builder.metadata = this.metadata;
    return builder;
  }

  /**
   * Add metadata to the scorer
   */
  withMetadata(metadata: Record<string, unknown>): ScorerBuilder<TInputs> {
    const builder = new ScorerBuilder<TInputs>(this.name, this.output);
    builder.inputs = [...this.inputs];
    builder.description = this.description;
    builder.normalizeWeights = this.normalizeWeights;
    builder.combineScoresFn = this.combineScoresFn;
    builder.fallbackScore = this.fallbackScore;
    builder.metadata = {
      ...(this.metadata || {}),
      ...metadata,
    };
    return builder;
  }

  /**
   * Build the final Scorer object
   */
  build(): Scorer<TInputs> {
    if (this.inputs.length === 0) {
      throw new Error('ScorerBuilder: At least one metric input is required');
    }

    return {
      name: this.name,
      ...(this.description !== undefined && { description: this.description }),
      output: this.output,
      inputs: this.inputs as unknown as TInputs,
      ...(this.normalizeWeights !== undefined && {
        normalizeWeights: this.normalizeWeights,
      }),
      ...(this.combineScoresFn !== undefined && {
        combineScores: this.combineScoresFn,
      }),
      ...(this.fallbackScore !== undefined && { fallbackScore: this.fallbackScore }),
      ...(this.metadata !== undefined && { metadata: this.metadata }),
    };
  }
}

export { ScorerBuilder };
