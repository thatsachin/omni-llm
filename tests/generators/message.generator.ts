/**
 * Fast-check arbitraries for Message types
 * Reusable generators for property-based testing
 */
import * as fc from 'fast-check';
import type {
  Message,
  MessageRole,
  ContentPart,
  TextContentPart,
  ImageUrlContentPart,
  ImageContentPart,
  DocumentContentPart,
  ToolCall,
} from '../../src/types';

// Basic content generators
export const arbitraryTextContent = fc.string({ minLength: 1, maxLength: 500 });

export const arbitraryShortText = fc.string({ minLength: 1, maxLength: 100 });

// Content part generators
export const arbitraryTextContentPart: fc.Arbitrary<TextContentPart> = fc.record({
  type: fc.constant('text' as const),
  text: fc.string({ minLength: 1 }),
});

export const arbitraryImageUrlContentPart: fc.Arbitrary<ImageUrlContentPart> = fc.record({
  type: fc.constant('image_url' as const),
  image_url: fc.record({
    url: fc.webUrl(),
    detail: fc.option(fc.constantFrom('auto', 'low', 'high') as fc.Arbitrary<'auto' | 'low' | 'high'>),
  }).map(({ url, detail }) => ({
    url,
    ...(detail !== null ? { detail } : {}),
  })),
});

export const arbitraryImageContentPart: fc.Arbitrary<ImageContentPart> = fc.record({
  type: fc.constant('image' as const),
  source: fc.record({
    type: fc.constant('base64' as const),
    media_type: fc.constantFrom('image/jpeg', 'image/png', 'image/gif', 'image/webp'),
    data: fc.base64String({ minLength: 10, maxLength: 100 }),
  }),
});

export const arbitraryDocumentContentPart: fc.Arbitrary<DocumentContentPart> = fc.record({
  type: fc.constant('document' as const),
  source: fc.record({
    type: fc.constant('base64' as const),
    media_type: fc.constant('application/pdf'),
    data: fc.base64String({ minLength: 10, maxLength: 100 }),
  }),
});

export const arbitraryContentPart: fc.Arbitrary<ContentPart> = fc.oneof(
  arbitraryTextContentPart,
  arbitraryImageUrlContentPart,
  arbitraryImageContentPart,
  arbitraryDocumentContentPart
);

// Simple content part (text only) for most tests
export const arbitrarySimpleContentPart: fc.Arbitrary<ContentPart> = arbitraryTextContentPart;


// Tool call generator
export const arbitraryToolCall: fc.Arbitrary<ToolCall> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  type: fc.constant('function' as const),
  function: fc.record({
    name: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s)),
    arguments: fc.json(),
  }),
});

// Message role generator
export const arbitraryMessageRole: fc.Arbitrary<MessageRole> = fc.constantFrom(
  'system',
  'user',
  'assistant',
  'tool'
);

// Individual message type generators
export const arbitrarySystemMessage: fc.Arbitrary<Message> = fc.record({
  role: fc.constant('system' as const),
  content: arbitraryTextContent,
});

export const arbitraryUserMessage: fc.Arbitrary<Message> = fc.record({
  role: fc.constant('user' as const),
  content: fc.oneof(
    arbitraryTextContent,
    fc.array(arbitrarySimpleContentPart, { minLength: 1, maxLength: 3 })
  ),
});

export const arbitraryAssistantMessage: fc.Arbitrary<Message> = fc
  .record({
    role: fc.constant('assistant' as const),
    content: arbitraryTextContent,
    tool_calls: fc.option(fc.array(arbitraryToolCall, { minLength: 1, maxLength: 3 })),
  })
  .map((msg) => {
    if (msg.tool_calls === null) {
      const { tool_calls, ...rest } = msg;
      return rest as Message;
    }
    return msg as Message;
  });

export const arbitraryToolMessage: fc.Arbitrary<Message> = fc.record({
  role: fc.constant('tool' as const),
  content: arbitraryTextContent,
  tool_call_id: fc.string({ minLength: 1, maxLength: 50 }),
});

// Combined message generator (any type)
export const arbitraryMessage: fc.Arbitrary<Message> = fc.oneof(
  arbitrarySystemMessage,
  arbitraryUserMessage,
  arbitraryAssistantMessage,
  arbitraryToolMessage
);

// Message array generators
export const arbitraryMessages = (
  minLength = 0,
  maxLength = 10
): fc.Arbitrary<Message[]> => fc.array(arbitraryMessage, { minLength, maxLength });

// Conversation generator (alternating user/assistant)
export const arbitraryConversation = (
  turns = 5
): fc.Arbitrary<Message[]> =>
  fc.array(arbitraryTextContent, { minLength: turns, maxLength: turns }).map((contents) =>
    contents.map((content, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as MessageRole,
      content,
    }))
  );

// Message with optional system prefix
export const arbitraryConversationWithSystem = (
  turns = 5
): fc.Arbitrary<Message[]> =>
  fc
    .tuple(fc.option(arbitraryTextContent), arbitraryConversation(turns))
    .map(([systemContent, conversation]) => {
      if (systemContent !== null) {
        return [{ role: 'system' as const, content: systemContent }, ...conversation];
      }
      return conversation;
    });
