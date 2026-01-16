/**
 * Tally Container
 *
 * Main evaluation container that orchestrates the entire evaluation flow.
 * Wraps data and evaluators (which contain evals), and provides a simple run() method.
 */

import type {
  Conversation,
  DatasetItem,
  EvaluationReport,
  Evaluator,
  MetricContainer,
  MetricScalar,
  Tally,
} from '@tally/core/types';
import { match, P } from 'ts-pattern';
import { generateRunId } from '../utils/ids';
import { buildFromEvals } from './evals/builder';
import type { MemoryCache } from './execution/cache/memoryCache';
import type { GenerateObjectOptions } from './execution/llm/generateObject';
import { type PipelineOptions, executePipeline } from './pipeline';

/**
 * Validate evaluator has required fields
 */
const validateEvaluator = (evaluator: Evaluator<MetricContainer>): void =>
  match(evaluator)
    .with({ evals: P.when((e) => !e || e.length === 0) }, ({ name }) => {
      throw new Error(`Tally: evaluator "${name}" must have at least one eval`);
    })
    .with({ context: P.nullish }, ({ name }) => {
      throw new Error(`Tally: evaluator "${name}" must have a context`);
    })
    .otherwise(() => undefined);

/**
 * Validate constructor inputs
 */
const validateInputs = (data: unknown, evaluators: unknown): void => {
  match({ data, evaluators })
    .with({ data: P.when((d) => !Array.isArray(d)) }, () => {
      throw new Error('Tally: data must be an array');
    })
    .with({ evaluators: P.when((e) => !Array.isArray(e)) }, () => {
      throw new Error('Tally: evaluators must be an array');
    })
    .with({ evaluators: P.when((e) => Array.isArray(e) && e.length === 0) }, () => {
      throw new Error('Tally: at least one evaluator is required');
    })
    .otherwise(() => undefined);
};

/**
 * Tally container implementation
 */
export class TallyContainer<TContainer extends DatasetItem | Conversation>
  implements Tally<TContainer>
{
  public readonly data: readonly TContainer[];
  public readonly evaluators: readonly Evaluator<MetricContainer>[];

  constructor(data: readonly TContainer[], evaluators: readonly Evaluator<MetricContainer>[]) {
    validateInputs(data, evaluators);
    evaluators.forEach(validateEvaluator);

    this.data = data;
    this.evaluators = evaluators;
  }

  /**
   * Run the full evaluation pipeline
   *
   * @param options - Optional pipeline options (cache, LLM options, metadata)
   * @returns Evaluation report with per-target results and aggregate summaries
   */
  async run(options?: {
    cache?: MemoryCache<MetricScalar>;
    llmOptions?: GenerateObjectOptions;
    metadata?: Record<string, unknown>;
  }): Promise<EvaluationReport> {
    const runId = generateRunId();
    const timestamp = new Date();

    // Convert evals to internal evaluators
    // Collect all evals from all evaluators
    const allEvals = this.evaluators.flatMap((evaluator) => evaluator.evals);
    const { internalEvaluators, evalMetadata } = buildFromEvals(allEvals);

    // Execute pipeline
    const pipelineOptions: PipelineOptions = {
      ...(options?.cache !== undefined && { cache: options.cache }),
      ...(options?.llmOptions !== undefined && { llmOptions: options.llmOptions }),
      ...(options?.metadata !== undefined && { metadata: options.metadata }),
    };

    const pipelineResult = await executePipeline(
      this.data,
      internalEvaluators,
      evalMetadata,
      pipelineOptions
    );

    // Build evaluation report (convert readonly to mutable for report interface)
    const report: EvaluationReport = {
      runId,
      timestamp,
      perTargetResults: [...pipelineResult.perTargetResults],
      aggregateSummaries: [...pipelineResult.aggregateSummaries],
      evalSummaries: new Map(pipelineResult.evalSummaries),
      metricToEvalMap: new Map(pipelineResult.metricToEvalMap),
      metadata: {
        ...(options?.metadata ?? {}),
        dataCount: this.data.length,
        evaluatorCount: this.evaluators.length,
      },
    };

    return report;
  }
}

/**
 * Create a Tally container
 *
 * Convenience factory function for creating a Tally instance.
 *
 * @param data - Array of containers (DatasetItem[] or Conversation[])
 * @param evaluators - Array of evaluators (with evals)
 * @returns Tally container instance
 */
export function createTally<TContainer extends DatasetItem | Conversation>(args: {
  data: readonly TContainer[];
  evaluators: readonly Evaluator<MetricContainer>[];
}): Tally<TContainer> {
  return new TallyContainer(args.data, args.evaluators);
}
