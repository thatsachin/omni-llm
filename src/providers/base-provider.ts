// Base Provider abstract class for Unified LLM
import type {
  Message,
  Tool,
  ToolDefinition,
  Attachment,
  ContentPart,
  ProviderOptions,
  ProviderResponse,
  ProviderChunk,
  ServiceName,
  Model,
} from '../types';

/**
 * Abstract base class for all LLM providers
 * Providers must implement the abstract methods to handle provider-specific logic
 */
export abstract class BaseProvider {
  /**
   * The name of this provider service
   */
  abstract readonly name: ServiceName;

  /**
   * Whether this provider supports thinking/reasoning mode
   */
  abstract readonly supportsThinking: boolean;

  /**
   * Whether this provider supports tool/function calling
   */
  abstract readonly supportsTools: boolean;

  /**
   * Whether this provider supports vision (image) inputs
   */
  abstract readonly supportsVision: boolean;

  /**
   * Whether this provider supports document (PDF) inputs
   */
  abstract readonly supportsDocuments: boolean;

  /**
   * Send a non-streaming request to the provider
   * @param messages - The conversation messages
   * @param options - Provider-specific options
   * @returns The provider response
   */
  abstract sendRequest(
    messages: Message[],
    options: ProviderOptions
  ): Promise<ProviderResponse>;

  /**
   * Send a streaming request to the provider
   * @param messages - The conversation messages
   * @param options - Provider-specific options
   * @returns An async iterable of response chunks
   */
  abstract sendStreamingRequest(
    messages: Message[],
    options: ProviderOptions
  ): AsyncIterable<ProviderChunk>;

  /**
   * Fetch available models from the provider
   * @param apiKey - Optional API key for authentication
   * @returns List of available models
   */
  abstract fetchModels(apiKey?: string): Promise<Model[]>;

  /**
   * Verify the connection to the provider
   * @param apiKey - Optional API key for authentication
   * @returns True if connection is successful
   */
  abstract verifyConnection(apiKey?: string): Promise<boolean>;

  /**
   * Format messages for the provider's API format
   * Override in subclasses for provider-specific formatting
   * @param messages - The conversation messages
   * @returns Formatted messages for the provider
   */
  protected formatMessages(messages: Message[]): unknown {
    return messages;
  }

  /**
   * Format tools for the provider's API format
   * Override in subclasses for provider-specific formatting
   * @param tools - The tool definitions
   * @returns Formatted tools for the provider
   */
  protected formatTools(tools: Tool[]): ToolDefinition[] {
    return tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /**
   * Format attachments for the provider's API format
   * Override in subclasses for provider-specific formatting
   * @param attachments - The attachments
   * @returns Formatted content parts for the provider
   */
  protected formatAttachments(attachments: Attachment[]): ContentPart[] {
    return attachments.map((attachment) => {
      if (attachment.type === 'image') {
        if (attachment.source === 'url') {
          return {
            type: 'image_url' as const,
            image_url: {
              url: attachment.data as string,
            },
          };
        }
        // base64 or buffer (already converted to base64)
        return {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: attachment.mimeType || 'image/png',
            data: attachment.data as string,
          },
        };
      }
      // document
      return {
        type: 'document' as const,
        source: {
          type: 'base64' as const,
          media_type: attachment.mimeType || 'application/pdf',
          data: attachment.data as string,
        },
      };
    });
  }

  /**
   * Parse the provider's response into a standard format
   * Override in subclasses for provider-specific parsing
   * @param response - The raw provider response
   * @returns Parsed provider response
   */
  protected parseResponse(response: unknown): ProviderResponse {
    return response as ProviderResponse;
  }

  /**
   * Parse a streaming chunk into a standard format
   * Override in subclasses for provider-specific parsing
   * @param chunk - The raw provider chunk
   * @returns Parsed provider chunk
   */
  protected parseChunk(chunk: unknown): ProviderChunk {
    return chunk as ProviderChunk;
  }

  /**
   * Get the default base URL for this provider
   * Override in subclasses to provide provider-specific URLs
   */
  protected getDefaultBaseUrl(): string {
    return '';
  }

  /**
   * Get the environment variable name for the API key
   * Override in subclasses to provide provider-specific env var names
   */
  protected getApiKeyEnvVar(): string {
    return '';
  }
}
