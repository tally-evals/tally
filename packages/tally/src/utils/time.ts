/**
 * Timing and stopwatch utilities
 * 
 * Provides functions for measuring execution time and managing timestamps.
 */

/**
 * Stopwatch class for measuring elapsed time
 */
export class Stopwatch {
	private startTime: number;
	private endTime: number | null = null;

	constructor() {
		this.startTime = Date.now();
	}

	/**
	 * Get elapsed time in milliseconds
	 */
	elapsed(): number {
		if (this.endTime !== null) {
			return this.endTime - this.startTime;
		}
		return Date.now() - this.startTime;
	}

	/**
	 * Stop the stopwatch and return elapsed time
	 */
	stop(): number {
		if (this.endTime === null) {
			this.endTime = Date.now();
		}
		return this.elapsed();
	}

	/**
	 * Reset the stopwatch
	 */
	reset(): void {
		this.startTime = Date.now();
		this.endTime = null;
	}
}

/**
 * Create a new stopwatch instance
 */
export function createStopwatch(): Stopwatch {
	return new Stopwatch();
}

/**
 * Measure the execution time of an async function
 */
export async function measureAsync<T>(
	fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
	const stopwatch = createStopwatch();
	const result = await fn();
	const duration = stopwatch.stop();
	return { result, duration };
}

/**
 * Measure the execution time of a synchronous function
 */
export function measureSync<T>(
	fn: () => T
): { result: T; duration: number } {
	const stopwatch = createStopwatch();
	const result = fn();
	const duration = stopwatch.stop();
	return { result, duration };
}

/**
 * Format duration in milliseconds to a human-readable string
 */
export function formatDuration(ms: number): string {
	if (ms < 1) {
		return `${(ms * 1000).toFixed(2)}μs`;
	}
	if (ms < 1000) {
		return `${ms.toFixed(2)}ms`;
	}
	if (ms < 60000) {
		return `${(ms / 1000).toFixed(2)}s`;
	}
	const minutes = Math.floor(ms / 60000);
	const seconds = ((ms % 60000) / 1000).toFixed(2);
	return `${minutes}m ${seconds}s`;
}

/**
 * Get current timestamp as Date object
 */
export function getTimestamp(): Date {
	return new Date();
}

/**
 * Get current timestamp as ISO string
 */
export function getTimestampISO(): string {
	return new Date().toISOString();
}

/**
 * Get current timestamp as Unix timestamp (milliseconds)
 */
export function getTimestampUnix(): number {
	return Date.now();
}

