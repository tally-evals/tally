/**
 * Storage initialization helper
 */

import { LocalStorage } from '../storage/localStorage.js';
import { NoopStorage } from '../storage/noopStorage.js';
import type { Storage } from '../storage/interface.js';
import type { Trajectory } from '../types.js';

export interface StorageOptions {
	storage?: Storage;
}

/**
 * Initialize storage based on trajectory config and options
 */
export function initializeStorage(
	trajectory: Trajectory,
	options?: StorageOptions
): Storage {
	if (options?.storage) {
		return options.storage;
	}

	if (trajectory.storage?.strategy === 'none') {
		return new NoopStorage();
	}

	const storageOptions: { ttlMs?: number; capacity?: number } = {};
	if (trajectory.storage?.ttlMs !== undefined) {
		storageOptions.ttlMs = trajectory.storage.ttlMs;
	}
	if (trajectory.storage?.capacity !== undefined) {
		storageOptions.capacity = trajectory.storage.capacity;
	}

	return new LocalStorage(storageOptions);
}
