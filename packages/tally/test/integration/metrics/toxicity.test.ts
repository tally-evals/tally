import { describe, it, expect } from 'vitest';
import {
	createToxicityMetric,
	runSingleTurnMetric,
} from '../../_exports';
import { makeMockLanguageModelReturningObject } from '../../_mocks/mockModel';
import type { ConversationStep, DatasetItem } from '../../_exports';

describe('Integration | Metrics | Toxicity', () => {
	it('creates toxicity metric', () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 5}');
		const metric = createToxicityMetric({ provider: mockProvider });

		expect(metric).toBeDefined();
		expect(metric.name).toBe('toxicity');
		expect(metric.valueType).toBe('number');
		expect(metric.scope).toBe('single');
	});

	it('executes toxicity metric on DatasetItem', async () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 5}');
		const metric = createToxicityMetric({ provider: mockProvider });

		const item: DatasetItem = {
			id: 'test-1',
			prompt: 'Tell me about the weather.',
			completion: 'The weather today is sunny and pleasant.',
		};

		const result = await runSingleTurnMetric(metric, item);

		expect(result).toBeDefined();
		expect(result.value).toBeGreaterThanOrEqual(1);
		expect(result.value).toBeLessThanOrEqual(5);
		expect(result.executionTime).toBeGreaterThanOrEqual(0);
	});

	it('executes toxicity metric on ConversationStep', async () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 4}');
		const metric = createToxicityMetric({ provider: mockProvider });

		const step: ConversationStep = {
			stepIndex: 0,
			input: { role: 'user', content: 'Tell me about the weather.' },
			output: {
				role: 'assistant',
				content: 'The weather today is sunny and pleasant.',
			},
		};

		const result = await runSingleTurnMetric(metric, step);

		expect(result).toBeDefined();
		expect(result.value).toBeGreaterThanOrEqual(1);
		expect(result.value).toBeLessThanOrEqual(5);
		expect(result.executionTime).toBeGreaterThanOrEqual(0);
	});

	it('creates toxicity metric with categories', () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 5}');
		const metric = createToxicityMetric({
			provider: mockProvider,
			categories: ['hate', 'harassment', 'violence'],
		});

		expect(metric).toBeDefined();
		expect(metric.name).toBe('toxicity');
	});

	it('creates toxicity metric with all category types', () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 5}');
		const metric = createToxicityMetric({
			provider: mockProvider,
			categories: ['hate', 'harassment', 'violence', 'self-harm', 'sexual', 'profanity'],
		});

		expect(metric).toBeDefined();
		expect(metric.name).toBe('toxicity');
	});
});

