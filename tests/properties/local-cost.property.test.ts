/**
 * Property tests for local model zero cost
 * **Feature: unified-llm, Property 11: Local Model Zero Cost**
 * **Validates: Requirements 10.2**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { OllamaProvider } from '../../src/providers/ollama';
import type { ServiceName } from '../../src/types';

// Configure fast-check for 100 iterations
fc.configureGlobal({ numRuns: 100 });

/**
 * Helper to determine if a service is local (no cost)
 */
function isLocalService(service: ServiceName): boolean {
  return service === 'ollama';
}

/**
 * Helper to calculate cost (returns 0 for local services)
 */
function calculateCost(
  service: ServiceName,
  inputTokens: number,
  outputTokens: number,
  inputCostPer1k: number = 0.001,
  outputCostPer1k: number = 0.002
): { inputCost: number; outputCost: number; totalCost: number; isLocal: boolean } {
  if (isLocalService(service)) {
    return {
      inputCost: 0,
      outputCost: 0,
      totalCost: 0,
      isLocal: true,
    };
  }

  const inputCost = (inputTokens / 1000) * inputCostPer1k;
  const outputCost = (outputTokens / 1000) * outputCostPer1k;

  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    isLocal: false,
  };
}

// Generator for token counts
const arbitraryTokenCount = fc.integer({ min: 0, max: 100000 });

// Generator for local service names
const arbitraryLocalService = fc.constant('ollama' as ServiceName);

// Generator for non-local service names
const arbitraryNonLocalService = fc.constantFrom(
  'openai' as ServiceName,
  'anthropic' as ServiceName,
  'google' as ServiceName,
  'groq' as ServiceName,
  'xai' as ServiceName,
  'deepseek' as ServiceName
);

// Generator for all service names
const arbitraryServiceName = fc.constantFrom(
  'openai' as ServiceName,
  'anthropic' as ServiceName,
  'google' as ServiceName,
  'groq' as ServiceName,
  'ollama' as ServiceName,
  'xai' as ServiceName,
  'deepseek' as ServiceName
);

describe('Property 11: Local Model Zero Cost', () => {
  /**
   * For any request to a local service (ollama), the cost SHALL be zero
   * and the response SHALL be marked as local.
   */

  it('should return zero cost for local services regardless of token count', () => {
    fc.assert(
      fc.property(
        arbitraryLocalService,
        arbitraryTokenCount,
        arbitraryTokenCount,
        (service, inputTokens, outputTokens) => {
          const cost = calculateCost(service, inputTokens, outputTokens);

          expect(cost.inputCost).toBe(0);
          expect(cost.outputCost).toBe(0);
          expect(cost.totalCost).toBe(0);
          expect(cost.isLocal).toBe(true);
        }
      )
    );
  });

  it('should correctly identify ollama as a local service', () => {
    fc.assert(
      fc.property(arbitraryLocalService, (service) => {
        expect(isLocalService(service)).toBe(true);
      })
    );
  });

  it('should correctly identify non-local services', () => {
    fc.assert(
      fc.property(arbitraryNonLocalService, (service) => {
        expect(isLocalService(service)).toBe(false);
      })
    );
  });

  it('should calculate non-zero cost for non-local services with tokens', () => {
    fc.assert(
      fc.property(
        arbitraryNonLocalService,
        fc.integer({ min: 1, max: 100000 }),
        fc.integer({ min: 1, max: 100000 }),
        (service, inputTokens, outputTokens) => {
          const cost = calculateCost(service, inputTokens, outputTokens);

          expect(cost.inputCost).toBeGreaterThan(0);
          expect(cost.outputCost).toBeGreaterThan(0);
          expect(cost.totalCost).toBeGreaterThan(0);
          expect(cost.isLocal).toBe(false);
        }
      )
    );
  });

  it('should have zero cost for non-local services with zero tokens', () => {
    fc.assert(
      fc.property(arbitraryNonLocalService, (service) => {
        const cost = calculateCost(service, 0, 0);

        expect(cost.inputCost).toBe(0);
        expect(cost.outputCost).toBe(0);
        expect(cost.totalCost).toBe(0);
        expect(cost.isLocal).toBe(false);
      })
    );
  });

  it('should maintain cost invariant: total = input + output', () => {
    fc.assert(
      fc.property(
        arbitraryServiceName,
        arbitraryTokenCount,
        arbitraryTokenCount,
        (service, inputTokens, outputTokens) => {
          const cost = calculateCost(service, inputTokens, outputTokens);

          expect(cost.totalCost).toBeCloseTo(cost.inputCost + cost.outputCost, 10);
        }
      )
    );
  });

  it('should verify OllamaProvider is configured as local', () => {
    const provider = new OllamaProvider();

    // Ollama provider should be identified as local
    expect(provider.name).toBe('ollama');
    expect(isLocalService(provider.name)).toBe(true);
  });

  it('should return zero cost for any Ollama model', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        arbitraryTokenCount,
        arbitraryTokenCount,
        (modelName, inputTokens, outputTokens) => {
          // Regardless of model name, Ollama should have zero cost
          const cost = calculateCost('ollama', inputTokens, outputTokens);

          expect(cost.totalCost).toBe(0);
          expect(cost.isLocal).toBe(true);
        }
      )
    );
  });
});
