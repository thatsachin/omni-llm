// Serializer for Unified LLM
import type { Message, Options, SerializedLLM, ServiceName } from './types';
import { ValidationError } from './errors';

/**
 * Interface for LLM instance (to avoid circular dependency)
 */
export interface SerializableLLM {
  readonly service: ServiceName;
  readonly model: string;
  readonly messages: Message[];
  readonly options: Partial<Options>;
}

/**
 * Factory function type for creating LLM instances
 */
export type LLMFactory = (
  messages: Message[],
  options: Options
) => SerializableLLM;

/**
 * Handles serialization and deserialization of LLM instances and messages
 */
export class Serializer {
  private static llmFactory: LLMFactory | null = null;

  /**
   * Register the LLM factory for deserialization
   * This should be called by the LLM class during initialization
   */
  static registerFactory(factory: LLMFactory): void {
    Serializer.llmFactory = factory;
  }

  /**
   * Serialize an LLM instance to a SerializedLLM object
   */
  static serializeLLM(llm: SerializableLLM): SerializedLLM {
    return {
      service: llm.service,
      model: llm.model,
      messages: Serializer.cloneMessages(llm.messages),
      options: Serializer.cloneOptions(llm.options),
    };
  }

  /**
   * Deserialize a SerializedLLM object back to an LLM instance
   * @throws ValidationError if no factory is registered or data is invalid
   */
  static deserializeLLM(data: SerializedLLM): SerializableLLM {
    if (!Serializer.llmFactory) {
      throw new ValidationError(
        'LLM factory not registered. Cannot deserialize.',
        'factory',
        null
      );
    }

    Serializer.validateSerializedLLM(data);

    const options: Options = {
      ...data.options,
      service: data.service,
      model: data.model,
      messages: data.messages,
    };

    return Serializer.llmFactory(data.messages, options);
  }


  /**
   * Serialize messages to a JSON string
   */
  static serializeMessages(messages: Message[]): string {
    return JSON.stringify(Serializer.cloneMessages(messages));
  }

  /**
   * Deserialize a JSON string to messages
   * @throws ValidationError if JSON is invalid or messages are malformed
   */
  static deserializeMessages(json: string): Message[] {
    let parsed: unknown;

    try {
      parsed = JSON.parse(json);
    } catch (error) {
      throw new ValidationError(
        'Invalid JSON string for messages',
        'json',
        json
      );
    }

    if (!Array.isArray(parsed)) {
      throw new ValidationError(
        'Messages must be an array',
        'messages',
        parsed
      );
    }

    const messages: Message[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const msg = parsed[i];
      Serializer.validateMessage(msg, i);
      messages.push(msg as Message);
    }

    return messages;
  }

  /**
   * Validate a SerializedLLM object
   */
  private static validateSerializedLLM(data: unknown): asserts data is SerializedLLM {
    if (!data || typeof data !== 'object') {
      throw new ValidationError(
        'SerializedLLM must be an object',
        'data',
        data
      );
    }

    const obj = data as Record<string, unknown>;

    if (typeof obj.service !== 'string') {
      throw new ValidationError(
        'SerializedLLM.service must be a string',
        'service',
        obj.service
      );
    }

    if (typeof obj.model !== 'string') {
      throw new ValidationError(
        'SerializedLLM.model must be a string',
        'model',
        obj.model
      );
    }

    if (!Array.isArray(obj.messages)) {
      throw new ValidationError(
        'SerializedLLM.messages must be an array',
        'messages',
        obj.messages
      );
    }

    // Validate each message
    for (let i = 0; i < obj.messages.length; i++) {
      Serializer.validateMessage(obj.messages[i], i);
    }
  }

  /**
   * Validate a single message
   */
  private static validateMessage(msg: unknown, index: number): void {
    if (!msg || typeof msg !== 'object') {
      throw new ValidationError(
        `Message at index ${index} must be an object`,
        `messages[${index}]`,
        msg
      );
    }

    const message = msg as Record<string, unknown>;

    if (!['system', 'user', 'assistant', 'tool'].includes(message.role as string)) {
      throw new ValidationError(
        `Message at index ${index} has invalid role`,
        `messages[${index}].role`,
        message.role
      );
    }

    if (
      typeof message.content !== 'string' &&
      !Array.isArray(message.content)
    ) {
      throw new ValidationError(
        `Message at index ${index} has invalid content`,
        `messages[${index}].content`,
        message.content
      );
    }
  }

  /**
   * Deep clone messages array
   */
  private static cloneMessages(messages: Message[]): Message[] {
    return JSON.parse(JSON.stringify(messages));
  }

  /**
   * Clone options (excluding non-serializable properties)
   */
  private static cloneOptions(options: Partial<Options>): Partial<Options> {
    const { tools, parser, signal, ...serializableOptions } = options;
    return JSON.parse(JSON.stringify(serializableOptions));
  }

  /**
   * Convert SerializedLLM to JSON string
   */
  static toJSON(llm: SerializableLLM): string {
    return JSON.stringify(Serializer.serializeLLM(llm));
  }

  /**
   * Parse JSON string to SerializedLLM
   */
  static fromJSON(json: string): SerializedLLM {
    let parsed: unknown;

    try {
      parsed = JSON.parse(json);
    } catch (error) {
      throw new ValidationError(
        'Invalid JSON string for SerializedLLM',
        'json',
        json
      );
    }

    Serializer.validateSerializedLLM(parsed);
    return parsed;
  }
}
