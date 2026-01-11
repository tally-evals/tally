import { describe, it, expect } from 'bun:test';
import {
	createRoleAdherenceMetric,
	runMultiTurnMetric,
} from '../../_exports';
import { makeMockLanguageModelReturningObject } from '../../_mocks/mockModel';
import { conversationExampleA, conversationExampleB } from '../../_fixtures/conversation.examples';
import type { Conversation } from '../../_exports';

describe('Integration | Metrics | Role Adherence', () => {
	it('creates role adherence metric', () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.5}');
		const metric = createRoleAdherenceMetric({
			expectedRole: 'friendly customer service agent',
			provider: mockProvider,
		});

		expect(metric).toBeDefined();
		expect(metric.name).toBe('roleAdherence');
		expect(metric.valueType).toBe('number');
		expect(metric.scope).toBe('multi');
	});

	it('executes role adherence metric on conversation', async () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.0}');
		const metric = createRoleAdherenceMetric({
			expectedRole: 'helpful assistant',
			provider: mockProvider,
		});

		const result = await runMultiTurnMetric(metric, conversationExampleA);

		expect(result).toBeDefined();
		expect(result.value).toBeGreaterThanOrEqual(0);
		expect(result.value).toBeLessThanOrEqual(5);
		expect(result.executionTime).toBeGreaterThanOrEqual(0);
	});

	it('executes role adherence metric with consistency checking enabled', async () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.5}');
		const metric = createRoleAdherenceMetric({
			expectedRole: 'friendly assistant',
			provider: mockProvider,
			checkConsistency: true,
		});

		const result = await runMultiTurnMetric(metric, conversationExampleB);

		expect(result).toBeDefined();
		expect(result.value).toBeGreaterThanOrEqual(0);
		expect(result.value).toBeLessThanOrEqual(5);
		expect(result.executionTime).toBeGreaterThanOrEqual(0);
	});

	it('executes role adherence metric with consistency checking disabled', async () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 3.5}');
		const metric = createRoleAdherenceMetric({
			expectedRole: 'technical expert',
			provider: mockProvider,
			checkConsistency: false,
		});

		const result = await runMultiTurnMetric(metric, conversationExampleA);

		expect(result).toBeDefined();
		expect(result.value).toBeGreaterThanOrEqual(0);
		expect(result.value).toBeLessThanOrEqual(5);
	});

	it('creates role adherence metric with different role descriptions', () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 5}');
		
		const metric1 = createRoleAdherenceMetric({
			expectedRole: 'friendly customer service agent',
			provider: mockProvider,
		});
		expect(metric1).toBeDefined();

		const metric2 = createRoleAdherenceMetric({
			expectedRole: 'technical expert who explains complex concepts simply',
			provider: mockProvider,
		});
		expect(metric2).toBeDefined();

		const metric3 = createRoleAdherenceMetric({
			expectedRole: 'professional business consultant',
			provider: mockProvider,
		});
		expect(metric3).toBeDefined();
	});

	it('executes role adherence metric on conversation with multiple steps', async () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.2}');
		const metric = createRoleAdherenceMetric({
			expectedRole: 'helpful and concise assistant',
			provider: mockProvider,
			checkConsistency: true,
		});

		// Test with conversationExampleB which has 3 steps
		const result = await runMultiTurnMetric(metric, conversationExampleB);

		expect(result).toBeDefined();
		expect(result.value).toBeGreaterThanOrEqual(0);
		expect(result.value).toBeLessThanOrEqual(5);
		expect(result.executionTime).toBeGreaterThanOrEqual(0);
	});

	it('role adherence metric includes expectedRole in metadata', () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.0}');
		const expectedRole = 'friendly customer service agent';
		const metric = createRoleAdherenceMetric({
			expectedRole,
			provider: mockProvider,
		});

		expect(metric.metadata).toBeDefined();
		expect(metric.metadata?.expectedRole).toBe(expectedRole);
		expect(metric.metadata?.checkConsistency).toBe(true); // default value
	});
});

