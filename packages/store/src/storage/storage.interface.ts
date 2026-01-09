// =============================================================================
// Storage Backend Abstraction
// =============================================================================

/**
 * Represents metadata about a child entry in a directory-like structure
 */
export interface StorageEntry {
  id: string;
  path: string;
  isDirectory?: boolean;
}

/**
 * Core storage backend interface for abstraction across different storage systems
 * Implementations can support local filesystem, S3, S2.dev, or any other storage
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
   * Get metadata about a path
   * @param filePath - The path to check
   * @returns Metadata including whether it's a directory
   */
  stat(filePath: string): Promise<{ isDirectory: boolean } | null>;

  /**
   * Delete a file at a path
   * @param filePath - The path to delete
   */
  delete(filePath: string): Promise<void>;
}
