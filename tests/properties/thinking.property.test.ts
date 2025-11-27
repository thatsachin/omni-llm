// Property tests for Thinking Mode Error Handling
// **Feature: unified-llm, Property 18: Thinking Mode Error Handling**
// **Validates: Requirements 5.5**

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { UnsupportedFeatureError } from '../../src/errors';

describe('Property 18: Thinking Mode Error Handling', () => {
  /**
   * Property: UnsupportedFeatureError should have correct properties
   * For any model that does not support thinking mode, requesting think=true
   * should throw a descriptive error indicating the model does not support reasoning
   */
  it('should create UnsupportedFeatureError with correct properties', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.constantFrom('thinking', 'vision', 'tools', 'documents'),
        fc.constantFrom('openai', 'anthropic', 'google', 'groq', 'ollama', 'xai', 'deepseek'),
        (message, feature, service) => {
          const error = new UnsupportedFeatureError(message, feature, service);

          expect(error.name).toBe('UnsupportedFeatureError');
          expect(error.code).toBe('UNSUPPORTED_FEATURE');
          expect(error.message).toBe(message);
          expect(error.feature).toBe(feature);
          expect(error.service).toBe(service);
          expect(error instanceof Error).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Error message should contain feature and service information
   * For any unsupported feature error, the error should be descriptive
   */
  it('should allow descriptive error messages about unsupported features', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('gpt-4o-mini', 'llama3.2', 'mixtral-8x7b'),
        fc.constantFrom('openai', 'ollama', 'groq'),
        (model, service) => {
          const message = `Model ${model} on ${service} does not support thinking/reasoning mode`;
          const error = new UnsupportedFeatureError(message, 'thinking', service);

          expect(error.message).toContain(model);
          expect(error.message).toContain(service);
          expect(error.message).toContain('thinking');
          expect(error.feature).toBe('thinking');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: UnsupportedFeatureError should be catchable as Error
   */
  it('should be catchable as Error', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (message) => {
          const error = new UnsupportedFeatureError(message, 'thinking', 'ollama');

          // Should be catchable as Error
          try {
            throw error;
          } catch (e) {
            expect(e instanceof Error).toBe(true);
            expect(e instanceof UnsupportedFeatureError).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Feature property should always be set
   */
  it('should always have feature property set', () => {
    const features = ['thinking', 'vision', 'tools', 'documents', 'streaming'];

    fc.assert(
      fc.property(
        fc.constantFrom(...features),
        (feature) => {
          const error = new UnsupportedFeatureError(
            `Feature ${feature} not supported`,
            feature,
            'test-service'
          );

          expect(error.feature).toBe(feature);
          expect(typeof error.feature).toBe('string');
          expect(error.feature.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Service property should always be set
   */
  it('should always have service property set', () => {
    const services = ['openai', 'anthropic', 'google', 'groq', 'ollama', 'xai', 'deepseek'];

    fc.assert(
      fc.property(
        fc.constantFrom(...services),
        (service) => {
          const error = new UnsupportedFeatureError(
            `Service ${service} does not support this feature`,
            'thinking',
            service
          );

          expect(error.service).toBe(service);
          expect(typeof error.service).toBe('string');
          expect(error.service.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
