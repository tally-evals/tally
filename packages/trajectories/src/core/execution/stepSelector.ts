/**
 * Step selection logic for trajectory execution
 */

import type { Trajectory, TrajectoryStep } from '../types.js';
import type { ModelMessage, LanguageModel } from 'ai';
import { matchStepToAgentQuestion, extractLastAssistantMessage } from './stepMatcher.js';
import type { StepMatchResult } from './stepMatcher.js';

export interface StepSelectionResult {
	stepToUse: TrajectoryStep | undefined;
	stepIndexToUse: number;
	matchResult?: StepMatchResult;
}

/**
 * Determine which step to use for user message generation
 */
export async function determineStep(
	trajectory: Trajectory,
	turnIndex: number,
	currentStepIndex: number,
	history: readonly ModelMessage[],
	userModel: LanguageModel,
	generateLogs: boolean
): Promise<StepSelectionResult> {
	let stepToUse: TrajectoryStep | undefined;
	let stepIndexToUse = currentStepIndex;
	let matchResult: StepMatchResult | undefined;

	if (generateLogs) {
		console.log(
			`\n🔍 [DEBUG] Turn ${turnIndex}, mode: ${trajectory.mode}, history length: ${history.length}, currentStepIndex: ${currentStepIndex}`
		);
	}

	// In loose mode, after the first turn, try to match agent's question to a step
	if (trajectory.mode === 'loose' && turnIndex > 0 && history.length > 0) {
		const agentMessage = extractLastAssistantMessage(history);
		if (agentMessage) {
			if (generateLogs) {
				console.log(`\n🔍 [DEBUG] Attempting step match for Turn ${turnIndex}`);
				console.log(
					`🔍 [DEBUG] Agent message: "${agentMessage.substring(0, 100)}${agentMessage.length > 100 ? '...' : ''}"`
				);
			}

			matchResult = await matchStepToAgentQuestion(agentMessage, trajectory, userModel);

			if (generateLogs) {
				if (matchResult.matchedStepIndex !== null) {
					console.log(
						`\n🔍 [DEBUG] ✅ Step matched: ${matchResult.matchedStepIndex} - ${matchResult.reasoning}`
					);
				} else {
					console.log(
						`\n🔍 [DEBUG] ❌ No step matched - ${matchResult.reasoning}. Generating natural response based on persona.`
					);
				}
			}

			// If we found a match, use that step
			if (matchResult.matchedStepIndex !== null && matchResult.matchedStep) {
				stepToUse = matchResult.matchedStep;
				stepIndexToUse = matchResult.matchedStepIndex;
			}
		} else if (generateLogs) {
			console.log('\n🔍 [DEBUG] No agent message found in history for step matching');
		}
	}

	// In strict mode, or if no match in loose mode and we're not past first turn, use sequential step
	// In loose mode after first turn with no match, stepToUse stays undefined for natural response
	if (!stepToUse && (trajectory.mode === 'strict' || turnIndex === 0)) {
		stepToUse =
			trajectory.steps && currentStepIndex < trajectory.steps.length
				? trajectory.steps[currentStepIndex]
				: undefined;
		stepIndexToUse = currentStepIndex;
		if (generateLogs && stepToUse) {
			console.log(
				`\n🔍 [DEBUG] Using sequential step ${currentStepIndex}: "${stepToUse.instruction}"`
			);
		}
	} else if (!stepToUse && generateLogs) {
		console.log('\n🔍 [DEBUG] No step to use - will generate natural response based on persona');
	}

	return {
		stepToUse,
		stepIndexToUse,
		...(matchResult !== undefined && { matchResult }),
	};
}

