/**
 * Property-based tests for Token Usage and Cost Calculation
 * **Feature: unified-llm, Property 9: Token Usage Completeness**
 * **Validates: Requirements 9.1, 9.2, 9.3**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { CostCalculator } from '../../src/cost-calculator';
import { ModelRegistry, getModelRegistry } from '../../src/model-registry';
import type { Usage, ModelInfo, ServiceName } from '../../src/types';

// Configure fast-check for 100 iterations
fc.configureGlobal({ numRuns: 100 });

// Arbitrary generators
const arbitraryUsageWithoutThinking = fc.record({
  input_tokens: fc.nat({ max: 100000 }),
  output_tokens: fc.nat({ max: 100000 }),
}).map((u): Usage => ({
  input_tokens: u.input_tokens,
  output_tokens: u.output_tokens,
  total_tokens: u.input_tokens + u.output_tokens,
}));

const arbitraryUsageWithThinking = fc.record({
  input_tokens: fc.nat({ max: 100000 }),
  output_tokens: fc.nat({ max: 100000 }),
  thinking_tokens: fc.nat({ max: 50000 }),
}).map((u): Usage => ({
  input_tokens: u.input_tokens,
  output_tokens: u.output_tokens,
  thinking_tokens: u.thinking_tokens,
  total_tokens: u.input_tokens + u.output_tokens + u.thinking_tokens,
}));

const arbitraryUsage = fc.oneof(arbitraryUsageWithoutThinking, arbitraryUsageWithThinking);

const arbitraryModelInfo = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  contextWindow: fc.integer({ min: 1000, max: 2000000 }),
  inputCostPer1k: fc.float({ min: 0, max: 1, noNaN: true }),
  outputCostPer1k: fc.float({ min: 0, max: 1, noNaN: true }),
  supportsThinking: fc.boolean(),
  supportsTools: fc.boolean(),
  supportsVision: fc.boolean(),
  supportsDocuments: fc.boolean(),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
}) as fc.Arbitrary<ModelInfo>;


describe('Property 9: Token Usage Completeness', () => {
  /**
   * **Feature: unified-llm, Property 9: Token Usage Completeness**
   * *For any* extended response, the usage object SHALL contain input_tokens,
   * output_tokens, and total_tokens fields with non-negative integer values
   * where total_tokens equals input_tokens + output_tokens (+ thinking_tokens if present).
   */

  it('should have non-negative integer values for all token counts', () => {
    fc.assert(
      fc.property(arbitraryUsage, (usage) => {
        expect(usage.input_tokens).toBeGreaterThanOrEqual(0);
        expect(usage.output_tokens).toBeGreaterThanOrEqual(0);
        expect(usage.total_tokens).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(usage.input_tokens)).toBe(true);
        expect(Number.isInteger(usage.output_tokens)).toBe(true);
        expect(Number.isInteger(usage.total_tokens)).toBe(true);
      })
    );
  });

  it('should have total_tokens equal to sum of input, output, and thinking tokens', () => {
    fc.assert(
      fc.property(arbitraryUsage, (usage) => {
        const expectedTotal =
          usage.input_tokens +
          usage.output_tokens +
          (usage.thinking_tokens ?? 0);
        expect(usage.total_tokens).toBe(expectedTotal);
      })
    );
  });

  it('should have thinking_tokens as non-negative integer when present', () => {
    fc.assert(
      fc.property(arbitraryUsageWithThinking, (usage) => {
        expect(usage.thinking_tokens).toBeDefined();
        expect(usage.thinking_tokens).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(usage.thinking_tokens)).toBe(true);
      })
    );
  });
});

/**
 * **Feature: unified-llm, Property 10: Cost Calculation Correctness**
 * **Validates: Requirements 10.1, 10.4**
 */
describe('Property 10: Cost Calculation Correctness', () => {
  /**
   * *For any* extended response with known model pricing, the cost SHALL be
   * calculated as: input_cost = input_tokens * input_price_per_token,
   * output_cost = output_tokens * output_price_per_token,
   * total_cost = input_cost + output_cost (+ thinking_cost if applicable).
   */

  it('should calculate input_cost correctly', () => {
    fc.assert(
      fc.property(arbitraryUsage, arbitraryModelInfo, (usage, modelInfo) => {
        const cost = CostCalculator.calculate(usage, modelInfo);

        if (cost) {
          const expectedInputCost = (usage.input_tokens / 1000) * modelInfo.inputCostPer1k;
          expect(cost.input_cost).toBeCloseTo(expectedInputCost, 10);
        }
      })
    );
  });

  it('should calculate output_cost correctly', () => {
    fc.assert(
      fc.property(arbitraryUsage, arbitraryModelInfo, (usage, modelInfo) => {
        const cost = CostCalculator.calculate(usage, modelInfo);

        if (cost) {
          const expectedOutputCost = (usage.output_tokens / 1000) * modelInfo.outputCostPer1k;
          expect(cost.output_cost).toBeCloseTo(expectedOutputCost, 10);
        }
      })
    );
  });

  it('should calculate total_cost as sum of all costs', () => {
    fc.assert(
      fc.property(arbitraryUsage, arbitraryModelInfo, (usage, modelInfo) => {
        const cost = CostCalculator.calculate(usage, modelInfo);

        if (cost) {
          const expectedTotal =
            cost.input_cost + cost.output_cost + (cost.thinking_cost ?? 0);
          expect(cost.total_cost).toBeCloseTo(expectedTotal, 10);
        }
      })
    );
  });

  it('should include thinking_cost when thinking_tokens present', () => {
    fc.assert(
      fc.property(arbitraryUsageWithThinking, arbitraryModelInfo, (usage, modelInfo) => {
        const cost = CostCalculator.calculate(usage, modelInfo);

        if (cost && usage.thinking_tokens && usage.thinking_tokens > 0) {
          expect(cost.thinking_cost).toBeDefined();
          const expectedThinkingCost =
            (usage.thinking_tokens / 1000) * modelInfo.outputCostPer1k;
          expect(cost.thinking_cost).toBeCloseTo(expectedThinkingCost, 10);
        }
      })
    );
  });

  it('should return null when modelInfo is null', () => {
    fc.assert(
      fc.property(arbitraryUsage, (usage) => {
        const cost = CostCalculator.calculate(usage, null);
        expect(cost).toBeNull();
      })
    );
  });

  it('should always return USD as currency', () => {
    fc.assert(
      fc.property(arbitraryUsage, arbitraryModelInfo, (usage, modelInfo) => {
        const cost = CostCalculator.calculate(usage, modelInfo);

        if (cost) {
          expect(cost.currency).toBe('USD');
        }
      })
    );
  });
});


/**
 * **Feature: unified-llm, Property 17: Quality Model Filtering**
 * **Validates: Requirements 11.2**
 */
describe('Property 17: Quality Model Filtering', () => {
  /**
   * *For any* service, getQualityModels SHALL return a subset of fetchModels
   * that excludes all models tagged as embeddings, tts, image, audio, or instruct.
   */

  const NON_LLM_TAGS = ['embedding', 'embeddings', 'tts', 'image', 'audio', 'instruct', 'whisper', 'dall-e'];

  const arbitraryServiceName = fc.constantFrom(
    'openai',
    'anthropic',
    'google',
    'groq',
    'deepseek',
    'xai'
  ) as fc.Arbitrary<ServiceName>;

  it('should return subset of all models', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryServiceName, async (service) => {
        const registry = new ModelRegistry();
        const allModels = await registry.fetchModels(service);
        const qualityModels = registry.getQualityModels(service);

        // Quality models should be a subset
        expect(qualityModels.length).toBeLessThanOrEqual(allModels.length);

        // Every quality model should exist in all models
        for (const qm of qualityModels) {
          const found = allModels.some((m) => m.id === qm.id);
          expect(found).toBe(true);
        }
      })
    );
  });

  it('should exclude models with non-LLM tags', () => {
    fc.assert(
      fc.property(arbitraryServiceName, (service) => {
        const registry = new ModelRegistry();
        const qualityModels = registry.getQualityModels(service);

        for (const model of qualityModels) {
          if (model.info) {
            const hasNonLLMTag = model.info.tags.some((tag) =>
              NON_LLM_TAGS.some((nonLLM) => tag.toLowerCase().includes(nonLLM))
            );
            expect(hasNonLLMTag).toBe(false);
          }
        }
      })
    );
  });

  it('should include models without non-LLM tags', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryServiceName, async (service) => {
        const registry = new ModelRegistry();
        const allModels = await registry.fetchModels(service);
        const qualityModels = registry.getQualityModels(service);

        // Models without non-LLM tags should be in quality models
        for (const model of allModels) {
          if (model.info) {
            const hasNonLLMTag = model.info.tags.some((tag) =>
              NON_LLM_TAGS.some((nonLLM) => tag.toLowerCase().includes(nonLLM))
            );

            if (!hasNonLLMTag) {
              const inQuality = qualityModels.some((qm) => qm.id === model.id);
              expect(inQuality).toBe(true);
            }
          }
        }
      })
    );
  });

  it('should filter out custom models with non-LLM tags', () => {
    fc.assert(
      fc.property(
        arbitraryServiceName,
        fc.constantFrom(...NON_LLM_TAGS),
        (service, nonLLMTag) => {
          const registry = new ModelRegistry();

          // Add a custom model with a non-LLM tag
          registry.addCustomModel(service, 'test-embedding-model', {
            name: 'Test Embedding Model',
            contextWindow: 8192,
            inputCostPer1k: 0.0001,
            outputCostPer1k: 0.0001,
            supportsThinking: false,
            supportsTools: false,
            supportsVision: false,
            supportsDocuments: false,
            tags: [nonLLMTag],
          });

          const qualityModels = registry.getQualityModels(service);

          // The model with non-LLM tag should not be in quality models
          const found = qualityModels.some((m) => m.id === 'test-embedding-model');
          expect(found).toBe(false);
        }
      )
    );
  });

  it('should include custom models without non-LLM tags', () => {
    fc.assert(
      fc.property(arbitraryServiceName, (service) => {
        const registry = new ModelRegistry();

        // Add a custom model without non-LLM tags
        registry.addCustomModel(service, 'test-chat-model', {
          name: 'Test Chat Model',
          contextWindow: 8192,
          inputCostPer1k: 0.001,
          outputCostPer1k: 0.002,
          supportsThinking: false,
          supportsTools: true,
          supportsVision: false,
          supportsDocuments: false,
          tags: ['chat'],
        });

        const qualityModels = registry.getQualityModels(service);

        // The model without non-LLM tags should be in quality models
        const found = qualityModels.some((m) => m.id === 'test-chat-model');
        expect(found).toBe(true);
      })
    );
  });
});
