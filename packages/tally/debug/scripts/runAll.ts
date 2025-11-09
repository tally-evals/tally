/**
 * Refactored Debug Script Runner using Trajectories
 */

import { config } from 'dotenv';
import { resolve, join } from 'node:path';
import { travelPlannerAgent, demandLetterAgent } from '@tally-evals/examples-ai-sdk';
import {
	createTrajectory,
	runTrajectory,
	withAISdkAgent,
	toConversation,
} from '@tally-evals/trajectories';
import { travelPlannerTrajectory, demandLetterTrajectory } from '../trajectories';
import {
	convertConversationToDataset,
	saveConversationJSONL,
	saveDatasetJSONL,
	saveConversationFixture,
	saveDatasetFixture,
} from '../utils/recorder';
import type { Conversation } from '../../src/index';

// Load .env.local if it exists
config({ path: resolve(__dirname, '../../.env.local') });

const OUTPUT_DIR = join(__dirname, '../test/_fixtures/recorded');

async function runAll() {
	console.log('🚀 Starting All Debug Scripts (Trajectory-based)...\n');

	if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
		console.error('❌ Error: GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set');
		console.error('   Please set it in your .env.local file or export it before running this script');
		process.exit(1);
	}

	const travelAgent = withAISdkAgent(travelPlannerAgent);
	const demandAgent = withAISdkAgent(demandLetterAgent);

	const allConversations: Conversation[] = [];
	const allDatasets: Array<{ id: string; prompt: string; completion: string; metadata?: Record<string, unknown> }> = [];

	// Travel Planner scenarios
	const travelScenarios = [
		{
			...travelPlannerTrajectory,
			goal: 'Plan a trip from New York to San Francisco. I need flights for June 15th and a hotel for 3 nights starting that day. My budget is around $500 for flights.',
		},
		{
			...travelPlannerTrajectory,
			goal: 'Can you help me find a flight from LAX to Paris for July 1st? I also need accommodation for 3 nights. I prefer hotels over apartments.',
		},
	];

	// Demand Letter scenarios
	const demandScenarios = [
		{
			...demandLetterTrajectory,
			goal: 'Create a demand letter for an unpaid invoice. The amount is $2,500 and it was due on March 15th. The recipient is ABC Company located at 123 Business St, New York, NY 10001.',
		},
		{
			...demandLetterTrajectory,
			goal: 'Help me draft a cease and desist letter. Someone is using my company name without permission. My company is XYZ Corp and I want them to stop immediately.',
		},
	];

	// Run Travel Planner
	console.log('📋 Running Travel Planner Agent...\n');
	for (let i = 0; i < travelScenarios.length; i++) {
		const scenario = travelScenarios[i];
		console.log(`  Scenario ${i + 1}: "${scenario.goal.substring(0, 60)}..."`);

		try {
			const trajectory = createTrajectory(scenario, travelAgent);
			const result = await runTrajectory(trajectory);

			const conversation = toConversation(result, `travel-planner-${i + 1}`);
			conversation.metadata = {
				...(conversation.metadata || {}),
				scenario: 'travel-planner',
				promptIndex: i,
			};
			const dataset = convertConversationToDataset(conversation);

			allConversations.push(conversation);
			allDatasets.push(...dataset);

			const convId = `travel-planner-${i + 1}`;
			saveConversationJSONL(conversation, join(OUTPUT_DIR, `conversations/${convId}.jsonl`));
			saveDatasetJSONL(dataset, join(OUTPUT_DIR, `datasets/${convId}.jsonl`));

			console.log(`  ✅ Completed (${result.steps.length} turns)\n`);
		} catch (error) {
			console.error(`  ❌ Error:`, error instanceof Error ? error.message : error);
		}
	}

	// Run Demand Letter
	console.log('📋 Running Demand Letter Agent...\n');
	for (let i = 0; i < demandScenarios.length; i++) {
		const scenario = demandScenarios[i];
		console.log(`  Scenario ${i + 1}: "${scenario.goal.substring(0, 60)}..."`);

		try {
			const trajectory = createTrajectory(scenario, demandAgent);
			const result = await runTrajectory(trajectory);

			const conversation = toConversation(result, `demand-letter-${i + 1}`);
			conversation.metadata = {
				...(conversation.metadata || {}),
				scenario: 'demand-letter',
				promptIndex: i,
			};
			const dataset = convertConversationToDataset(conversation);

			allConversations.push(conversation);
			allDatasets.push(...dataset);

			const convId = `demand-letter-${i + 1}`;
			saveConversationJSONL(conversation, join(OUTPUT_DIR, `conversations/${convId}.jsonl`));
			saveDatasetJSONL(dataset, join(OUTPUT_DIR, `datasets/${convId}.jsonl`));

			console.log(`  ✅ Completed (${result.steps.length} turns)\n`);
		} catch (error) {
			console.error(`  ❌ Error:`, error instanceof Error ? error.message : error);
		}
	}

	// Save combined fixtures
	console.log('📦 Saving combined fixtures...');
	if (allConversations.length > 0) {
		const travelConvs = allConversations.filter((c) => c.metadata?.scenario === 'travel-planner');
		const demandConvs = allConversations.filter((c) => c.metadata?.scenario === 'demand-letter');

		if (travelConvs.length > 0) {
			saveConversationFixture(travelConvs[0], join(OUTPUT_DIR, 'travelPlannerConversation.ts'), 'travelPlannerConversation');
			const travelDataset = travelConvs.flatMap(convertConversationToDataset);
			saveDatasetFixture(travelDataset, join(OUTPUT_DIR, 'travelPlannerDataset.ts'), 'travelPlannerDataset');
		}

		if (demandConvs.length > 0) {
			saveConversationFixture(demandConvs[0], join(OUTPUT_DIR, 'demandLetterConversation.ts'), 'demandLetterConversation');
			const demandDataset = demandConvs.flatMap(convertConversationToDataset);
			saveDatasetFixture(demandDataset, join(OUTPUT_DIR, 'demandLetterDataset.ts'), 'demandLetterDataset');
		}

		console.log('  ✅ Saved TypeScript fixtures');
	}

	console.log('\n✨ All Debug Scripts completed!');
	console.log(`   Generated ${allConversations.length} conversations`);
	console.log(`   Generated ${allDatasets.length} dataset items`);
}

runAll().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});
