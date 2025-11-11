/**
 * Tally Container
 *
 * Main evaluation container that orchestrates the entire evaluation flow.
 * Wraps data and evaluators (which contain evals), and provides a simple run() method.
 */

import type {
	Tally,
	Evaluator,
	EvaluationReport,
	DatasetItem,
	Conversation,
	MetricScalar,
} from '@tally/core/types';
import { executePipeline, type PipelineOptions } from './pipeline';
import type { MemoryCache } from './execution/cache/memoryCache';
import type { GenerateObjectOptions } from './execution/llm/generateObject';
import { generateRunId } from '../utils/ids';
import { buildFromEvals } from './evals/builder';

/**
 * Tally container implementation
 */
export class TallyContainer<TContainer extends DatasetItem | Conversation>
	implements Tally<TContainer>
{
	public readonly data: readonly TContainer[];
	public readonly evaluators: readonly Evaluator<import('@tally/core/types').MetricContainer>[];

	constructor(
		data: readonly TContainer[],
		evaluators: readonly Evaluator<import('@tally/core/types').MetricContainer>[]
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

		// Validate evaluators have evals
		for (const evaluator of evaluators) {
			if (!evaluator.evals || evaluator.evals.length === 0) {
				throw new Error(
					`Tally: evaluator "${evaluator.name}" must have at least one eval`
				);
			}
			if (!evaluator.context) {
				throw new Error(`Tally: evaluator "${evaluator.name}" must have a context`);
			}
		}

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

		const { perTargetResults, aggregateSummaries, evalSummaries } = await executePipeline(
			this.data,
			internalEvaluators,
			evalMetadata,
			pipelineOptions
		);

		// Build evaluation report
		const report: EvaluationReport = {
			runId,
			timestamp,
			perTargetResults,
			aggregateSummaries,
			evalSummaries,
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
export function createTally<TContainer extends DatasetItem | Conversation>(
	args: {
		data: readonly TContainer[];
		evaluators: readonly Evaluator<import('@tally/core/types').MetricContainer>[];
	}
): Tally<TContainer> {
	return new TallyContainer(args.data, args.evaluators);
}

