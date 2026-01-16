/**
 * Multi-Turn Metric Execution
 *
 * Executes multi-turn metrics (both code-based and LLM-based) against
 * conversation containers. Handles execution timing and metadata collection.
 */

import type {
  Conversation,
  Metric,
  MetricContainer,
  MetricDef,
  MetricScalar,
  MultiTurnContainer,
} from '@tally/core/types';
import type { MemoryCache } from './cache/memoryCache';
import { getExecutor } from './executors';
import type { GenerateObjectOptions } from './llm/generateObject';

/**
 * Options for multi-turn metric execution
 */
export interface RunMultiTurnOptions {
  cache?: MemoryCache<MetricScalar>;
  llmOptions?: GenerateObjectOptions;
  /**
   * Optional per-run preprocessor override. If provided, takes precedence over the default
   * and is only superseded by a metric's own preprocessContainer/runOnContainer.
   */
  preprocessor?: (conversation: Conversation, metric: unknown) => Promise<unknown> | unknown;
  /**
   * Arbitrary per-run variables to inject into prompt context.
   * Intended for string-based variables to be used in templates.
   */
  runMetadata?: Record<string, unknown>;
}

/**
 * Execute a multi-turn metric against a conversation
 *
 * @param metricDef - Multi-turn metric definition
 * @param conversation - Conversation container to evaluate
 * @param options - Optional execution options (cache, LLM options)
 * @returns Metric result with execution metadata
 */
export async function runMultiTurnMetric<T extends MetricScalar>(
  metricDef: MetricDef<T, MultiTurnContainer>,
  conversation: Conversation,
  options?: RunMultiTurnOptions
): Promise<Metric<T>> {
  // Resolve preprocessor: metric-level > per-run override > default
  type MaybePreprocessFields = {
    preprocessContainer?: (container: Conversation) => Promise<unknown> | unknown;
    runOnContainer?: (container: Conversation) => Promise<unknown> | unknown;
  };
  const preprocessFields = metricDef as unknown as MaybePreprocessFields;
  type PreprocessorFn = (conversation: Conversation, metric: unknown) => Promise<unknown> | unknown;
  const resolvedPreprocessor: PreprocessorFn = preprocessFields.preprocessContainer
    ? (c) => {
        const fn = preprocessFields.preprocessContainer as (
          container: Conversation
        ) => Promise<unknown> | unknown;
        return fn(c);
      }
    : preprocessFields.runOnContainer
      ? (c) => {
          const fn = preprocessFields.runOnContainer as (
            container: Conversation
          ) => Promise<unknown> | unknown;
          return fn(c);
        }
      : (options?.preprocessor ?? defaultPreprocess);
  const prepared = await resolvedPreprocessor(conversation, metricDef);

  const executor = getExecutor<Conversation, T>(metricDef as MetricDef<T, MetricContainer>);
  const execResult = await executor.execute(
    metricDef as MetricDef<T, MetricContainer>,
    conversation,
    {
      ...(options?.cache !== undefined && { cache: options.cache }),
      ...(options?.llmOptions !== undefined && { llmOptions: options.llmOptions }),
      ...(prepared !== undefined && { prepared }),
      ...(options?.runMetadata !== undefined && { runMetadata: options.runMetadata }),
    }
  );

  return {
    metricDef: metricDef as MetricDef<T, MetricContainer>,
    value: execResult.value,
    ...(execResult.confidence !== undefined && { confidence: execResult.confidence }),
    ...(execResult.reasoning !== undefined && { reasoning: execResult.reasoning }),
    executionTime: execResult.executionTime,
    timestamp: new Date(),
  };
}

/**
 * Execute a multi-turn metric against multiple conversations
 *
 * @param metricDef - Multi-turn metric definition
 * @param conversations - Array of conversations to evaluate
 * @param options - Optional execution options
 * @returns Array of metric results
 */
export async function runMultiTurnMetrics<T extends MetricScalar>(
  metricDef: MetricDef<T, MultiTurnContainer>,
  conversations: readonly Conversation[],
  options?: RunMultiTurnOptions
): Promise<Metric<T>[]> {
  const results = await Promise.all(
    conversations.map((conversation) => runMultiTurnMetric(metricDef, conversation, options))
  );

  return results;
}

/**
 * Default multi-turn preprocessor.
 * Conservatively returns minimal metadata to avoid changing existing prompt shapes.
 */
async function defaultPreprocess(conversation: Conversation, _metric: unknown): Promise<unknown> {
  return {
    conversationId: conversation.id,
    stepCount: conversation.steps.length,
  };
}
