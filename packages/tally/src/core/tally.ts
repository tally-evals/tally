/**
 * Tally Container
 *
 * Main evaluation container that orchestrates the entire evaluation flow.
 * Wraps data, evaluators, and aggregators, and provides a simple run() method.
 */

import type {
	Tally,
	Evaluator,
	Aggregator,
	EvaluationReport,
	DatasetItem,
	Conversation,
	MetricDefFor,
	MetricScalar,
} from '@tally/core/types';
import { executePipeline, type PipelineOptions } from './pipeline';
import { type MemoryCache } from './execution/cache/memoryCache';
import { type GenerateObjectOptions } from './execution/llm/generateObject';
import { generateRunId } from '../utils/ids';

/**
 * Tally container implementation
 */
export class TallyContainer<TContainer extends DatasetItem | Conversation>
	implements Tally<TContainer>
{
	public readonly data: readonly TContainer[];
	public readonly evaluators: readonly Evaluator<
		TContainer,
		readonly MetricDefFor<TContainer>[]
	>[];
	public readonly aggregators: readonly Aggregator[];

	constructor(
		data: readonly TContainer[],
		evaluators: readonly Evaluator<
			TContainer,
			readonly MetricDefFor<TContainer>[]
		>[],
		aggregators: readonly Aggregator[] = []
	) {
		// Validate inputs
		if (!Array.isArray(data)) {
			throw new Error('Tally: data must be an array');
		}
		if (!Array.isArray(evaluators)) {
			throw new Error('Tally: evaluators must be an array');
		}
		if (evaluators.length === 0) {
			throw new Error('Tally: at least one evaluator is required');
		}
		if (!Array.isArray(aggregators)) {
			throw new Error('Tally: aggregators must be an array');
		}

		// Validate evaluators have metrics
		for (const evaluator of evaluators) {
			if (!evaluator.metrics || evaluator.metrics.length === 0) {
				throw new Error(
					`Tally: evaluator "${evaluator.name}" must have at least one metric`
				);
			}
			if (!evaluator.scorer) {
				throw new Error(`Tally: evaluator "${evaluator.name}" must have a scorer`);
			}
		}

		this.data = data;
		this.evaluators = evaluators;
		this.aggregators = aggregators;
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

		// Execute pipeline
		const pipelineOptions: PipelineOptions = {};
		if (options?.cache !== undefined) {
			pipelineOptions.cache = options.cache;
		}
		if (options?.llmOptions !== undefined) {
			pipelineOptions.llmOptions = options.llmOptions;
		}
		if (options?.metadata !== undefined) {
			pipelineOptions.metadata = options.metadata;
		}

		const { perTargetResults, aggregateSummaries } = await executePipeline(
			this.data,
			this.evaluators,
			this.aggregators,
			pipelineOptions
		);

		// Build evaluation report
		const report: EvaluationReport = {
			runId,
			timestamp,
			perTargetResults,
			aggregateSummaries,
			metadata: {
				...(options?.metadata ?? {}),
				dataCount: this.data.length,
				evaluatorCount: this.evaluators.length,
				aggregatorCount: this.aggregators.length,
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
 * @param evaluators - Array of evaluators
 * @param aggregators - Optional array of aggregators
 * @returns Tally container instance
 */
export function createTally<TContainer extends DatasetItem | Conversation>(
	args: {
		data: readonly TContainer[];
		evaluators: readonly Evaluator<
			TContainer,
			readonly MetricDefFor<TContainer>[]
		>[];
		aggregators?: readonly Aggregator[];
	}
): Tally<TContainer> {
	return new TallyContainer(
		args.data,
		args.evaluators,
		args.aggregators ?? []
	);
}

