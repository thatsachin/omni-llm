// Model Registry for Unified LLM
import type { Model, ModelInfo, ServiceName } from './types';

/**
 * Default model information for known models
 * Pricing is per 1K tokens in USD
 */
const DEFAULT_MODEL_INFO: Record<string, Record<string, ModelInfo>> = {
  openai: {
    'gpt-4o': {
      name: 'GPT-4o',
      contextWindow: 128000,
      inputCostPer1k: 0.005,
      outputCostPer1k: 0.015,
      supportsThinking: false,
      supportsTools: true,
      supportsVision: true,
      supportsDocuments: false,
      tags: ['chat', 'vision'],
    },
    'gpt-4o-mini': {
      name: 'GPT-4o Mini',
      contextWindow: 128000,
      inputCostPer1k: 0.00015,
      outputCostPer1k: 0.0006,
      supportsThinking: false,
      supportsTools: true,
      supportsVision: true,
      supportsDocuments: false,
      tags: ['chat', 'vision'],
    },
    'gpt-4-turbo': {
      name: 'GPT-4 Turbo',
      contextWindow: 128000,
      inputCostPer1k: 0.01,
      outputCostPer1k: 0.03,
      supportsThinking: false,
      supportsTools: true,
      supportsVision: true,
      supportsDocuments: false,
      tags: ['chat', 'vision'],
    },
    'o1': {
      name: 'o1',
      contextWindow: 200000,
      inputCostPer1k: 0.015,
      outputCostPer1k: 0.06,
      supportsThinking: true,
      supportsTools: true,
      supportsVision: true,
      supportsDocuments: false,
      tags: ['chat', 'reasoning'],
    },
  },
  anthropic: {
    'claude-3-5-sonnet-20241022': {
      name: 'Claude 3.5 Sonnet',
      contextWindow: 200000,
      inputCostPer1k: 0.003,
      outputCostPer1k: 0.015,
      supportsThinking: true,
      supportsTools: true,
      supportsVision: true,
      supportsDocuments: true,
      tags: ['chat', 'vision'],
    },
    'claude-3-5-haiku-20241022': {
      name: 'Claude 3.5 Haiku',
      contextWindow: 200000,
      inputCostPer1k: 0.001,
      outputCostPer1k: 0.005,
      supportsThinking: false,
      supportsTools: true,
      supportsVision: true,
      supportsDocuments: true,
      tags: ['chat', 'vision'],
    },
    'claude-3-opus-20240229': {
      name: 'Claude 3 Opus',
      contextWindow: 200000,
      inputCostPer1k: 0.015,
      outputCostPer1k: 0.075,
      supportsThinking: true,
      supportsTools: true,
      supportsVision: true,
      supportsDocuments: true,
      tags: ['chat', 'vision'],
    },
  },
  google: {
    'gemini-1.5-pro': {
      name: 'Gemini 1.5 Pro',
      contextWindow: 2000000,
      inputCostPer1k: 0.00125,
      outputCostPer1k: 0.005,
      supportsThinking: false,
      supportsTools: true,
      supportsVision: true,
      supportsDocuments: true,
      tags: ['chat', 'vision'],
    },
    'gemini-1.5-flash': {
      name: 'Gemini 1.5 Flash',
      contextWindow: 1000000,
      inputCostPer1k: 0.000075,
      outputCostPer1k: 0.0003,
      supportsThinking: false,
      supportsTools: true,
      supportsVision: true,
      supportsDocuments: true,
      tags: ['chat', 'vision'],
    },
  },
  groq: {
    'llama-3.3-70b-versatile': {
      name: 'Llama 3.3 70B',
      contextWindow: 128000,
      inputCostPer1k: 0.00059,
      outputCostPer1k: 0.00079,
      supportsThinking: false,
      supportsTools: true,
      supportsVision: false,
      supportsDocuments: false,
      tags: ['chat'],
    },
    'mixtral-8x7b-32768': {
      name: 'Mixtral 8x7B',
      contextWindow: 32768,
      inputCostPer1k: 0.00024,
      outputCostPer1k: 0.00024,
      supportsThinking: false,
      supportsTools: true,
      supportsVision: false,
      supportsDocuments: false,
      tags: ['chat'],
    },
  },
  deepseek: {
    'deepseek-chat': {
      name: 'DeepSeek Chat',
      contextWindow: 64000,
      inputCostPer1k: 0.00014,
      outputCostPer1k: 0.00028,
      supportsThinking: false,
      supportsTools: true,
      supportsVision: false,
      supportsDocuments: false,
      tags: ['chat'],
    },
    'deepseek-reasoner': {
      name: 'DeepSeek Reasoner',
      contextWindow: 64000,
      inputCostPer1k: 0.00055,
      outputCostPer1k: 0.00219,
      supportsThinking: true,
      supportsTools: true,
      supportsVision: false,
      supportsDocuments: false,
      tags: ['chat', 'reasoning'],
    },
  },
  xai: {
    'grok-2': {
      name: 'Grok 2',
      contextWindow: 131072,
      inputCostPer1k: 0.002,
      outputCostPer1k: 0.01,
      supportsThinking: false,
      supportsTools: true,
      supportsVision: true,
      supportsDocuments: false,
      tags: ['chat', 'vision'],
    },
  },
};


/**
 * Tags that indicate non-LLM models (for filtering)
 */
const NON_LLM_TAGS = ['embedding', 'embeddings', 'tts', 'image', 'audio', 'instruct', 'whisper', 'dall-e'];

/**
 * Registry for managing model information and pricing
 */
export class ModelRegistry {
  private customModels: Map<string, Map<string, ModelInfo>> = new Map();

  /**
   * Fetch available models for a service
   * Note: This returns cached/known models. For live fetching, use provider.fetchModels()
   */
  async fetchModels(service: ServiceName, _apiKey?: string): Promise<Model[]> {
    const serviceModels = DEFAULT_MODEL_INFO[service] ?? {};
    const customServiceModels = this.customModels.get(service) ?? new Map();

    const models: Model[] = [];

    // Add default models
    for (const [id, info] of Object.entries(serviceModels)) {
      models.push({
        id,
        name: info.name,
        provider: service,
        info,
      });
    }

    // Add custom models
    for (const [id, info] of customServiceModels) {
      models.push({
        id,
        name: info.name,
        provider: service,
        info,
      });
    }

    return models;
  }

  /**
   * Get quality models (excluding embeddings, TTS, image, audio, instruct models)
   */
  getQualityModels(service: ServiceName): Model[] {
    const serviceModels = DEFAULT_MODEL_INFO[service] ?? {};
    const customServiceModels = this.customModels.get(service) ?? new Map();

    const models: Model[] = [];

    // Filter default models
    for (const [id, info] of Object.entries(serviceModels)) {
      if (!this.hasNonLLMTags(info.tags)) {
        models.push({
          id,
          name: info.name,
          provider: service,
          info,
        });
      }
    }

    // Filter custom models
    for (const [id, info] of customServiceModels) {
      if (!this.hasNonLLMTags(info.tags)) {
        models.push({
          id,
          name: info.name,
          provider: service,
          info,
        });
      }
    }

    return models;
  }

  /**
   * Check if tags contain any non-LLM indicators
   */
  private hasNonLLMTags(tags: string[]): boolean {
    return tags.some((tag) =>
      NON_LLM_TAGS.some((nonLLM) => tag.toLowerCase().includes(nonLLM))
    );
  }

  /**
   * Get model information for a specific model
   */
  getModelInfo(service: ServiceName, model: string): ModelInfo | null {
    // Check custom models first
    const customServiceModels = this.customModels.get(service);
    if (customServiceModels?.has(model)) {
      return customServiceModels.get(model)!;
    }

    // Check default models
    const serviceModels = DEFAULT_MODEL_INFO[service];
    if (serviceModels?.[model]) {
      return serviceModels[model];
    }

    return null;
  }

  /**
   * Add a custom model definition
   */
  addCustomModel(service: ServiceName, model: string, info: ModelInfo): void {
    if (!this.customModels.has(service)) {
      this.customModels.set(service, new Map());
    }
    this.customModels.get(service)!.set(model, info);
  }

  /**
   * Remove a custom model definition
   */
  removeCustomModel(service: ServiceName, model: string): boolean {
    const serviceModels = this.customModels.get(service);
    if (serviceModels) {
      return serviceModels.delete(model);
    }
    return false;
  }

  /**
   * Check if a model exists (either default or custom)
   */
  hasModel(service: ServiceName, model: string): boolean {
    return this.getModelInfo(service, model) !== null;
  }

  /**
   * Get all known services
   */
  getKnownServices(): ServiceName[] {
    const services = new Set<ServiceName>([
      ...Object.keys(DEFAULT_MODEL_INFO),
      ...this.customModels.keys(),
    ]);
    return Array.from(services) as ServiceName[];
  }
}

// Singleton instance
let modelRegistryInstance: ModelRegistry | null = null;

/**
 * Get the global ModelRegistry instance
 */
export function getModelRegistry(): ModelRegistry {
  if (!modelRegistryInstance) {
    modelRegistryInstance = new ModelRegistry();
  }
  return modelRegistryInstance;
}
