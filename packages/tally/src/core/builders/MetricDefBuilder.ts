/**
 * MetricDef Builder (split implementation)
 *
 * Strongly-typed builders for single-turn and multi-turn metrics with a small
 * facade exposing MetricDefBuilder.singleTurn / .multiTurn for API parity.
 */

import type {
  BaseMetricDef,
  CodeMetricFields,
  LLMMetricFields,
  MetricDef,
  MetricNormalization,
  MetricScalar,
  MultiTurnContainer,
  MultiTurnMetricDef,
  NormalizeToScore,
  NormalizerSpec,
  ScoringContext,
  SingleTurnContainer,
  SingleTurnMetricDef,
  VarsTuple,
} from '@tally/core/types';

/**
 * @deprecated Prefer functional factories in '@tally/core/factory'
 * SingleTurnMetricDefBuilder will be removed in a future release.
 */
class SingleTurnMetricDefBuilder<
  T extends MetricScalar,
  TContainer extends SingleTurnContainer = SingleTurnContainer,
  HasKind extends boolean = false,
  HasRunnerFn extends boolean = false,
> {
  private readonly base: BaseMetricDef<T>;
  private readonly codeConfig: Omit<CodeMetricFields<T>, 'type'> | undefined;
  private readonly llmConfig: Omit<LLMMetricFields<T, readonly []>, 'type'> | undefined;
  private readonly preProcessorFn: SingleTurnMetricDef<T, TContainer>['preProcessor'] | undefined;

  private constructor(args: {
    base: BaseMetricDef<T>;
    codeConfig?: Omit<CodeMetricFields<T>, 'type'> | undefined;
    llmConfig?: Omit<LLMMetricFields<T, readonly []>, 'type'> | undefined;
    preProcessorFn?: SingleTurnMetricDef<T, TContainer>['preProcessor'] | undefined;
  }) {
    this.base = args.base;
    this.codeConfig = args.codeConfig;
    this.llmConfig = args.llmConfig;
    this.preProcessorFn = args.preProcessorFn;
  }

  static create<
    T extends MetricScalar,
    TContainer extends SingleTurnContainer = SingleTurnContainer,
  >(base: BaseMetricDef<T>): SingleTurnMetricDefBuilder<T, TContainer, false, false> {
    return new SingleTurnMetricDefBuilder<T, TContainer, false, false>({ base });
  }

  asLLM<V extends VarsTuple = readonly []>(
    config: Omit<LLMMetricFields<T, V>, 'type'>
  ): SingleTurnMetricDefBuilder<T, TContainer, true, HasRunnerFn> {
    return new SingleTurnMetricDefBuilder<T, TContainer, true, HasRunnerFn>({
      base: this.base,
      llmConfig: config as unknown as Omit<LLMMetricFields<T, readonly []>, 'type'>,
      codeConfig: this.codeConfig,
      preProcessorFn: this.preProcessorFn,
    });
  }

  asCode(
    config: Omit<CodeMetricFields<T>, 'type'>
  ): SingleTurnMetricDefBuilder<T, TContainer, true, HasRunnerFn> {
    return new SingleTurnMetricDefBuilder<T, TContainer, true, HasRunnerFn>({
      base: this.base,
      codeConfig: config,
      llmConfig: this.llmConfig,
      preProcessorFn: this.preProcessorFn,
    });
  }

  preProcessor(
    fn: SingleTurnMetricDef<T, TContainer>['preProcessor']
  ): SingleTurnMetricDefBuilder<T, TContainer, HasKind, true> {
    return new SingleTurnMetricDefBuilder<T, TContainer, HasKind, true>({
      base: this.base,
      codeConfig: this.codeConfig,
      llmConfig: this.llmConfig,
      preProcessorFn: fn,
    });
  }

  withNormalization(
    defaultNormalizer: NormalizerSpec<T, ScoringContext> | NormalizeToScore<T, ScoringContext>,
    context?:
      | ScoringContext
      | ((args: {
          dataset: readonly unknown[];
          rawValues: readonly T[];
        }) => Promise<ScoringContext> | ScoringContext)
  ): this {
    const normalization: MetricNormalization<T, ScoringContext> = {
      default: defaultNormalizer,
      ...(context !== undefined && { context }),
    };
    (this.base as BaseMetricDef<T>).normalization = normalization;
    return this;
  }

  withMetadata(metadata: Record<string, unknown>): this {
    (this.base as BaseMetricDef<T>).metadata = {
      ...(this.base.metadata || {}),
      ...metadata,
    };
    return this;
  }

  build(this: SingleTurnMetricDefBuilder<T, TContainer, true, true>): MetricDef<T, TContainer> {
    if (!this.preProcessorFn) {
      throw new Error('SingleTurnMetricDefBuilder: preProcessor() is required before build()');
    }
    if (this.codeConfig) {
      const { /* type */ ...codeFields } = this.codeConfig;
      return {
        ...this.base,
        scope: 'single',
        type: 'code-based',
        ...codeFields,
        preProcessor: this.preProcessorFn,
      } as MetricDef<T, TContainer>;
    }
    if (this.llmConfig) {
      return {
        ...this.base,
        scope: 'single',
        type: 'llm-based',
        ...this.llmConfig,
        preProcessor: this.preProcessorFn,
      } as MetricDef<T, TContainer>;
    }
    throw new Error(
      'SingleTurnMetricDefBuilder: asCode() or asLLM() must be called before build()'
    );
  }
}

/**
 * @deprecated Prefer functional factories in '@tally/core/factory'
 * MultiTurnMetricDefBuilder will be removed in a future release.
 */
class MultiTurnMetricDefBuilder<
  T extends MetricScalar,
  TContainer extends MultiTurnContainer = MultiTurnContainer,
  HasKind extends boolean = false,
  HasRunnerFn extends boolean = false,
> {
  private readonly base: BaseMetricDef<T>;
  private readonly codeConfig: Omit<CodeMetricFields<T>, 'type'> | undefined;
  private readonly llmConfig: Omit<LLMMetricFields<T, readonly []>, 'type'> | undefined;
  private readonly runOnContainerFn:
    | MultiTurnMetricDef<T, TContainer>['runOnContainer']
    | undefined;

  private constructor(args: {
    base: BaseMetricDef<T>;
    codeConfig?: Omit<CodeMetricFields<T>, 'type'> | undefined;
    llmConfig?: Omit<LLMMetricFields<T, readonly []>, 'type'> | undefined;
    runOnContainerFn?: MultiTurnMetricDef<T, TContainer>['runOnContainer'] | undefined;
  }) {
    this.base = args.base;
    this.codeConfig = args.codeConfig;
    this.llmConfig = args.llmConfig;
    this.runOnContainerFn = args.runOnContainerFn;
  }

  static create<T extends MetricScalar, TContainer extends MultiTurnContainer = MultiTurnContainer>(
    base: BaseMetricDef<T>
  ): MultiTurnMetricDefBuilder<T, TContainer, false, false> {
    return new MultiTurnMetricDefBuilder<T, TContainer, false, false>({ base });
  }

  asLLM<V extends VarsTuple = readonly []>(
    config: Omit<LLMMetricFields<T, V>, 'type'>
  ): MultiTurnMetricDefBuilder<T, TContainer, true, HasRunnerFn> {
    return new MultiTurnMetricDefBuilder<T, TContainer, true, HasRunnerFn>({
      base: this.base,
      llmConfig: config as unknown as Omit<LLMMetricFields<T, readonly []>, 'type'>,
      codeConfig: this.codeConfig,
      runOnContainerFn: this.runOnContainerFn,
    });
  }

  asCode(
    config: Omit<CodeMetricFields<T>, 'type'>
  ): MultiTurnMetricDefBuilder<T, TContainer, true, HasRunnerFn> {
    return new MultiTurnMetricDefBuilder<T, TContainer, true, HasRunnerFn>({
      base: this.base,
      codeConfig: config,
      llmConfig: this.llmConfig,
      runOnContainerFn: this.runOnContainerFn,
    });
  }

  runOnContainer(
    fn: MultiTurnMetricDef<T, TContainer>['runOnContainer']
  ): MultiTurnMetricDefBuilder<T, TContainer, HasKind, true> {
    return new MultiTurnMetricDefBuilder<T, TContainer, HasKind, true>({
      base: this.base,
      codeConfig: this.codeConfig,
      llmConfig: this.llmConfig,
      runOnContainerFn: fn,
    });
  }

  withNormalization(
    defaultNormalizer: NormalizerSpec<T, ScoringContext> | NormalizeToScore<T, ScoringContext>,
    context?:
      | ScoringContext
      | ((args: {
          dataset: readonly unknown[];
          rawValues: readonly T[];
        }) => Promise<ScoringContext> | ScoringContext)
  ): this {
    const normalization: MetricNormalization<T, ScoringContext> = {
      default: defaultNormalizer,
      ...(context !== undefined && { context }),
    };
    (this.base as BaseMetricDef<T>).normalization = normalization;
    return this;
  }

  withMetadata(metadata: Record<string, unknown>): this {
    (this.base as BaseMetricDef<T>).metadata = {
      ...(this.base.metadata || {}),
      ...metadata,
    };
    return this;
  }

  build(this: MultiTurnMetricDefBuilder<T, TContainer, true, true>): MetricDef<T, TContainer> {
    if (!this.runOnContainerFn) {
      throw new Error('MultiTurnMetricDefBuilder: runOnContainer() is required before build()');
    }
    if (this.codeConfig) {
      const { /* type */ ...codeFields } = this.codeConfig;
      return {
        ...this.base,
        scope: 'multi',
        type: 'code-based',
        ...codeFields,
        runOnContainer: this.runOnContainerFn,
      } as MetricDef<T, TContainer>;
    }
    if (this.llmConfig) {
      return {
        ...this.base,
        scope: 'multi',
        type: 'llm-based',
        ...this.llmConfig,
        runOnContainer: this.runOnContainerFn,
      } as MetricDef<T, TContainer>;
    }
    throw new Error('MultiTurnMetricDefBuilder: asCode() or asLLM() must be called before build()');
  }
}

/**
 * Facade to keep existing API: MetricDefBuilder.singleTurn / multiTurn
 *
 * @deprecated Prefer functional factories in '@tally/core/factory'
 * MetricDefBuilder will be removed in a future release.
 */
export const MetricDefBuilder = {
  singleTurn<T extends MetricScalar, TContainer extends SingleTurnContainer = SingleTurnContainer>(
    base: BaseMetricDef<T>
  ) {
    return SingleTurnMetricDefBuilder.create<T, TContainer>(base);
  },
  multiTurn<T extends MetricScalar, TContainer extends MultiTurnContainer = MultiTurnContainer>(
    base: BaseMetricDef<T>
  ) {
    return MultiTurnMetricDefBuilder.create<T, TContainer>(base);
  },
};
