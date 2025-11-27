// Main LLM Class for Unified LLM
import type {
  Message,
  Options,
  ServiceName,
  ExtendedResponse,
  Chunk,
  ContentPart,
  SerializedLLM,
  Model,
  ConnectionStatus,
  ProviderOptions,
} from './types';
import { MessageManager } from './message-manager';
import { StreamHandler } from './stream-handler';
import { ToolExecutor } from './tool-executor';
import { AttachmentProcessor } from './attachment-processor';
import { CostCalculator } from './cost-calculator';
import { getModelRegistry } from './model-registry';
import { getProviderRegistry, registerProvider, BaseProvider } from './providers';
import { parsers } from './parsers';
import { Serializer, type SerializableLLM } from './serializer';
import {
  ValidationError,
  AbortError,
  UnsupportedFeatureError,
} from './errors';

/**
 * Default service when none is specified
 */
const DEFAULT_SERVICE: ServiceName = 'ollama';

/**
 * Default model per service
 */
const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-3-5-sonnet-20241022',
  google: 'gemini-1.5-pro',
  groq: 'llama-3.3-70b-versatile',
  ollama: 'llama3.2',
  xai: 'grok-2',
  deepseek: 'deepseek-chat',
};


/**
 * Main LLM class providing unified interface for multiple LLM providers
 */
export class LLM implements SerializableLLM {
  private messageManager: MessageManager;
  private abortController: AbortController | null = null;
  private streamHandler: StreamHandler | null = null;
  private defaultOptions: Partial<Options>;

  readonly service: ServiceName;
  readonly model: string;

  /**
   * Static parsers for response parsing
   */
  static parsers = parsers;

  /**
   * Create a new LLM instance
   * @param input - Optional initial prompt string or message array
   * @param options - Configuration options
   */
  constructor(input?: string | Message[], options: Options = {}) {
    // Determine service and model
    this.service = options.service ?? DEFAULT_SERVICE;
    this.model = options.model ?? DEFAULT_MODELS[this.service] ?? 'default';

    // Initialize message manager
    if (options.messages) {
      this.messageManager = new MessageManager(options.messages);
    } else if (Array.isArray(input)) {
      this.messageManager = new MessageManager(input);
    } else {
      this.messageManager = new MessageManager();
    }

    // Add initial string input as user message
    if (typeof input === 'string' && input.trim()) {
      this.messageManager.addUser(input);
    }

    // Store default options (excluding messages which are handled separately)
    const { messages: _, ...restOptions } = options;
    this.defaultOptions = restOptions;

    // Register this class with the Serializer
    Serializer.registerFactory((msgs, opts) => new LLM(msgs, opts));
  }

  /**
   * Get the current message history
   */
  get messages(): Message[] {
    return this.messageManager.getMessages();
  }

  /**
   * Get the current options
   */
  get options(): Partial<Options> {
    return { ...this.defaultOptions };
  }


  /**
   * Add a system message to the conversation
   * @param prompt - The system prompt
   * @returns This instance for chaining
   */
  system(prompt: string): this {
    this.messageManager.addSystem(prompt);
    return this;
  }

  /**
   * Send a chat message and get a response
   * @param input - The user message (string or message array)
   * @param options - Per-request options (merged with instance defaults)
   */
  async chat(
    input: string | Message[],
    options: Options = {}
  ): Promise<string | ExtendedResponse | AsyncIterable<Chunk>> {
    // Merge options with defaults
    const mergedOptions = this.mergeOptions(options);

    // Validate options
    this.validateOptions(mergedOptions);

    // Add user message(s)
    if (typeof input === 'string') {
      // Handle attachments
      if (mergedOptions.attachments && mergedOptions.attachments.length > 0) {
        const contentParts: ContentPart[] = [{ type: 'text', text: input }];
        for (const attachment of mergedOptions.attachments) {
          const contentPart = AttachmentProcessor.toContentPart(attachment, this.service);
          contentParts.push(contentPart);
        }
        this.messageManager.addUser(contentParts);
      } else {
        this.messageManager.addUser(input);
      }
    } else {
      // Add array of messages
      for (const msg of input) {
        if (msg.role === 'user') {
          this.messageManager.addUser(msg.content);
        } else if (msg.role === 'system') {
          this.messageManager.addSystem(msg.content as string);
        } else if (msg.role === 'assistant') {
          this.messageManager.addAssistant(msg.content as string, msg.tool_calls);
        } else if (msg.role === 'tool' && msg.tool_call_id) {
          this.messageManager.addToolResult(msg.tool_call_id, msg.content as string);
        }
      }
    }

    // Get provider
    const provider = getProviderRegistry().get(this.service);

    // Check for thinking mode support
    if (mergedOptions.think && !provider.supportsThinking) {
      throw new UnsupportedFeatureError(
        `Model ${this.model} on ${this.service} does not support thinking/reasoning mode`,
        'thinking',
        this.service
      );
    }

    // Create abort controller
    this.abortController = new AbortController();
    const signal = mergedOptions.signal ?? this.abortController.signal;

    // Build provider options
    const providerOptions: ProviderOptions = {
      model: this.model,
      apiKey: mergedOptions.apiKey ?? this.getApiKeyFromEnv(),
      baseUrl: mergedOptions.baseUrl,
      temperature: mergedOptions.temperature,
      max_tokens: mergedOptions.max_tokens,
      think: mergedOptions.think,
      max_thinking_tokens: mergedOptions.max_thinking_tokens,
      tools: mergedOptions.tools
        ? new ToolExecutor(mergedOptions.tools).getToolDefinitions()
        : undefined,
      signal,
    };

    // Handle streaming vs non-streaming
    if (mergedOptions.stream) {
      return this.handleStreamingRequest(provider, providerOptions, mergedOptions);
    } else {
      return this.handleNonStreamingRequest(provider, providerOptions, mergedOptions);
    }
  }


  /**
   * Handle non-streaming request
   */
  private async handleNonStreamingRequest(
    provider: BaseProvider,
    providerOptions: ProviderOptions,
    options: Options
  ): Promise<string | ExtendedResponse> {
    try {
      const response = await provider.sendRequest(
        this.messageManager.getMessages(),
        providerOptions
      );

      // Add assistant message to history
      this.messageManager.addAssistant(response.content, response.toolCalls);

      // Handle tool calls
      if (response.toolCalls && response.toolCalls.length > 0 && options.tools) {
        const toolExecutor = new ToolExecutor(options.tools);
        const results = await toolExecutor.execute(response.toolCalls);

        // Add tool results to history
        for (const result of results) {
          this.messageManager.addToolResult(result.tool_call_id, result.result);
        }

        // Continue conversation with tool results (non-streaming)
        const continueOptions = { ...options, stream: false };
        return this.handleNonStreamingRequest(provider, providerOptions, continueOptions);
      }

      // Apply parser if specified
      if (options.parser) {
        const parsed = options.parser(response.content);
        if (options.extended) {
          return {
            ...this.buildExtendedResponse(response),
            content: typeof parsed === 'string' ? parsed : JSON.stringify(parsed),
          };
        }
        return typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
      }

      // Return extended or simple response
      if (options.extended) {
        return this.buildExtendedResponse(response);
      }

      return response.content;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AbortError('Request was aborted');
      }
      throw error;
    }
  }

  /**
   * Handle streaming request
   */
  private async *handleStreamingRequest(
    provider: BaseProvider,
    providerOptions: ProviderOptions,
    _options: Options
  ): AsyncIterable<Chunk> {
    this.streamHandler = new StreamHandler(this.service, this.model);

    try {
      const stream = provider.sendStreamingRequest(
        this.messageManager.getMessages(),
        providerOptions
      );

      for await (const chunk of this.streamHandler.process(stream)) {
        yield chunk;
      }

      // Get complete response and add to history
      const complete = this.streamHandler.getComplete();
      this.messageManager.addAssistant(complete.content, complete.toolCalls);

      // Calculate cost
      const modelInfo = getModelRegistry().getModelInfo(this.service, this.model);
      const cost = CostCalculator.calculateWithServiceCheck(
        complete.usage,
        modelInfo,
        this.service
      );
      this.streamHandler.setCost(cost);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AbortError('Request was aborted');
      }
      throw error;
    }
  }


  /**
   * Build an ExtendedResponse from a provider response
   */
  private buildExtendedResponse(response: {
    content: string;
    thinking?: string;
    toolCalls?: any[];
    usage: any;
    model: string;
  }): ExtendedResponse {
    const modelInfo = getModelRegistry().getModelInfo(this.service, this.model);
    const cost = CostCalculator.calculateWithServiceCheck(
      response.usage,
      modelInfo,
      this.service
    );

    return {
      content: response.content,
      thinking: response.thinking,
      usage: response.usage,
      cost,
      model: response.model,
      service: this.service,
      toolCalls: response.toolCalls,
    };
  }

  /**
   * Get the complete response after streaming
   * @throws Error if called before streaming completes
   */
  complete(): ExtendedResponse {
    if (!this.streamHandler) {
      throw new Error('No streaming request in progress. Call chat() with stream: true first.');
    }
    return this.streamHandler.getComplete();
  }

  /**
   * Abort the current request
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Merge per-request options with instance defaults
   */
  private mergeOptions(requestOptions: Options): Options {
    return {
      ...this.defaultOptions,
      ...requestOptions,
      service: this.service,
      model: this.model,
    };
  }

  /**
   * Validate options
   */
  private validateOptions(options: Options): void {
    if (options.temperature !== undefined) {
      if (typeof options.temperature !== 'number' || options.temperature < 0 || options.temperature > 2) {
        throw new ValidationError(
          'Temperature must be a number between 0 and 2',
          'temperature',
          options.temperature
        );
      }
    }

    if (options.max_tokens !== undefined) {
      if (typeof options.max_tokens !== 'number' || options.max_tokens < 1) {
        throw new ValidationError(
          'max_tokens must be a positive integer',
          'max_tokens',
          options.max_tokens
        );
      }
    }

    if (options.max_thinking_tokens !== undefined) {
      if (typeof options.max_thinking_tokens !== 'number' || options.max_thinking_tokens < 1) {
        throw new ValidationError(
          'max_thinking_tokens must be a positive integer',
          'max_thinking_tokens',
          options.max_thinking_tokens
        );
      }
    }
  }

  /**
   * Get API key from environment variables
   */
  private getApiKeyFromEnv(): string | undefined {
    if (typeof process === 'undefined' || !process.env) {
      return undefined;
    }

    const envVarMap: Record<string, string> = {
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      google: 'GOOGLE_API_KEY',
      groq: 'GROQ_API_KEY',
      xai: 'XAI_API_KEY',
      deepseek: 'DEEPSEEK_API_KEY',
    };

    const envVar = envVarMap[this.service];
    return envVar ? process.env[envVar] : undefined;
  }


  /**
   * Serialize this instance to JSON
   */
  toJSON(): SerializedLLM {
    return Serializer.serializeLLM(this);
  }

  /**
   * Create an LLM instance from serialized JSON
   */
  static fromJSON(data: SerializedLLM): LLM {
    return new LLM(data.messages, {
      ...data.options,
      service: data.service,
      model: data.model,
    });
  }

  /**
   * Fetch available models for a service
   */
  static async fetchModels(service: ServiceName, apiKey?: string): Promise<Model[]> {
    try {
      const provider = getProviderRegistry().get(service);
      return await provider.fetchModels(apiKey);
    } catch {
      // Fall back to model registry
      return getModelRegistry().fetchModels(service, apiKey);
    }
  }

  /**
   * Get quality models (excluding embeddings, TTS, etc.)
   */
  static getQualityModels(service: ServiceName): Model[] {
    return getModelRegistry().getQualityModels(service);
  }

  /**
   * Register a custom service provider
   */
  static registerService(name: string, provider: BaseProvider): void {
    registerProvider(name, provider);
  }

  /**
   * Verify connection to a service
   */
  static async verifyConnection(
    service: ServiceName,
    apiKey?: string
  ): Promise<ConnectionStatus> {
    try {
      const provider = getProviderRegistry().get(service);
      const success = await provider.verifyConnection(apiKey);

      return {
        success,
        service,
        message: success ? 'Connection successful' : 'Connection failed',
      };
    } catch (error) {
      return {
        success: false,
        service,
        message: 'Connection failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * LLM function interface for one-off requests
 */
export async function llm(
  input: string,
  options: Options = {}
): Promise<string | ExtendedResponse | AsyncIterable<Chunk>> {
  const instance = new LLM(undefined, options);
  return instance.chat(input, options);
}

// Export the function as default as well
export default LLM;
