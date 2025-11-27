/**
 * Property tests for message history invariant
 * **Feature: unified-llm, Property 2: Message History Invariant**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { MessageManager } from '../../src/message-manager';
import type { Message, ContentPart, ToolCall } from '../../src/types';

// Configure fast-check for 100 iterations
fc.configureGlobal({ numRuns: 100 });

// Generators for messages
const arbitraryTextContent = fc.string({ minLength: 1, maxLength: 500 });

const arbitraryContentPart: fc.Arbitrary<ContentPart> = fc.oneof(
  fc.record({
    type: fc.constant('text' as const),
    text: fc.string({ minLength: 1 }),
  })
);

const arbitraryToolCall: fc.Arbitrary<ToolCall> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }),
  type: fc.constant('function' as const),
  function: fc.record({
    name: fc.string({ minLength: 1, maxLength: 50 }),
    arguments: fc.json(),
  }),
});

const arbitrarySystemMessage: fc.Arbitrary<Message> = fc.record({
  role: fc.constant('system' as const),
  content: arbitraryTextContent,
});

const arbitraryUserMessage: fc.Arbitrary<Message> = fc.record({
  role: fc.constant('user' as const),
  content: fc.oneof(arbitraryTextContent, fc.array(arbitraryContentPart, { minLength: 1, maxLength: 3 })),
});

const arbitraryAssistantMessage: fc.Arbitrary<Message> = fc.record({
  role: fc.constant('assistant' as const),
  content: arbitraryTextContent,
  tool_calls: fc.option(fc.array(arbitraryToolCall, { minLength: 1, maxLength: 3 })),
}).map(msg => {
  if (msg.tool_calls === null) {
    const { tool_calls, ...rest } = msg;
    return rest as Message;
  }
  return msg as Message;
});

const arbitraryToolMessage: fc.Arbitrary<Message> = fc.record({
  role: fc.constant('tool' as const),
  content: arbitraryTextContent,
  tool_call_id: fc.string({ minLength: 1, maxLength: 50 }),
});

const arbitraryMessage: fc.Arbitrary<Message> = fc.oneof(
  arbitrarySystemMessage,
  arbitraryUserMessage,
  arbitraryAssistantMessage,
  arbitraryToolMessage
);

describe('Property 2: Message History Invariant', () => {
  /**
   * For any sequence of chat operations (system, chat, tool results),
   * the messages property SHALL always reflect the correct cumulative history
   * with proper message structure and ordering.
   */

  describe('Initial messages preservation', () => {
    it('should preserve initial messages exactly', () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryMessage, { minLength: 0, maxLength: 10 }),
          (initialMessages) => {
            const manager = new MessageManager(initialMessages);
            const retrieved = manager.getMessages();

            expect(retrieved).toHaveLength(initialMessages.length);
            expect(retrieved).toEqual(initialMessages);
          }
        )
      );
    });

    it('should not mutate original array when modifying manager', () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryMessage, { minLength: 1, maxLength: 5 }),
          arbitraryTextContent,
          (initialMessages, newContent) => {
            const originalCopy = JSON.parse(JSON.stringify(initialMessages));
            const manager = new MessageManager(initialMessages);
            
            manager.addUser(newContent);
            
            expect(initialMessages).toEqual(originalCopy);
          }
        )
      );
    });
  });

  describe('Message ordering', () => {
    it('should maintain correct order for sequential operations', () => {
      fc.assert(
        fc.property(
          arbitraryTextContent,
          arbitraryTextContent,
          arbitraryTextContent,
          (systemContent, userContent, assistantContent) => {
            const manager = new MessageManager();
            
            manager.addSystem(systemContent);
            manager.addUser(userContent);
            manager.addAssistant(assistantContent);
            
            const messages = manager.getMessages();
            
            expect(messages).toHaveLength(3);
            expect(messages[0].role).toBe('system');
            expect(messages[0].content).toBe(systemContent);
            expect(messages[1].role).toBe('user');
            expect(messages[1].content).toBe(userContent);
            expect(messages[2].role).toBe('assistant');
            expect(messages[2].content).toBe(assistantContent);
          }
        )
      );
    });

    it('should maintain order with tool calls and results', () => {
      fc.assert(
        fc.property(
          arbitraryTextContent,
          arbitraryTextContent,
          fc.array(arbitraryToolCall, { minLength: 1, maxLength: 3 }),
          arbitraryTextContent,
          (userContent, assistantContent, toolCalls, toolResult) => {
            const manager = new MessageManager();
            
            manager.addUser(userContent);
            manager.addAssistant(assistantContent, toolCalls);
            manager.addToolResult(toolCalls[0].id, toolResult);
            
            const messages = manager.getMessages();
            
            expect(messages).toHaveLength(3);
            expect(messages[0].role).toBe('user');
            expect(messages[1].role).toBe('assistant');
            expect(messages[1].tool_calls).toEqual(toolCalls);
            expect(messages[2].role).toBe('tool');
            expect(messages[2].tool_call_id).toBe(toolCalls[0].id);
            expect(messages[2].content).toBe(toolResult);
          }
        )
      );
    });
  });

  describe('Cumulative history', () => {
    it('should accumulate messages correctly over multiple operations', () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryTextContent, { minLength: 1, maxLength: 10 }),
          (contents) => {
            const manager = new MessageManager();
            
            contents.forEach((content, i) => {
              if (i % 2 === 0) {
                manager.addUser(content);
              } else {
                manager.addAssistant(content);
              }
            });
            
            const messages = manager.getMessages();
            expect(messages).toHaveLength(contents.length);
            
            contents.forEach((content, i) => {
              expect(messages[i].content).toBe(content);
              expect(messages[i].role).toBe(i % 2 === 0 ? 'user' : 'assistant');
            });
          }
        )
      );
    });

    it('length property should match actual message count', () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryMessage, { minLength: 0, maxLength: 10 }),
          fc.nat({ max: 5 }),
          (initialMessages, additionalCount) => {
            const manager = new MessageManager(initialMessages);
            
            for (let i = 0; i < additionalCount; i++) {
              manager.addUser(`message ${i}`);
            }
            
            expect(manager.length).toBe(initialMessages.length + additionalCount);
            expect(manager.getMessages()).toHaveLength(manager.length);
          }
        )
      );
    });
  });

  describe('Message structure', () => {
    it('should preserve multimodal content parts', () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryContentPart, { minLength: 1, maxLength: 5 }),
          (contentParts) => {
            const manager = new MessageManager();
            manager.addUser(contentParts);
            
            const messages = manager.getMessages();
            expect(messages[0].content).toEqual(contentParts);
          }
        )
      );
    });

    it('should only include tool_calls when provided', () => {
      fc.assert(
        fc.property(
          arbitraryTextContent,
          fc.option(fc.array(arbitraryToolCall, { minLength: 1, maxLength: 3 })),
          (content, toolCalls) => {
            const manager = new MessageManager();
            manager.addAssistant(content, toolCalls ?? undefined);
            
            const messages = manager.getMessages();
            if (toolCalls && toolCalls.length > 0) {
              expect(messages[0].tool_calls).toEqual(toolCalls);
            } else {
              expect(messages[0].tool_calls).toBeUndefined();
            }
          }
        )
      );
    });
  });

  describe('Clear operation', () => {
    it('should remove all messages when cleared', () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryMessage, { minLength: 1, maxLength: 10 }),
          (initialMessages) => {
            const manager = new MessageManager(initialMessages);
            expect(manager.length).toBeGreaterThan(0);
            
            manager.clear();
            
            expect(manager.length).toBe(0);
            expect(manager.getMessages()).toEqual([]);
          }
        )
      );
    });
  });

  describe('Serialization round-trip', () => {
    it('should preserve messages through toJSON/fromJSON', () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryMessage, { minLength: 0, maxLength: 10 }),
          (initialMessages) => {
            const manager = new MessageManager(initialMessages);
            const serialized = manager.toJSON();
            const restored = MessageManager.fromJSON(serialized);
            
            expect(restored.getMessages()).toEqual(manager.getMessages());
            expect(restored.length).toBe(manager.length);
          }
        )
      );
    });
  });

  describe('Immutability of returned messages', () => {
    it('should return a copy that does not affect internal state', () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryMessage, { minLength: 1, maxLength: 5 }),
          (initialMessages) => {
            const manager = new MessageManager(initialMessages);
            const retrieved = manager.getMessages();
            
            // Mutate the retrieved array
            retrieved.push({ role: 'user', content: 'mutated' });
            
            // Internal state should be unchanged
            expect(manager.getMessages()).toHaveLength(initialMessages.length);
          }
        )
      );
    });
  });
});
