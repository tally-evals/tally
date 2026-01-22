import { describe, it, expect } from 'vitest';
import {
	createAnswerRelevanceMetric,
	runSingleTurnMetric,
} from '../../_exports';
import { makeMockLanguageModelReturningObject } from '../../_mocks/mockModel';
import type { ConversationStep, DatasetItem } from '../../_exports';

describe('Integration | Metrics | Answer Relevance', () => {
	it('creates answer relevance metric', () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.5}');
		const metric = createAnswerRelevanceMetric({ provider: mockProvider });

		expect(metric).toBeDefined();
		expect(metric.name).toBe('answerRelevance');
		expect(metric.valueType).toBe('number');
		expect(metric.scope).toBe('single');
	});

	it('executes answer relevance metric on DatasetItem', async () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.0}');
		const metric = createAnswerRelevanceMetric({ provider: mockProvider });

		const item: DatasetItem = {
			id: 'test-1',
			prompt: 'What is the capital of France?',
			completion: 'Paris is the capital of France.',
		};

		const result = await runSingleTurnMetric(metric, item);

		expect(result).toBeDefined();
		expect(result.value).toBeGreaterThanOrEqual(0);
		expect(result.value).toBeLessThanOrEqual(5);
		expect(result.executionTime).toBeGreaterThanOrEqual(0);
	});

	it('executes answer relevance metric on ConversationStep', async () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.5}');
		const metric = createAnswerRelevanceMetric({ provider: mockProvider });

		const step: ConversationStep = {
			stepIndex: 0,
			input: { role: 'user', content: 'What is the capital of France?' },
			output: [{ role: 'assistant', content: 'Paris is the capital of France.' }],
		};

		const result = await runSingleTurnMetric(metric, step);

		expect(result).toBeDefined();
		expect(result.value).toBeGreaterThanOrEqual(0);
		expect(result.value).toBeLessThanOrEqual(5);
		expect(result.executionTime).toBeGreaterThanOrEqual(0);
	});

	it('creates answer relevance metric with custom partialWeight', () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.0}');
		const metric = createAnswerRelevanceMetric({
			provider: mockProvider,
			partialWeight: 0.5,
		});

		expect(metric).toBeDefined();
		expect(metric.name).toBe('answerRelevance');
	});
});

