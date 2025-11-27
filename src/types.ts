// Core types for Unified LLM

/**
 * Supported LLM service providers
 */
export type ServiceName =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'groq'
  | 'ollama'
  | 'xai'
  | 'deepseek'
  | (string & {});

/**
 * Message roles in a conversation
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Content part types for multimodal messages
 */
export interface TextContentPart {
  type: 'text';
  text: string;
}

export interface ImageUrlContentPart {
  type: 'image_url';
  image_url: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
}

export interface ImageContentPart {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

export interface DocumentContentPart {
  type: 'document';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

export type ContentPart =
  | TextContentPart
  | ImageUrlContentPart
  | ImageContentPart
  | DocumentContentPart;


/**
 * A single message in a conversation
 */
export interface Message {
  role: MessageRole;
  content: string | ContentPart[];
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

/**
 * JSON Schema type for tool parameters
 */
export interface JSONSchema {
  type?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  description?: string;
  enum?: unknown[];
  [key: string]: unknown;
}

/**
 * Tool definition for function calling
 */
export interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
  function: (...args: unknown[]) => unknown | Promise<unknown>;
}

/**
 * Tool call from an LLM response
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Result of executing a tool
 */
export interface ToolResult {
  tool_call_id: string;
  result: string;
}

/**
 * Tool definition for provider formatting (without function)
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JSONSchema;
  };
}

/**
 * Token usage information
 */
export interface Usage {
  input_tokens: number;
  output_tokens: number;
  thinking_tokens?: number;
  total_tokens: number;
}

/**
 * Cost information for a request
 */
export interface Cost {
  input_cost: number;
  output_cost: number;
  thinking_cost?: number;
  total_cost: number;
  currency: 'USD';
}

/**
 * Extended response with metadata
 */
export interface ExtendedResponse {
  content: string;
  thinking?: string;
  usage: Usage;
  cost: Cost | null;
  model: string;
  service: ServiceName;
  toolCalls?: ToolCall[];
}


/**
 * Attachment types for multimodal input
 */
export type AttachmentType = 'image' | 'document';
export type AttachmentSource = 'path' | 'url' | 'base64' | 'buffer';

/**
 * Attachment for multimodal requests
 */
export interface Attachment {
  type: AttachmentType;
  source: AttachmentSource;
  data: string | Buffer;
  mimeType?: string;
}

/**
 * Parser function type
 */
export type Parser<T = unknown> = (content: string) => T;

/**
 * Options for LLM requests
 */
export interface Options {
  service?: ServiceName;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  extended?: boolean;
  think?: boolean;
  max_thinking_tokens?: number;
  tools?: Tool[];
  parser?: Parser;
  messages?: Message[];
  signal?: AbortSignal;
  attachments?: Attachment[];
}

/**
 * Streaming chunk types
 */
export type ChunkType = 'content' | 'thinking' | 'tool_call' | 'usage';

/**
 * Streaming chunk
 */
export interface Chunk {
  type: ChunkType;
  content?: string;
  thinking?: string;
  toolCall?: ToolCall;
  usage?: Usage;
}

/**
 * Model information
 */
export interface ModelInfo {
  name: string;
  contextWindow: number;
  inputCostPer1k: number;
  outputCostPer1k: number;
  supportsThinking: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsDocuments: boolean;
  tags: string[];
}

/**
 * Model from provider API
 */
export interface Model {
  id: string;
  name: string;
  provider: ServiceName;
  info?: ModelInfo;
}

/**
 * Connection verification status
 */
export interface ConnectionStatus {
  success: boolean;
  service: ServiceName;
  message: string;
  error?: string;
}

/**
 * Serialized LLM instance for persistence
 */
export interface SerializedLLM {
  service: ServiceName;
  model: string;
  messages: Message[];
  options: Partial<Options>;
}

/**
 * Provider options passed to provider implementations
 */
export interface ProviderOptions {
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  max_tokens?: number;
  think?: boolean;
  max_thinking_tokens?: number;
  tools?: ToolDefinition[];
  signal?: AbortSignal;
}

/**
 * Provider response from non-streaming request
 */
export interface ProviderResponse {
  content: string;
  thinking?: string;
  toolCalls?: ToolCall[];
  usage: Usage;
  model: string;
}

/**
 * Provider chunk from streaming request
 */
export interface ProviderChunk {
  type: ChunkType;
  content?: string;
  thinking?: string;
  toolCall?: ToolCall;
  usage?: Usage;
}
