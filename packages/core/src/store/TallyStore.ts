import path from 'node:path';
import { resolveConfig } from '../config/resolver';
import type { TallyConfigInput } from '../config/types';
import { CONVERSATIONS, META, STEP_TRACES, TRAJECTORY_META } from '../constants';
import { decodeStepTraces, decodeTrajectoryMeta, encodeStepTraces, encodeTrajectoryMeta } from '../codecs/trajectory';
import { createStorage } from '../storage/factory';
import type { IStorage } from '../storage/storage.interface';
import { ConversationRef } from './ConversationRef';
import type { Conversation, StepTrace, TrajectoryMeta } from '../types';

export class TallyStore {
  private constructor(
    private readonly storage: IStorage,
    private readonly basePath: string
  ) {}

  /**
   * Open a store using resolved configuration (config file + env + overrides).
   *
   * The backend is selected purely by config; consumers don't need to know it.
   */
  static async open(options?: {
    cwd?: string;
    config?: Partial<TallyConfigInput>;
  }): Promise<TallyStore> {
    const cwd = options?.cwd ?? process.cwd();
    const resolveOptions: { cwd: string; overrides?: Partial<TallyConfigInput> } = { cwd };
    if (options?.config) {
      resolveOptions.overrides = options.config;
    }
    const resolved = await resolveConfig(resolveOptions);

    const storage = createStorage(resolved.storage);

    const basePath = normalizeBasePath({
      backend: resolved.storage.backend,
      cwd,
      configuredPath: resolved.storage.path,
    });

    return new TallyStore(storage, basePath);
  }

  /**
   * List all conversations available in the store.
   */
  async listConversations(): Promise<ConversationRef[]> {
    const conversationsPath = this.storage.join(this.basePath, CONVERSATIONS);
    const entries = await this.storage.list(conversationsPath).catch(() => []);
    return entries
      .filter((e) => e.isDirectory)
      .map((e) => new ConversationRef(this.storage, e.path, e.id));
  }

  /**
   * Get a conversation by id, or null if it doesn't exist.
   */
  async getConversation(id: string): Promise<ConversationRef | null> {
    const convPath = this.storage.join(this.basePath, CONVERSATIONS, id);
    const stat = await this.storage.stat(convPath);
    return stat ? new ConversationRef(this.storage, convPath, id) : null;
  }

  /**
   * Create a conversation. For local storage this also creates the folder structure
   * by writing a minimal meta file.
   */
  async createConversation(id: string): Promise<ConversationRef> {
    const convPath = this.storage.join(this.basePath, CONVERSATIONS, id);
    const metaPath = this.storage.join(convPath, META);
    await this.storage.write(
      metaPath,
      JSON.stringify({ id, createdAt: new Date().toISOString() }, null, 2)
    );
    return new ConversationRef(this.storage, convPath, id);
  }

  /**
   * Save a conversation (creates folder if needed, writes conversation.jsonl).
   */
  async saveConversation(id: string, conversation: Conversation): Promise<ConversationRef> {
    const ref = await this.getConversation(id) ?? await this.createConversation(id);
    await ref.save(conversation);
    return ref;
  }

  /**
   * Save declarative TrajectoryMeta (debug/replay snapshot) by trajectoryId.
   * Stored alongside conversation in conversations/{id}/trajectory.meta.json
   */
  async saveTrajectoryMeta(trajectoryId: string, meta: TrajectoryMeta): Promise<void> {
    // Store in conversations folder (unified with conversation data)
    const convPath = this.storage.join(this.basePath, CONVERSATIONS, trajectoryId);
    const metaPath = this.storage.join(convPath, TRAJECTORY_META);
    await this.storage.write(metaPath, encodeTrajectoryMeta(meta));
  }

  /**
   * Load declarative TrajectoryMeta by trajectoryId, or null if missing.
   * Reads from conversations/{id}/trajectory.meta.json
   */
  async loadTrajectoryMeta(trajectoryId: string): Promise<TrajectoryMeta | null> {
    const convPath = this.storage.join(this.basePath, CONVERSATIONS, trajectoryId);
    const metaPath = this.storage.join(convPath, TRAJECTORY_META);
    const stat = await this.storage.stat(metaPath);
    if (!stat) return null;
    const content = await this.storage.read(metaPath);
    return decodeTrajectoryMeta(content);
  }

  /**
   * Save StepTrace[] for a trajectory run by trajectoryId.
   * Stored alongside conversation in conversations/{id}/stepTraces.json
   */
  async saveTrajectoryStepTraces(trajectoryId: string, steps: readonly StepTrace[]): Promise<void> {
    // Store in conversations folder (unified with conversation data)
    const convPath = this.storage.join(this.basePath, CONVERSATIONS, trajectoryId);
    const tracesPath = this.storage.join(convPath, STEP_TRACES);
    await this.storage.write(tracesPath, encodeStepTraces(steps));
  }

  /**
   * Load StepTrace[] for a trajectory run by trajectoryId, or null if missing.
   * Reads from conversations/{id}/stepTraces.json
   */
  async loadTrajectoryStepTraces(trajectoryId: string): Promise<StepTrace[] | null> {
    const convPath = this.storage.join(this.basePath, CONVERSATIONS, trajectoryId);
    const tracesPath = this.storage.join(convPath, STEP_TRACES);
    const stat = await this.storage.stat(tracesPath);
    if (!stat) return null;
    const content = await this.storage.read(tracesPath);
    return decodeStepTraces(content);
  }
}

function normalizeBasePath(options: {
  backend: 'local' | 's2' | 'redis';
  cwd: string;
  configuredPath: string | undefined;
}): string {
  const configured = options.configuredPath ?? '.tally';
  if (options.backend !== 'local') {
    // For streaming backends, treat path as a key prefix (or '' if unset).
    return configured;
  }

  // For local backend, resolve relative path against cwd.
  return path.isAbsolute(configured) ? configured : path.resolve(options.cwd, configured);
}
