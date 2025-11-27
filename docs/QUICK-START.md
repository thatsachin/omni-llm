# Quick Start Guide

Get up and running with unified-llm in under 5 minutes.

## Installation

```bash
npm install unified-llm
```

## Setup API Keys

Set your API keys as environment variables:

```bash
# .env file or shell
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export GOOGLE_API_KEY=...
export GROQ_API_KEY=gsk_...
```

Or pass them directly in code:

```typescript
const chat = new LLM('openai/gpt-4o', { apiKey: 'sk-...' });
```

## Basic Examples

### 1. Simple Question-Answer

```typescript
import { llm } from 'unified-llm';

const answer = await llm('openai/gpt-4o', 'What is the capital of Japan?');
console.log(answer); // "The capital of Japan is Tokyo."
```

### 2. Conversation with History

```typescript
import { LLM } from 'unified-llm';

const chat = new LLM('anthropic/claude-3-5-sonnet-20241022');

// Set a system prompt
chat.system('You are a friendly assistant who speaks like a pirate.');

// Have a conversation
const r1 = await chat.chat('Hello!');
console.log(r1.content); // "Ahoy there, matey! What can I do for ye today?"

const r2 = await chat.chat('What is 2 + 2?');
console.log(r2.content); // "Arrr, that be 4, ye landlubber!"

// History is automatically maintained
const r3 = await chat.chat('What did I just ask you?');
console.log(r3.content); // "Ye asked me what 2 + 2 be, matey!"
```

### 3. Streaming Response

```typescript
import { LLM } from 'unified-llm';

const chat = new LLM('openai/gpt-4o');

console.log('Response: ');
for await (const chunk of chat.stream('Tell me a short joke')) {
  process.stdout.write(chunk.content || '');
}
console.log('\n');
```

### 4. Using Tools

```typescript
import { LLM } from 'unified-llm';

const chat = new LLM('openai/gpt-4o', {
  tools: [{
    name: 'calculate',
    description: 'Perform a mathematical calculation',
    parameters: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'Math expression to evaluate' }
      },
      required: ['expression']
    },
    function: ({ expression }) => {
      return eval(expression); // In production, use a safe math parser
    }
  }]
});

const response = await chat.chat('What is 15 * 7 + 23?');
console.log(response.content); // "15 * 7 + 23 = 128"
```

### 5. Analyzing Images

```typescript
import { LLM, AttachmentProcessor } from 'unified-llm';

const chat = new LLM('openai/gpt-4o');

const response = await chat.chat('What do you see in this image?', {
  attachments: [
    await AttachmentProcessor.fromUrl('https://upload.wikimedia.org/wikipedia/commons/a/a7/Camponotus_flavomarginatus_ant.jpg')
  ]
});

console.log(response.content); // "I see a close-up photograph of an ant..."
```

### 6. Parsing JSON Responses

```typescript
import { LLM } from 'unified-llm';

const chat = new LLM('openai/gpt-4o');

const response = await chat.chat(
  'Return a JSON object with fields: name (string), age (number), hobbies (array of strings). Make up the data.'
);

const data = LLM.parsers.json(response.content);
console.log(data);
// { name: "Alex", age: 28, hobbies: ["reading", "hiking", "coding"] }
```

### 7. Using Different Providers

```typescript
import { llm } from 'unified-llm';

// Same question, different providers
const question = 'Explain quantum computing in one sentence.';

// OpenAI
console.log('OpenAI:', await llm('openai/gpt-4o', question));

// Anthropic
console.log('Claude:', await llm('anthropic/claude-3-5-sonnet-20241022', question));

// Google
console.log('Gemini:', await llm('google/gemini-1.5-pro', question));

// Groq (fast!)
console.log('Groq:', await llm('groq/llama-3.1-70b-versatile', question));

// Local Ollama
console.log('Ollama:', await llm('ollama/llama3.2', question));
```

### 8. Tracking Costs

```typescript
import { LLM } from 'unified-llm';

const chat = new LLM('openai/gpt-4o');
const response = await chat.chat('Write a haiku about programming');

console.log('Tokens used:', response.usage?.total_tokens);
console.log('Cost: $', response.cost?.total.toFixed(6));
```

## Next Steps

- Read the [full documentation](../README.md)
- Check out [advanced examples](./EXAMPLES.md)
- See the [API reference](./API.md)
- Compare with [LLM.js](./COMPARISON.md)
