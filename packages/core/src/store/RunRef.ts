import type { EvaluationReport } from '../codecs/report';
import { decodeReport, encodeReport } from '../codecs/report';
import type { IStorage } from '../storage/storage.interface';
import type { TrajectoryRunMeta } from '../types/runs';
import type { RunType } from './types';

export class RunRef {
  constructor(
    private readonly storage: IStorage,
    public readonly path: string,
    public readonly id: string,
    public readonly type: RunType
  ) {}

  async load(): Promise<EvaluationReport | TrajectoryRunMeta> {
    const content = await this.storage.read(this.path);
    if (this.type === 'tally') {
      return decodeReport(content);
    }
    return JSON.parse(content) as TrajectoryRunMeta;
  }

  async save(data: EvaluationReport | TrajectoryRunMeta): Promise<void> {
    const content =
      this.type === 'tally'
        ? encodeReport(data as EvaluationReport)
        : JSON.stringify(data, null, 2);
    await this.storage.write(this.path, content);
  }
}
