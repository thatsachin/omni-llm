# omni-llm

A unified, **zero-dependency** TypeScript/JavaScript library for interacting with multiple LLM providers through a single, consistent API.

[![npm version](https://badge.fury.io/js/omni-llm.svg)](https://www.npmjs.com/package/omni-llm)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](https://www.npmjs.com/package/omni-llm)

## Why omni-llm?

Both `omni-llm` and `LLM.js` are excellent zero-dependency libraries for working with multiple LLM providers. Here's how they compare:

| Feature | omni-llm | LLM.js |
|---------|----------|--------|
| **Zero Dependencies** | ✅ Yes | ✅ Yes |
| **TypeScript** | ✅ Full types | ✅ Full types |
| **Streaming** | ✅ Native async iterators | ✅ Yes |
| **Tool Calling** | ✅ All providers | ✅ All providers |
| **Vision/Images** | ✅ All providers | ✅ All providers |
| **Thinking Mode** | ✅ Claude, DeepSeek | ✅ Claude, DeepSeek |
| **Cost Tracking** | ✅ Built-in | ✅ Built-in |
| **Token Usage** | ✅ Detailed | ✅ Detailed |
| **Abort Support** | ✅ AbortController | ✅ Yes |
| **Serialization** | ✅ Full state | ❌ No |
| **Model Syntax** | `provider/model` | `{service, model}` |
| **Custom Providers** | ✅ Easy registration | ✅ Extensible |
| **Error Handling** | ✅ Typed errors | ⚠️ Generic |
| **Local Models** | ✅ Ollama native | ✅ Ollama native |
| **PDF Attachments** | ❌ No | ✅ Yes |
| **Browser Support** | ✅ Yes | ✅ Yes |

**Choose omni-llm if you prefer:**
- Clean `provider/model` syntax (e.g., `openai/gpt-4o`)
- Full state serialization for saving/restoring conversations
- Strongly typed error classes for precise error handling

**Choose LLM.js if you prefer:**
- PDF document attachments
- Options-based configuration style
- Established library with longer track record

## Supported Providers

- **OpenAI** - GPT-4, GPT-4o, GPT-3.5-turbo, o1, o1-mini
- **Anthropic** - Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku
- **Google** - Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini 2.0
- **Groq** - Llama 3, Mixtral (ultra-fast inference)
- **Ollama** - Any local model (Llama, Mistral, CodeLlama, etc.)
- **xAI** - Grok-1, Grok-2
- **DeepSeek** - DeepSeek-V3, DeepSeek-R1 (with reasoning)

## Installation

```bash
npm install omni-llm
```

```bash
yarn add omni-llm
```

```bash
pnpm add omni-llm
```

## Quick Start

### Basic Usage (One-liner)

```typescript
import { llm } from 'omni-llm';

// Simple one-off request
const response = await llm('openai/gpt-4o', 'What is the capital of France?');
console.log(response); // "The capital of France is Paris."
```

### Instance-Based Usage

```typescript
import { LLM } from 'omni-llm';

// Create an instance for conversation
const chat = new LLM('anthropic/claude-3-5-sonnet-20241022');

// Add a system prompt
chat.system('You are a helpful coding assistant.');

// Send messages
const response = await chat.chat('How do I reverse a string in JavaScript?');
console.log(response.content);

// Continue the conversation (history is maintained)
const followUp = await chat.chat('Can you show me a more efficient way?');
console.log(followUp.content);
```

### Streaming Responses

```typescript
import { LLM } from 'omni-llm';

const chat = new LLM('openai/gpt-4o');

// Stream the response
for await (const chunk of chat.stream('Tell me a story about a robot')) {
  process.stdout.write(chunk.content || '');
}

// Or get the complete response after streaming
const stream = chat.stream('Tell me another story');
for await (const chunk of stream) {
  process.stdout.write(chunk.content || '');
}
const complete = await chat.complete();
console.log('\n\nTotal tokens:', complete.usage?.total_tokens);
```

## Core Features

### 1. Multi-Provider Support

Switch between providers by changing the model string:

```typescript
import { llm } from 'omni-llm';

// OpenAI
await llm('openai/gpt-4o', 'Hello!');

// Anthropic
await llm('anthropic/claude-3-5-sonnet-20241022', 'Hello!');

// Google
await llm('google/gemini-1.5-pro', 'Hello!');

// Groq (fast inference)
await llm('groq/llama-3.1-70b-versatile', 'Hello!');

// Local Ollama
await llm('ollama/llama3.2', 'Hello!');

// xAI
await llm('xai/grok-2', 'Hello!');

// DeepSeek
await llm('deepseek/deepseek-chat', 'Hello!');
```

### 2. Tool Calling (Function Calling)

```typescript
import { LLM } from 'omni-llm';

const tools = [
  {
    name: 'get_weather',
    description: 'Get the current weather for a location',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'City name' },
        unit: { type: 'string', enum: ['celsius', 'fahrenheit'] }
      },
      required: ['location']
    },
    function: async ({ location, unit = 'celsius' }) => {
      // Your weather API call here
      return { temperature: 22, unit, condition: 'sunny' };
    }
  }
];

const chat = new LLM('openai/gpt-4o', { tools });
const response = await chat.chat('What\'s the weather in Tokyo?');
console.log(response.content); // "The weather in Tokyo is 22°C and sunny."
```

### 3. Vision (Image Analysis)

```typescript
import { LLM, AttachmentProcessor } from 'omni-llm';

const chat = new LLM('openai/gpt-4o');

// From URL
const response = await chat.chat('What\'s in this image?', {
  attachments: [
    await AttachmentProcessor.fromUrl('https://example.com/image.jpg')
  ]
});

// From local file
const response2 = await chat.chat('Describe this photo', {
  attachments: [
    await AttachmentProcessor.fromPath('./photo.png')
  ]
});

// From base64
const response3 = await chat.chat('What do you see?', {
  attachments: [
    AttachmentProcessor.fromBase64(base64String, 'image/jpeg')
  ]
});
```

### 4. Thinking Mode (Extended Reasoning)

```typescript
import { LLM } from 'omni-llm';

// Claude with extended thinking
const chat = new LLM('anthropic/claude-3-5-sonnet-20241022');
const response = await chat.chat('Solve this complex math problem: ...', {
  think: true,
  max_thinking_tokens: 10000
});

console.log('Thinking:', response.thinking);
console.log('Answer:', response.content);

// DeepSeek with reasoning
const deepseek = new LLM('deepseek/deepseek-reasoner');
const result = await deepseek.chat('Explain quantum entanglement', {
  think: true
});
```

### 5. Streaming with Tool Calls

```typescript
import { LLM } from 'omni-llm';

const chat = new LLM('anthropic/claude-3-5-sonnet-20241022', {
  tools: [/* your tools */]
});

for await (const chunk of chat.stream('Search for the latest news')) {
  if (chunk.type === 'content') {
    process.stdout.write(chunk.content);
  } else if (chunk.type === 'tool_call') {
    console.log('Tool called:', chunk.toolCall.function.name);
  } else if (chunk.type === 'thinking') {
    console.log('Thinking:', chunk.thinking);
  }
}
```

### 6. Message History Management

```typescript
import { LLM, MessageManager } from 'omni-llm';

const chat = new LLM('openai/gpt-4o');

// Automatic history management
await chat.chat('My name is Alice');
await chat.chat('What is my name?'); // "Your name is Alice"

// Access message history
const messages = chat.getMessages();

// Clear history
chat.clearMessages();

// Manual message management
const manager = new MessageManager();
manager.addSystem('You are a helpful assistant');
manager.addUser('Hello!');
manager.addAssistant('Hi there! How can I help?');

const chat2 = new LLM('openai/gpt-4o');
const response = await chat2.chat(manager.getMessages());
```

### 7. Response Parsing

```typescript
import { LLM } from 'omni-llm';

const chat = new LLM('openai/gpt-4o');

// JSON parsing
const response = await chat.chat('Return a JSON object with name and age');
const data = LLM.parsers.json(response.content);

// Code block extraction
const codeResponse = await chat.chat('Write a Python function to sort a list');
const code = LLM.parsers.codeBlock(codeResponse.content, 'python');

// XML parsing
const xmlResponse = await chat.chat('Return data in XML format');
const xml = LLM.parsers.xml(xmlResponse.content);
console.log(xml.tag, xml.children, xml.text);

// Custom parser
const customParser = LLM.parsers.custom((content) => {
  return content.split('\n').filter(line => line.startsWith('- '));
});
```

### 8. Cost & Token Tracking

```typescript
import { LLM, CostCalculator } from 'omni-llm';

const chat = new LLM('openai/gpt-4o');
const response = await chat.chat('Write a haiku about programming');

// Token usage
console.log('Input tokens:', response.usage?.input_tokens);
console.log('Output tokens:', response.usage?.output_tokens);
console.log('Total tokens:', response.usage?.total_tokens);

// Cost calculation
console.log('Cost:', response.cost);
// { input: 0.00015, output: 0.0006, total: 0.00075 }

// Thinking tokens (for Claude/DeepSeek)
console.log('Thinking tokens:', response.usage?.thinking_tokens);
```

### 9. Abort Requests

```typescript
import { LLM } from 'omni-llm';

const chat = new LLM('openai/gpt-4o');

// Using AbortController
const controller = new AbortController();

// Abort after 5 seconds
setTimeout(() => controller.abort(), 5000);

try {
  const response = await chat.chat('Write a very long essay', {
    signal: controller.signal
  });
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Request was aborted');
  }
}

// Or use the built-in abort method
const promise = chat.chat('Write a novel');
setTimeout(() => chat.abort(), 3000);
```

### 10. Serialization & Restoration

```typescript
import { LLM, Serializer } from 'omni-llm';

const chat = new LLM('openai/gpt-4o');
chat.system('You are a helpful assistant');
await chat.chat('Remember: my favorite color is blue');

// Serialize the entire state
const serialized = chat.toJSON();
localStorage.setItem('chat-state', JSON.stringify(serialized));

// Later: restore the state
const saved = JSON.parse(localStorage.getItem('chat-state'));
const restored = LLM.fromJSON(saved);
const response = await restored.chat('What is my favorite color?');
// "Your favorite color is blue"
```

## Configuration Options

### Instance Options

```typescript
const chat = new LLM('openai/gpt-4o', {
  // API configuration
  apiKey: 'your-api-key',        // Override env variable
  baseUrl: 'https://custom.api', // Custom API endpoint
  
  // Model parameters
  temperature: 0.7,              // 0-2, default varies by provider
  max_tokens: 4096,              // Maximum response tokens
  
  // Tools
  tools: [...],                  // Array of tool definitions
  
  // Thinking mode
  think: true,                   // Enable extended thinking
  max_thinking_tokens: 10000,    // Max tokens for thinking
});
```

### Per-Request Options

```typescript
// Options can be overridden per request
const response = await chat.chat('Hello', {
  temperature: 0.9,
  max_tokens: 100,
  signal: abortController.signal,
  attachments: [...],
});
```

### Environment Variables

```bash
# Provider API keys (auto-detected)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
GROQ_API_KEY=gsk_...
XAI_API_KEY=...
DEEPSEEK_API_KEY=...

# Debug logging
DEBUG=omni-llm:*
```

## API Reference

### LLM Class

```typescript
class LLM {
  constructor(model: string, options?: Options);
  
  // Core methods
  chat(input: string | Message[], options?: Options): Promise<ExtendedResponse>;
  stream(input: string | Message[], options?: Options): AsyncIterable<Chunk>;
  complete(): Promise<ExtendedResponse>;
  system(prompt: string): this;
  abort(): void;
  
  // Message management
  getMessages(): Message[];
  clearMessages(): void;
  
  // Serialization
  toJSON(): SerializedLLM;
  static fromJSON(data: SerializedLLM): LLM;
  
  // Static utilities
  static parsers: Parsers;
  static fetchModels(service: string, apiKey?: string): Promise<Model[]>;
  static getQualityModels(service: string): Model[];
  static registerService(name: string, provider: BaseProvider): void;
  static verifyConnection(service: string, apiKey?: string): Promise<boolean>;
}
```

### Types

```typescript
interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ExtendedResponse {
  content: string;
  thinking?: string;
  toolCalls?: ToolCall[];
  usage?: Usage;
  cost?: Cost;
  model: string;
}

interface Usage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  thinking_tokens?: number;
}

interface Cost {
  input: number;
  output: number;
  total: number;
  thinking?: number;
}

interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
  function: (args: any) => any | Promise<any>;
}
```

### Error Classes

```typescript
import {
  UnifiedLLMError,      // Base error class
  AuthenticationError,  // Invalid API key
  RateLimitError,       // Rate limit exceeded
  ModelNotFoundError,   // Model doesn't exist
  ValidationError,      // Invalid parameters
  NetworkError,         // Connection issues
  ParsingError,         // Response parsing failed
  AbortError,           // Request aborted
  UnsupportedFeatureError // Feature not supported
} from 'omni-llm';

try {
  await chat.chat('Hello');
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log('Retry after:', error.retryAfter, 'seconds');
  } else if (error instanceof AuthenticationError) {
    console.log('Check your API key for:', error.service);
  }
}
```

## Advanced Usage

### Custom Provider Registration

```typescript
import { LLM, BaseProvider, registerProvider } from 'omni-llm';

class MyCustomProvider extends BaseProvider {
  readonly name = 'custom';
  readonly supportsThinking = false;
  readonly supportsTools = true;
  readonly supportsVision = false;
  readonly supportsDocuments = false;

  async sendRequest(messages, options) {
    // Your implementation
  }

  async *sendStreamingRequest(messages, options) {
    // Your streaming implementation
  }

  async fetchModels(apiKey) {
    return [{ id: 'custom-model', name: 'Custom Model', provider: 'custom' }];
  }

  async verifyConnection(apiKey) {
    return true;
  }
}

// Register the provider
registerProvider('custom', new MyCustomProvider());

// Use it
const chat = new LLM('custom/custom-model');
```

### Proxy/Custom Endpoints

```typescript
// Use with Azure OpenAI
const chat = new LLM('openai/gpt-4', {
  baseUrl: 'https://your-resource.openai.azure.com/openai/deployments/gpt-4',
  apiKey: 'your-azure-key'
});

// Use with OpenAI-compatible APIs
const chat2 = new LLM('openai/local-model', {
  baseUrl: 'http://localhost:8080/v1'
});
```

### Debug Logging

```typescript
import { createDebugLogger } from 'omni-llm';

// Enable debug logging
process.env.DEBUG = 'omni-llm:*';

// Or create a custom logger
const logger = createDebugLogger('my-app');
logger('Starting chat...');
```

## Migration from LLM.js

```typescript
// LLM.js
import LLM from 'llm.js';
const response = await LLM.chat('openai', 'gpt-4', 'Hello');

// omni-llm
import { llm } from 'omni-llm';
const response = await llm('openai/gpt-4', 'Hello');
```

```typescript
// LLM.js streaming
const stream = await LLM.stream('openai', 'gpt-4', 'Hello');
for await (const chunk of stream) {
  console.log(chunk);
}

// omni-llm streaming
const chat = new LLM('openai/gpt-4');
for await (const chunk of chat.stream('Hello')) {
  console.log(chunk.content);
}
```

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.

## License

MIT © Sachin Varma

---

Built with ❤️ for the AI developer community
