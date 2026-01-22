/**
 * Text and string utilities
 * 
 * Provides helper functions for text manipulation, normalization, and comparison.
 */

/**
 * Normalize whitespace in a string
 * Replaces multiple whitespace characters with a single space
 */
export function normalizeWhitespace(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

/**
 * Truncate a string to a maximum length with ellipsis
 */
export function truncate(text: string, maxLength: number, suffix = '...'): string {
	if (text.length <= maxLength) {
		return text;
	}
	return text.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Extract words from a string
 */
export function extractWords(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/[^\w\s]/g, ' ')
		.split(/\s+/)
		.filter((word) => word.length > 0);
}

/**
 * Calculate word count
 */
export function wordCount(text: string): number {
	return extractWords(text).length;
}

/**
 * Calculate character count (excluding whitespace)
 */
export function characterCount(text: string, excludeWhitespace = false): number {
	if (excludeWhitespace) {
		return text.replace(/\s/g, '').length;
	}
	return text.length;
}

/**
 * Check if a string contains all of the given keywords
 */
export function containsKeywords(
	text: string,
	keywords: readonly string[],
	caseSensitive = false
): boolean {
	const searchText = caseSensitive ? text : text.toLowerCase();
	const searchKeywords = caseSensitive
		? keywords
		: keywords.map((k) => k.toLowerCase());

	return searchKeywords.every((keyword) => searchText.includes(keyword));
}

/**
 * Calculate simple similarity between two strings (Jaccard similarity on words)
 */
export function wordSimilarity(text1: string, text2: string): number {
	const words1 = new Set(extractWords(text1));
	const words2 = new Set(extractWords(text2));

	const intersection = new Set(
		[...words1].filter((word) => words2.has(word))
	);
	const union = new Set([...words1, ...words2]);

	if (union.size === 0) {
		return 1; // Both empty strings are considered identical
	}

	return intersection.size / union.size;
}

/**
 * Escape special regex characters in a string
 */
export function escapeRegex(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if a string is empty or only whitespace
 */
export function isEmpty(text: string): boolean {
	return text.trim().length === 0;
}

/**
 * Remove common punctuation from a string
 */
export function removePunctuation(text: string): string {
	return text.replace(/[.,!?;:—–\-'"`]/g, '');
}

/**
 * Split text into sentences (simple implementation)
 */
export function splitSentences(text: string): string[] {
	return text
		.split(/[.!?]+/)
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

