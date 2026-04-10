/**
 * Unit tests for framework-specific HIL detection in agent wrappers
 *
 * Detection is now handled by each wrapper using the framework's native
 * signalling mechanism rather than a generic message scanner.
 */

import { describe, it, expect } from 'bun:test';
import { withAISdkAgent, withMastraAgent } from '../../../src/wrappers/index';
import type { ModelMessage } from 'ai';

// ---------------------------------------------------------------------------
// AI SDK wrapper detection
// ---------------------------------------------------------------------------

describe('withAISdkAgent HIL detection', () => {
	it('returns empty pendingToolCalls when no approval requests', async () => {
		const mockAgent = {
			generate: async () => ({
				response: {
					messages: [
						{ role: 'assistant' as const, content: 'Hello!' },
					],
				},
				content: [{ type: 'text', text: 'Hello!' }],
			}),
		};
		const handle = withAISdkAgent(mockAgent);
		const result = await handle.respond([
			{ role: 'user', content: 'Hi' },
		]);

		expect(result.pendingToolCalls).toEqual([]);
	});

	it('detects tool-approval-request parts in result.content', async () => {
		const mockAgent = {
			generate: async () => ({
				response: {
					messages: [
						{
							role: 'assistant' as const,
							content: [
								{ type: 'text', text: 'I need to confirm...' },
							],
						},
					],
				},
				content: [
					{ type: 'text', text: 'I need to confirm...' },
					{
						type: 'tool-approval-request',
						approvalId: 'approval-1',
						toolCall: {
							toolCallId: 'call-1',
							toolName: 'bookFlight',
							input: { flightId: 'FL-123' },
						},
					},
				],
			}),
		};
		const handle = withAISdkAgent(mockAgent);
		const result = await handle.respond([
			{ role: 'user', content: 'Book a flight' },
		]);

		expect(result.pendingToolCalls).toHaveLength(1);
		expect(result.pendingToolCalls[0]).toEqual({
			toolCallId: 'approval-1',
			toolName: 'bookFlight',
			args: { flightId: 'FL-123' },
		});
	});

	it('detects multiple tool-approval-request parts', async () => {
		const mockAgent = {
			generate: async () => ({
				response: {
					messages: [{ role: 'assistant' as const, content: 'Confirming...' }],
				},
				content: [
					{
						type: 'tool-approval-request',
						approvalId: 'a1',
						toolCall: {
							toolCallId: 'c1',
							toolName: 'bookFlight',
							input: {},
						},
					},
					{
						type: 'tool-approval-request',
						approvalId: 'a2',
						toolCall: {
							toolCallId: 'c2',
							toolName: 'bookHotel',
							input: {},
						},
					},
				],
			}),
		};
		const handle = withAISdkAgent(mockAgent);
		const result = await handle.respond([]);

		expect(result.pendingToolCalls).toHaveLength(2);
		expect(result.pendingToolCalls[0]!.toolName).toBe('bookFlight');
		expect(result.pendingToolCalls[1]!.toolName).toBe('bookHotel');
	});

	it('resolveHIL is defined on the handle', () => {
		const mockAgent = {
			generate: async () => ({
				response: { messages: [] as ModelMessage[] },
				content: [],
			}),
		};
		const handle = withAISdkAgent(mockAgent);
		expect(typeof handle.resolveHIL).toBe('function');
	});
});

// ---------------------------------------------------------------------------
// Mastra wrapper detection
// ---------------------------------------------------------------------------

describe('withMastraAgent HIL detection', () => {
	it('returns empty pendingToolCalls when finishReason is not suspended', async () => {
		const mockAgent = {
			generate: async () => ({
				text: 'Hello!',
				finishReason: 'stop',
				steps: [
					{
						response: {
							messages: [
								{ role: 'assistant' as const, content: 'Hello!' },
							],
						},
					},
				],
			}),
		};
		const handle = withMastraAgent(mockAgent as never);
		const result = await handle.respond([
			{ role: 'user', content: 'Hi' },
		]);

		expect(result.pendingToolCalls).toEqual([]);
	});

	it('detects suspended finish reason with suspendPayload', async () => {
		const mockAgent = {
			generate: async () => ({
				text: '',
				finishReason: 'suspended',
				runId: 'run-abc',
				suspendPayload: {
					toolCallId: 'tc-1',
					toolName: 'requestApproval',
					args: { action: 'delete file' },
				},
				steps: [],
			}),
		};
		const handle = withMastraAgent(mockAgent as never);
		const result = await handle.respond([]);

		expect(result.pendingToolCalls).toHaveLength(1);
		expect(result.pendingToolCalls[0]).toEqual({
			toolCallId: 'tc-1',
			toolName: 'requestApproval',
			args: { action: 'delete file' },
		});
	});

	it('resolveHIL calls approveToolCallGenerate on approve decision', async () => {
		let capturedOpts: { runId: string; toolCallId?: string } | undefined;
		const mockAgent = {
			generate: async () => ({
				text: '',
				finishReason: 'suspended',
				runId: 'run-xyz',
				suspendPayload: {
					toolCallId: 'tc-1',
					toolName: 'confirm',
					args: {},
				},
				steps: [],
			}),
			approveToolCallGenerate: async (opts: { runId: string; toolCallId?: string }) => {
				capturedOpts = opts;
				return {
					text: 'Approved!',
					finishReason: 'stop',
					steps: [
						{
							response: {
								messages: [
									{ role: 'assistant' as const, content: 'Approved!' },
								],
							},
						},
					],
				};
			},
			declineToolCallGenerate: async () => ({
				text: 'Declined',
				steps: [],
			}),
		};

		const handle = withMastraAgent(mockAgent as never);

		// First call triggers suspended state
		await handle.respond([]);

		// Resolve with approval
		const decisions = new Map();
		decisions.set('tc-1', { type: 'approve' as const });
		const resolved = await handle.resolveHIL!(decisions, []);

		expect(capturedOpts).toEqual({ runId: 'run-xyz', toolCallId: 'tc-1' });
		expect(resolved.messages).toHaveLength(1);
		expect(resolved.pendingToolCalls).toEqual([]);
	});

	it('resolveHIL calls declineToolCallGenerate on reject decision', async () => {
		let declineCalled = false;
		const mockAgent = {
			generate: async () => ({
				text: '',
				finishReason: 'suspended',
				runId: 'run-123',
				suspendPayload: {
					toolCallId: 'tc-1',
					toolName: 'dangerousAction',
					args: {},
				},
				steps: [],
			}),
			approveToolCallGenerate: async () => ({
				text: 'Should not be called',
				steps: [],
			}),
			declineToolCallGenerate: async () => {
				declineCalled = true;
				return {
					text: 'Action declined.',
					finishReason: 'stop',
					steps: [
						{
							response: {
								messages: [
									{ role: 'assistant' as const, content: 'Action declined.' },
								],
							},
						},
					],
				};
			},
		};

		const handle = withMastraAgent(mockAgent as never);
		await handle.respond([]);

		const decisions = new Map();
		decisions.set('tc-1', { type: 'reject' as const, reason: 'Too dangerous' });
		await handle.resolveHIL!(decisions, []);

		expect(declineCalled).toBe(true);
	});

	it('resolveHIL is defined on the handle', () => {
		const mockAgent = {
			generate: async () => ({ text: '', steps: [] }),
		};
		const handle = withMastraAgent(mockAgent as never);
		expect(typeof handle.resolveHIL).toBe('function');
	});
});

