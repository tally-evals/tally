/**
 * Refactored Travel Planner Debug Script using Trajectories
 */

import { config } from 'dotenv';
import { resolve, join } from 'node:path';
import { travelPlannerAgent } from '@tally/examples-ai-sdk';
import {
	createTrajectory,
	runTrajectory,
	withAISdkAgent,
	toConversation,
	toJSONL,
} from '@tally/trajectories';
import { travelPlannerTrajectory } from '../trajectories';
import { saveConversationsStepsJSONL } from '../utils/recorder';

// Load .env.local if it exists
config({ path: resolve(__dirname, '../../.env.local') });

const OUTPUT_DIR = join(__dirname, '../test/_fixtures/recorded');

async function main() {
	console.log('✈️  Travel Planner Agent Debug Script (Trajectory-based)\n');

	if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
		console.error('❌ Error: GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set');
		console.error('   Please set it in .env.local or export it before running this script');
		process.exit(1);
	}

	// Wrap the agent
	const agent = withAISdkAgent(travelPlannerAgent);

	// Create trajectory
	const trajectory = createTrajectory(travelPlannerTrajectory, agent);

	console.log('🚀 Running trajectory...');
	console.log(`   Goal: ${trajectory.goal}`);
	console.log(`   Mode: ${trajectory.mode}`);
	console.log(`   Steps: ${trajectory.steps?.length || 0}\n`);

	try {
		// Run trajectory (userModel is already in trajectory definition)
		const result = await runTrajectory(trajectory);

		console.log(`\n✅ Trajectory completed: ${result.completed ? 'SUCCESS' : 'INCOMPLETE'}`);
		console.log(`   Reason: ${result.reason}`);
		console.log(`   Total turns: ${result.steps.length}`);
		if (result.summary) {
			console.log(`   Summary: ${result.summary}`);
		}

		// Convert to Tally Conversation format
		const conversation = toConversation(result, 'travel-planner-trajectory');

		// Save conversation steps to JSONL file (one step per line)
		console.log('\n📦 Saving conversation steps...');
		saveConversationsStepsJSONL([conversation], join(OUTPUT_DIR, 'conversations/travelPlanner.jsonl'));
		console.log(`✅ Saved ${conversation.steps.length} conversation steps to travelPlanner.jsonl`);

		// Also save JSONL format from trajectory
		const jsonlLines = toJSONL(result);
		console.log(`✅ Generated ${jsonlLines.length} JSONL lines`);

		console.log('\n✨ Travel Planner Agent Debug Script completed!');
	} catch (error) {
		console.error('\n❌ Error running trajectory:', error);
		if (error instanceof Error) {
			console.error(`   ${error.message}`);
			console.error(`   ${error.stack}`);
		}
		process.exit(1);
	}
}

main().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});
