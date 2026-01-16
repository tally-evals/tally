/**
 * ID generation utilities
 *
 * Provides functions for generating unique identifiers for runs, targets, and other entities.
 */

/**
 * Generate a unique run ID
 * Format: run-{timestamp}-{random}
 */
export function generateRunId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `run-${timestamp}-${random}`;
}

/**
 * Generate a unique target ID
 * Format: target-{timestamp}-{random}
 */
export function generateTargetId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `target-${timestamp}-${random}`;
}

/**
 * Generate a unique metric ID
 * Format: metric-{timestamp}-{random}
 */
export function generateMetricId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `metric-${timestamp}-${random}`;
}

/**
 * Generate a unique ID with a custom prefix
 */
export function generateId(prefix: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Validate that an ID follows the expected format
 */
export function isValidId(id: string): boolean {
  return typeof id === 'string' && id.length > 0 && /^[a-z0-9-]+$/.test(id);
}
