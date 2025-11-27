/**
 * Property tests for provider routing correctness
 * **Feature: unified-llm, Property 1: Provider Routing Correctness**
 * **Feature: unified-llm, Property 16: Custom Service Registration**
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 15.1, 15.3**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  ProviderRegistry,
  BaseProvider,
} from '../../src/providers';
import { ValidationError } from '../../src/errors';
import type {
  Message,
  ProviderOptions,
  ProviderResponse,
  ProviderChunk,
  Model,
  ServiceName,
} from '../../src/types';

// Configure fast-check for 100 iterations
fc.configureGlobal({ numRuns: 100 });

/**
 * Mock provider for testing
 */
class MockProvider extends BaseProvider {
  readonly name: ServiceName;
  readonly supportsThinking: boolean;
  readonly supportsTools: boolean;
  readonly supportsVision: boolean;
  readonly supportsDocuments: boolean;

  constructor(name: ServiceName, options?: Partial<{
    supportsThinking: boolean;
    supportsTools: boolean;
    supportsVision: boolean;
    supportsDocuments: boolean;
  }>) {
    super();
    this.name = name;
    this.supportsThinking = options?.supportsThinking ?? false;
    this.supportsTools = options?.supportsTools ?? false;
    this.supportsVision = options?.supportsVision ?? false;
    this.supportsDocuments = options?.supportsDocuments ?? false;
  }

  async sendRequest(
    _messages: Message[],
    options: ProviderOptions
  ): Promise<ProviderResponse> {
    return {
      content: `Response from ${this.name}`,
      usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
      model: options.model,
    };
  }

  async *sendStreamingRequest(
    _messages: Message[],
    _options: ProviderOptions
  ): AsyncIterable<ProviderChunk> {
    yield { type: 'content', content: `Streaming from ${this.name}` };
  }

  async fetchModels(_apiKey?: string): Promise<Model[]> {
    return [
      { id: `${this.name}-model-1`, name: 'Model 1', provider: this.name },
      { id: `${this.name}-model-2`, name: 'Model 2', provider: this.name },
    ];
  }

  async verifyConnection(_apiKey?: string): Promise<boolean> {
    return true;
  }
}

// Generator for service names
const arbitraryServiceName = fc.constantFrom(
  'openai',
  'anthropic',
  'google',
  'groq',
  'ollama',
  'xai',
  'deepseek'
);

// Generator for custom service names (not built-in)
const arbitraryCustomServiceName = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => /^[a-z][a-z0-9-]*$/.test(s))
  .filter(
    (s) =>
      !['openai', 'anthropic', 'google', 'groq', 'ollama', 'xai', 'deepseek'].includes(s)
  );

describe('Property 1: Provider Routing Correctness', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    // Create a fresh registry for each test (not the singleton)
    registry = new ProviderRegistry();
    registry.clear();
  });

  /**
   * For any supported service name, when a request is made with that service,
   * the request SHALL be routed to the correct provider implementation.
   */

  it('should route to the correct provider for any registered service', () => {
    fc.assert(
      fc.property(arbitraryServiceName, (serviceName) => {
        const provider = new MockProvider(serviceName);
        registry.register(serviceName, provider);

        const retrieved = registry.get(serviceName);

        expect(retrieved).toBe(provider);
        expect(retrieved.name).toBe(serviceName);
      })
    );
  });

  it('should handle case-insensitive service names', () => {
    fc.assert(
      fc.property(
        arbitraryServiceName,
        fc.constantFrom('upper', 'lower', 'mixed'),
        (serviceName, caseType) => {
          const provider = new MockProvider(serviceName);
          registry.register(serviceName, provider);

          let lookupName: string;
          switch (caseType) {
            case 'upper':
              lookupName = serviceName.toUpperCase();
              break;
            case 'mixed':
              lookupName = serviceName
                .split('')
                .map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()))
                .join('');
              break;
            default:
              lookupName = serviceName.toLowerCase();
          }

          const retrieved = registry.get(lookupName);
          expect(retrieved).toBe(provider);
        }
      )
    );
  });

  it('should throw ValidationError for unregistered services', () => {
    fc.assert(
      fc.property(arbitraryServiceName, (serviceName) => {
        // Don't register the provider
        expect(() => registry.get(serviceName)).toThrow(ValidationError);
      })
    );
  });

  it('should correctly report registered services via has()', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryServiceName, { minLength: 1, maxLength: 7 }),
        (serviceNames) => {
          // Create fresh registry for each property test iteration
          const localRegistry = new ProviderRegistry();
          const uniqueNames = [...new Set(serviceNames)];

          // Register some providers
          uniqueNames.forEach((name) => {
            localRegistry.register(name, new MockProvider(name));
          });

          // Check has() returns true for registered
          uniqueNames.forEach((name) => {
            expect(localRegistry.has(name)).toBe(true);
          });

          // Check has() returns false for unregistered
          const allServices = [
            'openai',
            'anthropic',
            'google',
            'groq',
            'ollama',
            'xai',
            'deepseek',
          ];
          const unregistered = allServices.filter((s) => !uniqueNames.includes(s));
          unregistered.forEach((name) => {
            expect(localRegistry.has(name)).toBe(false);
          });
        }
      )
    );
  });

  it('should list all registered providers', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryServiceName, { minLength: 0, maxLength: 7 }),
        (serviceNames) => {
          // Create fresh registry for each property test iteration
          const localRegistry = new ProviderRegistry();
          const uniqueNames = [...new Set(serviceNames)];

          uniqueNames.forEach((name) => {
            localRegistry.register(name, new MockProvider(name));
          });

          const listed = localRegistry.list();
          expect(listed.sort()).toEqual(uniqueNames.sort());
        }
      )
    );
  });
});

describe('Property 16: Custom Service Registration', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    // Create a fresh registry for each test (not the singleton)
    registry = new ProviderRegistry();
    registry.clear();
  });

  afterEach(() => {
    ProviderRegistry.resetInstance();
  });

  /**
   * For any custom service registered with a unique name, subsequent requests
   * specifying that name SHALL use the custom service implementation.
   */

  it('should use custom service for requests after registration', () => {
    fc.assert(
      fc.property(arbitraryCustomServiceName, (customName) => {
        const customProvider = new MockProvider(customName, {
          supportsThinking: true,
          supportsTools: true,
        });

        registry.register(customName, customProvider);

        const retrieved = registry.get(customName);

        expect(retrieved).toBe(customProvider);
        expect(retrieved.name).toBe(customName);
        expect(retrieved.supportsThinking).toBe(true);
        expect(retrieved.supportsTools).toBe(true);
      })
    );
  });

  it('should allow overwriting existing providers', () => {
    fc.assert(
      fc.property(arbitraryServiceName, (serviceName) => {
        const provider1 = new MockProvider(serviceName, { supportsThinking: false });
        const provider2 = new MockProvider(serviceName, { supportsThinking: true });

        registry.register(serviceName, provider1);
        expect(registry.get(serviceName).supportsThinking).toBe(false);

        registry.register(serviceName, provider2);
        expect(registry.get(serviceName).supportsThinking).toBe(true);
        expect(registry.get(serviceName)).toBe(provider2);
      })
    );
  });

  it('should maintain custom providers independently', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryCustomServiceName, { minLength: 2, maxLength: 5 }),
        (customNames) => {
          const uniqueNames = [...new Set(customNames)];
          fc.pre(uniqueNames.length >= 2);

          const providers = uniqueNames.map(
            (name, i) =>
              new MockProvider(name, {
                supportsThinking: i % 2 === 0,
                supportsTools: i % 2 === 1,
              })
          );

          // Register all providers
          uniqueNames.forEach((name, i) => {
            registry.register(name, providers[i]);
          });

          // Verify each provider is independent
          uniqueNames.forEach((name, i) => {
            const retrieved = registry.get(name);
            expect(retrieved).toBe(providers[i]);
            expect(retrieved.supportsThinking).toBe(i % 2 === 0);
            expect(retrieved.supportsTools).toBe(i % 2 === 1);
          });
        }
      )
    );
  });

  it('should throw ValidationError for empty provider names', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('', ' ', '  ', '\t', '\n'),
        (emptyName) => {
          const provider = new MockProvider('test');

          expect(() => registry.register(emptyName, provider)).toThrow(ValidationError);
        }
      )
    );
  });

  it('should support unregistering providers', () => {
    fc.assert(
      fc.property(arbitraryCustomServiceName, (customName) => {
        const provider = new MockProvider(customName);

        registry.register(customName, provider);
        expect(registry.has(customName)).toBe(true);

        const result = registry.unregister(customName);
        expect(result).toBe(true);
        expect(registry.has(customName)).toBe(false);

        // Unregistering again should return false
        expect(registry.unregister(customName)).toBe(false);
      })
    );
  });

  it('should use global registry singleton correctly', () => {
    fc.assert(
      fc.property(arbitraryCustomServiceName, (customName) => {
        // Reset to ensure clean state
        ProviderRegistry.resetInstance();

        const globalRegistry = ProviderRegistry.getInstance();
        const provider = new MockProvider(customName);

        globalRegistry.register(customName, provider);

        // Getting instance again should return same registry
        const sameRegistry = ProviderRegistry.getInstance();
        expect(sameRegistry).toBe(globalRegistry);
        expect(sameRegistry.get(customName)).toBe(provider);

        // Clean up
        ProviderRegistry.resetInstance();
      })
    );
  });
});
