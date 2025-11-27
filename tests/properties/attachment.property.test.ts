/**
 * Property-based tests for AttachmentProcessor
 * **Feature: unified-llm, Property 6: Attachment Processing Correctness**
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { AttachmentProcessor } from '../../src/attachment-processor';
import type { AttachmentType, ServiceName } from '../../src/types';
import { UnsupportedFeatureError } from '../../src/errors';

// Configure fast-check for 100 iterations
fc.configureGlobal({ numRuns: 100 });

// Supported MIME types for testing
const SUPPORTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

const SUPPORTED_DOCUMENT_MIME_TYPES = ['application/pdf'] as const;

// Providers with their capabilities
const PROVIDERS_WITH_VISION: ServiceName[] = [
  'openai',
  'anthropic',
  'google',
  'groq',
  'ollama',
  'xai',
  'deepseek',
];

const PROVIDERS_WITH_DOCUMENTS: ServiceName[] = ['anthropic', 'google'];

// Arbitrary generators
const arbitraryBase64Data = fc.base64String({ minLength: 10, maxLength: 100 });
const arbitraryImageMimeType = fc.constantFrom(...SUPPORTED_IMAGE_MIME_TYPES);
const arbitraryDocumentMimeType = fc.constantFrom(...SUPPORTED_DOCUMENT_MIME_TYPES);
const arbitraryVisionProvider = fc.constantFrom(...PROVIDERS_WITH_VISION);
const arbitraryDocumentProvider = fc.constantFrom(...PROVIDERS_WITH_DOCUMENTS);
const arbitraryUrl = fc.webUrl();


describe('Property 6: Attachment Processing Correctness', () => {
  /**
   * **Feature: unified-llm, Property 6: Attachment Processing Correctness**
   * *For any* attachment source type (path, url, base64, buffer), the attachment
   * SHALL be processed into the correct format for the target provider without
   * data loss or corruption.
   */

  describe('fromBase64 - base64 source processing', () => {
    it('should preserve base64 data for image attachments', () => {
      fc.assert(
        fc.property(arbitraryBase64Data, arbitraryImageMimeType, (base64Data, mimeType) => {
          const attachment = AttachmentProcessor.fromBase64(base64Data, mimeType);

          expect(attachment.source).toBe('base64');
          expect(attachment.data).toBe(base64Data);
          expect(attachment.mimeType).toBe(mimeType);
          expect(attachment.type).toBe('image');
        })
      );
    });

    it('should preserve base64 data for document attachments', () => {
      fc.assert(
        fc.property(arbitraryBase64Data, arbitraryDocumentMimeType, (base64Data, mimeType) => {
          const attachment = AttachmentProcessor.fromBase64(base64Data, mimeType);

          expect(attachment.source).toBe('base64');
          expect(attachment.data).toBe(base64Data);
          expect(attachment.mimeType).toBe(mimeType);
          expect(attachment.type).toBe('document');
        })
      );
    });
  });

  describe('fromBuffer - buffer source processing', () => {
    it('should convert buffer to base64 without data loss for images', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 1, maxLength: 100 }),
          arbitraryImageMimeType,
          (uint8Array, mimeType) => {
            const buffer = Buffer.from(uint8Array);
            const attachment = AttachmentProcessor.fromBuffer(buffer, mimeType);

            expect(attachment.source).toBe('buffer');
            expect(attachment.mimeType).toBe(mimeType);
            expect(attachment.type).toBe('image');

            // Verify data integrity by decoding
            const decodedBuffer = Buffer.from(attachment.data as string, 'base64');
            expect(decodedBuffer).toEqual(buffer);
          }
        )
      );
    });

    it('should convert buffer to base64 without data loss for documents', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 1, maxLength: 100 }),
          arbitraryDocumentMimeType,
          (uint8Array, mimeType) => {
            const buffer = Buffer.from(uint8Array);
            const attachment = AttachmentProcessor.fromBuffer(buffer, mimeType);

            expect(attachment.source).toBe('buffer');
            expect(attachment.mimeType).toBe(mimeType);
            expect(attachment.type).toBe('document');

            // Verify data integrity by decoding
            const decodedBuffer = Buffer.from(attachment.data as string, 'base64');
            expect(decodedBuffer).toEqual(buffer);
          }
        )
      );
    });
  });

  describe('fromUrl - URL source processing', () => {
    it('should preserve URL for image attachments', () => {
      fc.assert(
        fc.property(arbitraryUrl, (url) => {
          const attachment = AttachmentProcessor.fromUrl(url, 'image');

          expect(attachment.source).toBe('url');
          expect(attachment.data).toBe(url);
          expect(attachment.type).toBe('image');
        })
      );
    });
  });

  describe('toContentPart - provider-specific formatting', () => {
    it('should format image attachments correctly for vision-capable providers', () => {
      fc.assert(
        fc.property(
          arbitraryBase64Data,
          arbitraryImageMimeType,
          arbitraryVisionProvider,
          (base64Data, mimeType, provider) => {
            const attachment = AttachmentProcessor.fromBase64(base64Data, mimeType);
            const contentPart = AttachmentProcessor.toContentPart(attachment, provider);

            // All providers should produce valid content parts
            if (provider === 'anthropic') {
              expect(contentPart.type).toBe('image');
              expect((contentPart as any).source.type).toBe('base64');
              expect((contentPart as any).source.data).toBe(base64Data);
              expect((contentPart as any).source.media_type).toBe(mimeType);
            } else {
              expect(contentPart.type).toBe('image_url');
              expect((contentPart as any).image_url.url).toContain(base64Data);
              expect((contentPart as any).image_url.url).toContain(mimeType);
            }
          }
        )
      );
    });

    it('should format document attachments correctly for document-capable providers', () => {
      fc.assert(
        fc.property(
          arbitraryBase64Data,
          arbitraryDocumentMimeType,
          arbitraryDocumentProvider,
          (base64Data, mimeType, provider) => {
            const attachment = AttachmentProcessor.fromBase64(base64Data, mimeType);
            const contentPart = AttachmentProcessor.toContentPart(attachment, provider);

            expect(contentPart.type).toBe('document');
            expect((contentPart as any).source.type).toBe('base64');
            expect((contentPart as any).source.data).toBe(base64Data);
            expect((contentPart as any).source.media_type).toBe(mimeType);
          }
        )
      );
    });

    it('should format URL image attachments correctly', () => {
      fc.assert(
        fc.property(arbitraryUrl, arbitraryVisionProvider, (url, provider) => {
          const attachment = AttachmentProcessor.fromUrl(url, 'image');
          const contentPart = AttachmentProcessor.toContentPart(attachment, provider);

          expect(contentPart.type).toBe('image_url');
          expect((contentPart as any).image_url.url).toBe(url);
        })
      );
    });
  });
});


/**
 * **Feature: unified-llm, Property 19: Unsupported Attachment Error**
 * **Validates: Requirements 7.8**
 */
describe('Property 19: Unsupported Attachment Error', () => {
  /**
   * *For any* attachment type not supported by the target provider,
   * the request SHALL throw a descriptive error indicating the unsupported attachment type.
   */

  // Providers that don't support documents
  const PROVIDERS_WITHOUT_DOCUMENTS: ServiceName[] = [
    'openai',
    'groq',
    'ollama',
    'xai',
    'deepseek',
  ];

  it('should throw UnsupportedFeatureError for document attachments on non-document providers', () => {
    fc.assert(
      fc.property(
        arbitraryBase64Data,
        arbitraryDocumentMimeType,
        fc.constantFrom(...PROVIDERS_WITHOUT_DOCUMENTS),
        (base64Data, mimeType, provider) => {
          const attachment = AttachmentProcessor.fromBase64(base64Data, mimeType);

          expect(() => {
            AttachmentProcessor.toContentPart(attachment, provider);
          }).toThrow(UnsupportedFeatureError);

          try {
            AttachmentProcessor.toContentPart(attachment, provider);
          } catch (error) {
            expect(error).toBeInstanceOf(UnsupportedFeatureError);
            expect((error as UnsupportedFeatureError).feature).toBe('documents');
            expect((error as UnsupportedFeatureError).service).toBe(provider);
            expect((error as UnsupportedFeatureError).message).toContain(provider);
            expect((error as UnsupportedFeatureError).message).toContain('document');
          }
        }
      )
    );
  });

  it('should throw UnsupportedFeatureError for image attachments on unknown providers', () => {
    fc.assert(
      fc.property(
        arbitraryBase64Data,
        arbitraryImageMimeType,
        fc.string({ minLength: 1 }).filter(
          (s) => !PROVIDERS_WITH_VISION.includes(s as ServiceName)
        ),
        (base64Data, mimeType, unknownProvider) => {
          const attachment = AttachmentProcessor.fromBase64(base64Data, mimeType);

          expect(() => {
            AttachmentProcessor.toContentPart(attachment, unknownProvider);
          }).toThrow(UnsupportedFeatureError);

          try {
            AttachmentProcessor.toContentPart(attachment, unknownProvider);
          } catch (error) {
            expect(error).toBeInstanceOf(UnsupportedFeatureError);
            expect((error as UnsupportedFeatureError).feature).toBe('vision');
            expect((error as UnsupportedFeatureError).service).toBe(unknownProvider);
          }
        }
      )
    );
  });

  it('isSupported should correctly report provider capabilities', () => {
    fc.assert(
      fc.property(arbitraryVisionProvider, (provider) => {
        // All vision providers should support images
        expect(AttachmentProcessor.isSupported(provider, 'image')).toBe(true);

        // Only some providers support documents
        const expectedDocSupport = PROVIDERS_WITH_DOCUMENTS.includes(provider);
        expect(AttachmentProcessor.isSupported(provider, 'document')).toBe(expectedDocSupport);
      })
    );
  });
});
