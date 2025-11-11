/**
 * Local storage implementation using Map for in-memory storage
 */

import type { ModelMessage } from 'ai';
import type { Storage } from './interface.js';

interface MessageEntry {
	messages: readonly ModelMessage[];
	timestamp: number;
}

export class LocalStorage implements Storage {
	private storage: Map<string, MessageEntry>;
	private readonly ttlMs?: number;
	private readonly capacity?: number;

	constructor(options?: { ttlMs?: number; capacity?: number }) {
		this.storage = new Map();
		if (options?.ttlMs !== undefined) {
			this.ttlMs = options.ttlMs;
		}
		if (options?.capacity !== undefined) {
			this.capacity = options.capacity;
		}
	}

	get(conversationId: string): readonly ModelMessage[] {
		const entry = this.storage.get(conversationId);
		if (!entry) {
			return [];
		}

		// Check TTL if configured
		if (this.ttlMs !== undefined) {
			const age = Date.now() - entry.timestamp;
			if (age > this.ttlMs) {
				this.clear(conversationId);
				return [];
			}
		}

		return entry.messages;
	}

	set(conversationId: string, messages: readonly ModelMessage[]): void {
		// Enforce capacity limit if configured
		if (this.capacity !== undefined && this.storage.size >= this.capacity) {
			this.evictOldest();
		}

		this.storage.set(conversationId, {
			messages,
			timestamp: Date.now(),
		});
	}

	clear(conversationId: string): void {
		this.storage.delete(conversationId);
	}

	private evictOldest(): void {
		if (this.storage.size === 0) {
			return;
		}

		let oldestId: string | undefined;
		let oldestTimestamp = Number.POSITIVE_INFINITY;

		for (const [id, entry] of this.storage.entries()) {
			if (entry.timestamp < oldestTimestamp) {
				oldestTimestamp = entry.timestamp;
				oldestId = id;
			}
		}

		if (oldestId !== undefined) {
			this.storage.delete(oldestId);
		}
	}
}

