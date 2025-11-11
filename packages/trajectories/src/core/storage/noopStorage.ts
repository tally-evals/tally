/**
 * No-op storage implementation that doesn't store anything
 */

import type { ModelMessage } from 'ai';
import type { Storage } from './interface.js';

export class NoopStorage implements Storage {
	get(_conversationId: string): readonly ModelMessage[] {
		return [];
	}

	set(_conversationId: string, _messages: readonly ModelMessage[]): void {
		// No-op: don't store anything
	}

	clear(_conversationId: string): void {
		// No-op: nothing to clear
	}
}

