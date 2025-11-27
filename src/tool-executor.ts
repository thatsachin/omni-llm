// Tool Executor for Unified LLM
import type { Tool, ToolCall, ToolResult, ToolDefinition } from './types';

/**
 * Handles execution of tools/functions called by LLMs
 */
export class ToolExecutor {
  private tools: Map<string, Tool>;

  /**
   * Create a new ToolExecutor
   * @param tools - Array of tool definitions with their functions
   */
  constructor(tools: Tool[]) {
    this.tools = new Map();
    for (const tool of tools) {
      this.tools.set(tool.name, tool);
    }
  }

  /**
   * Execute a single tool call
   * @param toolCall - The tool call from the LLM
   * @returns The result of the tool execution
   */
  async executeOne(toolCall: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(toolCall.function.name);

    if (!tool) {
      return {
        tool_call_id: toolCall.id,
        result: JSON.stringify({
          error: `Tool '${toolCall.function.name}' not found`,
        }),
      };
    }

    try {
      // Parse the arguments
      let args: unknown;
      try {
        args = JSON.parse(toolCall.function.arguments || '{}');
      } catch {
        return {
          tool_call_id: toolCall.id,
          result: JSON.stringify({
            error: `Invalid JSON arguments: ${toolCall.function.arguments}`,
          }),
        };
      }

      // Execute the tool function
      const result = await Promise.resolve(tool.function(args));

      // Convert result to string
      const resultString = typeof result === 'string' 
        ? result 
        : JSON.stringify(result);

      return {
        tool_call_id: toolCall.id,
        result: resultString,
      };
    } catch (error) {
      return {
        tool_call_id: toolCall.id,
        result: JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
      };
    }
  }


  /**
   * Execute multiple tool calls
   * @param toolCalls - Array of tool calls from the LLM
   * @returns Array of tool results in the same order
   */
  async execute(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    // Execute all tool calls in parallel
    const results = await Promise.all(
      toolCalls.map((toolCall) => this.executeOne(toolCall))
    );
    return results;
  }

  /**
   * Execute tool calls sequentially (for order-dependent operations)
   * @param toolCalls - Array of tool calls from the LLM
   * @returns Array of tool results in the same order
   */
  async executeSequential(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    for (const toolCall of toolCalls) {
      const result = await this.executeOne(toolCall);
      results.push(result);
    }
    return results;
  }

  /**
   * Get tool definitions for provider formatting
   * @returns Array of tool definitions without the function implementations
   */
  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /**
   * Check if a tool exists
   * @param name - The tool name to check
   * @returns True if the tool exists
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get a tool by name
   * @param name - The tool name
   * @returns The tool or undefined
   */
  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Add a tool to the executor
   * @param tool - The tool to add
   */
  addTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Remove a tool from the executor
   * @param name - The tool name to remove
   * @returns True if the tool was removed
   */
  removeTool(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Get the number of registered tools
   */
  get size(): number {
    return this.tools.size;
  }

  /**
   * Get all tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }
}
