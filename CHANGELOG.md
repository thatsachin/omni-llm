# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2025-11-28

### Fixed

- Updated repository URLs to github.com/thatsachin/omni-llm
- Updated comparison table with accurate LLM.js feature parity

## [1.0.1] - 2025-11-28

### Fixed

- Updated package branding and documentation

## [1.0.0] - 2025-11-28

### Added

- Initial release of omni-llm
- Support for 7 LLM providers:
  - OpenAI (GPT-4, GPT-4o, GPT-3.5-turbo, o1, o1-mini)
  - Anthropic (Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku)
  - Google (Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini 2.0)
  - Groq (Llama 3, Mixtral)
  - Ollama (any local model)
  - xAI (Grok-1, Grok-2)
  - DeepSeek (DeepSeek-V3, DeepSeek-R1)
- Unified API for all providers with `provider/model` syntax
- Streaming support with native async iterators
- Tool calling (function calling) support for all providers
- Vision/image analysis support
- Thinking mode (extended reasoning) for Claude and DeepSeek
- Built-in cost and token tracking
- Message history management
- Response parsers (JSON, XML, code blocks, custom)
- Full serialization/deserialization support
- AbortController support for cancelling requests
- Typed error classes for better error handling
- Custom provider registration
- Debug logging with namespace support
- Zero runtime dependencies
- Full TypeScript support with comprehensive types
- 127 property-based tests with fast-check
