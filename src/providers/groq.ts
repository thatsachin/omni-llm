// Groq Provider for Unified LLM (OpenAI-compatible API)
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
 * Groq API provider implementation (OpenAI-compatible)
 */
export class GroqProvider extends BaseProvider {
  readonly name: ServiceName = 'groq';
  readonly supportsThinking = false;
  readonly supportsTools = true;
  readonly supportsVision = true;
  readonly supportsDocuments = false;

  private readonly defaultBaseUrl = 'https://api.groq.com/openai/v1';

  /**
   * Send a non-streaming request to Groq
   */
  async sendRequest(
    messages: Message[],
    options: ProviderOptions
  ): Promise<ProviderResponse> {
    const apiKey = options.apiKey || this.getApiKeyFromEnv();
    const baseUrl = options.baseUrl || this.defaultBaseUrl;

    if (!apiKey) {
      throw new AuthenticationError(
        'Groq API key is required. Provide it via options.apiKey or GROQ_API_KEY environment variable.',
        this.name
      );
    }

    const body = this.buildRequestBody(messages, options, false);
    const response = await this.makeRequest(
      `${baseUrl}/chat/completions`,
      apiKey,
      body,
      options.signal
    );

    return this.parseResponse(response);
  }


  /**
   * Send a streaming request to Groq
   */
  async *sendStreamingRequest(
    messages: Message[],
    options: ProviderOptions
  ): AsyncIterable<ProviderChunk> {
    const apiKey = options.apiKey || this.getApiKeyFromEnv();
    const baseUrl = options.baseUrl || this.defaultBaseUrl;

    if (!apiKey) {
      throw new AuthenticationError(
        'Groq API key is required. Provide it via options.apiKey or GROQ_API_KEY environment variable.',
        this.name
      );
    }

    const body = this.buildRequestBody(messages, options, true);

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    if (!response.body) {
      throw new NetworkError('No response body received from Groq');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedToolCalls: Map<number, ToolCall> = new Map();
    let usage: Usage | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(trimmed.slice(6));
            const delta = data.choices?.[0]?.delta;

            if (delta?.content) {
              yield { type: 'content', content: delta.content };
            }

            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const index = tc.index;
                let existing = accumulatedToolCalls.get(index);
                if (!existing) {
                  existing = {
                    id: tc.id || '',
                    type: 'function',
                    function: { name: '', arguments: '' },
                  };
                  accumulatedToolCalls.set(index, existing);
                }
                if (tc.id) existing.id = tc.id;
                if (tc.function?.name) existing.function.name += tc.function.name;
                if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
              }
            }

            if (data.x_groq?.usage) {
              usage = {
                input_tokens: data.x_groq.usage.prompt_tokens,
                output_tokens: data.x_groq.usage.completion_tokens,
                total_tokens: data.x_groq.usage.total_tokens,
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
   * Fetch available models from Groq
   */
  async fetchModels(apiKey?: string): Promise<Model[]> {
    const key = apiKey || this.getApiKeyFromEnv();
    if (!key) {
      throw new AuthenticationError(
        'Groq API key is required to fetch models.',
        this.name
      );
    }

    const response = await fetch(`${this.defaultBaseUrl}/models`, {
      headers: { Authorization: `Bearer ${key}` },
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    const data = await response.json();
    return data.data.map((model: { id: string }) => ({
      id: model.id,
      name: model.id,
      provider: this.name,
    }));
  }

  /**
   * Verify connection to Groq
   */
  async verifyConnection(apiKey?: string): Promise<boolean> {
    try {
      await this.fetchModels(apiKey);
      return true;
    } catch {
      return false;
    }
  }


  /**
   * Build the request body for Groq API (OpenAI-compatible)
   */
  private buildRequestBody(
    messages: Message[],
    options: ProviderOptions,
    stream: boolean
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: options.model,
      messages: this.formatMessages(messages),
      stream,
    };

    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    if (options.max_tokens !== undefined) {
      body.max_tokens = options.max_tokens;
    }

    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools;
    }

    return body;
  }

  /**
   * Format messages for Groq API (OpenAI-compatible)
   */
  protected formatMessages(messages: Message[]): unknown[] {
    return messages.map((msg) => {
      const formatted: Record<string, unknown> = {
        role: msg.role,
        content: this.formatContent(msg.content),
      };

      if (msg.name) {
        formatted.name = msg.name;
      }

      if (msg.tool_calls) {
        formatted.tool_calls = msg.tool_calls;
      }

      if (msg.tool_call_id) {
        formatted.tool_call_id = msg.tool_call_id;
      }

      return formatted;
    });
  }

  /**
   * Format content for Groq API
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
        return { type: 'image_url', image_url: part.image_url };
      }
      if (part.type === 'image') {
        return {
          type: 'image_url',
          image_url: {
            url: `data:${part.source.media_type};base64,${part.source.data}`,
          },
        };
      }
      return part;
    });
  }

  /**
   * Parse Groq response (OpenAI-compatible)
   */
  protected parseResponse(response: unknown): ProviderResponse {
    const data = response as {
      choices: Array<{
        message: {
          content: string | null;
          tool_calls?: ToolCall[];
        };
      }>;
      usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
      model: string;
    };

    const choice = data.choices[0];
    if (!choice) {
      throw new NetworkError('No choices in Groq response');
    }
    return {
      content: choice.message.content || '',
      toolCalls: choice.message.tool_calls,
      usage: {
        input_tokens: data.usage.prompt_tokens,
        output_tokens: data.usage.completion_tokens,
        total_tokens: data.usage.total_tokens,
      },
      model: data.model,
    };
  }

  /**
   * Make HTTP request to Groq
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
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      throw new NetworkError(
        `Failed to connect to Groq: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    return response.json();
  }

  /**
   * Handle error responses from Groq
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

    throw new NetworkError(`Groq API error (${response.status}): ${message}`);
  }

  /**
   * Get API key from environment
   */
  private getApiKeyFromEnv(): string | undefined {
    if (typeof process !== 'undefined' && process.env) {
      return process.env.GROQ_API_KEY;
    }
    return undefined;
  }
}
