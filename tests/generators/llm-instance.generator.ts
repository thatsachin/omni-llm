/**
 * Fast-check arbitraries for LLM instance types
 * Reusable generators for property-based testing
 */
import * as fc from 'fast-check';
import type {
  Message,
  Options,
  ServiceName,
  Usage,
  Cost,
  ExtendedResponse,
  Chunk,
  ChunkType,
  SerializedLLM,
  ProviderResponse,
  ProviderChunk,
} from '../../src/types';
import { arbitraryMessage, arbitraryMessages, arbitraryToolCall } from './message.generator';
import { arbitraryBuiltInService, arbitraryModelName, arbitraryPartialOptions } from './options.generator';

// Usage generator
export const arbitraryUsage: fc.Arbitrary<Usage> = fc
  .tuple(
    fc.integer({ min: 0, max: 10000 }),
    fc.integer({ min: 0, max: 10000 }),
    fc.option(fc.integer({ min: 0, max: 5000 }))
  )
  .map(([input_tokens, output_tokens, thinking_tokens]) => ({
    input_tokens,
    output_tokens,
    ...(thinking_tokens !== null ? { thinking_tokens } : {}),
    total_tokens: input_tokens + output_tokens + (thinking_tokens ?? 0),
  }));

// Cost generator
export const arbitraryCost: fc.Arbitrary<Cost> = fc
  .tuple(
    fc.float({ min: 0, max: 1, noNaN: true }),
    fc.float({ min: 0, max: 1, noNaN: true }),
    fc.option(fc.float({ min: 0, max: 0.5, noNaN: true }))
  )
  .map(([input_cost, output_cost, thinking_cost]) => ({
    input_cost,
    output_cost,
    ...(thinking_cost !== null ? { thinking_cost } : {}),
    total_cost: input_cost + output_cost + (thinking_cost ?? 0),
    currency: 'USD' as const,
  }));

// Extended response generator
export const arbitraryExtendedResponse: fc.Arbitrary<ExtendedResponse> = fc.record({
  content: fc.string({ minLength: 1, maxLength: 500 }),
  thinking: fc.option(fc.string({ minLength: 1, maxLength: 200 })),
  usage: arbitraryUsage,
  cost: fc.option(arbitraryCost),
  model: arbitraryModelName,
  service: arbitraryBuiltInService,
  toolCalls: fc.option(fc.array(arbitraryToolCall, { minLength: 1, maxLength: 3 })),
}).map((r) => {
  const response: ExtendedResponse = {
    content: r.content,
    usage: r.usage,
    cost: r.cost,
    model: r.model,
    service: r.service,
  };
  if (r.thinking !== null) response.thinking = r.thinking;
  if (r.toolCalls !== null) response.toolCalls = r.toolCalls;
  return response;
});


// Chunk type generator
export const arbitraryChunkType: fc.Arbitrary<ChunkType> = fc.constantFrom(
  'content',
  'thinking',
  'tool_call',
  'usage'
);

// Content chunk generator
export const arbitraryContentChunk: fc.Arbitrary<Chunk> = fc
  .string({ minLength: 1, maxLength: 50 })
  .map((content) => ({
    type: 'content' as const,
    content,
  }));

// Thinking chunk generator
export const arbitraryThinkingChunk: fc.Arbitrary<Chunk> = fc
  .string({ minLength: 1, maxLength: 50 })
  .map((thinking) => ({
    type: 'thinking' as const,
    thinking,
  }));

// Tool call chunk generator
export const arbitraryToolCallChunk: fc.Arbitrary<Chunk> = arbitraryToolCall.map((toolCall) => ({
  type: 'tool_call' as const,
  toolCall,
}));

// Usage chunk generator
export const arbitraryUsageChunk: fc.Arbitrary<Chunk> = arbitraryUsage.map((usage) => ({
  type: 'usage' as const,
  usage,
}));

// Any chunk generator
export const arbitraryChunk: fc.Arbitrary<Chunk> = fc.oneof(
  arbitraryContentChunk,
  arbitraryThinkingChunk,
  arbitraryToolCallChunk,
  arbitraryUsageChunk
);

// Serialized LLM generator
export const arbitrarySerializedLLM: fc.Arbitrary<SerializedLLM> = fc.record({
  service: arbitraryBuiltInService,
  model: arbitraryModelName,
  messages: arbitraryMessages(0, 10),
  options: arbitraryPartialOptions,
});

// Provider response generator
export const arbitraryProviderResponse: fc.Arbitrary<ProviderResponse> = fc.record({
  content: fc.string({ minLength: 1, maxLength: 500 }),
  thinking: fc.option(fc.string({ minLength: 1, maxLength: 200 })),
  toolCalls: fc.option(fc.array(arbitraryToolCall, { minLength: 1, maxLength: 3 })),
  usage: arbitraryUsage,
  model: arbitraryModelName,
}).map((r) => {
  const response: ProviderResponse = {
    content: r.content,
    usage: r.usage,
    model: r.model,
  };
  if (r.thinking !== null) response.thinking = r.thinking;
  if (r.toolCalls !== null) response.toolCalls = r.toolCalls;
  return response;
});

// Provider chunk generator
export const arbitraryProviderChunk: fc.Arbitrary<ProviderChunk> = fc.oneof(
  fc.string({ minLength: 1, maxLength: 50 }).map((content) => ({
    type: 'content' as const,
    content,
  })),
  fc.string({ minLength: 1, maxLength: 50 }).map((thinking) => ({
    type: 'thinking' as const,
    thinking,
  })),
  arbitraryToolCall.map((toolCall) => ({
    type: 'tool_call' as const,
    toolCall,
  })),
  arbitraryUsage.map((usage) => ({
    type: 'usage' as const,
    usage,
  }))
);

// Stream of chunks (simulates streaming response)
export const arbitraryChunkStream = (
  minChunks = 1,
  maxChunks = 10
): fc.Arbitrary<Chunk[]> =>
  fc.array(arbitraryContentChunk, { minLength: minChunks, maxLength: maxChunks });

// Stream with usage at end
export const arbitraryChunkStreamWithUsage = (
  minChunks = 1,
  maxChunks = 10
): fc.Arbitrary<Chunk[]> =>
  fc
    .tuple(
      fc.array(arbitraryContentChunk, { minLength: minChunks, maxLength: maxChunks }),
      arbitraryUsageChunk
    )
    .map(([chunks, usageChunk]) => [...chunks, usageChunk]);
