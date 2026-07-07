import { randomUUID } from 'node:crypto';
import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { betaMessagesToDisplay, deriveSessionTitle } from './chat-engine.js';
import type { SessionDetail, SessionSummary } from './types.js';

type SessionRecord = {
  id: string;
  title: string;
  messages: BetaMessageParam[];
  createdAt: Date;
  updatedAt: Date;
};

export class SessionStore {
  private readonly sessions = new Map<string, SessionRecord>();

  create(): SessionDetail {
    const now = new Date();
    const record: SessionRecord = {
      id: randomUUID(),
      title: 'New chat',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(record.id, record);
    return this.toDetail(record);
  }

  list(): SessionSummary[] {
    return [...this.sessions.values()]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((record) => this.toSummary(record));
  }

  get(id: string): SessionDetail | undefined {
    const record = this.sessions.get(id);
    return record ? this.toDetail(record) : undefined;
  }

  getMessages(id: string): BetaMessageParam[] | undefined {
    return this.sessions.get(id)?.messages;
  }

  delete(id: string): boolean {
    return this.sessions.delete(id);
  }

  touch(id: string, userInput?: string): void {
    const record = this.sessions.get(id);
    if (!record) {
      return;
    }
    record.updatedAt = new Date();
    if (userInput && record.title === 'New chat') {
      record.title = deriveSessionTitle(userInput);
    }
  }

  private toSummary(record: SessionRecord): SessionSummary {
    return {
      id: record.id,
      title: record.title,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private toDetail(record: SessionRecord): SessionDetail {
    return {
      ...this.toSummary(record),
      messages: betaMessagesToDisplay(record.messages),
    };
  }
}
