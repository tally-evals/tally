import { describe, expect, it } from 'vitest';
import {
  extractTextFromMessage,
  extractTextFromMessages,
  getFirstTextContent,
  hasTextContent,
} from '../../src/utils';
import {
  assistantTextMessage,
  assistantWithToolCall,
  toolResultMessage,
  userMessage,
} from '../fixtures/messages';

describe('extractTextFromMessage', () => {
  it('extracts text from string content', () => {
    const text = extractTextFromMessage(userMessage);
    expect(text).toBe(
      "Hi there! I'm looking to plan a trip to San Francisco and could use some help with the details."
    );
  });

  it('extracts text from content parts array', () => {
    const text = extractTextFromMessage(assistantTextMessage);
    expect(text).toBe('I can help with that! What dates are you planning to visit San Francisco?');
  });

  it('returns empty string for tool-call only message', () => {
    const text = extractTextFromMessage(assistantWithToolCall);
    expect(text).toBe('');
  });
});

describe('extractTextFromMessages', () => {
  it('combines text from multiple messages', () => {
    const messages = [userMessage, assistantTextMessage];
    const text = extractTextFromMessages(messages);

    expect(text).toContain('plan a trip to San Francisco');
    expect(text).toContain('What dates are you planning');
  });
});

describe('hasTextContent', () => {
  it('returns true for message with text', () => {
    expect(hasTextContent(userMessage)).toBe(true);
    expect(hasTextContent(assistantTextMessage)).toBe(true);
  });

  it('returns false for tool-call only message', () => {
    expect(hasTextContent(assistantWithToolCall)).toBe(false);
  });
});

describe('getFirstTextContent', () => {
  it('returns first text content from message', () => {
    const text = getFirstTextContent(assistantTextMessage);
    expect(text).toBe('I can help with that! What dates are you planning to visit San Francisco?');
  });

  it('returns undefined for message without text', () => {
    expect(getFirstTextContent(assistantWithToolCall)).toBeUndefined();
  });
});
