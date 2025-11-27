// Property tests for Options Passthrough
// **Feature: unified-llm, Property 12: Options Passthrough**
// **Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5**

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { LLM } from '../../src/llm';
import type { Options } from '../../src/types';

describe('Property 12: Options Passthrough', () => {
  // Generator for valid temperature values
  const temperatureArb = fc.float({ min: 0, max: 2, noNaN: true });

  // Generator for valid max_tokens values
  const maxTokensArb = fc.integer({ min: 1, max: 100000 });

  // Generator for model names
  const modelArb = fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_'.split('')), {
    minLength: 1,
    maxLength: 50,
  });

  /**
   * Property: Instance-level options should be preserved
   * For any valid options set at instance creation, those options should be
   * accessible via the options property
   */
  it('should preserve instance-level default options', () => {
    fc.assert(
      fc.property(
        temperatureArb,
        maxTokensArb,
        (temperature, max_tokens) => {
          const instanceOptions: Options = {
            service: 'ollama',
            temperature,
            max_tokens,
          };

          const llm = new LLM(undefined, instanceOptions);

          // Instance options should be preserved
          expect(llm.options.temperature).toBe(temperature);
          expect(llm.options.max_tokens).toBe(max_tokens);
        }
      ),
      { numRuns: 100 }
    );
  });


  /**
   * Property: Request-level options should take precedence over instance defaults
   * For any instance with default options and any request with different options,
   * the merged options should have request options taking precedence
   */
  it('should merge options with request options taking precedence', () => {
    fc.assert(
      fc.property(
        temperatureArb,
        temperatureArb,
        maxTokensArb,
        maxTokensArb,
        (instanceTemp, requestTemp, instanceMaxTokens, requestMaxTokens) => {
          const instanceOptions: Options = {
            service: 'ollama',
            temperature: instanceTemp,
            max_tokens: instanceMaxTokens,
          };

          const llm = new LLM(undefined, instanceOptions);

          // Access the private mergeOptions method via type assertion
          const mergedOptions = (llm as any).mergeOptions({
            temperature: requestTemp,
            max_tokens: requestMaxTokens,
          });

          // Request options should take precedence
          expect(mergedOptions.temperature).toBe(requestTemp);
          expect(mergedOptions.max_tokens).toBe(requestMaxTokens);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Model option should be passed correctly
   * For any model name specified, it should be accessible on the instance
   */
  it('should pass model option correctly', () => {
    fc.assert(
      fc.property(modelArb, (model) => {
        const llm = new LLM(undefined, {
          service: 'ollama',
          model,
        });

        expect(llm.model).toBe(model);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Service option should be passed correctly
   * For any supported service, it should be accessible on the instance
   */
  it('should pass service option correctly', () => {
    const services = ['openai', 'anthropic', 'google', 'groq', 'ollama', 'xai', 'deepseek'] as const;

    fc.assert(
      fc.property(fc.constantFrom(...services), (service) => {
        const llm = new LLM(undefined, { service });

        expect(llm.service).toBe(service);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Partial request options should not override unspecified instance options
   * When request options only specify some fields, instance defaults for other fields
   * should be preserved
   */
  it('should preserve instance defaults for unspecified request options', () => {
    fc.assert(
      fc.property(
        temperatureArb,
        maxTokensArb,
        temperatureArb,
        (instanceTemp, instanceMaxTokens, requestTemp) => {
          const instanceOptions: Options = {
            service: 'ollama',
            temperature: instanceTemp,
            max_tokens: instanceMaxTokens,
          };

          const llm = new LLM(undefined, instanceOptions);

          // Only specify temperature in request
          const mergedOptions = (llm as any).mergeOptions({
            temperature: requestTemp,
          });

          // Request temperature should override
          expect(mergedOptions.temperature).toBe(requestTemp);
          // Instance max_tokens should be preserved
          expect(mergedOptions.max_tokens).toBe(instanceMaxTokens);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty request options should use all instance defaults
   */
  it('should use all instance defaults when request options are empty', () => {
    fc.assert(
      fc.property(
        temperatureArb,
        maxTokensArb,
        (temperature, max_tokens) => {
          const instanceOptions: Options = {
            service: 'ollama',
            temperature,
            max_tokens,
          };

          const llm = new LLM(undefined, instanceOptions);
          const mergedOptions = (llm as any).mergeOptions({});

          expect(mergedOptions.temperature).toBe(temperature);
          expect(mergedOptions.max_tokens).toBe(max_tokens);
        }
      ),
      { numRuns: 100 }
    );
  });
});
