import { decodeConversation, encodeConversation } from '../codecs/conversation';
import { CONVERSATION, RUNS, TALLY, TRAJECTORY } from '../constants';
import type { IStorage } from '../storage/storage.interface';
import type { Conversation } from '../types/conversation';
import { generateRunId } from '../utils/ids';
import { RunRef } from './RunRef';
import type { RunType } from './types';

export class ConversationRef {
  constructor(
    private readonly storage: IStorage,
    public readonly path: string,
    public readonly id: string
  ) {}

  async load(): Promise<Conversation> {
    const jsonlPath = this.storage.join(this.path, `${CONVERSATION}.jsonl`);
    const content = await this.storage.read(jsonlPath);
    return decodeConversation(content);
  }

  async save(conversation: Conversation): Promise<void> {
    const jsonlPath = this.storage.join(this.path, `${CONVERSATION}.jsonl`);
    const content = encodeConversation(conversation);
    await this.storage.write(jsonlPath, content);
  }

  async listRuns(): Promise<RunRef[]> {
    const runs: RunRef[] = [];

    for (const type of [TALLY, TRAJECTORY] as const) {
      const runsPath = this.storage.join(this.path, RUNS, type);
      const entries = await this.storage.list(runsPath).catch(() => []);
      for (const e of entries) {
        if (e.isDirectory) continue;
        const runId = e.id.replace(/\.json$/, '');
        runs.push(new RunRef(this.storage, e.path, runId, type));
      }
    }

    return runs;
  }

  async getRun(runId: string): Promise<RunRef | null> {
    for (const type of [TALLY, TRAJECTORY] as const) {
      const runPath = this.storage.join(this.path, RUNS, type, `${runId}.json`);
      const stat = await this.storage.stat(runPath);
      if (stat) return new RunRef(this.storage, runPath, runId, type);
    }
    return null;
  }

  async createRun(options: { type: RunType; runId?: string }): Promise<RunRef> {
    const id = options.runId ?? generateRunId();
    const runPath = this.storage.join(this.path, RUNS, options.type, `${id}.json`);
    return new RunRef(this.storage, runPath, id, options.type);
  }
}
