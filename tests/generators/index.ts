/**
 * Test Generators Index
 * Re-exports all fast-check arbitraries for property-based testing
 */

// Message generators
export {
  arbitraryTextContent,
  arbitraryShortText,
  arbitraryTextContentPart,
  arbitraryImageUrlContentPart,
  arbitraryImageContentPart,
  arbitraryDocumentContentPart,
  arbitraryContentPart,
  arbitrarySimpleContentPart,
  arbitraryToolCall,
  arbitraryMessageRole,
  arbitrarySystemMessage,
  arbitraryUserMessage,
  arbitraryAssistantMessage,
  arbitraryToolMessage,
  arbitraryMessage,
  arbitraryMessages,
  arbitraryConversation,
  arbitraryConversationWithSystem,
} from './message.generator';

// Options generators
export {
  arbitraryBuiltInService,
  arbitraryServiceName,
  arbitraryModelName,
  arbitraryTemperature,
  arbitraryMaxTokens,
  arbitraryApiKey,
  arbitraryBaseUrl,
  arbitraryPartialOptions,
  arbitraryOptions,
  arbitraryOptionsWithService,
  arbitraryOptionsForService,
  arbitraryStreamingOptions,
  arbitraryExtendedOptions,
  arbitraryThinkingOptions,
} from './options.generator';

// Tool generators
export {
  arbitraryToolName,
  arbitraryToolCallId,
  arbitraryJsonValue,
  arbitraryJsonObject,
  arbitraryJsonSchema,
  arbitraryToolCall as arbitraryToolCallFromTool,
  arbitraryToolCallForTool,
  arbitraryToolResult,
  arbitraryToolDefinition,
  createEchoTool,
  createAsyncTool,
  createErrorTool,
  arbitraryTool,
  arbitraryTools,
  arbitraryToolCallsForTools,
} from './tool.generator';

// Attachment generators
export {
  SUPPORTED_IMAGE_MIME_TYPES,
  SUPPORTED_DOCUMENT_MIME_TYPES,
  PROVIDERS_WITH_VISION,
  PROVIDERS_WITH_DOCUMENTS,
  PROVIDERS_WITHOUT_DOCUMENTS,
  arbitraryImageMimeType,
  arbitraryDocumentMimeType,
  arbitraryMimeType,
  arbitraryVisionProvider,
  arbitraryDocumentProvider,
  arbitraryNonDocumentProvider,
  arbitraryAttachmentType,
  arbitraryAttachmentSource,
  arbitraryBase64Data,
  arbitraryUrl,
  arbitraryFilePath,
  arbitraryImageAttachmentBase64,
  arbitraryImageAttachmentUrl,
  arbitraryImageAttachmentBuffer,
  arbitraryDocumentAttachmentBase64,
  arbitraryDocumentAttachmentBuffer,
  arbitraryImageAttachment,
  arbitraryDocumentAttachment,
  arbitraryAttachment,
  arbitraryAttachments,
  arbitraryImageAttachments,
  arbitraryDocumentAttachments,
} from './attachment.generator';

// LLM instance generators
export {
  arbitraryUsage,
  arbitraryCost,
  arbitraryExtendedResponse,
  arbitraryChunkType,
  arbitraryContentChunk,
  arbitraryThinkingChunk,
  arbitraryToolCallChunk,
  arbitraryUsageChunk,
  arbitraryChunk,
  arbitrarySerializedLLM,
  arbitraryProviderResponse,
  arbitraryProviderChunk,
  arbitraryChunkStream,
  arbitraryChunkStreamWithUsage,
} from './llm-instance.generator';
