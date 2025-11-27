# Implementation Plan

- [x] 1. Set up project structure and core types




  - [x] 1.1 Initialize TypeScript project with Vitest and fast-check


    - Create package.json with dependencies (vitest, fast-check as dev dependencies)
    - Configure tsconfig.json with strict mode
    - Configure vitest.config.ts with fast-check global settings (100 iterations minimum)
    - Create directory structure: src/, tests/unit/, tests/properties/, tests/generators/
    - _Requirements: 18.3, 16.4_

  - [x] 1.2 Define core TypeScript types and interfaces



    - Create src/types.ts with Message, ContentPart, Tool, ToolCall, ExtendedResponse, Usage, Cost, Attachment, Options, ServiceName interfaces
    - Export all types from src/index.ts
    - _Requirements: 18.1, 18.2_

  - [x] 1.3 Implement error class hierarchy


    - Create src/errors.ts with UnifiedLLMError base class
    - Implement AuthenticationError, RateLimitError, ModelNotFoundError, ValidationError, NetworkError, ParsingError, AbortError, UnsupportedFeatureError
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_


  - [x] 1.4 Write property test for error type correctness

    - **Property 14: Error Type Correctness**
    - **Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.5**

- [x] 2. Implement Message Manager



  - [x] 2.1 Create MessageManager class

    - Create src/message-manager.ts
    - Implement constructor with optional initial messages
    - Implement addSystem, addUser, addAssistant, addToolResult methods
    - Implement getMessages, clear methods
    - Implement toJSON and static fromJSON for serialization
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 2.2 Write property test for message history invariant


    - **Property 2: Message History Invariant**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**



- [x] 3. Implement Parsers

  - [x] 3.1 Create built-in parsers

    - Create src/parsers.ts
    - Implement json parser with error handling
    - Implement xml parser (simple DOM-like structure)
    - Implement codeBlock parser for markdown extraction
    - Implement custom parser wrapper
    - _Requirements: 8.1, 8.2, 8.3, 8.4_


  - [x] 3.2 Write property test for JSON parser round-trip

    - **Property 7: JSON Parser Round-Trip**
    - **Validates: Requirements 8.1**


  - [x] 3.3 Write property test for code block extraction

    - **Property 8: Code Block Extraction**
    - **Validates: Requirements 8.3**



  - [x] 3.4 Write property test for parser error handling
    - **Property 20: Parser Error Handling**
    - **Validates: Requirements 8.6**

- [x] 4. Implement Provider Infrastructure



  - [x] 4.1 Create BaseProvider abstract class

    - Create src/providers/base-provider.ts
    - Define abstract methods: sendRequest, sendStreamingRequest, fetchModels, verifyConnection
    - Define abstract properties: name, supportsThinking, supportsTools, supportsVision, supportsDocuments
    - Implement template methods: formatMessages, formatTools, formatAttachments, parseResponse, parseChunk
    - _Requirements: 2.1-2.8, 15.2_


  - [x] 4.2 Create ProviderRegistry class

    - Create src/providers/registry.ts
    - Implement register, get, has, list methods
    - Pre-register built-in providers
    - _Requirements: 2.8, 15.1, 15.3_


  - [x] 4.3 Write property test for provider routing correctness

    - **Property 1: Provider Routing Correctness**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**




  - [x] 4.4 Write property test for custom service registration
    - **Property 16: Custom Service Registration**
    - **Validates: Requirements 2.8, 15.1, 15.3**

- [x] 5. Implement OpenAI Provider



  - [x] 5.1 Create OpenAI provider implementation


    - Create src/providers/openai.ts extending BaseProvider
    - Implement sendRequest with proper message formatting
    - Implement sendStreamingRequest with SSE parsing
    - Implement fetchModels and verifyConnection
    - Handle tool calls and thinking mode
    - _Requirements: 2.1, 4.1-4.6, 5.1-5.4, 6.1-6.6_

- [x] 6. Implement Anthropic Provider



  - [x] 6.1 Create Anthropic provider implementation

    - Create src/providers/anthropic.ts extending BaseProvider
    - Implement sendRequest with Anthropic message format
    - Implement sendStreamingRequest with SSE parsing
    - Implement fetchModels and verifyConnection
    - Handle tool calls and thinking mode (extended thinking)
    - _Requirements: 2.2, 4.1-4.6, 5.1-5.4, 6.1-6.6_



- [x] 7. Implement Google Provider

  - [x] 7.1 Create Google Gemini provider implementation

    - Create src/providers/google.ts extending BaseProvider
    - Implement sendRequest with Gemini API format
    - Implement sendStreamingRequest
    - Implement fetchModels and verifyConnection
    - Handle tool calls
    - _Requirements: 2.3, 4.1-4.6, 6.1-6.6_



- [x] 8. Implement Remaining Providers

  - [x] 8.1 Create Groq provider implementation

    - Create src/providers/groq.ts extending BaseProvider
    - Implement OpenAI-compatible API with Groq-specific handling
    - _Requirements: 2.4_


  - [x] 8.2 Create Ollama provider implementation

    - Create src/providers/ollama.ts extending BaseProvider
    - Implement local Ollama API communication
    - Handle no-auth requirement
    - _Requirements: 2.5, 10.2_

  - [x] 8.3 Create xAI provider implementation


    - Create src/providers/xai.ts extending BaseProvider
    - Implement xAI API communication
    - _Requirements: 2.6_


  - [x] 8.4 Create DeepSeek provider implementation

    - Create src/providers/deepseek.ts extending BaseProvider
    - Implement DeepSeek API with reasoning support
    - _Requirements: 2.7, 5.1-5.4_


  - [x] 8.5 Write property test for local model zero cost

    - **Property 11: Local Model Zero Cost**
    - **Validates: Requirements 10.2**


- [x] 9. Checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise.



- [x] 10. Implement Tool Executor


  - [x] 10.1 Create ToolExecutor class

    - Create src/tool-executor.ts
    - Implement constructor accepting Tool array
    - Implement execute method for single and multiple tool calls
    - Implement getToolDefinitions for provider formatting
    - Handle async tool functions
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6_


  - [x] 10.2 Write property test for tool execution correctness

    - **Property 4: Tool Execution Correctness**
    - **Validates: Requirements 6.2, 6.3, 6.6**


  - [x] 10.3 Write property test for multiple tool calls handling
    - **Property 5: Multiple Tool Calls Handling**
    - **Validates: Requirements 6.4**

- [x] 11. Implement Attachment Processor



  - [x] 11.1 Create AttachmentProcessor class

    - Create src/attachment-processor.ts
    - Implement static fromPath (Node.js file reading)
    - Implement static fromUrl
    - Implement static fromBase64
    - Implement static fromBuffer
    - Implement toContentPart with provider-specific formatting
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 11.2 Write property test for attachment processing correctness


    - **Property 6: Attachment Processing Correctness**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

  - [x] 11.3 Write property test for unsupported attachment error


    - **Property 19: Unsupported Attachment Error**
    - **Validates: Requirements 7.8**

- [x] 12. Implement Stream Handler



  - [x] 12.1 Create StreamHandler class

    - Create src/stream-handler.ts
    - Implement async generator process method
    - Track chunks for complete response assembly
    - Implement getComplete method returning ExtendedResponse
    - Handle thinking, content, and tool_call chunk types
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 12.2 Write property test for streaming completion consistency


    - **Property 3: Streaming Completion Consistency**
    - **Validates: Requirements 4.3, 4.4, 9.4**

- [x] 13. Implement Token and Cost Tracking



  - [x] 13.1 Create ModelRegistry class

    - Create src/model-registry.ts
    - Implement fetchModels for each service
    - Implement getQualityModels with filtering logic
    - Implement getModelInfo for pricing and features
    - Implement addCustomModel for user-defined models
    - Store pricing data from LiteLLM format
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_


  - [x] 13.2 Create CostCalculator class

    - Create src/cost-calculator.ts
    - Implement calculate method using usage and model pricing
    - Implement isLocal check for zero-cost services
    - Handle thinking token costs
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 13.3 Write property test for token usage completeness


    - **Property 9: Token Usage Completeness**
    - **Validates: Requirements 9.1, 9.2, 9.3**


  - [x] 13.4 Write property test for cost calculation correctness

    - **Property 10: Cost Calculation Correctness**
    - **Validates: Requirements 10.1, 10.4**

  - [x] 13.5 Write property test for quality model filtering


    - **Property 17: Quality Model Filtering**
    - **Validates: Requirements 11.2**

- [x] 14. Checkpoint - Ensure all tests pass


  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Implement Serializer




  - [x] 15.1 Create Serializer class

    - Create src/serializer.ts
    - Implement serializeLLM producing SerializedLLM object
    - Implement deserializeLLM restoring LLM instance
    - Implement serializeMessages and deserializeMessages
    - _Requirements: 19.1, 19.2, 19.3_

  - [x] 15.2 Write property test for serialization round-trip


    - **Property 15: Serialization Round-Trip**
    - **Validates: Requirements 19.1, 19.2, 19.3**

- [x] 16. Implement Main LLM Class



  - [x] 16.1 Create LLM class with core functionality

    - Create src/llm.ts
    - Implement constructor with input and options
    - Implement chat method handling string and Message[] inputs
    - Implement system method for adding system prompts
    - Implement abort method using AbortController
    - Implement complete method for streaming results
    - Wire up MessageManager, ProviderRegistry, StreamHandler
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 3.1-3.5, 4.1-4.6, 12.1-12.4_


  - [x] 16.2 Implement options handling and merging

    - Implement instance-level default options
    - Implement per-request option merging with precedence
    - Validate options and throw ValidationError for invalid values
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_



  - [x] 16.3 Write property test for options passthrough
    - **Property 12: Options Passthrough**
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5**


  - [x] 16.4 Write property test for abort signal handling

    - **Property 13: Abort Signal Handling**
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4**

- [x] 17. Implement Static Methods and Function Interface



  - [x] 17.1 Add static methods to LLM class

    - Implement static parsers property exposing built-in parsers
    - Implement static fetchModels method
    - Implement static getQualityModels method
    - Implement static registerService method
    - Implement static verifyConnection method
    - Implement static fromJSON for deserialization
    - _Requirements: 11.1, 11.2, 14.1, 14.2, 14.3, 14.4, 15.1, 15.3_


  - [x] 17.2 Create LLM function interface

    - Create callable function that instantiates LLM and calls chat
    - Support one-off requests without maintaining instance
    - _Requirements: 1.1_


  - [x] 17.3 Implement toJSON instance method

    - Serialize current instance state
    - _Requirements: 19.1_

- [x] 18. Implement Thinking Mode Support



  - [x] 18.1 Add thinking mode to LLM class

    - Handle think option in chat method
    - Pass max_thinking_tokens to providers
    - Include thinking content in ExtendedResponse
    - Validate model support for thinking
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_


  - [x] 18.2 Write property test for thinking mode error handling

    - **Property 18: Thinking Mode Error Handling**
    - **Validates: Requirements 5.5**

- [x] 19. Implement Debug Logging



  - [x] 19.1 Create debug logging system

    - Create src/debug.ts with namespaced logger
    - Support DEBUG environment variable
    - Log request/response details when enabled
    - Ensure no output when disabled
    - _Requirements: 20.1, 20.2, 20.3_

- [x] 20. Create Public API Exports



  - [x] 20.1 Set up main entry point


    - Update src/index.ts to export LLM class and function
    - Export all types, interfaces, and error classes
    - Export parsers, Attachment class
    - Configure package.json exports field
    - _Requirements: 18.1_

- [x] 21. Checkpoint - Ensure all tests pass


  - Ensure all tests pass, ask the user if questions arise.



- [x] 22. Create Test Generators

  - [x] 22.1 Implement fast-check arbitraries

    - Create tests/generators/message.generator.ts
    - Create tests/generators/options.generator.ts
    - Create tests/generators/tool.generator.ts
    - Create tests/generators/attachment.generator.ts
    - Create tests/generators/llm-instance.generator.ts
    - _Requirements: Testing infrastructure_



- [x] 23. Final Checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise.


- [x] 24. Package and Documentation

  - [x] 24.1 Build NPM package
    - Fixed TypeScript compilation errors
    - Built dist/ folder with all compiled files
    - Updated package.json with proper metadata and keywords
    - Created .npmignore for clean publishing

  - [x] 24.2 Create comprehensive documentation
    - Created README.md with full API documentation
    - Created docs/QUICK-START.md for beginners
    - Created docs/EXAMPLES.md with practical examples
    - Created docs/API.md with complete API reference
    - Created docs/COMPARISON.md comparing unified-llm vs LLM.js
    - Created CHANGELOG.md
    - Created LICENSE (MIT)

---

## Summary

All 23 original tasks + 1 additional packaging task completed successfully.

**Final Status:**
- ✅ 127 property-based tests passing
- ✅ TypeScript build successful
- ✅ Zero runtime dependencies
- ✅ Full documentation created
- ✅ Ready for npm publish

**Package Features:**
- 7 LLM providers (OpenAI, Anthropic, Google, Groq, Ollama, xAI, DeepSeek)
- Streaming with async iterators
- Tool calling (function calling)
- Vision/image support
- Thinking mode (Claude, DeepSeek)
- Cost & token tracking
- Message history management
- Response parsers (JSON, XML, code blocks)
- Full serialization/deserialization
- AbortController support
- Typed error classes
- Custom provider registration
- Debug logging

**To publish:**
```bash
npm publish
```
