/**
 * Order Rejection — HIL reject flow (Mastra)
 *
 * Validates that the trajectory orchestrator auto-rejects the `processOrder`
 * tool call and the agent communicates the rejection to the user.
 */

import { describe, it, expect } from 'vitest';
import { orderAgent } from '../../../src/mastra/agents/order-agent';
import { orderRejectTrajectory } from './definitions';
import { runCase, saveTallyReportToStore } from '../../utils/harness';
// Import mastra instance to ensure orderAgent is registered with storage
import '../../../src/mastra/index';
import {
	createTally,
	runAllTargets,
	defineBaseMetric,
	defineInput,
	defineSingleTurnEval,
	defineMultiTurnEval,
	defineScorerEval,
	thresholdVerdict,
	formatReportAsTables,
} from '@tally-evals/tally';
import {
	createAnswerRelevanceMetric,
	createRoleAdherenceMetric,
} from '@tally-evals/tally/metrics';
import { createWeightedAverageScorer } from '@tally-evals/tally/scorers';
import { google } from '@ai-sdk/google';

describe('Order Processing Agent — HIL Reject', () => {
	it('rejects a processOrder tool call and agent communicates the rejection', async () => {
		const { conversation, mode } = await runCase({
			trajectory: orderRejectTrajectory,
			agent: orderAgent,
			conversationId: 'order-reject',
			generateLogs: true,
		});

		expect(conversation.steps.length).toBeGreaterThan(0);

		// ---- Verify tools were invoked ----
		const allToolNames = new Set<string>();
		for (const step of conversation.steps) {
			for (const msg of step.output) {
				if (Array.isArray(msg.content)) {
					for (const part of msg.content as Array<{ type?: string; toolName?: string }>) {
						if (
							(part.type === 'tool-call' || part.type === 'tool-result') &&
							part.toolName
						) {
							allToolNames.add(part.toolName);
						}
					}
				}
			}
		}
		expect(allToolNames.has('searchProducts') || allToolNames.has('processOrder')).toBe(true);

		// ---- Verify agent mentioned rejection keywords ----
		const allAgentText = conversation.steps
			.flatMap((s) => s.output)
			.filter((m) => m.role === 'assistant')
			.map((m) => (typeof m.content === 'string' ? m.content : ''))
			.join(' ')
			.toLowerCase();

		const rejectKeywords = [
			'declined',
			'rejected',
			'denied',
			'unable',
			'could not',
			'cannot',
			'address',
			'verification',
			'unfortunately',
		];
		const hasRejection = rejectKeywords.some((kw) => allAgentText.includes(kw));
		expect(hasRejection).toBe(true);

		// ---- Tally evaluation (skipped in record mode) ----
		if (mode === 'record') {
			console.log(`✅ Recording complete: ${conversation.steps.length} steps`);
			return;
		}

		const model = google('models/gemini-2.5-flash-lite');

		const answerRelevance = createAnswerRelevanceMetric({ provider: model });
		const roleAdherence = createRoleAdherenceMetric({ provider: model });

		const overallQuality = defineBaseMetric<number>({
			name: 'overallQuality',
			valueType: 'number',
		});

		const qualityScorer = createWeightedAverageScorer({
			name: 'Overall Quality',
			output: overallQuality,
			inputs: [
				defineInput({ metric: answerRelevance, weight: 0.5 }),
				defineInput({ metric: roleAdherence, weight: 0.5 }),
			],
		});

		const answerRelevanceEval = defineSingleTurnEval({
			name: 'Answer Relevance',
			metric: answerRelevance,
		});

		const roleAdherenceEval = defineMultiTurnEval({
			name: 'Role Adherence',
			metric: roleAdherence,
		});

		const overallQualityEval = defineScorerEval({
			name: 'Overall Quality',
			scorer: qualityScorer,
			verdict: thresholdVerdict(0.5),
		});

		const tally = createTally({
			data: [conversation],
			evals: [answerRelevanceEval, roleAdherenceEval, overallQualityEval],
			context: runAllTargets(),
		});

		const report = await tally.run();
		formatReportAsTables(report.toArtifact(), conversation);

		await saveTallyReportToStore({
			conversationId: 'order-reject',
			report: report.toArtifact(),
		});

		expect(report).toBeDefined();
		expect(report.result.stepCount).toBeGreaterThan(0);
	}, 180000);
});
