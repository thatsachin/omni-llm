// Message Manager for Unified LLM
import type { Message, ContentPart, ToolCall } from './types';

/**
 * Manages message history for LLM conversations
 */
export class MessageManager {
  private messages: Message[];

  /**
   * Create a new MessageManager
   * @param initialMessages - Optional initial messages to populate history
   */
  constructor(initialMessages?: Message[]) {
    this.messages = initialMessages ? [...initialMessages] : [];
  }

  /**
   * Add a system message to the history
   * @param content - The system prompt content
   */
  addSystem(content: string): void {
    this.messages.push({
      role: 'system',
      content,
    });
  }

  /**
   * Add a user message to the history
   * @param content - The user message content (string or ContentPart array for multimodal)
   */
  addUser(content: string | ContentPart[]): void {
    this.messages.push({
      role: 'user',
      content,
    });
  }

  /**
   * Add an assistant message to the history
   * @param content - The assistant response content
   * @param toolCalls - Optional tool calls made by the assistant
   */
  addAssistant(content: string, toolCalls?: ToolCall[]): void {
    const message: Message = {
      role: 'assistant',
      content,
    };
    if (toolCalls && toolCalls.length > 0) {
      message.tool_calls = toolCalls;
    }
    this.messages.push(message);
  }

  /**
   * Add a tool result message to the history
   * @param toolCallId - The ID of the tool call this result responds to
   * @param result - The result of the tool execution (will be stringified if not a string)
   */
  addToolResult(toolCallId: string, result: string): void {
    this.messages.push({
      role: 'tool',
      tool_call_id: toolCallId,
      content: result,
    });
  }

  /**
   * Get all messages in the history
   * @returns A copy of the message array
   */
  getMessages(): Message[] {
    return [...this.messages];
  }

  /**
   * Clear all messages from the history
   */
  clear(): void {
    this.messages = [];
  }

  /**
   * Get the number of messages in the history
   */
  get length(): number {
    return this.messages.length;
  }

  /**
   * Serialize the message history to JSON
   * @returns The message array
   */
  toJSON(): Message[] {
    return this.getMessages();
  }

  /**
   * Create a MessageManager from serialized JSON
   * @param messages - The serialized message array
   * @returns A new MessageManager instance
   */
  static fromJSON(messages: Message[]): MessageManager {
    return new MessageManager(messages);
  }
}
