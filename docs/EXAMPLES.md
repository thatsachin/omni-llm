# unified-llm Examples

A collection of practical examples for common use cases.

## Table of Contents

1. [Chatbot with Memory](#chatbot-with-memory)
2. [AI Agent with Tools](#ai-agent-with-tools)
3. [Document Q&A](#document-qa)
4. [Code Assistant](#code-assistant)
5. [Multi-Provider Fallback](#multi-provider-fallback)
6. [Streaming Chat UI](#streaming-chat-ui)
7. [Batch Processing](#batch-processing)
8. [Rate Limit Handling](#rate-limit-handling)
9. [Session Persistence](#session-persistence)
10. [Thinking Mode for Complex Problems](#thinking-mode-for-complex-problems)

---

## Chatbot with Memory

```typescript
import { LLM } from 'unified-llm';

class Chatbot {
  private llm: LLM;
  
  constructor(model = 'openai/gpt-4o') {
    this.llm = new LLM(model);
    this.llm.system(`You are a helpful assistant. Be concise and friendly.
    Remember details the user shares about themselves.`);
  }
  
  async chat(message: string): Promise<string> {
    const response = await this.llm.chat(message);
    return response.content;
  }
  
  getHistory() {
    return this.llm.getMessages();
  }
  
  clearHistory() {
    this.llm.clearMessages();
  }
  
  save() {
    return this.llm.toJSON();
  }
  
  static load(data: any) {
    const bot = new Chatbot();
    bot.llm = LLM.fromJSON(data);
    return bot;
  }
}

// Usage
const bot = new Chatbot();
console.log(await bot.chat('Hi! My name is Alice.'));
console.log(await bot.chat('What is my name?')); // "Your name is Alice!"
```

---

## AI Agent with Tools

```typescript
import { LLM } from 'unified-llm';

const agent = new LLM('anthropic/claude-3-5-sonnet-20241022', {
  tools: [
    {
      name: 'search_web',
      description: 'Search the web for information',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' }
        },
        required: ['query']
      },
      function: async ({ query }) => {
        // Simulate web search
        return `Search results for "${query}": [Result 1, Result 2, Result 3]`;
      }
    },
    {
      name: 'get_weather',
      description: 'Get current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string' },
          unit: { type: 'string', enum: ['celsius', 'fahrenheit'] }
        },
        required: ['location']
      },
      function: async ({ location, unit = 'celsius' }) => {
        // Simulate weather API
        return { location, temperature: 22, unit, condition: 'sunny' };
      }
    },
    {
      name: 'send_email',
      description: 'Send an email',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string' },
          subject: { type: 'string' },
          body: { type: 'string' }
        },
        required: ['to', 'subject', 'body']
      },
      function: async ({ to, subject, body }) => {
        console.log(`Sending email to ${to}: ${subject}`);
        return { success: true, messageId: 'msg_123' };
      }
    }
  ]
});

agent.system(`You are a helpful AI assistant with access to tools.
Use tools when needed to help the user.`);

// The agent will automatically use tools as needed
const response = await agent.chat(
  'What is the weather in Tokyo? Also search for the best ramen restaurants there.'
);
console.log(response.content);
```

---

## Document Q&A

```typescript
import { LLM } from 'unified-llm';
import { readFileSync } from 'fs';

async function documentQA(documentPath: string, question: string) {
  const document = readFileSync(documentPath, 'utf-8');
  
  const chat = new LLM('anthropic/claude-3-5-sonnet-20241022');
  chat.system(`You are a document analysis assistant. 
  Answer questions based ONLY on the provided document.
  If the answer is not in the document, say so.`);
  
  const response = await chat.chat(`
Document:
---
${document}
---

Question: ${question}
  `);
  
  return response.content;
}

// Usage
const answer = await documentQA('./contract.txt', 'What is the termination clause?');
console.log(answer);
```

---

## Code Assistant

```typescript
import { LLM } from 'unified-llm';

class CodeAssistant {
  private llm: LLM;
  
  constructor() {
    this.llm = new LLM('anthropic/claude-3-5-sonnet-20241022');
    this.llm.system(`You are an expert programmer. 
    When writing code:
    - Use best practices
    - Add comments for complex logic
    - Handle errors appropriately
    - Return code in markdown code blocks`);
  }
  
  async generateCode(prompt: string, language: string): Promise<string> {
    const response = await this.llm.chat(
      `Write ${language} code for: ${prompt}`
    );
    return LLM.parsers.codeBlock(response.content, language);
  }
  
  async reviewCode(code: string, language: string): Promise<string> {
    const response = await this.llm.chat(`
Review this ${language} code and suggest improvements:

\`\`\`${language}
${code}
\`\`\`
    `);
    return response.content;
  }
  
  async explainCode(code: string): Promise<string> {
    const response = await this.llm.chat(`
Explain this code line by line:

\`\`\`
${code}
\`\`\`
    `);
    return response.content;
  }
  
  async fixBug(code: string, error: string): Promise<string> {
    const response = await this.llm.chat(`
Fix this bug:

Code:
\`\`\`
${code}
\`\`\`

Error: ${error}
    `);
    return response.content;
  }
}

// Usage
const assistant = new CodeAssistant();
const code = await assistant.generateCode(
  'a function to validate email addresses',
  'typescript'
);
console.log(code);
```

---

## Multi-Provider Fallback

```typescript
import { LLM, RateLimitError, NetworkError } from 'unified-llm';

const PROVIDERS = [
  'openai/gpt-4o',
  'anthropic/claude-3-5-sonnet-20241022',
  'google/gemini-1.5-pro',
  'groq/llama-3.1-70b-versatile'
];

async function chatWithFallback(message: string): Promise<string> {
  for (const model of PROVIDERS) {
    try {
      const chat = new LLM(model);
      const response = await chat.chat(message);
      console.log(`Success with ${model}`);
      return response.content;
    } catch (error) {
      if (error instanceof RateLimitError) {
        console.log(`Rate limited on ${model}, trying next...`);
        continue;
      }
      if (error instanceof NetworkError) {
        console.log(`Network error on ${model}, trying next...`);
        continue;
      }
      throw error; // Re-throw other errors
    }
  }
  throw new Error('All providers failed');
}

// Usage
const response = await chatWithFallback('Hello!');
```

---

## Streaming Chat UI

```typescript
import { LLM } from 'unified-llm';

async function streamingChat(
  message: string,
  onChunk: (text: string) => void,
  onThinking?: (text: string) => void,
  onComplete?: (response: any) => void
) {
  const chat = new LLM('anthropic/claude-3-5-sonnet-20241022');
  
  for await (const chunk of chat.stream(message)) {
    if (chunk.type === 'content' && chunk.content) {
      onChunk(chunk.content);
    } else if (chunk.type === 'thinking' && chunk.thinking && onThinking) {
      onThinking(chunk.thinking);
    }
  }
  
  const complete = await chat.complete();
  if (onComplete) {
    onComplete(complete);
  }
}

// Usage (e.g., in a React component)
await streamingChat(
  'Explain machine learning',
  (text) => setResponse(prev => prev + text),
  (thinking) => setThinking(prev => prev + thinking),
  (complete) => {
    setTokens(complete.usage?.total_tokens);
    setCost(complete.cost?.total);
  }
);
```

---

## Batch Processing

```typescript
import { LLM, RateLimitError } from 'unified-llm';

async function processBatch<T>(
  items: T[],
  processor: (item: T) => Promise<string>,
  options: {
    concurrency?: number;
    retries?: number;
    delayMs?: number;
  } = {}
): Promise<Map<T, string>> {
  const { concurrency = 3, retries = 3, delayMs = 1000 } = options;
  const results = new Map<T, string>();
  const queue = [...items];
  
  async function processItem(item: T, attempt = 1): Promise<void> {
    try {
      const result = await processor(item);
      results.set(item, result);
    } catch (error) {
      if (error instanceof RateLimitError && attempt < retries) {
        const waitTime = error.retryAfter ? error.retryAfter * 1000 : delayMs * attempt;
        await new Promise(r => setTimeout(r, waitTime));
        return processItem(item, attempt + 1);
      }
      throw error;
    }
  }
  
  // Process in batches
  while (queue.length > 0) {
    const batch = queue.splice(0, concurrency);
    await Promise.all(batch.map(item => processItem(item)));
  }
  
  return results;
}

// Usage
const questions = [
  'What is AI?',
  'What is ML?',
  'What is DL?',
  'What is NLP?'
];

const chat = new LLM('openai/gpt-4o');
const results = await processBatch(
  questions,
  async (q) => {
    const r = await chat.chat(q);
    return r.content;
  },
  { concurrency: 2 }
);

results.forEach((answer, question) => {
  console.log(`Q: ${question}\nA: ${answer}\n`);
});
```

---

## Rate Limit Handling

```typescript
import { LLM, RateLimitError } from 'unified-llm';

async function chatWithRetry(
  chat: LLM,
  message: string,
  maxRetries = 3
): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await chat.chat(message);
      return response.content;
    } catch (error) {
      if (error instanceof RateLimitError) {
        if (attempt === maxRetries) throw error;
        
        const waitTime = error.retryAfter || Math.pow(2, attempt);
        console.log(`Rate limited. Waiting ${waitTime}s before retry ${attempt + 1}...`);
        await new Promise(r => setTimeout(r, waitTime * 1000));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retries exceeded');
}

// Usage
const chat = new LLM('openai/gpt-4o');
const response = await chatWithRetry(chat, 'Hello!');
```

---

## Session Persistence

```typescript
import { LLM } from 'unified-llm';
import { readFileSync, writeFileSync, existsSync } from 'fs';

class PersistentChat {
  private llm: LLM;
  private sessionFile: string;
  
  constructor(sessionId: string, model = 'openai/gpt-4o') {
    this.sessionFile = `./sessions/${sessionId}.json`;
    
    if (existsSync(this.sessionFile)) {
      const data = JSON.parse(readFileSync(this.sessionFile, 'utf-8'));
      this.llm = LLM.fromJSON(data);
      console.log('Session restored');
    } else {
      this.llm = new LLM(model);
      this.llm.system('You are a helpful assistant.');
    }
  }
  
  async chat(message: string): Promise<string> {
    const response = await this.llm.chat(message);
    this.save();
    return response.content;
  }
  
  private save() {
    writeFileSync(this.sessionFile, JSON.stringify(this.llm.toJSON(), null, 2));
  }
  
  clear() {
    this.llm.clearMessages();
    this.save();
  }
}

// Usage
const chat = new PersistentChat('user-123');
console.log(await chat.chat('Remember: my favorite color is blue'));
// Later, in a new process:
const chat2 = new PersistentChat('user-123');
console.log(await chat2.chat('What is my favorite color?')); // "Blue!"
```

---

## Thinking Mode for Complex Problems

```typescript
import { LLM } from 'unified-llm';

async function solveComplexProblem(problem: string) {
  const chat = new LLM('anthropic/claude-3-5-sonnet-20241022');
  
  chat.system(`You are an expert problem solver. 
  Think through problems step by step.
  Show your reasoning process.`);
  
  const response = await chat.chat(problem, {
    think: true,
    max_thinking_tokens: 16000
  });
  
  return {
    thinking: response.thinking,
    answer: response.content,
    tokens: {
      thinking: response.usage?.thinking_tokens,
      total: response.usage?.total_tokens
    }
  };
}

// Usage
const result = await solveComplexProblem(`
A farmer has 17 sheep. All but 9 run away. How many sheep does the farmer have left?
Explain your reasoning.
`);

console.log('Thinking process:', result.thinking);
console.log('Answer:', result.answer);
console.log('Thinking tokens used:', result.tokens.thinking);
```

---

## More Examples

For more examples, check out:
- [API Reference](./API.md)
- [Provider-specific guides](./PROVIDERS.md)
- [TypeScript integration](./TYPESCRIPT.md)
