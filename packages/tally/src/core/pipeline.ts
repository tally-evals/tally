/**
 * Evaluation Pipeline
 *
 * Orchestrates the 5-phase evaluation process:
 * 1. Measure: Execute all metrics (single-turn + multi-turn)
 * 2. Resolve Context: Resolve normalization contexts for each metric
 * 3. Normalize: Transform raw values to Scores
 * 4. Score: Execute scorers to produce derived metrics
 * 5. Aggregate: Run aggregators over derived metrics
 */

import type {
	MetricDef,
	Metric,
	MetricScalar,
	Score,
	Aggregator,
	Evaluator,
	PerTargetResult,
	AggregateSummary,
	Conversation,
	DatasetItem,
	SingleTargetFor,
	MetricDefFor,
	ScoringContext,
	BaseMetricDef,
	SingleTurnRunPolicy,
} from '@tally/core/types';
import { runSingleTurnMetrics } from './execution/runSingleTurn';
import { runMultiTurnMetric } from './execution/runMultiTurn';
import type { RunSingleTurnOptions } from './execution/runSingleTurn';
import type { RunMultiTurnOptions } from './execution/runMultiTurn';
import type { ExecutorOptions } from './execution/executors';
import type { MemoryCache } from './execution/cache/memoryCache';
import type { GenerateObjectOptions } from './execution/llm/generateObject';
import { resolveContext } from './normalization/context';
import { applyNormalization } from './normalization/apply';
import { selectConversationTargets, selectDatasetTargets, resolveRunPolicy } from './evaluators/context';

/**
 * Pipeline state - intermediate results between phases
 */
export interface PipelineState {
	// Phase 1: Raw metric results
	rawMetrics: Map<string, Metric<MetricScalar>[]>; // key: targetId, value: metrics for that target

	// Phase 2: Resolved contexts per metric
	contexts: Map<string, ScoringContext>; // key: metric name

	// Phase 3: Normalized scores per target
	normalizedScores: Map<string, Map<string, Score>>; // key: targetId, inner key: metric name

	// Phase 4: Derived metric scores per target
	// Maps targetId -> scorer name -> { score, outputMetric }
	derivedScores: Map<
		string,
		Map<
			string,
			{
				score: Score;
				outputMetric: BaseMetricDef<number>;
			}
		>
	>;

	// Phase 5: Aggregate summaries
	aggregateSummaries: AggregateSummary[];
}

/**
 * Pipeline options
 */
export interface PipelineOptions {
	cache?: MemoryCache<MetricScalar>;
	llmOptions?: GenerateObjectOptions;
	metadata?: Record<string, unknown>;
}

/**
 * Execute the full 5-phase evaluation pipeline
 */
export async function executePipeline<TContainer extends DatasetItem | Conversation>(
	data: readonly TContainer[],
	evaluators: readonly Evaluator<TContainer, readonly MetricDefFor<TContainer>[]>[],
	aggregators: readonly Aggregator[],
	options?: PipelineOptions
): Promise<{
	perTargetResults: PerTargetResult[];
	aggregateSummaries: AggregateSummary[];
}> {
	const state: PipelineState = {
		rawMetrics: new Map(),
		contexts: new Map(),
		normalizedScores: new Map(),
		derivedScores: new Map(),
		aggregateSummaries: [],
	};

	// Phase 1: Measure - Execute all metrics
	await phaseMeasure(data, evaluators, state, options);

	// Phase 2: Resolve Context - Resolve normalization contexts
	await phaseResolveContext(data, evaluators, state);

	// Phase 3: Normalize - Transform raw values to Scores
	phaseNormalize(evaluators, state);

	// Phase 4: Score - Execute scorers to produce derived metrics
	phaseScore(evaluators, state);

	// Phase 5: Aggregate - Run aggregators over derived metrics
	phaseAggregate(aggregators, state);

	// Build final results
	const perTargetResults = buildPerTargetResults(state, data);
	const aggregateSummaries = state.aggregateSummaries;

	return { perTargetResults, aggregateSummaries };
}

/**
 * Phase 1: Measure - Execute all metrics for all evaluators
 */
async function phaseMeasure<TContainer extends DatasetItem | Conversation>(
	data: readonly TContainer[],
	evaluators: readonly Evaluator<TContainer, readonly MetricDefFor<TContainer>[]>[],
	state: PipelineState,
	options?: PipelineOptions
): Promise<void> {
	const executionOptions: RunSingleTurnOptions = {};
	if (options?.cache !== undefined) {
		executionOptions.cache = options.cache;
	}
	if (options?.llmOptions !== undefined) {
		executionOptions.llmOptions = options.llmOptions;
	}
	if (options?.metadata !== undefined) {
		(executionOptions as unknown as ExecutorOptions).runMetadata = options.metadata;
	}

	// Process each container
	for (let i = 0; i < data.length; i++) {
		const container = data[i];
		if (container === undefined) continue;

		const targetId = getTargetId(container, i);
		const metrics: Metric<MetricScalar>[] = [];

		// Execute all evaluators' metrics for this container
		for (const evaluator of evaluators) {
			for (const metricDef of evaluator.metrics) {
				if (metricDef.scope === 'single') {
					// Single-turn: select targets based on policy
					const policy = resolveRunPolicy(evaluator.context);
					const targets = selectTargets(container, policy);
					const results = await runSingleTurnMetrics(
						metricDef as MetricDef<MetricScalar, TContainer>,
						targets,
						executionOptions
					);
					metrics.push(...results);
				} else if (metricDef.scope === 'multi') {
					// Multi-turn: execute on entire conversation
					if (isConversation(container)) {
						const multiTurnOptions: RunMultiTurnOptions = {};
						if (options?.cache !== undefined) {
							multiTurnOptions.cache = options.cache;
						}
						if (options?.llmOptions !== undefined) {
							multiTurnOptions.llmOptions = options.llmOptions;
						}
						if (options?.metadata !== undefined) {
							multiTurnOptions.runMetadata = options.metadata;
						}
						const result = await runMultiTurnMetric(
							metricDef as MetricDef<MetricScalar, Conversation>,
							container,
							multiTurnOptions
						);
						metrics.push(result);
					}
				}
			}
		}

		state.rawMetrics.set(targetId, metrics);
	}
}

/**
 * Phase 2: Resolve Context - Resolve normalization contexts for each unique metric
 */
async function phaseResolveContext<TContainer extends DatasetItem | Conversation>(
	data: readonly TContainer[],
	evaluators: readonly Evaluator<TContainer, readonly MetricDefFor<TContainer>[]>[],
	state: PipelineState
): Promise<void> {
	// Collect all unique metric definitions
	const uniqueMetrics = new Map<string, MetricDef<MetricScalar, TContainer>>();
	for (const evaluator of evaluators) {
		for (const metricDef of evaluator.metrics) {
			if (!uniqueMetrics.has(metricDef.name)) {
				uniqueMetrics.set(metricDef.name, metricDef);
			}
		}
	}

	// Resolve context for each metric
	for (const [metricName, metricDef] of uniqueMetrics) {
		// Collect raw values for this metric across all targets
		const rawValues: MetricScalar[] = [];
		for (const metrics of state.rawMetrics.values()) {
			for (const metric of metrics) {
				if (metric.metricDef.name === metricName) {
					rawValues.push(metric.value);
				}
			}
		}

		// Resolve context
		const context = await resolveContext(
			metricDef.normalization,
			data,
			rawValues,
			metricName
		);
		state.contexts.set(metricName, context);
	}
}

/**
 * Phase 3: Normalize - Transform raw metric values to Scores
 */
function phaseNormalize<TContainer extends DatasetItem | Conversation>(
	evaluators: readonly Evaluator<TContainer, readonly MetricDefFor<TContainer>[]>[],
	state: PipelineState
): void {
	// Collect all unique metric definitions
	const uniqueMetrics = new Map<string, MetricDef<MetricScalar, TContainer>>();
	for (const evaluator of evaluators) {
		for (const metricDef of evaluator.metrics) {
			if (!uniqueMetrics.has(metricDef.name)) {
				uniqueMetrics.set(metricDef.name, metricDef);
			}
		}
	}

	// Normalize metrics for each target
	for (const [targetId, metrics] of state.rawMetrics) {
		const scores = new Map<string, Score>();

		for (const metric of metrics) {
			const metricDef = metric.metricDef;
			const context = state.contexts.get(metricDef.name);
			if (!context) {
				throw new Error(`Missing context for metric: ${metricDef.name}`);
			}

			// Get normalizer spec (default to identity if not specified)
			const normalizerSpec = metricDef.normalization?.default ?? { type: 'identity' };

			// Apply normalization
			const score = applyNormalization(
				metric.value,
				normalizerSpec,
				context,
				metricDef
			);

			scores.set(metricDef.name, score);
		}

		state.normalizedScores.set(targetId, scores);
	}
}

/**
 * Phase 4: Score - Execute scorers to produce derived metrics
 */
function phaseScore<TContainer extends DatasetItem | Conversation>(
	evaluators: readonly Evaluator<TContainer, readonly MetricDefFor<TContainer>[]>[],
	state: PipelineState
): void {
	// Execute each evaluator's scorer
	for (const evaluator of evaluators) {
		const scorer = evaluator.scorer;

		// For each target, compute derived score
		for (const [targetId, normalizedScores] of state.normalizedScores) {
			// Collect input scores for this scorer
			const inputScores: Record<string, Score> = {};
			for (const input of scorer.inputs) {
				const metricName = input.metric.name;
				const score = normalizedScores.get(metricName);

				if (score === undefined) {
					if (input.required !== false) {
						throw new Error(
							`Required metric "${metricName}" missing for scorer "${scorer.name}" on target "${targetId}"`
						);
					}
					// Optional metric missing - skip or use fallback
					if (scorer.fallbackScore !== undefined) {
						inputScores[metricName] = scorer.fallbackScore;
					}
					continue;
				}

				inputScores[metricName] = score;
			}

			// Compute derived score
			let derivedScore: Score;
			if (scorer.combineScores) {
				derivedScore = scorer.combineScores(inputScores as never);
			} else {
				// Default: weighted average (should be provided by scorer builder)
				throw new Error(`Scorer "${scorer.name}" missing combineScores function`);
			}

			// Store derived score with output metric definition
			let targetDerivedScores = state.derivedScores.get(targetId);
			if (!targetDerivedScores) {
				targetDerivedScores = new Map();
				state.derivedScores.set(targetId, targetDerivedScores);
			}
			targetDerivedScores.set(scorer.name, {
				score: derivedScore,
				outputMetric: scorer.output,
			});
		}
	}
}

/**
 * Phase 5: Aggregate - Run aggregators over derived metrics
 */
function phaseAggregate(
	aggregators: readonly Aggregator[],
	state: PipelineState
): void {
	// Group derived scores by metric (scorer output metric name)
	const scoresByMetric = new Map<string, Score[]>();
	for (const derivedScores of state.derivedScores.values()) {
		for (const [, { score, outputMetric }] of derivedScores) {
			const metricName = outputMetric.name;
			const scores = scoresByMetric.get(metricName) ?? [];
			scores.push(score);
			scoresByMetric.set(metricName, scores);
		}
	}

	// Run each aggregator
	for (const aggregator of aggregators) {
		const scores = scoresByMetric.get(aggregator.metric.name);
		if (!scores || scores.length === 0) {
			continue; // Skip if no scores for this metric
		}

		const aggregated = aggregator.aggregate(scores);
		state.aggregateSummaries.push({
			metric: aggregator.metric,
			average: aggregated,
			count: scores.length,
		});
	}
}

/**
 * Build per-target results from pipeline state
 */
function buildPerTargetResults<TContainer extends DatasetItem | Conversation>(
	state: PipelineState,
	data: readonly TContainer[]
): PerTargetResult[] {
	const results: PerTargetResult[] = [];

	for (let i = 0; i < data.length; i++) {
		const container = data[i];
		if (container === undefined) continue;

		const targetId = getTargetId(container as DatasetItem | Conversation, i);
		const rawMetrics = state.rawMetrics.get(targetId) ?? [];
		const derivedScores = state.derivedScores.get(targetId) ?? new Map();

		const derivedMetrics: Array<{
			definition: BaseMetricDef<number>;
			value: Score;
		}> = [];
		for (const [, { score, outputMetric }] of derivedScores) {
			derivedMetrics.push({
				definition: outputMetric,
				value: score,
			});
		}

		results.push({
			targetId,
			rawMetrics,
			derivedMetrics,
		});
	}

	return results;
}

/**
 * Get target ID from container
 */
function getTargetId(container: DatasetItem | Conversation, index: number): string {
	if ('id' in container && typeof container.id === 'string') {
		return container.id;
	}
	return `target-${index}`;
}

/**
 * Select targets based on run policy
 */
function selectTargets<TContainer extends DatasetItem | Conversation>(
	container: TContainer,
	policy: SingleTurnRunPolicy | undefined
): readonly SingleTargetFor<TContainer>[] {
	const defaultPolicy: SingleTurnRunPolicy = { run: 'all' };
	const effectivePolicy = policy ?? defaultPolicy;

	if (isConversation(container)) {
		const result = selectConversationTargets(container, effectivePolicy);
		return result.targets as readonly SingleTargetFor<TContainer>[];
	}
	if (isDatasetItem(container)) {
		const result = selectDatasetTargets([container], effectivePolicy);
		return result.targets as readonly SingleTargetFor<TContainer>[];
	}

	return [];
}

/**
 * Type guard for Conversation
 */
function isConversation(value: unknown): value is Conversation {
	return (
		typeof value === 'object' &&
		value !== null &&
		'id' in value &&
		'steps' in value &&
		Array.isArray((value as Conversation).steps)
	);
}

/**
 * Type guard for DatasetItem
 */
function isDatasetItem(value: unknown): value is DatasetItem {
	return (
		typeof value === 'object' &&
		value !== null &&
		'id' in value &&
		'prompt' in value &&
		'completion' in value
	);
}

