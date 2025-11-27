/**
 * Property-based tests for StreamHandler
 * **Feature: unified-llm, Property 3: Streaming Completion Consistency**
 * **Validates: Requirements 4.3, 4.4, 9.4**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { StreamHandler } from '../../src/stream-handler';
import type { ProviderChunk, ServiceName, Usage, ToolCall } from '../../src/types';

// Configure fast-check for 100 iterations
fc.configureGlobal({ numRuns: 100 });

// Arbitrary generators
const arbitraryServiceName = fc.constantFrom(
  'openai',
  'anthropic',
  'google',
  'groq',
  'ollama',
  'xai',
  'deepseek'
) as fc.Arbitrary<ServiceName>;

const arbitraryModelName = fc.string({ minLength: 1, maxLength: 50 });

const arbitraryContentChunk = fc.string({ minLength: 0, maxLength: 100 }).map(
  (content): ProviderChunk => ({
    type: 'content',
    content,
  })
);

const arbitraryUsage = fc.record({
  input_tokens: fc.nat({ max: 10000 }),
  output_tokens: fc.nat({ max: 10000 }),
  thinking_tokens: fc.option(fc.nat({ max: 10000 })),
}).map((u): Usage => ({
  input_tokens: u.input_tokens,
  output_tokens: u.output_tokens,
  thinking_tokens: u.thinking_tokens ?? undefined,
  total_tokens: u.input_tokens + u.output_tokens + (u.thinking_tokens ?? 0),
}));

const arbitraryToolCall = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  arguments: fc.json(),
}).map((t): ToolCall => ({
  id: t.id,
  type: 'function',
  function: {
    name: t.name,
    arguments: t.arguments,
  },
}));


// Helper to create async iterable from array
async function* arrayToAsyncIterable<T>(arr: T[]): AsyncIterable<T> {
  for (const item of arr) {
    yield item;
  }
}

// Helper to consume async iterable
async function consumeStream(handler: StreamHandler, chunks: ProviderChunk[]): Promise<void> {
  for await (const _ of handler.process(arrayToAsyncIterable(chunks))) {
    // consume
  }
}

describe('Property 3: Streaming Completion Consistency', () => {
  /**
   * **Feature: unified-llm, Property 3: Streaming Completion Consistency**
   * *For any* streaming request with extended option enabled, after the stream
   * completes, the complete() method SHALL return an ExtendedResponse containing
   * the full concatenated content, accurate token usage, and calculated cost.
   */

  describe('Content concatenation', () => {
    it('should concatenate all content chunks into complete response', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryServiceName,
          arbitraryModelName,
          fc.array(fc.string({ minLength: 0, maxLength: 50 }), { minLength: 0, maxLength: 20 }),
          async (service, model, contentParts) => {
            const handler = new StreamHandler(service, model);
            const chunks: ProviderChunk[] = contentParts.map((content) => ({
              type: 'content',
              content,
            }));

            await consumeStream(handler, chunks);
            const response = handler.getComplete();

            const expectedContent = contentParts.join('');
            expect(response.content).toBe(expectedContent);
            expect(response.service).toBe(service);
            expect(response.model).toBe(model);
          }
        )
      );
    });
  });

  describe('Thinking content concatenation', () => {
    it('should concatenate all thinking chunks into complete response', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryServiceName,
          arbitraryModelName,
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
          async (service, model, thinkingParts) => {
            const handler = new StreamHandler(service, model);
            const chunks: ProviderChunk[] = thinkingParts.map((thinking) => ({
              type: 'thinking',
              thinking,
            }));

            await consumeStream(handler, chunks);
            const response = handler.getComplete();

            const expectedThinking = thinkingParts.join('');
            expect(response.thinking).toBe(expectedThinking);
          }
        )
      );
    });
  });

  describe('Usage tracking', () => {
    it('should include usage from the last usage chunk', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryServiceName,
          arbitraryModelName,
          fc.array(arbitraryContentChunk, { minLength: 1, maxLength: 5 }),
          arbitraryUsage,
          async (service, model, contentChunks, usage) => {
            const handler = new StreamHandler(service, model);
            const chunks: ProviderChunk[] = [
              ...contentChunks,
              { type: 'usage', usage },
            ];

            await consumeStream(handler, chunks);
            const response = handler.getComplete();

            expect(response.usage.input_tokens).toBe(usage.input_tokens);
            expect(response.usage.output_tokens).toBe(usage.output_tokens);
            expect(response.usage.total_tokens).toBe(usage.total_tokens);
            if (usage.thinking_tokens !== undefined) {
              expect(response.usage.thinking_tokens).toBe(usage.thinking_tokens);
            }
          }
        )
      );
    });
  });

  describe('Tool calls accumulation', () => {
    it('should accumulate all tool calls in order', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryServiceName,
          arbitraryModelName,
          fc.array(arbitraryToolCall, { minLength: 1, maxLength: 5 }),
          async (service, model, toolCalls) => {
            const handler = new StreamHandler(service, model);
            const chunks: ProviderChunk[] = toolCalls.map((toolCall) => ({
              type: 'tool_call',
              toolCall,
            }));

            await consumeStream(handler, chunks);
            const response = handler.getComplete();

            expect(response.toolCalls).toHaveLength(toolCalls.length);
            for (let i = 0; i < toolCalls.length; i++) {
              expect(response.toolCalls![i].id).toBe(toolCalls[i].id);
              expect(response.toolCalls![i].function.name).toBe(toolCalls[i].function.name);
            }
          }
        )
      );
    });
  });

  describe('Mixed chunk types', () => {
    it('should handle mixed content, thinking, tool calls, and usage', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryServiceName,
          arbitraryModelName,
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 3 }),
          fc.array(arbitraryToolCall, { minLength: 0, maxLength: 2 }),
          arbitraryUsage,
          async (service, model, contentParts, thinkingParts, toolCalls, usage) => {
            const handler = new StreamHandler(service, model);

            const chunks: ProviderChunk[] = [];
            
            for (let i = 0; i < Math.max(contentParts.length, thinkingParts.length); i++) {
              if (i < contentParts.length) {
                chunks.push({ type: 'content', content: contentParts[i] });
              }
              if (i < thinkingParts.length) {
                chunks.push({ type: 'thinking', thinking: thinkingParts[i] });
              }
            }

            for (const toolCall of toolCalls) {
              chunks.push({ type: 'tool_call', toolCall });
            }

            chunks.push({ type: 'usage', usage });

            await consumeStream(handler, chunks);
            const response = handler.getComplete();

            expect(response.content).toBe(contentParts.join(''));
            if (thinkingParts.length > 0) {
              expect(response.thinking).toBe(thinkingParts.join(''));
            }
            expect(response.toolCalls?.length ?? 0).toBe(toolCalls.length);
            expect(response.usage.input_tokens).toBe(usage.input_tokens);
          }
        )
      );
    });
  });

  describe('Completion state', () => {
    it('should throw error if getComplete called before stream finishes', () => {
      fc.assert(
        fc.property(arbitraryServiceName, arbitraryModelName, (service, model) => {
          const handler = new StreamHandler(service, model);

          expect(() => handler.getComplete()).toThrow('Stream is not complete');
          expect(handler.getIsComplete()).toBe(false);
        })
      );
    });

    it('should mark as complete after processing', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryServiceName,
          arbitraryModelName,
          fc.array(arbitraryContentChunk, { minLength: 0, maxLength: 5 }),
          async (service, model, chunks) => {
            const handler = new StreamHandler(service, model);

            await consumeStream(handler, chunks);

            expect(handler.getIsComplete()).toBe(true);
            const response = handler.getComplete();
            expect(response).toBeDefined();
          }
        )
      );
    });
  });
});
