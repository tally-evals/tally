/**
 * Unit tests for the HIL handler (resolution logic)
 *
 * The handler now returns a `HILDecisionMap` (decisions) instead of
 * `toolResultMessages`. The wrappers are responsible for translating
 * decisions into framework-specific resolution protocols.
 */

import { describe, it, expect } from 'bun:test';
import { resolveHILCalls } from '../../../src/core/hil/handler';
import type { HILConfig, HILContext, HILToolCall } from '../../../src/core/hil/types';
import type { ModelMessage } from 'ai';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCall(overrides?: Partial<HILToolCall>): HILToolCall {
	return {
		toolCallId: 'call-1',
		toolName: 'askForConfirmation',
		args: { message: 'Proceed?' },
		...overrides,
	};
}

function makeContext(overrides?: Partial<HILContext>): HILContext {
	return {
		goal: 'Book a flight',
		persona: { description: 'A cautious traveller' },
		history: [] as ModelMessage[],
		stepTraces: [],
		turnIndex: 0,
		...overrides,
	};
}

/** Stub LanguageModel that should never be called (for non-llm tests) */
const NOOP_MODEL = {} as never;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveHILCalls', () => {
	describe('deterministic policies', () => {
		it('approves with default result when behavior is approve', async () => {
			const config: HILConfig = {
				tools: {
					askForConfirmation: { behavior: 'approve' },
				},
			};
			const { decisions, interactions } = await resolveHILCalls(
				[makeCall()],
				config,
				makeContext(),
				NOOP_MODEL,
			);

			expect(interactions).toHaveLength(1);
			expect(interactions[0]!.decision).toEqual({ type: 'approve', result: undefined });
			expect(interactions[0]!.method).toBe('default');

			// Decision map should contain the decision keyed by toolCallId
			expect(decisions.size).toBe(1);
			expect(decisions.get('call-1')).toEqual({ type: 'approve', result: undefined });
		});

		it('approves with custom result when approveResult is set', async () => {
			const config: HILConfig = {
				tools: {
					askForConfirmation: {
						behavior: 'approve',
						approveResult: { confirmed: true, reference: 'ABC-123' },
					},
				},
			};
			const { decisions } = await resolveHILCalls(
				[makeCall()],
				config,
				makeContext(),
				NOOP_MODEL,
			);

			const decision = decisions.get('call-1');
			expect(decision).toEqual({
				type: 'approve',
				result: { confirmed: true, reference: 'ABC-123' },
			});
		});

		it('rejects with default reason when behavior is reject', async () => {
			const config: HILConfig = {
				tools: {
					askForConfirmation: { behavior: 'reject' },
				},
			};
			const { interactions, decisions } = await resolveHILCalls(
				[makeCall()],
				config,
				makeContext(),
				NOOP_MODEL,
			);

			expect(interactions[0]!.decision).toEqual({
				type: 'reject',
				reason: 'Rejected by HIL policy',
			});

			const decision = decisions.get('call-1');
			expect(decision).toEqual({
				type: 'reject',
				reason: 'Rejected by HIL policy',
			});
		});

		it('rejects with custom reason when rejectReason is set', async () => {
			const config: HILConfig = {
				tools: {
					askForConfirmation: {
						behavior: 'reject',
						rejectReason: 'Too expensive',
					},
				},
			};
			const { interactions } = await resolveHILCalls(
				[makeCall()],
				config,
				makeContext(),
				NOOP_MODEL,
			);

			expect(interactions[0]!.decision).toEqual({
				type: 'reject',
				reason: 'Too expensive',
			});
		});
	});

	describe('defaultPolicy fallback', () => {
		it('uses defaultPolicy when tool is not in tools map', async () => {
			const config: HILConfig = {
				defaultPolicy: 'approve',
			};
			const { interactions } = await resolveHILCalls(
				[makeCall({ toolName: 'unknownTool' })],
				config,
				makeContext(),
				NOOP_MODEL,
			);

			expect(interactions[0]!.decision.type).toBe('approve');
			expect(interactions[0]!.method).toBe('default');
		});

		it('uses defaultPolicy reject when configured', async () => {
			const config: HILConfig = {
				defaultPolicy: 'reject',
			};
			const { interactions } = await resolveHILCalls(
				[makeCall({ toolName: 'anyTool' })],
				config,
				makeContext(),
				NOOP_MODEL,
			);

			expect(interactions[0]!.decision.type).toBe('reject');
		});
	});

	describe('callback handlers', () => {
		it('uses per-tool handler when provided', async () => {
			const config: HILConfig = {
				tools: {
					askForConfirmation: {
						behavior: 'reject', // should be overridden by handler
						handler: async (_call, _ctx) => ({
							type: 'provide',
							data: { userInput: 'confirmed via callback' },
						}),
					},
				},
			};
			const { interactions } = await resolveHILCalls(
				[makeCall()],
				config,
				makeContext(),
				NOOP_MODEL,
			);

			expect(interactions[0]!.decision).toEqual({
				type: 'provide',
				data: { userInput: 'confirmed via callback' },
			});
			expect(interactions[0]!.method).toBe('callback');
		});

		it('uses global handler when per-tool handler is not set', async () => {
			const config: HILConfig = {
				handler: async (call, _ctx) => ({
					type: 'approve',
					result: { tool: call.toolName },
				}),
			};
			const { interactions } = await resolveHILCalls(
				[makeCall()],
				config,
				makeContext(),
				NOOP_MODEL,
			);

			expect(interactions[0]!.decision).toEqual({
				type: 'approve',
				result: { tool: 'askForConfirmation' },
			});
			expect(interactions[0]!.method).toBe('callback');
		});

		it('per-tool handler takes precedence over global handler', async () => {
			const config: HILConfig = {
				handler: async () => ({ type: 'reject', reason: 'global' }),
				tools: {
					askForConfirmation: {
						behavior: 'reject',
						handler: async () => ({ type: 'approve' }),
					},
				},
			};
			const { interactions } = await resolveHILCalls(
				[makeCall()],
				config,
				makeContext(),
				NOOP_MODEL,
			);

			expect(interactions[0]!.decision.type).toBe('approve');
			expect(interactions[0]!.method).toBe('callback');
		});
	});

	describe('multiple pending calls', () => {
		it('resolves all pending calls independently', async () => {
			const config: HILConfig = {
				tools: {
					confirmFlight: { behavior: 'approve' },
					confirmHotel: { behavior: 'reject', rejectReason: 'No vacancy' },
				},
			};
			const calls: HILToolCall[] = [
				makeCall({ toolCallId: 'c1', toolName: 'confirmFlight' }),
				makeCall({ toolCallId: 'c2', toolName: 'confirmHotel' }),
			];
			const { interactions, decisions } = await resolveHILCalls(
				calls,
				config,
				makeContext(),
				NOOP_MODEL,
			);

			expect(interactions).toHaveLength(2);
			expect(interactions[0]!.decision.type).toBe('approve');
			expect(interactions[1]!.decision.type).toBe('reject');

			// Decision map has entries for both calls
			expect(decisions.size).toBe(2);
			expect(decisions.get('c1')!.type).toBe('approve');
			expect(decisions.get('c2')!.type).toBe('reject');
		});
	});

	describe('decision map structure', () => {
		it('builds correct decision map for provide decision', async () => {
			const config: HILConfig = {
				handler: async () => ({
					type: 'provide',
					data: { email: 'user@example.com' },
				}),
			};
			const { decisions } = await resolveHILCalls(
				[makeCall({ toolCallId: 'call-99', toolName: 'requestEmail' })],
				config,
				makeContext(),
				NOOP_MODEL,
			);

			expect(decisions.size).toBe(1);
			const decision = decisions.get('call-99');
			expect(decision).toEqual({
				type: 'provide',
				data: { email: 'user@example.com' },
			});
		});
	});
});
