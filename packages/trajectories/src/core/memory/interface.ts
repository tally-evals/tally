/**
 * Memory interface for conversation history management
 */

import type { ModelMessage } from 'ai';

export interface Memory {
	get(conversationId: string): readonly ModelMessage[];
	set(conversationId: string, messages: readonly ModelMessage[]): void;
	clear(conversationId: string): void;
}

