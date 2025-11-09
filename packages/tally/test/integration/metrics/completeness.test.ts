import { describe, it, expect } from 'vitest';
import {
	createCompletenessMetric,
	runSingleTurnMetric,
} from '../../_exports';
import { makeMockLanguageModelReturningObject } from '../../_mocks/mockModel';
import type { ConversationStep, DatasetItem } from '../../_exports';

describe('Integration | Metrics | Completeness', () => {
	it('creates completeness metric', () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.5}');
		const metric = createCompletenessMetric({ provider: mockProvider });

		expect(metric).toBeDefined();
		expect(metric.name).toBe('completeness');
		expect(metric.valueType).toBe('number');
		expect(metric.scope).toBe('single');
	});

	it('executes completeness metric on DatasetItem', async () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.0}');
		const metric = createCompletenessMetric({ provider: mockProvider });

		const item: DatasetItem = {
			id: 'test-1',
			prompt: 'Explain the water cycle.',
			completion: 'The water cycle involves evaporation, condensation, and precipitation.',
		};

		const result = await runSingleTurnMetric(metric, item);

		expect(result).toBeDefined();
		expect(result.value).toBeGreaterThanOrEqual(0);
		expect(result.value).toBeLessThanOrEqual(5);
		expect(result.executionTime).toBeGreaterThanOrEqual(0);
	});

	it('executes completeness metric on ConversationStep', async () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.5}');
		const metric = createCompletenessMetric({ provider: mockProvider });

		const step: ConversationStep = {
			stepIndex: 0,
			input: { role: 'user', content: 'Explain the water cycle.' },
			output: {
				role: 'assistant',
				content: 'The water cycle involves evaporation, condensation, and precipitation.',
			},
		};

		const result = await runSingleTurnMetric(metric, step);

		expect(result).toBeDefined();
		expect(result.value).toBeGreaterThanOrEqual(0);
		expect(result.value).toBeLessThanOrEqual(5);
		expect(result.executionTime).toBeGreaterThanOrEqual(0);
	});

	it('creates completeness metric with expected points', () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.0}');
		const metric = createCompletenessMetric({
			provider: mockProvider,
			expectedPoints: ['evaporation', 'condensation', 'precipitation'],
		});

		expect(metric).toBeDefined();
		expect(metric.name).toBe('completeness');
	});
});

