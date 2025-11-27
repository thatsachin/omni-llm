// Anthropic Provider for Unified LLM
import { BaseProvider } from './base-provider';
import {
  AuthenticationError,
  NetworkError,
  RateLimitError,
  ModelNotFoundError,
} from '../errors';
import type {
  Message,
  ProviderOptions,
  ProviderResponse,
  ProviderChunk,
  Model,
  ServiceName,
  Usage,
  ToolCall,
  ContentPart,
} from '../types';

/**
 * Anthropic API provider implementation
 */
export class AnthropicProvider extends BaseProvider {
  readonly name: ServiceName = 'anthropic';
  readonly supportsThinking = true; // Claude supports extended thinking
  readonly supportsTools = true;
  readonly supportsVision = true;
  readonly supportsDocuments = true; // Claude supports PDF

  private readonly defaultBaseUrl = 'https://api.anthropic.com/v1';
  private readonly apiVersion = '2023-06-01';

  /**
   * Send a non-streaming request to Anthropic
   */
  async sendRequest(
    messages: Message[],
    options: ProviderOptions
  ): Promise<ProviderResponse> {
    const apiKey = options.apiKey || this.getApiKeyFromEnv();

    if (!apiKey) {
      throw new AuthenticationError(
        'Anthropic API key is required. Provide it via options.apiKey or ANTHROPIC_API_KEY environment variable.',
        this.name
      );
    }

    const body = this.buildRequestBody(messages, options, false);
    const baseUrl = options.baseUrl || this.defaultBaseUrl;

    const response = await this.makeRequest(
      `${baseUrl}/messages`,
      apiKey,
      body,
      options.signal
    );

    return this.parseResponse(response);
  }


  /**
   * Send a streaming request to Anthropic
   */
  async *sendStreamingRequest(
    messages: Message[],
    options: ProviderOptions
  ): AsyncIterable<ProviderChunk> {
    const apiKey = options.apiKey || this.getApiKeyFromEnv();
    const baseUrl = options.baseUrl || this.defaultBaseUrl;

    if (!apiKey) {
      throw new AuthenticationError(
        'Anthropic API key is required. Provide it via options.apiKey or ANTHROPIC_API_KEY environment variable.',
        this.name
      );
    }

    const body = this.buildRequestBody(messages, options, true);

    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': this.apiVersion,
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    if (!response.body) {
      throw new NetworkError('No response body received from Anthropic');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedToolCalls: Map<number, ToolCall> = new Map();
    let usage: Usage | undefined;
    let inputTokens = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(trimmed.slice(6));

            // Handle message_start for input tokens
            if (data.type === 'message_start' && data.message?.usage) {
              inputTokens = data.message.usage.input_tokens || 0;
            }

            // Handle content_block_delta for text and thinking
            if (data.type === 'content_block_delta') {
              const delta = data.delta;
              if (delta?.type === 'text_delta' && delta.text) {
                yield { type: 'content', content: delta.text };
              }
              if (delta?.type === 'thinking_delta' && delta.thinking) {
                yield { type: 'thinking', thinking: delta.thinking };
              }
              if (delta?.type === 'input_json_delta' && delta.partial_json) {
                // Tool call argument streaming
                const index = data.index;
                const existing = accumulatedToolCalls.get(index);
                if (existing) {
                  existing.function.arguments += delta.partial_json;
                }
              }
            }

            // Handle content_block_start for tool use
            if (data.type === 'content_block_start' && data.content_block?.type === 'tool_use') {
              const block = data.content_block;
              accumulatedToolCalls.set(data.index, {
                id: block.id,
                type: 'function',
                function: { name: block.name, arguments: '' },
              });
            }

            // Handle message_delta for usage
            if (data.type === 'message_delta' && data.usage) {
              usage = {
                input_tokens: inputTokens,
                output_tokens: data.usage.output_tokens || 0,
                total_tokens: inputTokens + (data.usage.output_tokens || 0),
              };
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      // Yield accumulated tool calls
      for (const toolCall of accumulatedToolCalls.values()) {
        yield { type: 'tool_call', toolCall };
      }

      // Yield usage if available
      if (usage) {
        yield { type: 'usage', usage };
      }
    } finally {
      reader.releaseLock();
    }
  }


  /**
   * Fetch available models from Anthropic
   */
  async fetchModels(_apiKey?: string): Promise<Model[]> {
    // Anthropic doesn't have a models endpoint, return known models
    return [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: this.name },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: this.name },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: this.name },
      { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', provider: this.name },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: this.name },
    ];
  }

  /**
   * Verify connection to Anthropic
   */
  async verifyConnection(apiKey?: string): Promise<boolean> {
    const key = apiKey || this.getApiKeyFromEnv();
    if (!key) return false;

    try {
      // Make a minimal request to verify the API key
      const response = await fetch(`${this.defaultBaseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': this.apiVersion,
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      });
      return response.ok || response.status === 400; // 400 means auth worked but request was bad
    } catch {
      return false;
    }
  }

  /**
   * Build the request body for Anthropic API
   */
  private buildRequestBody(
    messages: Message[],
    options: ProviderOptions,
    stream: boolean
  ): Record<string, unknown> {
    const { systemMessage, conversationMessages } = this.extractSystemMessage(messages);

    const body: Record<string, unknown> = {
      model: options.model,
      messages: this.formatMessages(conversationMessages),
      max_tokens: options.max_tokens || 4096,
      stream,
    };

    if (systemMessage) {
      body.system = systemMessage;
    }

    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    if (options.tools && options.tools.length > 0) {
      body.tools = this.formatToolsForAnthropic(options.tools);
    }

    // Handle thinking mode (extended thinking)
    if (options.think) {
      body.thinking = {
        type: 'enabled',
        budget_tokens: options.max_thinking_tokens || 10000,
      };
    }

    return body;
  }

  /**
   * Extract system message from messages array
   */
  private extractSystemMessage(messages: Message[]): {
    systemMessage: string | null;
    conversationMessages: Message[];
  } {
    const systemMessages = messages.filter((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    const systemMessage = systemMessages.length > 0
      ? systemMessages.map((m) => typeof m.content === 'string' ? m.content : '').join('\n')
      : null;

    return { systemMessage, conversationMessages };
  }


  /**
   * Format messages for Anthropic API
   */
  protected formatMessages(messages: Message[]): unknown[] {
    return messages.map((msg) => {
      // Handle tool result messages
      if (msg.role === 'tool') {
        return {
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: msg.tool_call_id,
            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          }],
        };
      }

      // Handle assistant messages with tool calls
      if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
        const content: unknown[] = [];
        if (msg.content && typeof msg.content === 'string' && msg.content.trim()) {
          content.push({ type: 'text', text: msg.content });
        }
        for (const tc of msg.tool_calls) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments || '{}'),
          });
        }
        return { role: 'assistant', content };
      }

      // Handle regular messages
      return {
        role: msg.role,
        content: this.formatContent(msg.content),
      };
    });
  }

  /**
   * Format content for Anthropic API
   */
  private formatContent(content: string | ContentPart[]): unknown {
    if (typeof content === 'string') {
      return content;
    }

    return content.map((part) => {
      if (part.type === 'text') {
        return { type: 'text', text: part.text };
      }
      if (part.type === 'image_url') {
        // Anthropic needs base64 for images, but we can try URL
        return {
          type: 'image',
          source: {
            type: 'url',
            url: part.image_url.url,
          },
        };
      }
      if (part.type === 'image') {
        return {
          type: 'image',
          source: {
            type: 'base64',
            media_type: part.source.media_type,
            data: part.source.data,
          },
        };
      }
      if (part.type === 'document') {
        return {
          type: 'document',
          source: {
            type: 'base64',
            media_type: part.source.media_type,
            data: part.source.data,
          },
        };
      }
      return part;
    });
  }

  /**
   * Format tools for Anthropic API
   */
  private formatToolsForAnthropic(tools: { type: string; function: { name: string; description: string; parameters: unknown } }[]): unknown[] {
    return tools.map((tool) => ({
      name: tool.function.name,
      description: tool.function.description,
      input_schema: tool.function.parameters,
    }));
  }

  /**
   * Parse Anthropic response
   */
  protected parseResponse(response: unknown): ProviderResponse {
    const data = response as {
      content: Array<{
        type: string;
        text?: string;
        thinking?: string;
        id?: string;
        name?: string;
        input?: unknown;
      }>;
      usage: {
        input_tokens: number;
        output_tokens: number;
      };
      model: string;
    };

    let content = '';
    let thinking = '';
    const toolCalls: ToolCall[] = [];

    for (const block of data.content) {
      if (block.type === 'text') {
        content += block.text || '';
      }
      if (block.type === 'thinking') {
        thinking += block.thinking || '';
      }
      if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id || '',
          type: 'function',
          function: {
            name: block.name || '',
            arguments: JSON.stringify(block.input || {}),
          },
        });
      }
    }

    const result: ProviderResponse = {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        input_tokens: data.usage.input_tokens,
        output_tokens: data.usage.output_tokens,
        total_tokens: data.usage.input_tokens + data.usage.output_tokens,
      },
      model: data.model,
    };

    if (thinking) {
      result.thinking = thinking;
    }

    return result;
  }


  /**
   * Make HTTP request to Anthropic
   */
  private async makeRequest(
    url: string,
    apiKey: string,
    body: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': this.apiVersion,
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      throw new NetworkError(
        `Failed to connect to Anthropic: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    return response.json();
  }

  /**
   * Handle error responses from Anthropic
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorData: { error?: { message?: string; type?: string } } = {};
    try {
      errorData = await response.json();
    } catch {
      // Ignore JSON parse errors
    }

    const message = errorData.error?.message || response.statusText;

    if (response.status === 401) {
      throw new AuthenticationError(message, this.name);
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      throw new RateLimitError(
        message,
        retryAfter ? parseInt(retryAfter, 10) : undefined,
        this.name
      );
    }

    if (response.status === 404) {
      throw new ModelNotFoundError(message, 'unknown');
    }

    throw new NetworkError(`Anthropic API error (${response.status}): ${message}`);
  }

  /**
   * Get API key from environment
   */
  private getApiKeyFromEnv(): string | undefined {
    if (typeof process !== 'undefined' && process.env) {
      return process.env.ANTHROPIC_API_KEY;
    }
    return undefined;
  }
}
