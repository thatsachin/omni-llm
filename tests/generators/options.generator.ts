/**
 * Fast-check arbitraries for Options types
 * Reusable generators for property-based testing
 */
import * as fc from 'fast-check';
import type { Options, ServiceName } from '../../src/types';

// Service name generators
export const arbitraryBuiltInService: fc.Arbitrary<ServiceName> = fc.constantFrom(
  'openai',
  'anthropic',
  'google',
  'groq',
  'ollama',
  'xai',
  'deepseek'
);

export const arbitraryServiceName: fc.Arbitrary<ServiceName> = fc.oneof(
  arbitraryBuiltInService,
  fc.string({ minLength: 1, maxLength: 30 }).filter((s) => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s))
);

// Model name generator
export const arbitraryModelName = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_.:'.split('')),
  { minLength: 1, maxLength: 50 }
);

// Temperature generator (0-2 range)
export const arbitraryTemperature = fc.float({ min: 0, max: 2, noNaN: true });

// Max tokens generator
export const arbitraryMaxTokens = fc.integer({ min: 1, max: 100000 });

// API key generator (simulated)
export const arbitraryApiKey = fc.string({ minLength: 20, maxLength: 100 }).map(
  (s) => `sk-${s.replace(/[^a-zA-Z0-9]/g, 'x')}`
);

// Base URL generator
export const arbitraryBaseUrl = fc.webUrl();

// Partial options generator (for merging tests)
export const arbitraryPartialOptions: fc.Arbitrary<Partial<Options>> = fc
  .record({
    temperature: fc.option(arbitraryTemperature),
    max_tokens: fc.option(arbitraryMaxTokens),
    stream: fc.option(fc.boolean()),
    extended: fc.option(fc.boolean()),
    think: fc.option(fc.boolean()),
    max_thinking_tokens: fc.option(fc.integer({ min: 100, max: 10000 })),
  })
  .map((o) => {
    const opts: Partial<Options> = {};
    if (o.temperature !== null) opts.temperature = o.temperature;
    if (o.max_tokens !== null) opts.max_tokens = o.max_tokens;
    if (o.stream !== null) opts.stream = o.stream;
    if (o.extended !== null) opts.extended = o.extended;
    if (o.think !== null) opts.think = o.think;
    if (o.max_thinking_tokens !== null) opts.max_thinking_tokens = o.max_thinking_tokens;
    return opts;
  });


// Full options generator (without tools/parser/signal which are complex)
export const arbitraryOptions: fc.Arbitrary<Options> = fc
  .record({
    service: fc.option(arbitraryBuiltInService),
    model: fc.option(arbitraryModelName),
    temperature: fc.option(arbitraryTemperature),
    max_tokens: fc.option(arbitraryMaxTokens),
    stream: fc.option(fc.boolean()),
    extended: fc.option(fc.boolean()),
    think: fc.option(fc.boolean()),
    max_thinking_tokens: fc.option(fc.integer({ min: 100, max: 10000 })),
  })
  .map((o) => {
    const opts: Options = {};
    if (o.service !== null) opts.service = o.service;
    if (o.model !== null) opts.model = o.model;
    if (o.temperature !== null) opts.temperature = o.temperature;
    if (o.max_tokens !== null) opts.max_tokens = o.max_tokens;
    if (o.stream !== null) opts.stream = o.stream;
    if (o.extended !== null) opts.extended = o.extended;
    if (o.think !== null) opts.think = o.think;
    if (o.max_thinking_tokens !== null) opts.max_thinking_tokens = o.max_thinking_tokens;
    return opts;
  });

// Options with service (guaranteed to have service)
export const arbitraryOptionsWithService: fc.Arbitrary<Options> = fc
  .tuple(arbitraryBuiltInService, arbitraryPartialOptions)
  .map(([service, opts]) => ({ ...opts, service }));

// Options for specific service
export const arbitraryOptionsForService = (
  service: ServiceName
): fc.Arbitrary<Options> =>
  arbitraryPartialOptions.map((opts) => ({ ...opts, service }));

// Streaming options
export const arbitraryStreamingOptions: fc.Arbitrary<Options> = arbitraryOptions.map(
  (opts) => ({ ...opts, stream: true })
);

// Extended options
export const arbitraryExtendedOptions: fc.Arbitrary<Options> = arbitraryOptions.map(
  (opts) => ({ ...opts, extended: true })
);

// Thinking options (for models that support it)
export const arbitraryThinkingOptions: fc.Arbitrary<Options> = fc
  .tuple(
    arbitraryPartialOptions,
    fc.integer({ min: 100, max: 10000 })
  )
  .map(([opts, maxThinkingTokens]) => ({
    ...opts,
    think: true,
    max_thinking_tokens: maxThinkingTokens,
  }));
