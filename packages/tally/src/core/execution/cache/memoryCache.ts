/**
 * Memory Cache for Metric Execution
 *
 * Simple in-memory cache for metric results, keyed by metric name + input hash.
 * Supports optional TTL and cache hit/miss tracking.
 */

export interface CacheEntry<T> {
	value: T;
	timestamp: number;
	ttl?: number; // Time to live in milliseconds
}

export interface CacheStats {
	hits: number;
	misses: number;
	size: number;
}

/**
 * Simple in-memory cache for metric execution results
 */
export class MemoryCache<T = unknown> {
	private cache = new Map<string, CacheEntry<T>>();
	private stats: CacheStats = {
		hits: 0,
		misses: 0,
		size: 0,
	};

	/**
	 * Generate a cache key from metric name and input data
	 *
	 * @param metricName - Name of the metric
	 * @param input - Input data to hash
	 * @returns Cache key string
	 */
	private generateKey(metricName: string, input: unknown): string {
		// Simple hash function for cache key generation
		const inputStr = JSON.stringify(input);
		return `${metricName}:${this.hashString(inputStr)}`;
	}

	/**
	 * Simple hash function for strings
	 *
	 * @param str - String to hash
	 * @returns Hash value
	 */
	private hashString(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return hash.toString(36);
	}

	/**
	 * Check if a cache entry is expired
	 *
	 * @param entry - Cache entry to check
	 * @returns True if entry is expired
	 */
	private isExpired(entry: CacheEntry<T>): boolean {
		if (entry.ttl === undefined) {
			return false; // No TTL means never expires
		}
		const now = Date.now();
		return now - entry.timestamp > entry.ttl;
	}

	/**
	 * Get a value from the cache
	 *
	 * @param metricName - Name of the metric
	 * @param input - Input data used to generate cache key
	 * @returns Cached value or undefined if not found/expired
	 */
	get(metricName: string, input: unknown): T | undefined {
		const key = this.generateKey(metricName, input);
		const entry = this.cache.get(key);

		if (entry === undefined) {
			this.stats.misses++;
			return undefined;
		}

		if (this.isExpired(entry)) {
			this.cache.delete(key);
			this.stats.size--;
			this.stats.misses++;
			return undefined;
		}

		this.stats.hits++;
		return entry.value;
	}

	/**
	 * Set a value in the cache
	 *
	 * @param metricName - Name of the metric
	 * @param input - Input data used to generate cache key
	 * @param value - Value to cache
	 * @param ttl - Optional time to live in milliseconds
	 */
	set(metricName: string, input: unknown, value: T, ttl?: number): void {
		const key = this.generateKey(metricName, input);
		const existing = this.cache.get(key);

		const entry: CacheEntry<T> = {
			value,
			timestamp: Date.now(),
			...(ttl !== undefined && { ttl }),
		};

		if (existing === undefined) {
			this.stats.size++;
		}

		this.cache.set(key, entry);
	}

	/**
	 * Clear all entries from the cache
	 */
	clear(): void {
		this.cache.clear();
		this.stats.size = 0;
	}

	/**
	 * Remove expired entries from the cache
	 *
	 * @returns Number of entries removed
	 */
	evictExpired(): number {
		let removed = 0;
		for (const [key, entry] of this.cache.entries()) {
			if (this.isExpired(entry)) {
				this.cache.delete(key);
				removed++;
			}
		}
		this.stats.size -= removed;
		return removed;
	}

	/**
	 * Get cache statistics
	 *
	 * @returns Cache statistics
	 */
	getStats(): CacheStats {
		return { ...this.stats };
	}

	/**
	 * Reset cache statistics
	 */
	resetStats(): void {
		this.stats = {
			hits: 0,
			misses: 0,
			size: this.cache.size,
		};
	}
}

