/**
 * HIL handler — resolves pending tool calls using the configured strategy.
 *
 * Resolution priority (per tool call):
 *   1. Per-tool `handler` callback
 *   2. Global `handler` callback
 *   3. Per-tool `behavior` (approve / reject / llm)
 *   4. `defaultPolicy` (approve / reject / llm — defaults to 'llm')
 *
 * This handler produces a {@link HILDecisionMap} mapping each pending tool
 * call ID to its resolved decision. The *wrapper* is then responsible for
 * translating those decisions into the framework-specific resolution protocol
 * (e.g. AI SDK `tool-approval-response` messages, Mastra
 * `approveToolCallGenerate()`).
 */

import type { LanguageModel } from 'ai';
import type {
	HILToolCall,
	HILConfig,
	HILContext,
	HILDecision,
	HILInteraction,
} from './types.js';
import type { HILDecisionMap } from '../types.js';
import { generateHILDecision } from './prompt.js';

export interface HILResolutionResult {
	/** Decisions keyed by tool-call ID — passed to `AgentHandle.resolveHIL()` */
	decisions: HILDecisionMap;

	/** Interaction records for tracing */
	interactions: readonly HILInteraction[];
}

/**
 * Resolve an array of pending HIL tool calls according to the provided config.
 *
 * Returns a decision map and interaction records. The caller (orchestrator)
 * is responsible for forwarding the decisions to the agent wrapper via
 * `AgentHandle.resolveHIL()`.
 *
 * @param pending   - Unresolved tool calls detected by the framework wrapper
 * @param config    - The `HILConfig` from the trajectory definition
 * @param context   - Current trajectory context (persona, history, etc.)
 * @param model     - LLM to use when the strategy is `'llm'`
 * @returns Decision map and trace records
 */
export async function resolveHILCalls(
	pending: readonly HILToolCall[],
	config: HILConfig,
	context: HILContext,
	model: LanguageModel,
): Promise<HILResolutionResult> {
	const decisions: Map<string, HILDecision> = new Map();
	const interactions: HILInteraction[] = [];

	for (const call of pending) {
		const toolPolicy = config.tools?.[call.toolName];
		let decision: HILDecision;
		let method: HILInteraction['method'];

		// 1. Per-tool callback
		if (toolPolicy?.handler) {
			decision = await toolPolicy.handler(call, context);
			method = 'callback';
		}
		// 2. Global callback
		else if (config.handler) {
			decision = await config.handler(call, context);
			method = 'callback';
		}
		// 3. Per-tool behavior or defaultPolicy
		else {
			const behavior =
				toolPolicy?.behavior ?? config.defaultPolicy ?? 'llm';

			switch (behavior) {
				case 'approve':
					decision = {
						type: 'approve',
						result: toolPolicy?.approveResult,
					};
					method = 'default';
					break;

				case 'reject':
					decision = {
						type: 'reject',
						reason:
							toolPolicy?.rejectReason ??
							'Rejected by HIL policy',
					};
					method = 'default';
					break;

				case 'llm': {
					const guidance = toolPolicy?.guidance;
					decision = await generateHILDecision(
						call,
						context,
						guidance,
						model,
					);
					method = 'llm';
					break;
				}
			}
		}

		// Record the interaction
		interactions.push({
			toolCall: call,
			decision,
			method,
			timestamp: new Date(),
		});

		// Add to decision map
		decisions.set(call.toolCallId, decision);
	}

	return { decisions, interactions };
}
