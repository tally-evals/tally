/**
 * ID generation utilities
 */

/**
 * Generate a unique run ID
 */
export function generateRunId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `run-${timestamp}-${random}`;
}

/**
 * Generate a unique conversation ID
 */
export function generateConversationId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `conv-${timestamp}-${random}`;
}

/**
 * Generate a unique trajectory ID
 */
export function generateTrajectoryId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `traj-${timestamp}-${random}`;
}

/**
 * Extract timestamp from an ID (if it follows the standard format)
 */
export function extractTimestampFromId(id: string): Date | null {
  const match = id.match(/^(?:run|conv|traj)-(\d+)-/);
  if (match?.[1]) {
    const timestamp = Number.parseInt(match[1], 10);
    if (!Number.isNaN(timestamp)) {
      return new Date(timestamp);
    }
  }
  return null;
}
