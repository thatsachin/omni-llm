// Provider Registry for Unified LLM
import type { ServiceName } from '../types';
import { ValidationError } from '../errors';
import { BaseProvider } from './base-provider';

/**
 * Registry for managing LLM providers
 * Handles registration, lookup, and listing of providers
 */
export class ProviderRegistry {
  private providers: Map<string, BaseProvider> = new Map();
  private static instance: ProviderRegistry | null = null;

  /**
   * Get the singleton instance of the registry
   */
  static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    ProviderRegistry.instance = null;
  }

  /**
   * Register a provider with the registry
   * @param name - The service name to register under
   * @param provider - The provider instance
   * @throws ValidationError if name is empty
   */
  register(name: string, provider: BaseProvider): void {
    if (!name || name.trim() === '') {
      throw new ValidationError('Provider name cannot be empty', 'name', name);
    }
    this.providers.set(name.toLowerCase(), provider);
  }

  /**
   * Get a provider by service name
   * @param name - The service name to look up
   * @returns The provider instance
   * @throws ValidationError if provider is not found
   */
  get(name: ServiceName): BaseProvider {
    const provider = this.providers.get(name.toLowerCase());
    if (!provider) {
      throw new ValidationError(
        `Provider '${name}' is not registered. Available providers: ${this.list().join(', ')}`,
        'service',
        name
      );
    }
    return provider;
  }

  /**
   * Check if a provider is registered
   * @param name - The service name to check
   * @returns True if the provider is registered
   */
  has(name: ServiceName): boolean {
    return this.providers.has(name.toLowerCase());
  }

  /**
   * List all registered provider names
   * @returns Array of registered service names
   */
  list(): ServiceName[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Unregister a provider
   * @param name - The service name to unregister
   * @returns True if the provider was unregistered
   */
  unregister(name: string): boolean {
    return this.providers.delete(name.toLowerCase());
  }

  /**
   * Clear all registered providers
   */
  clear(): void {
    this.providers.clear();
  }
}

/**
 * Get the global provider registry instance
 */
export function getProviderRegistry(): ProviderRegistry {
  return ProviderRegistry.getInstance();
}

/**
 * Register a provider globally
 * @param name - The service name to register under
 * @param provider - The provider instance
 */
export function registerProvider(name: string, provider: BaseProvider): void {
  getProviderRegistry().register(name, provider);
}

/**
 * Get a provider from the global registry
 * @param name - The service name to look up
 * @returns The provider instance
 */
export function getProvider(name: ServiceName): BaseProvider {
  return getProviderRegistry().get(name);
}
