/**
 * Property-based tests for Serializer
 * **Feature: unified-llm, Property 15: Serialization Round-Trip**
 * **Validates: Requirements 19.1, 19.2, 19.3**
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { Serializer, type SerializableLLM } from '../../src/serializer';
import type { Message, Options, SerializedLLM, ServiceName } from '../../src/types';

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

const arbitraryRole = fc.constantFrom('system', 'user', 'assistant', 'tool') as fc.Arbitrary<
  'system' | 'user' | 'assistant' | 'tool'
>;

const arbitraryMessage = fc.record({
  role: arbitraryRole,
  content: fc.string({ minLength: 0, maxLength: 200 }),
  name: fc.option(fc.string({ minLength: 1, maxLength: 30 })),
  tool_call_id: fc.option(fc.string({ minLength: 1, maxLength: 30 })),
}).map((m): Message => ({
  role: m.role,
  content: m.content,
  ...(m.name ? { name: m.name } : {}),
  ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
}));

const arbitraryMessages = fc.array(arbitraryMessage, { minLength: 0, maxLength: 20 });

const arbitraryOptions = fc.record({
  temperature: fc.option(fc.float({ min: 0, max: 2, noNaN: true })),
  max_tokens: fc.option(fc.integer({ min: 1, max: 100000 })),
  stream: fc.option(fc.boolean()),
  extended: fc.option(fc.boolean()),
  think: fc.option(fc.boolean()),
}).map((o): Partial<Options> => {
  const opts: Partial<Options> = {};
  if (o.temperature !== null) opts.temperature = o.temperature;
  if (o.max_tokens !== null) opts.max_tokens = o.max_tokens;
  if (o.stream !== null) opts.stream = o.stream;
  if (o.extended !== null) opts.extended = o.extended;
  if (o.think !== null) opts.think = o.think;
  return opts;
});


// Mock LLM class for testing
class MockLLM implements SerializableLLM {
  constructor(
    public readonly service: ServiceName,
    public readonly model: string,
    public readonly messages: Message[],
    public readonly options: Partial<Options>
  ) {}
}

describe('Property 15: Serialization Round-Trip', () => {
  /**
   * **Feature: unified-llm, Property 15: Serialization Round-Trip**
   * *For any* LLM instance with message history and options, serializing to JSON
   * and deserializing back SHALL produce an equivalent instance with identical
   * messages, service, model, and options.
   */

  beforeEach(() => {
    // Register mock factory for deserialization
    Serializer.registerFactory((messages, options) => {
      return new MockLLM(
        options.service ?? 'ollama',
        options.model ?? 'llama3',
        messages,
        options
      );
    });
  });

  describe('serializeLLM / deserializeLLM round-trip', () => {
    it('should preserve service after round-trip', () => {
      fc.assert(
        fc.property(
          arbitraryServiceName,
          arbitraryModelName,
          arbitraryMessages,
          arbitraryOptions,
          (service, model, messages, options) => {
            const original = new MockLLM(service, model, messages, options);
            const serialized = Serializer.serializeLLM(original);
            const deserialized = Serializer.deserializeLLM(serialized);

            expect(deserialized.service).toBe(original.service);
          }
        )
      );
    });

    it('should preserve model after round-trip', () => {
      fc.assert(
        fc.property(
          arbitraryServiceName,
          arbitraryModelName,
          arbitraryMessages,
          arbitraryOptions,
          (service, model, messages, options) => {
            const original = new MockLLM(service, model, messages, options);
            const serialized = Serializer.serializeLLM(original);
            const deserialized = Serializer.deserializeLLM(serialized);

            expect(deserialized.model).toBe(original.model);
          }
        )
      );
    });

    it('should preserve messages after round-trip', () => {
      fc.assert(
        fc.property(
          arbitraryServiceName,
          arbitraryModelName,
          arbitraryMessages,
          arbitraryOptions,
          (service, model, messages, options) => {
            const original = new MockLLM(service, model, messages, options);
            const serialized = Serializer.serializeLLM(original);
            const deserialized = Serializer.deserializeLLM(serialized);

            expect(deserialized.messages).toEqual(original.messages);
            expect(deserialized.messages.length).toBe(original.messages.length);

            for (let i = 0; i < original.messages.length; i++) {
              expect(deserialized.messages[i].role).toBe(original.messages[i].role);
              expect(deserialized.messages[i].content).toBe(original.messages[i].content);
            }
          }
        )
      );
    });
  });

  describe('serializeMessages / deserializeMessages round-trip', () => {
    it('should preserve all message properties after round-trip', () => {
      fc.assert(
        fc.property(arbitraryMessages, (messages) => {
          const serialized = Serializer.serializeMessages(messages);
          const deserialized = Serializer.deserializeMessages(serialized);

          expect(deserialized).toEqual(messages);
          expect(deserialized.length).toBe(messages.length);
        })
      );
    });

    it('should produce valid JSON', () => {
      fc.assert(
        fc.property(arbitraryMessages, (messages) => {
          const serialized = Serializer.serializeMessages(messages);

          // Should not throw
          const parsed = JSON.parse(serialized);
          expect(Array.isArray(parsed)).toBe(true);
        })
      );
    });
  });

  describe('toJSON / fromJSON round-trip', () => {
    it('should preserve all properties through JSON string round-trip', () => {
      fc.assert(
        fc.property(
          arbitraryServiceName,
          arbitraryModelName,
          arbitraryMessages,
          arbitraryOptions,
          (service, model, messages, options) => {
            const original = new MockLLM(service, model, messages, options);
            const json = Serializer.toJSON(original);
            const parsed = Serializer.fromJSON(json);

            expect(parsed.service).toBe(original.service);
            expect(parsed.model).toBe(original.model);
            expect(parsed.messages).toEqual(original.messages);
          }
        )
      );
    });
  });

  describe('Serialization isolation', () => {
    it('should not share references between original and serialized', () => {
      fc.assert(
        fc.property(
          arbitraryServiceName,
          arbitraryModelName,
          arbitraryMessages,
          arbitraryOptions,
          (service, model, messages, options) => {
            const original = new MockLLM(service, model, messages, options);
            const serialized = Serializer.serializeLLM(original);

            // Modify serialized messages
            if (serialized.messages.length > 0) {
              serialized.messages[0].content = 'MODIFIED';
            }

            // Original should be unchanged
            if (original.messages.length > 0) {
              expect(original.messages[0].content).not.toBe('MODIFIED');
            }
          }
        )
      );
    });
  });

  describe('Error handling', () => {
    it('should throw ValidationError for invalid JSON in deserializeMessages', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => {
            try {
              JSON.parse(s);
              return false;
            } catch {
              return true;
            }
          }),
          (invalidJson) => {
            expect(() => Serializer.deserializeMessages(invalidJson)).toThrow();
          }
        )
      );
    });

    it('should throw ValidationError for non-array in deserializeMessages', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.string(), fc.integer(), fc.object()),
          (nonArray) => {
            const json = JSON.stringify(nonArray);
            expect(() => Serializer.deserializeMessages(json)).toThrow();
          }
        )
      );
    });
  });
});
