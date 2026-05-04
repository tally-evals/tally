/**
 * Unit tests for `toHILDecision` — the raw schema ↔ typed decision converter.
 */

import { describe, it, expect } from 'bun:test';
import { toHILDecision } from '../../../src/core/hil/prompt';

describe('toHILDecision', () => {
	it('maps "approve" to HILApproveDecision', () => {
		const result = toHILDecision({ decision: 'approve' });
		expect(result).toEqual({ type: 'approve' });
	});

	it('maps "reject" without reason', () => {
		const result = toHILDecision({ decision: 'reject' });
		expect(result).toEqual({ type: 'reject' });
	});

	it('maps "reject" with reason', () => {
		const result = toHILDecision({
			decision: 'reject',
			reason: 'Too expensive',
		});
		expect(result).toEqual({ type: 'reject', reason: 'Too expensive' });
	});

	it('approve ignores reason field (not part of approve decision)', () => {
		const result = toHILDecision({
			decision: 'approve',
			reason: 'should be ignored',
		});
		expect(result).toEqual({ type: 'approve' });
		expect(result).not.toHaveProperty('reason');
	});
});
