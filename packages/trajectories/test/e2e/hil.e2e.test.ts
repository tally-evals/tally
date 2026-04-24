/**
 * E2E Tests for Human-in-the-Loop (HIL) handling in Trajectories
 *
 * Validates the full HIL flow with a real LLM and a tool that has
 * `needsApproval: true` (AI SDK v6).  No mocks — the agent is driven by
 * an actual model call; the approval/rejection is handled by Tally's
 * trajectory orchestrator according to the trajectory's `hil` config.
 *
 * Requires:
 * - GOOGLE_GENERATIVE_AI_API_KEY environment variable
 * - Set E2E_TRAJECTORIES=1 to run (or run in CI)
 *
 * Run with: bun run --filter=@tally-evals/trajectories test:e2e hil
 */

import { describe, it, expect } from 'bun:test';
import { google } from '@ai-sdk/google';
import { ToolLoopAgent as Agent, stepCountIs, tool } from 'ai';
import { z } from 'zod';
import { z as z4 } from 'zod/v4';
import { Agent as MastraAgent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { LibSQLStore } from '@mastra/libsql';
import {
	createTrajectory,
	runTrajectory,
	withAISdkAgent,
	withMastraAgent,
	toConversation,
} from '../../src/index.js';
import { shouldRunE2E } from './setup.js';

// ============================================================================
// Agent setup
// ============================================================================

/**
 * A tool that requires human approval before it executes.
 * The agent is instructed to call this whenever the user asks it to
 * "confirm" or "process" something.
 */
const confirmAction = tool({
	description:
		'Confirm and execute a user-requested action. Always call this tool when the user asks you to confirm, process, or execute something. This requires approval before it runs.',
	inputSchema: z.object({
		action: z.string().describe('A short description of the action to confirm'),
		details: z.string().optional().describe('Additional details about the action'),
	}),
	// ⭐ Real AI SDK v6 HIL flag — triggers tool-approval-request in the response
	needsApproval: true,
	execute: async ({ action, details }) => ({
		status: 'completed',
		action,
		details: details ?? '',
		executedAt: new Date().toISOString(),
	}),
});

const hilAgent = new Agent({
	model: google('models/gemini-2.5-flash-lite'),
	tools: { confirmAction },
	stopWhen: stepCountIs(8),
	instructions: `You are a helpful assistant that processes user requests.

When the user asks you to confirm, process, or execute an action, you MUST call the confirmAction tool.
Always call the tool — never tell the user you will do something without actually calling the tool first.
After the tool result is returned, summarise what happened in one short sentence.`,
});

// ============================================================================
// Mastra Agent Setup
// ============================================================================

/**
 * Mastra `confirmAction` tool with `requireApproval: true` — Mastra's native
 * per-tool flag that causes the agent to suspend before executing it.
 */
const mastraConfirmAction = createTool({
	id: 'confirmAction',
	description:
		'Confirm and execute a user-requested action. Always call this tool when the user asks you to confirm, process, or execute something. This requires approval before it runs.',
	inputSchema: z4.object({
		action: z4.string().describe('A short description of the action to confirm'),
		details: z4.string().optional().describe('Additional details about the action'),
	}),
	outputSchema: z4.object({
		status: z4.string(),
		action: z4.string(),
		details: z4.string(),
		executedAt: z4.string(),
	}),
	// ⭐ Mastra's per-tool HIL flag — triggers suspension before executing
	requireApproval: true,
	execute: async (inputData) => ({
		status: 'completed',
		action: inputData.action,
		details: inputData.details ?? '',
		executedAt: new Date().toISOString(),
	}),
});

const mastraHILAgent = new MastraAgent({
	id: 'hil-test-agent',
	name: 'HIL Test Agent',
	instructions: `You are a helpful assistant that processes user requests.

When the user asks you to confirm, process, or execute an action, you MUST call the confirmAction tool.
Always call the tool — never tell the user you will do something without actually calling the tool first.
After the tool result is returned, summarise what happened in one short sentence.`,
	model: 'google/gemini-2.5-flash-lite',
	tools: { confirmAction: mastraConfirmAction },
});

/**
 * Register the agent with a Mastra instance that has in-memory LibSQL storage.
 *
 * `approveToolCall` / `declineToolCall` call `_resume()` internally, which
 * calls `mastra.getStorage().loadWorkflowSnapshot(runId)` to reload the
 * suspended workflow state.  Without a configured storage backend they throw
 * "No snapshot found for this workflow run".
 *
 * Using `:memory:` means each test process gets a fresh isolated store —
 * no cleanup required between tests.
 */
const _mastraInstance = new Mastra({
	storage: new LibSQLStore({ id: 'hil-test-storage', url: ':memory:' }),
	agents: { 'HIL Test Agent': mastraHILAgent },
});

// ============================================================================
// Helpers
// ============================================================================

/** Extract all tool names from a TrajectoryResult's agentMessages */
function collectToolNames(result: {
	steps: readonly {
		agentMessages: readonly { role: string; content?: unknown }[];
		hilInteractions?: readonly { toolCall?: { toolName?: string } }[];
	}[];
}): Set<string> {
	const names = new Set<string>();
	for (const step of result.steps) {
		// Check agentMessages for tool-call parts and tool-result parts
		for (const msg of step.agentMessages) {
			if (!Array.isArray(msg.content)) continue;
			for (const part of msg.content as { type?: string; toolName?: string }[]) {
				const t = part.type;
				if (
					(t === 'tool-call' || t === 'tool-approval-request' || t === 'tool-result') &&
					part.toolName
				) {
					names.add(part.toolName);
				}
			}
		}
		// Also check hilInteractions (recorded by orchestrator)
		for (const interaction of step.hilInteractions ?? []) {
			const name = interaction.toolCall?.toolName;
			if (name) names.add(name);
		}
	}
	return names;
}

/** Collect all recorded HIL interactions across all steps */
function collectHILInteractions(result: {
	steps: readonly {
		hilInteractions?: readonly {
			toolCall: { toolName: string; toolCallId: string; args: unknown };
			decision: { type: string };
			method: string;
		}[];
	}[];
}) {
	return result.steps.flatMap((s) => s.hilInteractions ?? []);
}

// ============================================================================
// Tests
// ============================================================================

const describeE2E = shouldRunE2E ? describe : describe.skip;

describeE2E('HIL E2E Tests', () => {
	const userModel = google('models/gemini-2.5-flash-lite');

	// --------------------------------------------------------------------------
	// Approval flow
	// --------------------------------------------------------------------------

	describe('AI SDK Agent — HIL Approval', () => {
		it('approves a needsApproval tool call and returns the tool result to the agent', async () => {
			const agent = withAISdkAgent(hilAgent);

			const trajectory = createTrajectory(
				{
					goal: 'Process a user action with human approval',
					persona: {
						description:
							'Ask the agent to confirm processing an order for "10 units of widget-A". Keep asking until it is confirmed.',
					},
					steps: {
						steps: [
							{
								id: 'step-0',
								instruction:
									'Ask the agent to confirm and process an order for "10 units of widget-A"',
							},
						],
						start: 'step-0',
						terminals: ['step-0'],
					},
					maxTurns: 5,
					conversationId: 'e2e-hil-approve',
					userModel,
					// ⭐ HIL config: auto-approve confirmAction with a fixed result
					hil: {
						tools: {
							confirmAction: {
								behavior: 'approve',
								approveResult: {
									status: 'completed',
									action: 'Process order: 10 units of widget-A',
									details: 'Order approved and queued for fulfilment',
									executedAt: new Date().toISOString(),
								},
							},
						},
						defaultPolicy: 'approve',
					},
				},
				agent,
			);

			const result = await runTrajectory(trajectory, { generateLogs: true });

			expect(result.steps.length).toBeGreaterThanOrEqual(1);

			// ---- Tool call verification ----
			const toolNames = collectToolNames(result);
			expect(toolNames.has('confirmAction')).toBe(true);

			// ---- HIL interaction recording ----
			const hilInteractions = collectHILInteractions(result);
			expect(hilInteractions.length).toBeGreaterThanOrEqual(1);

			const approveInteraction = hilInteractions.find((i) => i.decision.type === 'approve');
			expect(approveInteraction).toBeDefined();
			expect(approveInteraction!.toolCall.toolName).toBe('confirmAction');
			expect(approveInteraction!.method).toBe('default');

			// ---- Agent communicated success ----
			const allAssistantText = result.steps
				.flatMap((s) => s.agentMessages)
				.filter((m) => m.role === 'assistant')
				.flatMap((m) => {
					if (!Array.isArray(m.content)) return [String(m.content ?? '')];
					return (m.content as { type?: string; text?: string }[])
						.filter((p) => p.type === 'text')
						.map((p) => p.text ?? '');
				})
				.join(' ')
				.toLowerCase();

			console.log('\n💬 Agent text (approval):', allAssistantText.slice(0, 300));

			// The agent should have communicated something about the action being done
			const communicated =
				allAssistantText.includes('order') ||
				allAssistantText.includes('confirm') ||
				allAssistantText.includes('process') ||
				allAssistantText.includes('complet') ||
				allAssistantText.includes('widget');

			expect(communicated).toBe(true);
		}, 90_000);

		it('records hilInteractions in the step trace when HIL is resolved', async () => {
			const agent = withAISdkAgent(hilAgent);

			const trajectory = createTrajectory(
				{
					goal: 'Trigger and approve a HIL interaction, verify it is traced',
					persona: {
						description:
							'Ask the agent to confirm sending a report to "reports@example.com".',
					},
					steps: {
						steps: [
							{
								id: 'step-0',
								instruction: 'Ask the agent to confirm sending a report to reports@example.com',
							},
						],
						start: 'step-0',
						terminals: ['step-0'],
					},
					maxTurns: 5,
					conversationId: 'e2e-hil-trace',
					userModel,
					hil: {
						defaultPolicy: 'approve',
					},
				},
				agent,
			);

			const result = await runTrajectory(trajectory, { generateLogs: true });

			// At least one step must have hilInteractions recorded
			const stepWithHIL = result.steps.find(
				(s) => s.hilInteractions && s.hilInteractions.length > 0,
			);
			expect(stepWithHIL).toBeDefined();

			const interaction = stepWithHIL!.hilInteractions![0]!;
			expect(interaction.toolCall.toolName).toBe('confirmAction');
			expect(interaction.decision.type).toBe('approve');

			// The HIL call ID should match the tool call ID
			expect(typeof interaction.toolCall.toolCallId).toBe('string');
			expect(interaction.toolCall.toolCallId.length).toBeGreaterThan(0);
		}, 90_000);
	});

	// --------------------------------------------------------------------------
	// Rejection flow
	// --------------------------------------------------------------------------

	describe('AI SDK Agent — HIL Rejection', () => {
		it('rejects a needsApproval tool call and the agent handles the rejection', async () => {
			const agent = withAISdkAgent(hilAgent);

			const trajectory = createTrajectory(
				{
					goal: 'Attempt to process an action that will be rejected by the approval system',
					persona: {
						description:
							'Ask the agent to confirm deleting all records from the database. Accept whatever outcome the agent reports.',
					},
					steps: {
						steps: [
							{
								id: 'step-0',
								instruction:
									'Ask the agent to confirm deleting all records from the database',
							},
						],
						start: 'step-0',
						terminals: ['step-0'],
					},
					maxTurns: 5,
					conversationId: 'e2e-hil-reject',
					userModel,
					// ⭐ HIL config: reject confirmAction
					hil: {
						tools: {
							confirmAction: {
								behavior: 'reject',
								rejectReason:
									'This action requires supervisor sign-off. Please contact your manager.',
							},
						},
						defaultPolicy: 'reject',
					},
				},
				agent,
			);

			const result = await runTrajectory(trajectory, { generateLogs: true });

			expect(result.steps.length).toBeGreaterThanOrEqual(1);

			// ---- Tool call attempted ----
			const toolNames = collectToolNames(result);
			expect(toolNames.has('confirmAction')).toBe(true);

			// ---- HIL rejection recorded ----
			const hilInteractions = collectHILInteractions(result);
			expect(hilInteractions.length).toBeGreaterThanOrEqual(1);

			const rejectInteraction = hilInteractions.find((i) => i.decision.type === 'reject');
			expect(rejectInteraction).toBeDefined();
			expect(rejectInteraction!.toolCall.toolName).toBe('confirmAction');
			expect(rejectInteraction!.method).toBe('default');

			// ---- Agent communicated the rejection ----
			const allAssistantText = result.steps
				.flatMap((s) => s.agentMessages)
				.filter((m) => m.role === 'assistant')
				.flatMap((m) => {
					if (!Array.isArray(m.content)) return [String(m.content ?? '')];
					return (m.content as { type?: string; text?: string }[])
						.filter((p) => p.type === 'text')
						.map((p) => p.text ?? '');
				})
				.join(' ')
				.toLowerCase();

			console.log('\n💬 Agent text (rejection):', allAssistantText.slice(0, 300));

			// The agent should have relayed that the action did not go through
			const communicatedRejection =
				allAssistantText.length === 0 ||
				allAssistantText.includes('unable') ||
				allAssistantText.includes('not able') ||
				allAssistantText.includes('cannot') ||
				allAssistantText.includes("can't") ||
				allAssistantText.includes('declined') ||
				allAssistantText.includes('denied') ||
				allAssistantText.includes('not approved') ||
				allAssistantText.includes('sorry') ||
				allAssistantText.includes('unfortunately') ||
				allAssistantText.includes('failed') ||
				allAssistantText.includes('could not') ||
				allAssistantText.includes("couldn't") ||
				allAssistantText.includes('supervisor') ||
				allAssistantText.includes('manager') ||
				allAssistantText.includes('not processed');

			expect(communicatedRejection).toBe(true);
		}, 90_000);
	});

	// --------------------------------------------------------------------------
	// Conversation format
	// --------------------------------------------------------------------------

	describe('AI SDK Agent — HIL in Conversation format', () => {
		it('preserves HIL tool-result messages in toConversation output', async () => {
			const agent = withAISdkAgent(hilAgent);

			const trajectory = createTrajectory(
				{
					goal: 'Verify HIL tool results appear in the conversation format',
					persona: {
						description: 'Ask the agent to confirm processing a refund for order #ORD-999.',
					},
					steps: {
						steps: [
							{
								id: 'step-0',
								instruction: 'Ask the agent to confirm processing a refund for order #ORD-999',
							},
						],
						start: 'step-0',
						terminals: ['step-0'],
					},
					maxTurns: 5,
					conversationId: 'e2e-hil-conversation',
					userModel,
					hil: {
						defaultPolicy: 'approve',
					},
				},
				agent,
			);

			const result = await runTrajectory(trajectory, { generateLogs: true });
			const conversation = toConversation(result, 'e2e-hil-conversation');

			expect(conversation.steps.length).toBeGreaterThan(0);

			// The conversation output should include a tool-result for confirmAction
			// (stored in a role:'tool' message after the HIL round-trip completes)
			let hasConfirmActionResult = false;
			for (const step of conversation.steps) {
				for (const msg of step.output) {
					if (msg.role !== 'tool') continue;
					if (!Array.isArray(msg.content)) continue;
					for (const part of msg.content as { type?: string; toolName?: string }[]) {
						if (part.type === 'tool-result' && part.toolName === 'confirmAction') {
							hasConfirmActionResult = true;
						}
					}
				}
			}

			expect(hasConfirmActionResult).toBe(true);
		}, 90_000);
	});

	// --------------------------------------------------------------------------
	// Callback handler
	// --------------------------------------------------------------------------

	describe('AI SDK Agent — HIL callback handler', () => {
		it('invokes the per-tool callback handler with correct context', async () => {
			const callbackInvocations: { toolName: string; args: unknown }[] = [];

			const agent = withAISdkAgent(hilAgent);

			const trajectory = createTrajectory(
				{
					goal: 'Trigger a HIL approval via a callback handler',
					persona: {
						description: 'Ask the agent to confirm sending a notification to the team.',
					},
					steps: {
						steps: [
							{
								id: 'step-0',
								instruction: 'Ask the agent to confirm sending a notification to the team',
							},
						],
						start: 'step-0',
						terminals: ['step-0'],
					},
					maxTurns: 5,
					conversationId: 'e2e-hil-callback',
					userModel,
					// ⭐ Per-tool callback handler — records invocations
					hil: {
						tools: {
							confirmAction: {
								behavior: 'approve', // fallback (handler takes precedence)
								handler: async (call, ctx) => {
									callbackInvocations.push({
										toolName: call.toolName,
										args: call.args,
									});
									// The callback has full context
									expect(ctx.goal).toContain('callback handler');
									expect(ctx.persona).toBeDefined();
									expect(Array.isArray(ctx.history)).toBe(true);
									return {
										type: 'approve' as const,
										result: {
											status: 'completed',
											action: 'Send notification',
											details: 'Approved via callback',
										},
									};
								},
							},
						},
					},
				},
				agent,
			);

			const result = await runTrajectory(trajectory, { generateLogs: true });

			expect(result.steps.length).toBeGreaterThanOrEqual(1);

			// Callback must have been called at least once
			expect(callbackInvocations.length).toBeGreaterThanOrEqual(1);
			expect(callbackInvocations[0]!.toolName).toBe('confirmAction');

			// HIL interaction should show method: 'callback'
			const hilInteractions = collectHILInteractions(result);
			const callbackInteraction = hilInteractions.find((i) => i.method === 'callback');
			expect(callbackInteraction).toBeDefined();
		}, 90_000);
	});

	// --------------------------------------------------------------------------
	// Mastra Agent — HIL Approval
	// --------------------------------------------------------------------------

	describe('Mastra Agent — HIL Approval', () => {
		it('approves a requireApproval tool call and the agent continues', async () => {
			const agent = withMastraAgent(mastraHILAgent as Parameters<typeof withMastraAgent>[0]);

			const trajectory = createTrajectory(
				{
					goal: 'Process a user action with human approval (Mastra)',
					persona: {
						description:
							'Ask the agent to confirm processing an order for "5 units of gadget-B".',
					},
					steps: {
						steps: [
							{
								id: 'step-0',
								instruction:
									'Ask the agent to confirm and process an order for "5 units of gadget-B"',
							},
						],
						start: 'step-0',
						terminals: ['step-0'],
					},
					maxTurns: 5,
					conversationId: 'e2e-mastra-hil-approve',
					userModel,
					// ⭐ Trajectory config: approve confirmAction automatically
					hil: {
						tools: {
							confirmAction: {
								behavior: 'approve',
								approveResult: {
									status: 'completed',
									action: 'Process order: 5 units of gadget-B',
									details: 'Order approved and queued for fulfilment',
									executedAt: new Date().toISOString(),
								},
							},
						},
						defaultPolicy: 'approve',
					},
				},
				agent,
			);

			const result = await runTrajectory(trajectory, { generateLogs: true });

			expect(result.steps.length).toBeGreaterThanOrEqual(1);

			// ---- HIL interaction recorded ----
			const hilInteractions = collectHILInteractions(result);
			expect(hilInteractions.length).toBeGreaterThanOrEqual(1);

			const approveInteraction = hilInteractions.find(
				(i) => i.decision.type === 'approve',
			);
			expect(approveInteraction).toBeDefined();
			expect(approveInteraction!.toolCall.toolName).toBe('confirmAction');

			// ---- Agent communicated success ----
			const allAssistantText = result.steps
				.flatMap((s) => s.agentMessages)
				.filter((m) => m.role === 'assistant')
				.flatMap((m) => {
					if (!Array.isArray(m.content)) return [String(m.content ?? '')];
					return (m.content as { type?: string; text?: string }[])
						.filter((p) => p.type === 'text')
						.map((p) => p.text ?? '');
				})
				.join(' ')
				.toLowerCase();

			console.log('\n💬 [Mastra] Agent text (approval):', allAssistantText.slice(0, 300));

			const communicated =
				allAssistantText.includes('order') ||
				allAssistantText.includes('confirm') ||
				allAssistantText.includes('process') ||
				allAssistantText.includes('complet') ||
				allAssistantText.includes('gadget');

			expect(communicated).toBe(true);
		}, 90_000);

		it('records hilInteractions in the step trace (Mastra)', async () => {
			const agent = withMastraAgent(mastraHILAgent as Parameters<typeof withMastraAgent>[0]);

			const trajectory = createTrajectory(
				{
					goal: 'Verify Mastra HIL is recorded in step traces',
					persona: {
						description: 'Ask the agent to confirm dispatching a payment for invoice #INV-42.',
					},
					steps: {
						steps: [
							{
								id: 'step-0',
								instruction:
									'Ask the agent to confirm dispatching a payment for invoice #INV-42',
							},
						],
						start: 'step-0',
						terminals: ['step-0'],
					},
					maxTurns: 5,
					conversationId: 'e2e-mastra-hil-trace',
					userModel,
					hil: { defaultPolicy: 'approve' },
				},
				agent,
			);

			const result = await runTrajectory(trajectory, { generateLogs: true });

			const stepWithHIL = result.steps.find(
				(s) => s.hilInteractions && s.hilInteractions.length > 0,
			);
			expect(stepWithHIL).toBeDefined();

			const interaction = stepWithHIL!.hilInteractions![0]!;
			expect(interaction.toolCall.toolName).toBe('confirmAction');
			expect(interaction.decision.type).toBe('approve');
			expect(typeof interaction.toolCall.toolCallId).toBe('string');
			expect(interaction.toolCall.toolCallId.length).toBeGreaterThan(0);
		}, 90_000);
	});

	// --------------------------------------------------------------------------
	// Mastra Agent — HIL Rejection
	// --------------------------------------------------------------------------

	describe('Mastra Agent — HIL Rejection', () => {
		it('rejects a requireApproval tool call and the agent handles the rejection', async () => {
			const agent = withMastraAgent(mastraHILAgent as Parameters<typeof withMastraAgent>[0]);

			const trajectory = createTrajectory(
				{
					goal: 'Attempt a destructive action that will be rejected (Mastra)',
					persona: {
						description:
							'Ask the agent to confirm wiping the staging environment. Accept whatever outcome the agent reports.',
					},
					steps: {
						steps: [
							{
								id: 'step-0',
								instruction: 'Ask the agent to confirm wiping the staging environment',
							},
						],
						start: 'step-0',
						terminals: ['step-0'],
					},
					maxTurns: 5,
					conversationId: 'e2e-mastra-hil-reject',
					userModel,
					// ⭐ Trajectory config: reject confirmAction
					hil: {
						tools: {
							confirmAction: {
								behavior: 'reject',
								rejectReason:
									'This action requires change-management approval. Please raise a ticket.',
							},
						},
						defaultPolicy: 'reject',
					},
				},
				agent,
			);

			const result = await runTrajectory(trajectory, { generateLogs: true });

			expect(result.steps.length).toBeGreaterThanOrEqual(1);

			// ---- HIL rejection recorded ----
			const hilInteractions = collectHILInteractions(result);
			expect(hilInteractions.length).toBeGreaterThanOrEqual(1);

			const rejectInteraction = hilInteractions.find(
				(i) => i.decision.type === 'reject',
			);
			expect(rejectInteraction).toBeDefined();
			expect(rejectInteraction!.toolCall.toolName).toBe('confirmAction');

			// ---- Agent communicated the rejection ----
			const allAssistantText = result.steps
				.flatMap((s) => s.agentMessages)
				.filter((m) => m.role === 'assistant')
				.flatMap((m) => {
					if (!Array.isArray(m.content)) return [String(m.content ?? '')];
					return (m.content as { type?: string; text?: string }[])
						.filter((p) => p.type === 'text')
						.map((p) => p.text ?? '');
				})
				.join(' ')
				.toLowerCase();

			console.log('\n💬 [Mastra] Agent text (rejection):', allAssistantText.slice(0, 300));

			// Mastra should relay that the action was not approved
			const communicatedRejection =
				allAssistantText.includes('unable') ||
				allAssistantText.includes('not able') ||
				allAssistantText.includes('cannot') ||
				allAssistantText.includes("can't") ||
				allAssistantText.includes('declined') ||
				allAssistantText.includes('denied') ||
				allAssistantText.includes('not approved') ||
				allAssistantText.includes('sorry') ||
				allAssistantText.includes('unfortunately') ||
				allAssistantText.includes('failed') ||
				allAssistantText.includes('not processed') ||
				allAssistantText.includes('ticket') ||
				allAssistantText.includes('change') ||
				allAssistantText.includes('not be');

			expect(communicatedRejection).toBe(true);
		}, 90_000);
	});
});
