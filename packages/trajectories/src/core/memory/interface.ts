/**
 * AgentMemory interface for ephemeral conversation memory (per-run)
 */

import type { ModelMessage } from 'ai';

export interface AgentMemory {
	get(conversationId: string): readonly ModelMessage[];
	set(conversationId: string, messages: readonly ModelMessage[]): void;
	clear(conversationId: string): void;
}

