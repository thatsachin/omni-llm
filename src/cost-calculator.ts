// Cost Calculator for Unified LLM
import type { Cost, ModelInfo, ServiceName, Usage } from './types';

/**
 * Local services that have zero cost
 */
const LOCAL_SERVICES: ServiceName[] = ['ollama'];

/**
 * Calculates costs for LLM requests based on token usage and model pricing
 */
export class CostCalculator {
  /**
   * Calculate the cost of a request based on usage and model pricing
   * @param usage Token usage from the request
   * @param modelInfo Model information including pricing
   * @returns Cost breakdown or null if pricing unavailable
   */
  static calculate(usage: Usage, modelInfo: ModelInfo | null): Cost | null {
    if (!modelInfo) {
      return null;
    }

    // Calculate costs (pricing is per 1K tokens)
    const inputCost = (usage.input_tokens / 1000) * modelInfo.inputCostPer1k;
    const outputCost = (usage.output_tokens / 1000) * modelInfo.outputCostPer1k;

    // Calculate thinking cost if applicable
    let thinkingCost: number | undefined;
    if (usage.thinking_tokens !== undefined && usage.thinking_tokens > 0) {
      // Thinking tokens typically use output pricing
      thinkingCost = (usage.thinking_tokens / 1000) * modelInfo.outputCostPer1k;
    }

    const totalCost = inputCost + outputCost + (thinkingCost ?? 0);

    return {
      input_cost: inputCost,
      output_cost: outputCost,
      thinking_cost: thinkingCost,
      total_cost: totalCost,
      currency: 'USD',
    };
  }

  /**
   * Check if a service is local (zero cost)
   */
  static isLocal(service: ServiceName): boolean {
    return LOCAL_SERVICES.includes(service);
  }

  /**
   * Calculate cost for a local service (always zero)
   */
  static calculateLocalCost(): Cost {
    return {
      input_cost: 0,
      output_cost: 0,
      total_cost: 0,
      currency: 'USD',
    };
  }

  /**
   * Calculate cost with automatic local service detection
   */
  static calculateWithServiceCheck(
    usage: Usage,
    modelInfo: ModelInfo | null,
    service: ServiceName
  ): Cost | null {
    if (CostCalculator.isLocal(service)) {
      return CostCalculator.calculateLocalCost();
    }
    return CostCalculator.calculate(usage, modelInfo);
  }

  /**
   * Format cost as a human-readable string
   */
  static formatCost(cost: Cost | null): string {
    if (!cost) {
      return 'Unknown';
    }

    if (cost.total_cost === 0) {
      return 'Free (local)';
    }

    // Format to appropriate precision
    if (cost.total_cost < 0.01) {
      return `$${cost.total_cost.toFixed(6)} ${cost.currency}`;
    } else if (cost.total_cost < 1) {
      return `$${cost.total_cost.toFixed(4)} ${cost.currency}`;
    } else {
      return `$${cost.total_cost.toFixed(2)} ${cost.currency}`;
    }
  }

  /**
   * Estimate cost before making a request (based on input tokens only)
   */
  static estimateInputCost(
    inputTokens: number,
    modelInfo: ModelInfo | null
  ): number | null {
    if (!modelInfo) {
      return null;
    }
    return (inputTokens / 1000) * modelInfo.inputCostPer1k;
  }
}
