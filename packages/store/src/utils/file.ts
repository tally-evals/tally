import { CONVERSATION, CONVERSATIONS, RUNS } from 'src/constants';
import { IStorage } from 'src/storage/storage.interface';
import { LocalStorage } from 'src/storage/adapters/local';
import { scanTallyDirectory } from './scan';
import { ConversationCodec } from 'src/codecs/conversation';
import { Conversation, EvaluationReport } from '@tally-evals/tally';
import { EvaluationReportCodec } from 'src/codecs/report';
import path from 'path';

const localStorage = new LocalStorage();

export class RunFile {
  constructor(
    private basePath: string,
    private conversationId: string,
    private runId: string,
    private storage: IStorage = localStorage,
  ) {}

  static create(
    basePath: string,
    conversationId: string,
    runId: string,
    storage?: IStorage,
  ) {
    console.log(runId);
    return new RunFile(basePath, conversationId, runId, storage);
  }

  async read(): Promise<EvaluationReport> {
    const res = EvaluationReportCodec.safeDecode(
      await this.storage.read(this.path),
    );

    if (res.error) {
      throw new Error(res.error.message);
    }

    return res.data as unknown as EvaluationReport;
  }

  async write(report: EvaluationReport) {
    const res = EvaluationReportCodec.safeEncode(report);

    if (res.error) {
      throw new Error(res.error.message);
    }

    await this.storage.write(this.path, res.data);
  }

  get path() {
    return this.storage.join(
      this.basePath,
      CONVERSATIONS,
      this.conversationId,
      RUNS,
      this.runId,
    );
  }

  get id() {
    return this.runId.replace(path.extname(this.runId), '');
  }
}

export class ConversationFile {
  constructor(
    private basePath: string,
    private conversationId: string,
    private storage: IStorage = localStorage,
  ) {}

  static create(basePath: string, conversationId: string, storage?: IStorage) {
    return new ConversationFile(basePath, conversationId, storage);
  }

  async read(): Promise<Conversation> {
    const res = ConversationCodec.safeDecode(
      await this.storage.read(this.path),
    );

    if (res.error) {
      throw new Error(res.error.message);
    }

    return res.data as unknown as Conversation;
  }

  async write(conversation: Conversation) {
    const res = ConversationCodec.safeEncode(conversation);
    if (res.error) {
      throw new Error(res.error.message);
    }

    await this.storage.write(this.path, res.data);
  }

  async runs() {
    return this.storage
      .list(
        this.storage.join(
          this.basePath,
          CONVERSATIONS,
          this.conversationId,
          RUNS,
        ),
      )
      .then((runs) =>
        runs.map((run) =>
          RunFile.create(this.basePath, this.conversationId, run.id),
        ),
      );
  }

  get path() {
    return (
      this.storage.join(
        this.basePath,
        CONVERSATIONS,
        this.conversationId,
        CONVERSATION,
      ) + '.jsonl'
    );
  }

  get id() {
    return this.conversationId;
  }
}

export class TallyStore {
  constructor(private basePath: string, private storage: IStorage) {}

  static create(
    basePath: string = scanTallyDirectory(),
    storage: IStorage = localStorage,
  ) {
    return new TallyStore(basePath, storage);
  }

  async conversations(): Promise<ConversationFile[]> {
    return this.storage
      .list(this.storage.join(this.basePath, CONVERSATIONS))
      .then((conversations) =>
        conversations.map((conversation) =>
          ConversationFile.create(this.basePath, conversation.id),
        ),
      );
  }

  get path() {
    return this.basePath;
  }
}
