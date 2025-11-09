/**
 * Refactored Demand Letter Debug Script using Trajectories
 */

import { config } from 'dotenv';
import { resolve, join } from 'node:path';
import { demandLetterAgent } from '@tally/examples-ai-sdk';
import {
	createTrajectory,
	runTrajectory,
	withAISdkAgent,
	toConversation,
} from '@tally/trajectories';
import { demandLetterTrajectory } from '../trajectories';
import { saveConversationsJSONL } from '../utils/recorder';
import type { Conversation } from '../../src/index';

// Load .env.local if it exists
config({ path: resolve(__dirname, '../../.env.local') });

const OUTPUT_DIR = join(__dirname, '../test/_fixtures/recorded');

async function main() {
	console.log('📝 Demand Letter Agent Debug Script (Trajectory-based)\n');

	if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
		console.error('❌ Error: GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set');
		console.error('   Please set it in .env.local or export it before running this script');
		process.exit(1);
	}

	// Wrap the agent
	const agent = withAISdkAgent(demandLetterAgent);

	// Create trajectory
	const trajectory = createTrajectory(demandLetterTrajectory, agent);

	console.log('🚀 Running trajectory...');
	console.log(`   Goal: ${trajectory.goal}`);
	console.log(`   Mode: ${trajectory.mode}`);
	console.log(`   Steps: ${trajectory.steps?.length || 0}\n`);

	const allConversations: Conversation[] = [];

	// Run trajectory for each scenario
	const scenarios = [
		{
			...demandLetterTrajectory,
			goal: 'Create a demand letter for an unpaid invoice. The amount is $2,500 and it was due on March 15th. The recipient is ABC Company located at 123 Business St, New York, NY 10001.',
		},
		{
			...demandLetterTrajectory,
			goal: 'Help me draft a cease and desist letter. Someone is using my company name without permission. My company is XYZ Corp and I want them to stop immediately.',
		},
	];

	for (let i = 0; i < scenarios.length; i++) {
		const scenario = scenarios[i];
		console.log(`\n${'='.repeat(60)}`);
		console.log(`Scenario ${i + 1}: ${scenario.goal.substring(0, 80)}...`);
		console.log('='.repeat(60));

		try {
			// Create trajectory for this scenario
			const scenarioTrajectory = createTrajectory(scenario, agent);

			// Run trajectory (userModel is already in trajectory definition)
			const result = await runTrajectory(scenarioTrajectory);

			console.log(`✅ Trajectory completed: ${result.completed ? 'SUCCESS' : 'INCOMPLETE'}`);
			console.log(`   Reason: ${result.reason}`);
			console.log(`   Total turns: ${result.steps.length}`);

			// Convert to Tally Conversation format
			const conversation = toConversation(result, `demand-letter-${i + 1}`);
			conversation.metadata = {
				...(conversation.metadata || {}),
				scenario: 'demand-letter',
				promptIndex: i,
			};

			allConversations.push(conversation);
		} catch (error) {
			console.error('\n❌ Error:', error);
			if (error instanceof Error) {
				console.error(`   ${error.message}`);
				console.error(`   ${error.stack}`);
			}
		}
	}

	// Save all conversations to a single JSONL file
	if (allConversations.length > 0) {
		console.log('\n📦 Saving all conversations...');
		saveConversationsJSONL(allConversations, join(OUTPUT_DIR, 'conversations/demandLetter.jsonl'));
		console.log(`✅ Saved ${allConversations.length} conversations to demandLetter.jsonl`);
	}

	console.log('\n✨ Demand Letter Agent Debug Script completed!');
}

main().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});
