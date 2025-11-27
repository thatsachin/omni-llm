// Google Gemini Provider for Unified LLM
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
  ToolCall,
  ContentPart,
} from '../types';

/**
 * Google Gemini API provider implementation
 */
export class GoogleProvider extends BaseProvider {
  readonly name: ServiceName = 'google';
  readonly supportsThinking = false;
  readonly supportsTools = true;
  readonly supportsVision = true;
  readonly supportsDocuments = true;

  private readonly defaultBaseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  /**
   * Send a non-streaming request to Google Gemini
   */
  async sendRequest(
    messages: Message[],
    options: ProviderOptions
  ): Promise<ProviderResponse> {
    const apiKey = options.apiKey || this.getApiKeyFromEnv();

    if (!apiKey) {
      throw new AuthenticationError(
        'Google API key is required. Provide it via options.apiKey or GOOGLE_API_KEY environment variable.',
        this.name
      );
    }

    const body = this.buildRequestBody(messages, options);
    const baseUrl = options.baseUrl || this.defaultBaseUrl;
    const model = options.model || 'gemini-pro';

    const response = await this.makeRequest(
      `${baseUrl}/models/${model}:generateContent?key=${apiKey}`,
      body,
      options.signal
    );

    return this.parseResponse(response);
  }


  /**
   * Send a streaming request to Google Gemini
   */
  async *sendStreamingRequest(
    messages: Message[],
    options: ProviderOptions
  ): AsyncIterable<ProviderChunk> {
    const apiKey = options.apiKey || this.getApiKeyFromEnv();
    const baseUrl = options.baseUrl || this.defaultBaseUrl;
    const model = options.model || 'gemini-pro';

    if (!apiKey) {
      throw new AuthenticationError(
        'Google API key is required. Provide it via options.apiKey or GOOGLE_API_KEY environment variable.',
        this.name
      );
    }

    const body = this.buildRequestBody(messages, options);

    const response = await fetch(
      `${baseUrl}/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: options.signal,
      }
    );

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    if (!response.body) {
      throw new NetworkError('No response body received from Google');
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
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(trimmed.slice(6));

            // Handle text content
            const candidates = data.candidates || [];
            for (const candidate of candidates) {
              const content = candidate.content;
              if (content?.parts) {
                for (const part of content.parts) {
                  if (part.text) {
                    yield { type: 'content', content: part.text };
                  }
                  if (part.functionCall) {
                    const toolCall: ToolCall = {
                      id: `call_${Date.now()}_${accumulatedToolCalls.length}`,
                      type: 'function',
                      function: {
                        name: part.functionCall.name,
                        arguments: JSON.stringify(part.functionCall.args || {}),
                      },
                    };
                    accumulatedToolCalls.push(toolCall);
                  }
                }
              }
            }

            // Handle usage metadata
            if (data.usageMetadata) {
              totalInputTokens = data.usageMetadata.promptTokenCount || 0;
              totalOutputTokens = data.usageMetadata.candidatesTokenCount || 0;
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
   * Fetch available models from Google
   */
  async fetchModels(apiKey?: string): Promise<Model[]> {
    const key = apiKey || this.getApiKeyFromEnv();
    if (!key) {
      throw new AuthenticationError(
        'Google API key is required to fetch models.',
        this.name
      );
    }

    try {
      const response = await fetch(
        `${this.defaultBaseUrl}/models?key=${key}`
      );

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const data = await response.json();
      return (data.models || []).map((model: { name: string; displayName?: string }) => ({
        id: model.name.replace('models/', ''),
        name: model.displayName || model.name,
        provider: this.name,
      }));
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof NetworkError) {
        throw error;
      }
      // Return known models as fallback
      return [
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: this.name },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: this.name },
        { id: 'gemini-pro', name: 'Gemini Pro', provider: this.name },
        { id: 'gemini-pro-vision', name: 'Gemini Pro Vision', provider: this.name },
      ];
    }
  }

  /**
   * Verify connection to Google
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
   * Build the request body for Google Gemini API
   */
  private buildRequestBody(
    messages: Message[],
    options: ProviderOptions
  ): Record<string, unknown> {
    const { systemInstruction, contents } = this.formatMessagesForGemini(messages);

    const body: Record<string, unknown> = {
      contents,
    };

    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const generationConfig: Record<string, unknown> = {};

    if (options.temperature !== undefined) {
      generationConfig.temperature = options.temperature;
    }

    if (options.max_tokens !== undefined) {
      generationConfig.maxOutputTokens = options.max_tokens;
    }

    if (Object.keys(generationConfig).length > 0) {
      body.generationConfig = generationConfig;
    }

    if (options.tools && options.tools.length > 0) {
      body.tools = [{ functionDeclarations: this.formatToolsForGemini(options.tools) }];
    }

    return body;
  }

  /**
   * Format messages for Google Gemini API
   */
  private formatMessagesForGemini(messages: Message[]): {
    systemInstruction: string | null;
    contents: unknown[];
  } {
    const systemMessages = messages.filter((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    const systemInstruction = systemMessages.length > 0
      ? systemMessages.map((m) => typeof m.content === 'string' ? m.content : '').join('\n')
      : null;

    const contents = conversationMessages.map((msg) => {
      // Handle tool result messages
      if (msg.role === 'tool') {
        return {
          role: 'function',
          parts: [{
            functionResponse: {
              name: msg.name || 'unknown',
              response: { result: msg.content },
            },
          }],
        };
      }

      // Map roles
      const role = msg.role === 'assistant' ? 'model' : 'user';

      // Handle assistant messages with tool calls
      if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
        const parts: unknown[] = [];
        if (msg.content && typeof msg.content === 'string' && msg.content.trim()) {
          parts.push({ text: msg.content });
        }
        for (const tc of msg.tool_calls) {
          parts.push({
            functionCall: {
              name: tc.function.name,
              args: JSON.parse(tc.function.arguments || '{}'),
            },
          });
        }
        return { role, parts };
      }

      return {
        role,
        parts: this.formatContentForGemini(msg.content),
      };
    });

    return { systemInstruction, contents };
  }


  /**
   * Format content for Google Gemini API
   */
  private formatContentForGemini(content: string | ContentPart[]): unknown[] {
    if (typeof content === 'string') {
      return [{ text: content }];
    }

    return content.map((part) => {
      if (part.type === 'text') {
        return { text: part.text };
      }
      if (part.type === 'image_url') {
        return {
          inlineData: {
            mimeType: 'image/jpeg',
            data: part.image_url.url, // Assumes base64 or will need URL fetching
          },
        };
      }
      if (part.type === 'image') {
        return {
          inlineData: {
            mimeType: part.source.media_type,
            data: part.source.data,
          },
        };
      }
      if (part.type === 'document') {
        return {
          inlineData: {
            mimeType: part.source.media_type,
            data: part.source.data,
          },
        };
      }
      return { text: '' };
    });
  }

  /**
   * Format tools for Google Gemini API
   */
  private formatToolsForGemini(tools: { type: string; function: { name: string; description: string; parameters: unknown } }[]): unknown[] {
    return tools.map((tool) => ({
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters,
    }));
  }

  /**
   * Parse Google Gemini response
   */
  protected parseResponse(response: unknown): ProviderResponse {
    const data = response as {
      candidates: Array<{
        content: {
          parts: Array<{
            text?: string;
            functionCall?: { name: string; args: unknown };
          }>;
        };
      }>;
      usageMetadata?: {
        promptTokenCount: number;
        candidatesTokenCount: number;
        totalTokenCount: number;
      };
      modelVersion?: string;
    };

    let content = '';
    const toolCalls: ToolCall[] = [];

    const candidates = data.candidates || [];
    for (const candidate of candidates) {
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        if (part.text) {
          content += part.text;
        }
        if (part.functionCall) {
          toolCalls.push({
            id: `call_${Date.now()}_${toolCalls.length}`,
            type: 'function',
            function: {
              name: part.functionCall.name,
              arguments: JSON.stringify(part.functionCall.args || {}),
            },
          });
        }
      }
    }

    const usage = data.usageMetadata || { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        input_tokens: usage.promptTokenCount,
        output_tokens: usage.candidatesTokenCount,
        total_tokens: usage.totalTokenCount || (usage.promptTokenCount + usage.candidatesTokenCount),
      },
      model: data.modelVersion || 'gemini',
    };
  }

  /**
   * Make HTTP request to Google
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
        `Failed to connect to Google: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    return response.json();
  }

  /**
   * Handle error responses from Google
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorData: { error?: { message?: string; status?: string } } = {};
    try {
      errorData = await response.json();
    } catch {
      // Ignore JSON parse errors
    }

    const message = errorData.error?.message || response.statusText;

    if (response.status === 401 || response.status === 403) {
      throw new AuthenticationError(message, this.name);
    }

    if (response.status === 429) {
      throw new RateLimitError(message, undefined, this.name);
    }

    if (response.status === 404) {
      throw new ModelNotFoundError(message, 'unknown');
    }

    throw new NetworkError(`Google API error (${response.status}): ${message}`);
  }

  /**
   * Get API key from environment
   */
  private getApiKeyFromEnv(): string | undefined {
    if (typeof process !== 'undefined' && process.env) {
      return process.env.GOOGLE_API_KEY;
    }
    return undefined;
  }
}
