/**
 * Single-Turn Metric Execution
 *
 * Executes single-turn metrics (both code-based and LLM-based) against
 * selected targets. Handles execution timing and metadata collection.
 */

import type {
  ConversationStep,
  DatasetItem,
  Metric,
  MetricContainer,
  MetricDef,
  MetricScalar,
  SingleTargetFor,
  SingleTurnContainer,
} from '@tally/core/types';
import { extractTextFromMessage, extractTextFromMessages } from '../../metrics/common/utils';
import type { MemoryCache } from './cache/memoryCache';
import { getExecutor } from './executors';
import type { ExecutorOptions } from './executors';
import type { GenerateObjectOptions } from './llm/generateObject';

/**
 * Options for single-turn metric execution
 */
export interface RunSingleTurnOptions {
  cache?: MemoryCache<MetricScalar>;
  llmOptions?: GenerateObjectOptions;
  /**
   * Optional per-run preprocessor override for single-turn execution.
   * If provided, takes precedence over the default and is only superseded
   * by a metric's own preProcessor.
   */
  preprocessor?: (
    selected: SingleTargetFor<unknown>,
    metric: unknown
  ) => Promise<unknown> | unknown;
}

/**
 * Execute a single-turn metric against a target
 *
 * @param metricDef - Single-turn metric definition
 * @param target - Target to evaluate (DatasetItem or ConversationStep)
 * @param options - Optional execution options (cache, LLM options)
 * @returns Metric result with execution metadata
 */
export async function runSingleTurnMetric<
  T extends MetricScalar,
  TContainer extends SingleTurnContainer,
>(
  metricDef: MetricDef<T, TContainer>,
  target: SingleTargetFor<TContainer>,
  options?: RunSingleTurnOptions
): Promise<Metric<T>> {
  // Ensure we only execute single-turn metrics here
  if ((metricDef as unknown as { scope: 'single' | 'multi' }).scope !== 'single') {
    throw new Error(
      `runSingleTurnMetric: Expected single-turn metric, got multi-turn metric: ${metricDef.name}`
    );
  }

  // Resolve preprocessor: metric-level > per-run override > default
  type MaybePreprocessFields = {
    preProcessor?: (selected: SingleTargetFor<unknown>) => Promise<unknown> | unknown;
  };
  const preprocessFields = metricDef as unknown as MaybePreprocessFields;
  type PreprocessorFn = (
    selected: SingleTargetFor<unknown>,
    metric: unknown
  ) => Promise<unknown> | unknown;
  const resolvedPreprocessor: PreprocessorFn = preprocessFields.preProcessor
    ? (s) => {
        const fn = preprocessFields.preProcessor as (
          selected: SingleTargetFor<unknown>
        ) => Promise<unknown> | unknown;
        return fn(s);
      }
    : (options?.preprocessor ?? defaultPreprocessSingle);
  const prepared = await resolvedPreprocessor(target as SingleTargetFor<unknown>, metricDef);

  const executor = getExecutor<SingleTargetFor<TContainer>, T>(
    metricDef as MetricDef<T, MetricContainer>
  );
  const execOptions: ExecutorOptions = {};
  if (options?.cache) execOptions.cache = options.cache;
  if (options?.llmOptions) execOptions.llmOptions = options.llmOptions;
  if (prepared !== undefined) execOptions.prepared = prepared;

  const result = await executor.execute(
    metricDef as MetricDef<T, MetricContainer>,
    target,
    execOptions
  );
  return {
    metricDef: metricDef as MetricDef<T, MetricContainer>,
    value: result.value,
    ...(result.confidence !== undefined && { confidence: result.confidence }),
    ...(result.reasoning !== undefined && { reasoning: result.reasoning }),
    executionTime: result.executionTime,
    timestamp: new Date(),
  };
}

/**
 * Execute a single-turn metric against multiple targets
 *
 * @param metricDef - Single-turn metric definition
 * @param targets - Array of targets to evaluate
 * @param options - Optional execution options
 * @returns Array of metric results
 */
export async function runSingleTurnMetrics<
  T extends MetricScalar,
  TContainer extends SingleTurnContainer,
>(
  metricDef: MetricDef<T, TContainer>,
  targets: readonly SingleTargetFor<TContainer>[],
  options?: RunSingleTurnOptions
): Promise<Metric<T>[]> {
  const results = await Promise.all(
    targets.map((target) =>
      runSingleTurnMetric(metricDef as MetricDef<T, SingleTurnContainer>, target, options)
    )
  );

  return results;
}

/**
 * Default single-turn preprocessor.
 * Produces a normalized payload exposing { input, output } and optional metadata.
 */
async function defaultPreprocessSingle(
  selected: SingleTargetFor<unknown>,
  _metric: unknown
): Promise<unknown> {
  // DatasetItem: prompt/completion → input/output
  if (isDatasetItem(selected)) {
    const item = selected as DatasetItem;
    const payload: Record<string, unknown> = {
      input: item.prompt,
      output: item.completion,
    };
    if (item.metadata !== undefined) {
      payload.metadata = item.metadata;
    }
    return payload;
  }
  // ConversationStep: extract text from ModelMessages
  if (isConversationStep(selected)) {
    const step = selected as ConversationStep;
    const payload: Record<string, unknown> = {
      input: extractTextFromMessage(step.input),
      output: extractTextFromMessages(step.output),
    };
    if ((step as ConversationStep).metadata !== undefined) {
      payload.metadata = (step as ConversationStep).metadata;
    }
    return payload;
  }
  // Fallback: return as-is (unknown shape)
  return selected as unknown;
}

function isDatasetItem(value: unknown): value is DatasetItem {
  return (
    typeof value === 'object' &&
    value !== null &&
    'prompt' in (value as Record<string, unknown>) &&
    'completion' in (value as Record<string, unknown>)
  );
}

function isConversationStep(value: unknown): value is ConversationStep {
  return (
    typeof value === 'object' &&
    value !== null &&
    'input' in (value as Record<string, unknown>) &&
    'output' in (value as Record<string, unknown>)
  );
}
