/**
 * Storage Backend Abstraction
 *
 * Unified interface for storage operations across different backends:
 * - Local filesystem
 * - S2.dev streaming storage
 * - Redis Streams
 */

/**
 * Represents metadata about a child entry in a directory-like structure
 */
export interface StorageEntry {
  /** Entry identifier (filename or key) */
  id: string;

  /** Full path to entry */
  path: string;

  /** Whether this is a directory */
  isDirectory?: boolean;
}

/**
 * Core storage backend interface for abstraction across different storage systems
 * Implementations can support local filesystem, S3, S2.dev, Redis, or any other storage
 */
export interface IStorage {
  /**
   * List all entries in a directory-like path
   * @param dirPath - The path to list
   * @returns Array of storage entries
   */
  list(dirPath: string): Promise<StorageEntry[]>;

  /**
   * Join path segments together (filesystem-agnostic)
   * @param segments - Path segments to join
   * @returns Joined path string
   */
  join(...segments: string[]): string;

  /**
   * Read file content as string
   * @param filePath - The path to read
   * @returns File content
   */
  read(filePath: string): Promise<string>;

  /**
   * Write file content to a path
   * @param filePath - The path to write
   * @param content - The content to write
   */
  write(filePath: string, content: string): Promise<void>;

  /**
   * Append content to a file (for streaming backends)
   * Optional - not all backends support append
   * @param filePath - The path to append to
   * @param content - The content to append
   */
  append?(filePath: string, content: string): Promise<void>;

  /**
   * Get metadata about a path
   * @param filePath - The path to check
   * @returns Metadata including whether it's a directory, or null if not found
   */
  stat(filePath: string): Promise<{ isDirectory: boolean } | null>;

  /**
   * Delete a file at a path
   * @param filePath - The path to delete
   */
  delete(filePath: string): Promise<void>;
}
