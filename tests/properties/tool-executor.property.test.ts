/**
 * Property tests for tool execution correctness
 * **Feature: unified-llm, Property 4: Tool Execution Correctness**
 * **Feature: unified-llm, Property 5: Multiple Tool Calls Handling**
 * **Validates: Requirements 6.2, 6.3, 6.4, 6.6**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ToolExecutor } from '../../src/tool-executor';
import type { Tool, ToolCall } from '../../src/types';

// Configure fast-check for 100 iterations
fc.configureGlobal({ numRuns: 100 });

// Generator for tool names
const arbitraryToolName = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s));

// Generator for tool call IDs
const arbitraryToolCallId = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0);

// Generator for simple JSON-serializable values
const arbitraryJsonValue: fc.Arbitrary<unknown> = fc.oneof(
  fc.string(),
  fc.integer(),
  fc.double({ noNaN: true, noDefaultInfinity: true }),
  fc.boolean(),
  fc.constant(null)
);

// Generator for simple JSON objects
const arbitraryJsonObject = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)),
  arbitraryJsonValue,
  { minKeys: 0, maxKeys: 5 }
);

// Generator for a tool that returns its input
const createEchoTool = (name: string): Tool => ({
  name,
  description: `Echo tool: ${name}`,
  parameters: {
    type: 'object',
    properties: {
      input: { type: 'string' },
    },
  },
  function: (args: unknown) => args,
});

describe('Property 4: Tool Execution Correctness', () => {
  /**
   * For any tool call requested by an LLM, the tool's function SHALL be executed
   * with the exact arguments provided, and the result SHALL be added to message
   * history with the correct tool_call_id.
   */

  it('should execute tool with exact arguments provided', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryToolName,
        arbitraryToolCallId,
        arbitraryJsonObject,
        async (toolName, callId, args) => {
          let receivedArgs: unknown = null;

          const tool: Tool = {
            name: toolName,
            description: 'Test tool',
            parameters: { type: 'object' },
            function: (a: unknown) => {
              receivedArgs = a;
              return { success: true };
            },
          };

          const executor = new ToolExecutor([tool]);
          // Serialize and parse to normalize -0 to 0 (JSON doesn't preserve -0)
          const serializedArgs = JSON.stringify(args);
          const normalizedArgs = JSON.parse(serializedArgs);
          
          const toolCall: ToolCall = {
            id: callId,
            type: 'function',
            function: {
              name: toolName,
              arguments: serializedArgs,
            },
          };

          await executor.executeOne(toolCall);

          // Compare with normalized args since JSON.parse normalizes -0 to 0
          expect(receivedArgs).toEqual(normalizedArgs);
        }
      )
    );
  });

  it('should return result with correct tool_call_id', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryToolName,
        arbitraryToolCallId,
        async (toolName, callId) => {
          const tool = createEchoTool(toolName);
          const executor = new ToolExecutor([tool]);

          const toolCall: ToolCall = {
            id: callId,
            type: 'function',
            function: {
              name: toolName,
              arguments: '{}',
            },
          };

          const result = await executor.executeOne(toolCall);

          expect(result.tool_call_id).toBe(callId);
        }
      )
    );
  });

  it('should handle async tool functions', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryToolName,
        arbitraryToolCallId,
        fc.integer({ min: 1, max: 100 }),
        async (toolName, callId, value) => {
          const tool: Tool = {
            name: toolName,
            description: 'Async tool',
            parameters: { type: 'object' },
            function: async (args: { value?: number }) => {
              await new Promise((resolve) => setTimeout(resolve, 1));
              return { doubled: (args.value || 0) * 2 };
            },
          };

          const executor = new ToolExecutor([tool]);
          const toolCall: ToolCall = {
            id: callId,
            type: 'function',
            function: {
              name: toolName,
              arguments: JSON.stringify({ value }),
            },
          };

          const result = await executor.executeOne(toolCall);
          const parsed = JSON.parse(result.result);

          expect(parsed.doubled).toBe(value * 2);
        }
      )
    );
  });

  it('should return error for non-existent tool', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryToolName,
        arbitraryToolCallId,
        async (toolName, callId) => {
          const executor = new ToolExecutor([]);

          const toolCall: ToolCall = {
            id: callId,
            type: 'function',
            function: {
              name: toolName,
              arguments: '{}',
            },
          };

          const result = await executor.executeOne(toolCall);
          const parsed = JSON.parse(result.result);

          expect(result.tool_call_id).toBe(callId);
          expect(parsed.error).toContain('not found');
        }
      )
    );
  });

  it('should handle tool execution errors gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryToolName,
        arbitraryToolCallId,
        fc.string({ minLength: 1, maxLength: 100 }),
        async (toolName, callId, errorMessage) => {
          const tool: Tool = {
            name: toolName,
            description: 'Error tool',
            parameters: { type: 'object' },
            function: () => {
              throw new Error(errorMessage);
            },
          };

          const executor = new ToolExecutor([tool]);
          const toolCall: ToolCall = {
            id: callId,
            type: 'function',
            function: {
              name: toolName,
              arguments: '{}',
            },
          };

          const result = await executor.executeOne(toolCall);
          const parsed = JSON.parse(result.result);

          expect(result.tool_call_id).toBe(callId);
          expect(parsed.error).toBe(errorMessage);
        }
      )
    );
  });

  it('should handle invalid JSON arguments', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryToolName,
        arbitraryToolCallId,
        async (toolName, callId) => {
          const tool = createEchoTool(toolName);
          const executor = new ToolExecutor([tool]);

          const toolCall: ToolCall = {
            id: callId,
            type: 'function',
            function: {
              name: toolName,
              arguments: 'not valid json {{{',
            },
          };

          const result = await executor.executeOne(toolCall);
          const parsed = JSON.parse(result.result);

          expect(result.tool_call_id).toBe(callId);
          expect(parsed.error).toContain('Invalid JSON');
        }
      )
    );
  });
});


describe('Property 5: Multiple Tool Calls Handling', () => {
  /**
   * For any number N of tool calls in a single response, all N tools SHALL be
   * executed and all N results SHALL be returned to the LLM in the correct order.
   */

  it('should execute all tool calls and return results in order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbitraryToolName, { minLength: 1, maxLength: 10 }),
        async (toolNames) => {
          const uniqueNames = [...new Set(toolNames)];

          const tools = uniqueNames.map((name) => ({
            name,
            description: `Tool ${name}`,
            parameters: { type: 'object' as const },
            function: () => {
              return { executed: name };
            },
          }));

          const executor = new ToolExecutor(tools);

          const toolCalls: ToolCall[] = uniqueNames.map((name, i) => ({
            id: `call_${i}`,
            type: 'function' as const,
            function: {
              name,
              arguments: '{}',
            },
          }));

          const results = await executor.execute(toolCalls);

          // All tools should be executed
          expect(results.length).toBe(uniqueNames.length);

          // Results should be in the same order as calls
          results.forEach((result, i) => {
            expect(result.tool_call_id).toBe(`call_${i}`);
            const parsed = JSON.parse(result.result);
            expect(parsed.executed).toBe(uniqueNames[i]);
          });
        }
      )
    );
  });

  it('should execute tools sequentially when using executeSequential', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }),
        async (count) => {
          const executionOrder: number[] = [];

          const tools: Tool[] = [];
          for (let i = 0; i < count; i++) {
            tools.push({
              name: `tool_${i}`,
              description: `Tool ${i}`,
              parameters: { type: 'object' },
              function: async () => {
                await new Promise((resolve) => setTimeout(resolve, 5));
                executionOrder.push(i);
                return { index: i };
              },
            });
          }

          const executor = new ToolExecutor(tools);

          const toolCalls: ToolCall[] = tools.map((t, i) => ({
            id: `call_${i}`,
            type: 'function' as const,
            function: {
              name: t.name,
              arguments: '{}',
            },
          }));

          const results = await executor.executeSequential(toolCalls);

          // All tools should be executed
          expect(results.length).toBe(count);

          // Execution order should be sequential
          expect(executionOrder).toEqual(Array.from({ length: count }, (_, i) => i));
        }
      )
    );
  });

  it('should handle mixed success and failure in multiple calls', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }),
        async (shouldSucceed) => {
          const tools: Tool[] = shouldSucceed.map((success, i) => ({
            name: `tool_${i}`,
            description: `Tool ${i}`,
            parameters: { type: 'object' },
            function: () => {
              if (!success) {
                throw new Error(`Tool ${i} failed`);
              }
              return { success: true, index: i };
            },
          }));

          const executor = new ToolExecutor(tools);

          const toolCalls: ToolCall[] = tools.map((t, i) => ({
            id: `call_${i}`,
            type: 'function' as const,
            function: {
              name: t.name,
              arguments: '{}',
            },
          }));

          const results = await executor.execute(toolCalls);

          // All calls should have results
          expect(results.length).toBe(shouldSucceed.length);

          // Check each result matches expected success/failure
          results.forEach((result, i) => {
            const parsed = JSON.parse(result.result);
            if (shouldSucceed[i]) {
              expect(parsed.success).toBe(true);
              expect(parsed.index).toBe(i);
            } else {
              expect(parsed.error).toContain(`Tool ${i} failed`);
            }
          });
        }
      )
    );
  });

  it('should maintain tool_call_id correspondence for all results', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbitraryToolCallId, { minLength: 1, maxLength: 10 }),
        async (callIds) => {
          const uniqueIds = [...new Set(callIds)];

          const tools: Tool[] = uniqueIds.map((_, i) => ({
            name: `tool_${i}`,
            description: `Tool ${i}`,
            parameters: { type: 'object' },
            function: () => ({ index: i }),
          }));

          const executor = new ToolExecutor(tools);

          const toolCalls: ToolCall[] = uniqueIds.map((id, i) => ({
            id,
            type: 'function' as const,
            function: {
              name: `tool_${i}`,
              arguments: '{}',
            },
          }));

          const results = await executor.execute(toolCalls);

          // Each result should have the correct tool_call_id
          results.forEach((result, i) => {
            expect(result.tool_call_id).toBe(uniqueIds[i]);
          });
        }
      )
    );
  });

  it('should handle empty tool calls array', async () => {
    const executor = new ToolExecutor([]);
    const results = await executor.execute([]);
    expect(results).toEqual([]);
  });
});

describe('ToolExecutor utility methods', () => {
  it('should correctly report tool existence', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryToolName, { minLength: 1, maxLength: 10 }),
        (toolNames) => {
          const uniqueNames = [...new Set(toolNames)];
          const tools = uniqueNames.map((name) => createEchoTool(name));
          const executor = new ToolExecutor(tools);

          // All registered tools should exist
          uniqueNames.forEach((name) => {
            expect(executor.hasTool(name)).toBe(true);
          });

          // Non-existent tool should not exist
          expect(executor.hasTool('nonexistent_tool_xyz')).toBe(false);
        }
      )
    );
  });

  it('should return correct tool definitions', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryToolName, { minLength: 1, maxLength: 5 }),
        (toolNames) => {
          const uniqueNames = [...new Set(toolNames)];
          const tools = uniqueNames.map((name) => createEchoTool(name));
          const executor = new ToolExecutor(tools);

          const definitions = executor.getToolDefinitions();

          expect(definitions.length).toBe(uniqueNames.length);
          definitions.forEach((def) => {
            expect(def.type).toBe('function');
            expect(uniqueNames).toContain(def.function.name);
            expect(def.function.description).toBeDefined();
            expect(def.function.parameters).toBeDefined();
          });
        }
      )
    );
  });

  it('should correctly report size', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryToolName, { minLength: 0, maxLength: 10 }),
        (toolNames) => {
          const uniqueNames = [...new Set(toolNames)];
          const tools = uniqueNames.map((name) => createEchoTool(name));
          const executor = new ToolExecutor(tools);

          expect(executor.size).toBe(uniqueNames.length);
        }
      )
    );
  });
});
