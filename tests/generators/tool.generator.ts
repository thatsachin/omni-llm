/**
 * Fast-check arbitraries for Tool types
 * Reusable generators for property-based testing
 */
import * as fc from 'fast-check';
import type { Tool, ToolCall, ToolResult, ToolDefinition, JSONSchema } from '../../src/types';

// Tool name generator (valid identifier)
export const arbitraryToolName = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s));

// Tool call ID generator
export const arbitraryToolCallId = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0);

// Simple JSON-serializable value generator
export const arbitraryJsonValue: fc.Arbitrary<unknown> = fc.oneof(
  fc.string(),
  fc.integer(),
  fc.double({ noNaN: true, noDefaultInfinity: true }),
  fc.boolean(),
  fc.constant(null)
);

// JSON object generator (for tool arguments)
export const arbitraryJsonObject = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)),
  arbitraryJsonValue,
  { minKeys: 0, maxKeys: 5 }
);

// JSON Schema generator (simplified)
export const arbitraryJsonSchema: fc.Arbitrary<JSONSchema> = fc.record({
  type: fc.constantFrom('object', 'string', 'number', 'boolean', 'array'),
  description: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
}).map(({ type, description }) => ({
  type,
  ...(description !== null ? { description } : {}),
}));

// Tool call generator
export const arbitraryToolCall: fc.Arbitrary<ToolCall> = fc.record({
  id: arbitraryToolCallId,
  type: fc.constant('function' as const),
  function: fc.record({
    name: arbitraryToolName,
    arguments: fc.json(),
  }),
});

// Tool call with specific name
export const arbitraryToolCallForTool = (toolName: string): fc.Arbitrary<ToolCall> =>
  fc.record({
    id: arbitraryToolCallId,
    type: fc.constant('function' as const),
    function: fc.record({
      name: fc.constant(toolName),
      arguments: fc.json(),
    }),
  });


// Tool result generator
export const arbitraryToolResult: fc.Arbitrary<ToolResult> = fc.record({
  tool_call_id: arbitraryToolCallId,
  result: fc.json(),
});

// Tool definition generator (without function)
export const arbitraryToolDefinition: fc.Arbitrary<ToolDefinition> = fc.record({
  type: fc.constant('function' as const),
  function: fc.record({
    name: arbitraryToolName,
    description: fc.string({ minLength: 1, maxLength: 200 }),
    parameters: arbitraryJsonSchema,
  }),
});

// Echo tool factory (returns input as output)
export const createEchoTool = (name: string): Tool => ({
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

// Async tool factory (simulates async operation)
export const createAsyncTool = (name: string, delayMs = 1): Tool => ({
  name,
  description: `Async tool: ${name}`,
  parameters: {
    type: 'object',
    properties: {
      value: { type: 'number' },
    },
  },
  function: async (...args: unknown[]) => {
    const input = args[0] as { value?: number } | undefined;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return { result: (input?.value || 0) * 2 };
  },
});

// Error tool factory (always throws)
export const createErrorTool = (name: string, errorMessage: string): Tool => ({
  name,
  description: `Error tool: ${name}`,
  parameters: { type: 'object' },
  function: () => {
    throw new Error(errorMessage);
  },
});

// Tool generator (with simple echo function)
export const arbitraryTool: fc.Arbitrary<Tool> = fc
  .tuple(arbitraryToolName, fc.string({ minLength: 1, maxLength: 200 }))
  .map(([name, description]) => ({
    name,
    description,
    parameters: { type: 'object' as const },
    function: (args: unknown) => ({ received: args }),
  }));

// Multiple tools generator
export const arbitraryTools = (
  minLength = 1,
  maxLength = 5
): fc.Arbitrary<Tool[]> =>
  fc
    .array(arbitraryToolName, { minLength, maxLength })
    .map((names) => [...new Set(names)])
    .filter((names) => names.length >= minLength)
    .map((names) => names.map((name) => createEchoTool(name)));

// Tool calls for a set of tools
export const arbitraryToolCallsForTools = (
  tools: Tool[]
): fc.Arbitrary<ToolCall[]> =>
  fc
    .array(
      fc.tuple(
        fc.constantFrom(...tools.map((t) => t.name)),
        arbitraryToolCallId,
        arbitraryJsonObject
      ),
      { minLength: 1, maxLength: tools.length }
    )
    .map((calls) =>
      calls.map(([name, id, args]) => ({
        id,
        type: 'function' as const,
        function: {
          name,
          arguments: JSON.stringify(args),
        },
      }))
    );
