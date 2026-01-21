import type { TallyRunArtifact } from '../types/runArtifact';
import { decodeRunArtifact, encodeRunArtifact } from '../codecs/runArtifact';
import type { IStorage } from '../storage/storage.interface';
import type { TrajectoryRunMeta } from '../types/runs';
import type { RunType } from './types';

export class RunRef {
  timestamp: Date | undefined;
  constructor(
    private readonly storage: IStorage,
    public readonly path: string,
    public readonly id: string,
    public readonly type: RunType,
  ) {
    this.timestamp = id.split('-')[1]
      ? new Date(parseInt(id.split('-')[1]!))
      : undefined;
  }

  async load(): Promise<TallyRunArtifact | TrajectoryRunMeta> {
    const content = await this.storage.read(this.path);
    if (this.type === 'tally') {
      return decodeRunArtifact(content);
    }
    return JSON.parse(content) as TrajectoryRunMeta;
  }

  async save(data: TallyRunArtifact | TrajectoryRunMeta): Promise<void> {
    const content =
      this.type === 'tally'
        ? encodeRunArtifact(data as TallyRunArtifact)
        : JSON.stringify(data, null, 2);
    await this.storage.write(this.path, content);
  }
}
