# API Reference

Complete API documentation for unified-llm.

## Table of Contents

- [LLM Class](#llm-class)
- [llm Function](#llm-function)
- [MessageManager](#messagemanager)
- [AttachmentProcessor](#attachmentprocessor)
- [ToolExecutor](#toolexecutor)
- [Parsers](#parsers)
- [Error Classes](#error-classes)
- [Types](#types)

---

## LLM Class

The main class for interacting with LLM providers.

### Constructor

```typescript
new LLM(model: string, options?: LLMOptions)
```

**Parameters:**
- `model` - Model identifier in format `provider/model-name`
- `options` - Optional configuration

**Options:**
```typescript
interface LLMOptions {
  apiKey?: string;           // API key (overrides env variable)
  baseUrl?: string;          // Custom API endpoint
  temperature?: number;      // 0-2, controls randomness
  max_tokens?: number;       // Maximum response tokens
  tools?: Tool[];            // Array of tool definitions
  think?: boolean;           // Enable thinking mode
  max_thinking_tokens?: number; // Max tokens for thinking
}
```

**Example:**
```typescript
const chat = new LLM('openai/gpt-4o', {
  temperature: 0.7,
  max_tokens: 4096
});
```

### Methods

#### chat()

Send a message and get a response.

```typescript
chat(input: string | Message[], options?: ChatOptions): Promise<ExtendedResponse>
```

**Parameters:**
- `input` - User message string or array of messages
- `options` - Per-request options (override instance options)

**Returns:** `Promise<ExtendedResponse>`

**Example:**
```typescript
const response = await chat.chat('Hello!');
console.log(response.content);
```

#### stream()

Stream a response as an async iterator.

```typescript
stream(input: string | Message[], options?: ChatOptions): AsyncIterable<Chunk>
```

**Parameters:**
- `input` - User message string or array of messages
- `options` - Per-request options

**Returns:** `AsyncIterable<Chunk>`

**Example:**
```typescript
for await (const chunk of chat.stream('Tell me a story')) {
  if (chunk.type === 'content') {
    process.stdout.write(chunk.content);
  }
}
```

#### complete()

Get the complete response after streaming.

```typescript
complete(): Promise<ExtendedResponse>
```

**Returns:** `Promise<ExtendedResponse>`

**Example:**
```typescript
for await (const chunk of chat.stream('Hello')) {
  // process chunks
}
const complete = await chat.complete();
console.log('Total tokens:', complete.usage?.total_tokens);
```

#### system()

Set or add a system prompt.

```typescript
system(prompt: string): this
```

**Parameters:**
- `prompt` - System prompt text

**Returns:** `this` (for chaining)

**Example:**
```typescript
chat.system('You are a helpful assistant').chat('Hello');
```

#### abort()

Abort the current request.

```typescript
abort(): void
```

**Example:**
```typescript
const promise = chat.chat('Write a novel');
setTimeout(() => chat.abort(), 5000);
```

#### getMessages()

Get the current message history.

```typescript
getMessages(): Message[]
```

**Returns:** Array of messages

#### clearMessages()

Clear the message history.

```typescript
clearMessages(): void
```

#### toJSON()

Serialize the LLM instance state.

```typescript
toJSON(): SerializedLLM
```

**Returns:** Serializable object

### Static Methods

#### LLM.fromJSON()

Restore an LLM instance from serialized state.

```typescript
static fromJSON(data: SerializedLLM): LLM
```

#### LLM.parsers

Built-in response parsers.

```typescript
static parsers: {
  json<T>(content: string): T;
  xml(content: string): XMLNode;
  codeBlock(content: string, language?: string): string;
  custom<T>(fn: (content: string) => T): Parser<T>;
}
```

#### LLM.fetchModels()

Fetch available models from a provider.

```typescript
static fetchModels(service: ServiceName, apiKey?: string): Promise<Model[]>
```

#### LLM.getQualityModels()

Get recommended quality models for a provider.

```typescript
static getQualityModels(service: ServiceName): Model[]
```

#### LLM.registerService()

Register a custom provider.

```typescript
static registerService(name: string, provider: BaseProvider): void
```

#### LLM.verifyConnection()

Verify connection to a provider.

```typescript
static verifyConnection(service: ServiceName, apiKey?: string): Promise<boolean>
```

---

## llm Function

One-liner function for simple requests.

```typescript
llm(model: string, message: string, options?: LLMOptions): Promise<string>
```

**Parameters:**
- `model` - Model identifier
- `message` - User message
- `options` - Optional configuration

**Returns:** `Promise<string>` - Response content

**Example:**
```typescript
const answer = await llm('openai/gpt-4o', 'What is 2+2?');
```

---

## MessageManager

Manage conversation message history.

### Constructor

```typescript
new MessageManager(initialMessages?: Message[])
```

### Methods

#### addSystem()

```typescript
addSystem(content: string): this
```

#### addUser()

```typescript
addUser(content: string | ContentPart[]): this
```

#### addAssistant()

```typescript
addAssistant(content: string, toolCalls?: ToolCall[]): this
```

#### addToolResult()

```typescript
addToolResult(toolCallId: string, content: string): this
```

#### getMessages()

```typescript
getMessages(): Message[]
```

#### clear()

```typescript
clear(): void
```

#### toJSON()

```typescript
toJSON(): Message[]
```

#### fromJSON()

```typescript
static fromJSON(data: Message[]): MessageManager
```

---

## AttachmentProcessor

Process attachments (images, documents) for LLM input.

### Static Methods

#### fromPath()

Load attachment from file path.

```typescript
static fromPath(path: string): Promise<Attachment>
```

#### fromUrl()

Load attachment from URL.

```typescript
static fromUrl(url: string): Promise<Attachment>
```

#### fromBase64()

Create attachment from base64 string.

```typescript
static fromBase64(data: string, mimeType: string): Attachment
```

#### fromBuffer()

Create attachment from buffer.

```typescript
static fromBuffer(buffer: Buffer, mimeType: string): Attachment
```

**Example:**
```typescript
const attachment = await AttachmentProcessor.fromPath('./image.png');
const response = await chat.chat('Describe this', { attachments: [attachment] });
```

---

## ToolExecutor

Execute tool calls from LLM responses.

### Constructor

```typescript
new ToolExecutor(tools: Tool[])
```

### Methods

#### execute()

Execute a single tool call.

```typescript
execute(toolCall: ToolCall): Promise<ToolResult>
```

#### executeAll()

Execute multiple tool calls.

```typescript
executeAll(toolCalls: ToolCall[]): Promise<ToolResult[]>
```

#### getToolDefinitions()

Get tool definitions for provider API.

```typescript
getToolDefinitions(): ToolDefinition[]
```

---

## Parsers

Built-in response parsers.

### json()

Parse JSON from response content.

```typescript
parsers.json<T = unknown>(content: string): T
```

Handles markdown code blocks automatically.

### xml()

Parse XML into a DOM-like structure.

```typescript
parsers.xml(content: string): XMLNode

interface XMLNode {
  tag: string;
  attributes: Record<string, string>;
  children: (XMLNode | string)[];
  text: string;
}
```

### codeBlock()

Extract code from markdown code blocks.

```typescript
parsers.codeBlock(content: string, language?: string): string
```

### custom()

Create a custom parser.

```typescript
parsers.custom<T>(fn: (content: string) => T): Parser<T>
```

---

## Error Classes

### UnifiedLLMError

Base error class for all unified-llm errors.

```typescript
class UnifiedLLMError extends Error {
  code: string;
}
```

### AuthenticationError

Invalid or missing API key.

```typescript
class AuthenticationError extends UnifiedLLMError {
  service: ServiceName;
}
```

### RateLimitError

Rate limit exceeded.

```typescript
class RateLimitError extends UnifiedLLMError {
  retryAfter?: number;  // Seconds to wait
  service: ServiceName;
}
```

### ModelNotFoundError

Model doesn't exist.

```typescript
class ModelNotFoundError extends UnifiedLLMError {
  model: string;
}
```

### ValidationError

Invalid parameters.

```typescript
class ValidationError extends UnifiedLLMError {
  field?: string;
}
```

### NetworkError

Connection issues.

```typescript
class NetworkError extends UnifiedLLMError {
  cause?: Error;
}
```

### ParsingError

Response parsing failed.

```typescript
class ParsingError extends UnifiedLLMError {
  content: string;
  parserType: string;
}
```

### AbortError

Request was aborted.

```typescript
class AbortError extends UnifiedLLMError {}
```

### UnsupportedFeatureError

Feature not supported by provider.

```typescript
class UnsupportedFeatureError extends UnifiedLLMError {
  feature: string;
  service: ServiceName;
}
```

---

## Types

### Message

```typescript
interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}
```

### ContentPart

```typescript
type ContentPart = 
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };
```

### ExtendedResponse

```typescript
interface ExtendedResponse {
  content: string;
  thinking?: string;
  toolCalls?: ToolCall[];
  usage?: Usage;
  cost?: Cost;
  model: string;
}
```

### Usage

```typescript
interface Usage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  thinking_tokens?: number;
}
```

### Cost

```typescript
interface Cost {
  input: number;
  output: number;
  total: number;
  thinking?: number;
}
```

### Tool

```typescript
interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
  function: (args: any) => any | Promise<any>;
}
```

### ToolCall

```typescript
interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}
```

### Chunk

```typescript
type Chunk =
  | { type: 'content'; content: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'tool_call'; toolCall: ToolCall }
  | { type: 'usage'; usage: Usage };
```

### ServiceName

```typescript
type ServiceName = 
  | 'openai' 
  | 'anthropic' 
  | 'google' 
  | 'groq' 
  | 'ollama' 
  | 'xai' 
  | 'deepseek'
  | string;  // Custom providers
```

### Model

```typescript
interface Model {
  id: string;
  name: string;
  provider: ServiceName;
  contextWindow?: number;
  pricing?: {
    input: number;   // Per 1M tokens
    output: number;  // Per 1M tokens
  };
}
```
