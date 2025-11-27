// Stream Handler for Unified LLM
import type {
  Chunk,
  ExtendedResponse,
  ProviderChunk,
  ServiceName,
  ToolCall,
  Usage,
  Cost,
} from './types';

/**
 * Handles streaming responses from LLM providers
 * Tracks chunks for complete response assembly
 */
export class StreamHandler {
  private chunks: Chunk[] = [];
  private isComplete: boolean = false;
  private response: ExtendedResponse | null = null;

  private contentParts: string[] = [];
  private thinkingParts: string[] = [];
  private toolCalls: ToolCall[] = [];
  private usage: Usage | null = null;

  private readonly service: ServiceName;
  private readonly model: string;

  constructor(service: ServiceName, model: string) {
    this.service = service;
    this.model = model;
  }

  /**
   * Process a stream of provider chunks and yield normalized chunks
   */
  async *process(
    stream: AsyncIterable<ProviderChunk>
  ): AsyncIterable<Chunk> {
    for await (const providerChunk of stream) {
      const chunk = this.processChunk(providerChunk);
      if (chunk) {
        this.chunks.push(chunk);
        yield chunk;
      }
    }

    // Mark as complete and build final response
    this.isComplete = true;
    this.buildResponse();
  }


  /**
   * Process a single provider chunk into a normalized chunk
   */
  private processChunk(providerChunk: ProviderChunk): Chunk | null {
    switch (providerChunk.type) {
      case 'content':
        if (providerChunk.content) {
          this.contentParts.push(providerChunk.content);
          return {
            type: 'content',
            content: providerChunk.content,
          };
        }
        break;

      case 'thinking':
        if (providerChunk.thinking) {
          this.thinkingParts.push(providerChunk.thinking);
          return {
            type: 'thinking',
            thinking: providerChunk.thinking,
          };
        }
        break;

      case 'tool_call':
        if (providerChunk.toolCall) {
          this.toolCalls.push(providerChunk.toolCall);
          return {
            type: 'tool_call',
            toolCall: providerChunk.toolCall,
          };
        }
        break;

      case 'usage':
        if (providerChunk.usage) {
          this.usage = providerChunk.usage;
          return {
            type: 'usage',
            usage: providerChunk.usage,
          };
        }
        break;
    }

    return null;
  }

  /**
   * Build the final ExtendedResponse from accumulated chunks
   */
  private buildResponse(): void {
    const content = this.contentParts.join('');
    const thinking =
      this.thinkingParts.length > 0 ? this.thinkingParts.join('') : undefined;

    // Use provided usage or create default
    const usage: Usage = this.usage ?? {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
    };

    this.response = {
      content,
      thinking,
      usage,
      cost: null, // Cost will be calculated by CostCalculator
      model: this.model,
      service: this.service,
      toolCalls: this.toolCalls.length > 0 ? this.toolCalls : undefined,
    };
  }

  /**
   * Get the complete response after streaming finishes
   * @throws Error if called before stream is complete
   */
  getComplete(): ExtendedResponse {
    if (!this.isComplete) {
      throw new Error('Stream is not complete. Call process() first.');
    }

    if (!this.response) {
      throw new Error('Response not built. This should not happen.');
    }

    return this.response;
  }

  /**
   * Check if the stream has completed
   */
  getIsComplete(): boolean {
    return this.isComplete;
  }

  /**
   * Get all accumulated chunks
   */
  getChunks(): Chunk[] {
    return [...this.chunks];
  }

  /**
   * Get the accumulated content so far (even before completion)
   */
  getCurrentContent(): string {
    return this.contentParts.join('');
  }

  /**
   * Get the accumulated thinking content so far
   */
  getCurrentThinking(): string {
    return this.thinkingParts.join('');
  }

  /**
   * Get the accumulated tool calls so far
   */
  getCurrentToolCalls(): ToolCall[] {
    return [...this.toolCalls];
  }

  /**
   * Set the cost on the response (called by CostCalculator)
   */
  setCost(cost: Cost | null): void {
    if (this.response) {
      this.response.cost = cost;
    }
  }

  /**
   * Reset the handler for reuse
   */
  reset(): void {
    this.chunks = [];
    this.isComplete = false;
    this.response = null;
    this.contentParts = [];
    this.thinkingParts = [];
    this.toolCalls = [];
    this.usage = null;
  }
}
