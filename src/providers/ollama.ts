// Ollama Provider for Unified LLM (Local LLM)
import { BaseProvider } from './base-provider';
import { NetworkError } from '../errors';
import type {
  Message,
  ProviderOptions,
  ProviderResponse,
  ProviderChunk,
  Model,
  ServiceName,
  ToolCall,
  ContentPart,
} from '../types';

/**
 * Ollama API provider implementation (local LLM)
 * No authentication required
 */
export class OllamaProvider extends BaseProvider {
  readonly name: ServiceName = 'ollama';
  readonly supportsThinking = false;
  readonly supportsTools = true;
  readonly supportsVision = true;
  readonly supportsDocuments = false;

  private readonly defaultBaseUrl = 'http://localhost:11434';

  /**
   * Send a non-streaming request to Ollama
   */
  async sendRequest(
    messages: Message[],
    options: ProviderOptions
  ): Promise<ProviderResponse> {
    const baseUrl = options.baseUrl || this.defaultBaseUrl;
    const body = this.buildRequestBody(messages, options, false);

    const response = await this.makeRequest(
      `${baseUrl}/api/chat`,
      body,
      options.signal
    );

    return this.parseResponse(response);
  }

  /**
   * Send a streaming request to Ollama
   */
  async *sendStreamingRequest(
    messages: Message[],
    options: ProviderOptions
  ): AsyncIterable<ProviderChunk> {
    const baseUrl = options.baseUrl || this.defaultBaseUrl;
    const body = this.buildRequestBody(messages, options, true);

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    if (!response.body) {
      throw new NetworkError('No response body received from Ollama');
    }


    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const accumulatedToolCalls: ToolCall[] = [];

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const data = JSON.parse(trimmed);

            // Handle content
            if (data.message?.content) {
              yield { type: 'content', content: data.message.content };
            }

            // Handle tool calls
            if (data.message?.tool_calls) {
              for (const tc of data.message.tool_calls) {
                const toolCall: ToolCall = {
                  id: `call_${Date.now()}_${accumulatedToolCalls.length}`,
                  type: 'function',
                  function: {
                    name: tc.function?.name || '',
                    arguments: JSON.stringify(tc.function?.arguments || {}),
                  },
                };
                accumulatedToolCalls.push(toolCall);
              }
            }

            // Handle usage (comes with done: true)
            if (data.done && data.prompt_eval_count !== undefined) {
              totalInputTokens = data.prompt_eval_count || 0;
              totalOutputTokens = data.eval_count || 0;
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      // Yield accumulated tool calls
      for (const toolCall of accumulatedToolCalls) {
        yield { type: 'tool_call', toolCall };
      }

      // Yield usage
      if (totalInputTokens > 0 || totalOutputTokens > 0) {
        yield {
          type: 'usage',
          usage: {
            input_tokens: totalInputTokens,
            output_tokens: totalOutputTokens,
            total_tokens: totalInputTokens + totalOutputTokens,
          },
        };
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Fetch available models from Ollama
   */
  async fetchModels(_apiKey?: string): Promise<Model[]> {
    try {
      const response = await fetch(`${this.defaultBaseUrl}/api/tags`);

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return (data.models || []).map((model: { name: string }) => ({
        id: model.name,
        name: model.name,
        provider: this.name,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Verify connection to Ollama
   */
  async verifyConnection(_apiKey?: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.defaultBaseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Build the request body for Ollama API
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

    const ollamaOptions: Record<string, unknown> = {};

    if (options.temperature !== undefined) {
      ollamaOptions.temperature = options.temperature;
    }

    if (options.max_tokens !== undefined) {
      ollamaOptions.num_predict = options.max_tokens;
    }

    if (Object.keys(ollamaOptions).length > 0) {
      body.options = ollamaOptions;
    }

    if (options.tools && options.tools.length > 0) {
      body.tools = this.formatToolsForOllama(options.tools);
    }

    return body;
  }


  /**
   * Format messages for Ollama API
   */
  protected formatMessages(messages: Message[]): unknown[] {
    return messages.map((msg) => {
      const formatted: Record<string, unknown> = {
        role: msg.role,
        content: this.formatContent(msg.content),
      };

      if (msg.tool_calls) {
        formatted.tool_calls = msg.tool_calls.map((tc) => ({
          function: {
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments || '{}'),
          },
        }));
      }

      return formatted;
    });
  }

  /**
   * Format content for Ollama API
   */
  private formatContent(content: string | ContentPart[]): unknown {
    if (typeof content === 'string') {
      return content;
    }

    // Ollama expects images as base64 in a separate field
    const textParts: string[] = [];
    const images: string[] = [];

    for (const part of content) {
      if (part.type === 'text') {
        textParts.push(part.text);
      }
      if (part.type === 'image') {
        images.push(part.source.data);
      }
      if (part.type === 'image_url' && part.image_url.url.startsWith('data:')) {
        // Extract base64 from data URL
        const base64 = part.image_url.url.split(',')[1];
        if (base64) images.push(base64);
      }
    }

    // For Ollama, we return just the text content
    // Images would need to be handled separately in the message format
    return textParts.join('\n');
  }

  /**
   * Format tools for Ollama API
   */
  private formatToolsForOllama(tools: { type: string; function: { name: string; description: string; parameters: unknown } }[]): unknown[] {
    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
      },
    }));
  }

  /**
   * Parse Ollama response
   */
  protected parseResponse(response: unknown): ProviderResponse {
    const data = response as {
      message: {
        content: string;
        tool_calls?: Array<{
          function: { name: string; arguments: unknown };
        }>;
      };
      prompt_eval_count?: number;
      eval_count?: number;
      model: string;
    };

    const toolCalls: ToolCall[] = [];
    if (data.message.tool_calls) {
      for (const tc of data.message.tool_calls) {
        toolCalls.push({
          id: `call_${Date.now()}_${toolCalls.length}`,
          type: 'function',
          function: {
            name: tc.function.name,
            arguments: JSON.stringify(tc.function.arguments || {}),
          },
        });
      }
    }

    return {
      content: data.message.content || '',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        input_tokens: data.prompt_eval_count || 0,
        output_tokens: data.eval_count || 0,
        total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
      model: data.model,
    };
  }

  /**
   * Make HTTP request to Ollama
   */
  private async makeRequest(
    url: string,
    body: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      throw new NetworkError(
        `Failed to connect to Ollama: ${error instanceof Error ? error.message : 'Unknown error'}. Is Ollama running?`,
        error instanceof Error ? error : undefined
      );
    }

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    return response.json();
  }

  /**
   * Handle error responses from Ollama
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorData: { error?: string } = {};
    try {
      errorData = await response.json();
    } catch {
      // Ignore JSON parse errors
    }

    const message = errorData.error || response.statusText;
    throw new NetworkError(`Ollama error (${response.status}): ${message}`);
  }
}
