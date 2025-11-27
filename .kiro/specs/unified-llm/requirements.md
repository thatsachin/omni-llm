# Requirements Document

## Introduction

This document specifies the requirements for **Unified LLM**, a free and open-source TypeScript/JavaScript library that provides a unified interface for interacting with multiple Large Language Model (LLM) providers. The library aims to surpass LLM.js by offering better architecture, more comprehensive features, improved developer experience, and production-ready reliability. The library supports both Node.js and browser environments with zero external dependencies.

## Glossary

- **Unified LLM**: The library being specified, providing a single API for multiple LLM services
- **LLM Provider**: A service that hosts and serves Large Language Models (e.g., OpenAI, Anthropic, Google, Ollama)
- **Message**: A single unit of conversation containing role (system/user/assistant/tool) and content
- **Message History**: An ordered collection of messages representing a conversation
- **Streaming**: Real-time delivery of response tokens as they are generated
- **Thinking Mode**: A reasoning capability where models show their step-by-step thought process
- **Tool**: A function definition that an LLM can invoke to perform actions or retrieve information
- **Tool Call**: An LLM's request to execute a specific tool with provided arguments
- **Attachment**: A file (image, document) sent alongside a prompt for multimodal processing
- **Parser**: A function that transforms raw LLM response content into structured data
- **Token**: The basic unit of text processing in LLMs; used for billing and context limits
- **Token Usage**: Count of input and output tokens consumed by a request
- **Cost Usage**: Monetary cost calculated from token usage and model pricing
- **Extended Response**: A response object containing metadata (usage, cost, model info) alongside content
- **Context Window**: Maximum number of tokens a model can process in a single request
- **Temperature**: A parameter controlling randomness/creativity in model outputs (0-2)
- **Max Tokens**: Maximum number of tokens allowed in a response
- **Abort Signal**: A mechanism to cancel an in-progress request

## Requirements

### Requirement 1: Core LLM Invocation

**User Story:** As a developer, I want to send prompts to LLMs and receive responses, so that I can integrate AI capabilities into my applications.

#### Acceptance Criteria

1. WHEN a developer calls the library with a string prompt THEN the Unified LLM SHALL return a string response from the configured LLM provider
2. WHEN a developer specifies a service and model in options THEN the Unified LLM SHALL route the request to the correct provider and model
3. WHEN a developer does not specify a service THEN the Unified LLM SHALL default to a local Ollama instance
4. WHEN a developer provides an API key in options THEN the Unified LLM SHALL use that key for authentication
5. WHEN a developer does not provide an API key in Node.js THEN the Unified LLM SHALL attempt to read the key from environment variables
6. IF an API key is missing for a non-local service THEN the Unified LLM SHALL throw a descriptive authentication error

### Requirement 2: Multi-Provider Support

**User Story:** As a developer, I want to use the same API across different LLM providers, so that I can switch providers without rewriting my code.

#### Acceptance Criteria

1. WHEN a developer specifies "openai" as the service THEN the Unified LLM SHALL communicate with OpenAI's API using their native format
2. WHEN a developer specifies "anthropic" as the service THEN the Unified LLM SHALL communicate with Anthropic's API using their native format
3. WHEN a developer specifies "google" as the service THEN the Unified LLM SHALL communicate with Google's Gemini API using their native format
4. WHEN a developer specifies "groq" as the service THEN the Unified LLM SHALL communicate with Groq's API using their native format
5. WHEN a developer specifies "ollama" as the service THEN the Unified LLM SHALL communicate with a local Ollama instance
6. WHEN a developer specifies "xai" as the service THEN the Unified LLM SHALL communicate with xAI's API using their native format
7. WHEN a developer specifies "deepseek" as the service THEN the Unified LLM SHALL communicate with DeepSeek's API using their native format
8. WHEN a developer registers a custom service THEN the Unified LLM SHALL use that service for requests specifying its name

### Requirement 3: Chat and Message History

**User Story:** As a developer, I want to maintain conversation history with an LLM, so that I can build interactive chat applications.

#### Acceptance Criteria

1. WHEN a developer creates an LLM instance and calls chat multiple times THEN the Unified LLM SHALL maintain and send the full message history with each request
2. WHEN an LLM returns a response THEN the Unified LLM SHALL automatically append the assistant message to the history
3. WHEN a developer provides an initial messages array THEN the Unified LLM SHALL use those messages as the starting history
4. WHEN a developer calls the system method with a prompt THEN the Unified LLM SHALL add a system message to the history
5. WHEN a developer accesses the messages property THEN the Unified LLM SHALL return the current message history array

### Requirement 4: Streaming Responses

**User Story:** As a developer, I want to receive LLM responses as they are generated, so that I can provide real-time feedback to users.

#### Acceptance Criteria

1. WHEN a developer sets stream option to true THEN the Unified LLM SHALL return an async iterable that yields response chunks
2. WHEN streaming is enabled THEN the Unified LLM SHALL yield each token or chunk as soon as it is received from the provider
3. WHEN a stream completes THEN the Unified LLM SHALL have the complete response available via a complete method
4. WHEN streaming with extended option enabled THEN the complete method SHALL return full metadata including usage and cost
5. WHEN streaming with thinking mode enabled THEN the Unified LLM SHALL yield thinking content separately from response content
6. WHEN streaming with tools enabled THEN the Unified LLM SHALL yield tool calls as they are generated

### Requirement 5: Thinking/Reasoning Mode

**User Story:** As a developer, I want to enable reasoning mode for supported models, so that I can get step-by-step explanations of the model's thought process.

#### Acceptance Criteria

1. WHEN a developer sets think option to true THEN the Unified LLM SHALL request thinking/reasoning output from the model
2. WHEN thinking mode is enabled and the model supports it THEN the Unified LLM SHALL return both thinking content and final response
3. WHEN thinking mode is enabled with streaming THEN the Unified LLM SHALL stream thinking content in real-time
4. WHEN a developer sets max_thinking_tokens option THEN the Unified LLM SHALL limit thinking output to that token count
5. IF thinking mode is requested on an unsupported model THEN the Unified LLM SHALL throw a descriptive error indicating lack of support

### Requirement 6: Tool/Function Calling

**User Story:** As a developer, I want LLMs to call custom functions I define, so that I can extend AI capabilities with external data and actions.

#### Acceptance Criteria

1. WHEN a developer provides a tools array in options THEN the Unified LLM SHALL send tool definitions to the provider
2. WHEN an LLM decides to call a tool THEN the Unified LLM SHALL execute the tool's function with the provided arguments
3. WHEN a tool execution completes THEN the Unified LLM SHALL send the result back to the LLM for continued processing
4. WHEN multiple tool calls are requested THEN the Unified LLM SHALL execute them and return all results to the LLM
5. WHEN tools are used with streaming THEN the Unified LLM SHALL stream tool calls and results in real-time
6. WHEN a tool call is added to history THEN the Unified LLM SHALL maintain proper message structure for multi-turn tool conversations

### Requirement 7: Attachments (Multimodal)

**User Story:** As a developer, I want to send images and documents alongside prompts, so that I can build multimodal AI applications.

#### Acceptance Criteria

1. WHEN a developer provides an attachment with a file path THEN the Unified LLM SHALL read and encode the file appropriately
2. WHEN a developer provides an attachment with a URL THEN the Unified LLM SHALL include the URL reference for the provider
3. WHEN a developer provides an attachment with base64 data THEN the Unified LLM SHALL use the data directly
4. WHEN a developer provides an attachment with a Buffer THEN the Unified LLM SHALL encode it to base64
5. WHEN an image attachment is provided THEN the Unified LLM SHALL format it according to the provider's vision API requirements
6. WHEN a PDF attachment is provided to a supporting provider THEN the Unified LLM SHALL format it for document processing
7. WHEN attachments are used with streaming THEN the Unified LLM SHALL stream the response normally
8. IF an attachment type is unsupported by the provider THEN the Unified LLM SHALL throw a descriptive error

### Requirement 8: Response Parsers

**User Story:** As a developer, I want to automatically parse LLM responses into structured formats, so that I can easily extract data from AI outputs.

#### Acceptance Criteria

1. WHEN a developer specifies a JSON parser THEN the Unified LLM SHALL parse the response content as JSON and return the parsed object
2. WHEN a developer specifies an XML parser THEN the Unified LLM SHALL parse the response content as XML and return a structured object
3. WHEN a developer specifies a codeBlock parser THEN the Unified LLM SHALL extract code from markdown code blocks
4. WHEN a developer provides a custom parser function THEN the Unified LLM SHALL apply that function to the response content
5. WHEN parsing with streaming enabled THEN the Unified LLM SHALL apply the parser to the complete response after streaming finishes
6. IF parsing fails due to invalid format THEN the Unified LLM SHALL throw a descriptive parsing error with the original content

### Requirement 9: Token Usage Tracking

**User Story:** As a developer, I want to track token usage for each request, so that I can monitor and optimize my API consumption.

#### Acceptance Criteria

1. WHEN extended option is enabled THEN the Unified LLM SHALL return input token count in the response
2. WHEN extended option is enabled THEN the Unified LLM SHALL return output token count in the response
3. WHEN thinking mode is used with extended option THEN the Unified LLM SHALL return thinking tokens separately
4. WHEN streaming with extended option THEN the complete method SHALL return accurate token counts
5. WHEN the provider does not return token counts THEN the Unified LLM SHALL estimate tokens using a tokenizer

### Requirement 10: Cost Usage Tracking

**User Story:** As a developer, I want to track the cost of each LLM request, so that I can budget and optimize my AI spending.

#### Acceptance Criteria

1. WHEN extended option is enabled THEN the Unified LLM SHALL calculate and return the cost based on token usage and model pricing
2. WHEN a local model like Ollama is used THEN the Unified LLM SHALL return zero cost and mark the response as local
3. WHEN model pricing is not available THEN the Unified LLM SHALL return null for cost with a warning
4. WHEN thinking tokens are used THEN the Unified LLM SHALL include thinking token costs in the total

### Requirement 11: Model Management

**User Story:** As a developer, I want to discover and manage available models, so that I can choose the best model for my use case.

#### Acceptance Criteria

1. WHEN a developer calls fetchModels for a service THEN the Unified LLM SHALL return the current list of available models from that provider
2. WHEN a developer calls getQualityModels THEN the Unified LLM SHALL return a filtered list excluding non-LLM models (embeddings, TTS, image models)
3. WHEN a developer queries model features THEN the Unified LLM SHALL return capabilities like context window, tool support, and thinking support
4. WHEN a developer adds a custom model definition THEN the Unified LLM SHALL use that definition for pricing and feature information
5. WHEN model pricing data is available THEN the Unified LLM SHALL provide input and output cost per token

### Requirement 12: Request Abortion

**User Story:** As a developer, I want to cancel in-progress LLM requests, so that I can implement timeouts and user-initiated cancellations.

#### Acceptance Criteria

1. WHEN a developer calls abort on an LLM instance THEN the Unified LLM SHALL cancel the in-progress request
2. WHEN a developer provides an AbortSignal in options THEN the Unified LLM SHALL respect that signal for cancellation
3. WHEN a request is aborted during streaming THEN the Unified LLM SHALL stop yielding chunks and clean up resources
4. WHEN a request is aborted THEN the Unified LLM SHALL throw an AbortError with appropriate message

### Requirement 13: Configuration Options

**User Story:** As a developer, I want to configure LLM behavior through options, so that I can customize responses for different use cases.

#### Acceptance Criteria

1. WHEN a developer sets temperature option THEN the Unified LLM SHALL pass that value to control response randomness
2. WHEN a developer sets max_tokens option THEN the Unified LLM SHALL limit the response to that token count
3. WHEN a developer sets model option THEN the Unified LLM SHALL use that specific model
4. WHEN options are provided at instance creation THEN the Unified LLM SHALL use those as defaults for all requests
5. WHEN options are provided per-request THEN the Unified LLM SHALL merge them with instance defaults, with request options taking precedence

### Requirement 14: Connection Verification

**User Story:** As a developer, I want to verify my API connections are working, so that I can troubleshoot configuration issues.

#### Acceptance Criteria

1. WHEN a developer calls verifyConnection for a service THEN the Unified LLM SHALL test the connection without making a chat request
2. WHEN verification succeeds THEN the Unified LLM SHALL return a success status with service information
3. IF verification fails due to invalid credentials THEN the Unified LLM SHALL return a failure status with authentication error details
4. IF verification fails due to network issues THEN the Unified LLM SHALL return a failure status with connectivity error details

### Requirement 15: Custom Service Registration

**User Story:** As a developer, I want to add custom LLM services, so that I can use providers not built into the library.

#### Acceptance Criteria

1. WHEN a developer registers a custom service with configuration THEN the Unified LLM SHALL make that service available by name
2. WHEN a developer extends the base service class THEN the Unified LLM SHALL allow full customization of request handling
3. WHEN a custom service is registered globally THEN the Unified LLM SHALL use it for all instances specifying that service name
4. WHEN a custom service provides custom parsing logic THEN the Unified LLM SHALL use that logic for response processing

### Requirement 16: Environment Compatibility

**User Story:** As a developer, I want the library to work in both Node.js and browsers, so that I can use it across my full stack.

#### Acceptance Criteria

1. WHEN the library is used in Node.js THEN the Unified LLM SHALL use native Node.js APIs for HTTP and file operations
2. WHEN the library is used in a browser THEN the Unified LLM SHALL use browser-native fetch and File APIs
3. WHEN environment-specific features are unavailable THEN the Unified LLM SHALL provide appropriate fallbacks or clear errors
4. THE Unified LLM SHALL have zero external runtime dependencies

### Requirement 17: Error Handling

**User Story:** As a developer, I want clear and actionable error messages, so that I can quickly diagnose and fix issues.

#### Acceptance Criteria

1. WHEN an API request fails THEN the Unified LLM SHALL throw an error with the provider's error message and status code
2. WHEN rate limiting occurs THEN the Unified LLM SHALL throw a RateLimitError with retry-after information if available
3. WHEN a model is not found THEN the Unified LLM SHALL throw a ModelNotFoundError with available alternatives
4. WHEN validation fails for options THEN the Unified LLM SHALL throw a ValidationError with specific field information
5. WHEN network connectivity fails THEN the Unified LLM SHALL throw a NetworkError with connection details

### Requirement 18: TypeScript Support

**User Story:** As a developer, I want full TypeScript support, so that I can benefit from type safety and IDE autocompletion.

#### Acceptance Criteria

1. THE Unified LLM SHALL export TypeScript type definitions for all public APIs
2. THE Unified LLM SHALL provide generic types for custom parsers and tool definitions
3. THE Unified LLM SHALL use strict TypeScript compilation with no implicit any
4. WHEN a developer uses the library in TypeScript THEN the Unified LLM SHALL provide accurate type inference for responses

### Requirement 19: Serialization Round-Trip

**User Story:** As a developer, I want to serialize and deserialize LLM instances and messages, so that I can persist conversation state.

#### Acceptance Criteria

1. WHEN a developer serializes an LLM instance to JSON THEN the Unified LLM SHALL produce a valid JSON string containing all state
2. WHEN a developer deserializes a JSON string to an LLM instance THEN the Unified LLM SHALL restore the instance with all previous state
3. WHEN message history is serialized and deserialized THEN the Unified LLM SHALL preserve all message properties exactly

### Requirement 20: Debug and Logging

**User Story:** As a developer, I want to enable debug logging, so that I can troubleshoot issues and understand library behavior.

#### Acceptance Criteria

1. WHEN a developer enables debug mode THEN the Unified LLM SHALL log request and response details
2. WHEN debug logging is enabled THEN the Unified LLM SHALL use a namespaced logging system compatible with the DEBUG environment variable
3. WHEN debug logging is disabled THEN the Unified LLM SHALL produce no console output during normal operation
