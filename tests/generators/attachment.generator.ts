/**
 * Fast-check arbitraries for Attachment types
 * Reusable generators for property-based testing
 */
import * as fc from 'fast-check';
import type { Attachment, AttachmentType, AttachmentSource, ServiceName } from '../../src/types';

// Supported MIME types
export const SUPPORTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export const SUPPORTED_DOCUMENT_MIME_TYPES = ['application/pdf'] as const;

// Provider capabilities
export const PROVIDERS_WITH_VISION: ServiceName[] = [
  'openai',
  'anthropic',
  'google',
  'groq',
  'ollama',
  'xai',
  'deepseek',
];

export const PROVIDERS_WITH_DOCUMENTS: ServiceName[] = ['anthropic', 'google'];

export const PROVIDERS_WITHOUT_DOCUMENTS: ServiceName[] = [
  'openai',
  'groq',
  'ollama',
  'xai',
  'deepseek',
];

// MIME type generators
export const arbitraryImageMimeType = fc.constantFrom(...SUPPORTED_IMAGE_MIME_TYPES);
export const arbitraryDocumentMimeType = fc.constantFrom(...SUPPORTED_DOCUMENT_MIME_TYPES);
export const arbitraryMimeType = fc.oneof(arbitraryImageMimeType, arbitraryDocumentMimeType);

// Provider generators
export const arbitraryVisionProvider = fc.constantFrom(...PROVIDERS_WITH_VISION);
export const arbitraryDocumentProvider = fc.constantFrom(...PROVIDERS_WITH_DOCUMENTS);
export const arbitraryNonDocumentProvider = fc.constantFrom(...PROVIDERS_WITHOUT_DOCUMENTS);

// Attachment type generator
export const arbitraryAttachmentType: fc.Arbitrary<AttachmentType> = fc.constantFrom(
  'image',
  'document'
);

// Attachment source generator
export const arbitraryAttachmentSource: fc.Arbitrary<AttachmentSource> = fc.constantFrom(
  'path',
  'url',
  'base64',
  'buffer'
);

// Base64 data generator
export const arbitraryBase64Data = fc.base64String({ minLength: 10, maxLength: 100 });

// URL generator
export const arbitraryUrl = fc.webUrl();

// File path generator (simulated)
export const arbitraryFilePath = fc
  .tuple(
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
      minLength: 1,
      maxLength: 20,
    }),
    fc.constantFrom('jpg', 'png', 'gif', 'webp', 'pdf')
  )
  .map(([name, ext]) => `/path/to/${name}.${ext}`);


// Image attachment generator (base64 source)
export const arbitraryImageAttachmentBase64: fc.Arbitrary<Attachment> = fc
  .tuple(arbitraryBase64Data, arbitraryImageMimeType)
  .map(([data, mimeType]) => ({
    type: 'image' as const,
    source: 'base64' as const,
    data,
    mimeType,
  }));

// Image attachment generator (URL source)
export const arbitraryImageAttachmentUrl: fc.Arbitrary<Attachment> = fc
  .tuple(arbitraryUrl)
  .map(([url]) => ({
    type: 'image' as const,
    source: 'url' as const,
    data: url,
  }));

// Image attachment generator (buffer source)
export const arbitraryImageAttachmentBuffer: fc.Arbitrary<Attachment> = fc
  .tuple(fc.uint8Array({ minLength: 1, maxLength: 100 }), arbitraryImageMimeType)
  .map(([uint8Array, mimeType]) => ({
    type: 'image' as const,
    source: 'buffer' as const,
    data: Buffer.from(uint8Array),
    mimeType,
  }));

// Document attachment generator (base64 source)
export const arbitraryDocumentAttachmentBase64: fc.Arbitrary<Attachment> = fc
  .tuple(arbitraryBase64Data, arbitraryDocumentMimeType)
  .map(([data, mimeType]) => ({
    type: 'document' as const,
    source: 'base64' as const,
    data,
    mimeType,
  }));

// Document attachment generator (buffer source)
export const arbitraryDocumentAttachmentBuffer: fc.Arbitrary<Attachment> = fc
  .tuple(fc.uint8Array({ minLength: 1, maxLength: 100 }), arbitraryDocumentMimeType)
  .map(([uint8Array, mimeType]) => ({
    type: 'document' as const,
    source: 'buffer' as const,
    data: Buffer.from(uint8Array),
    mimeType,
  }));

// Any image attachment
export const arbitraryImageAttachment: fc.Arbitrary<Attachment> = fc.oneof(
  arbitraryImageAttachmentBase64,
  arbitraryImageAttachmentUrl,
  arbitraryImageAttachmentBuffer
);

// Any document attachment
export const arbitraryDocumentAttachment: fc.Arbitrary<Attachment> = fc.oneof(
  arbitraryDocumentAttachmentBase64,
  arbitraryDocumentAttachmentBuffer
);

// Any attachment
export const arbitraryAttachment: fc.Arbitrary<Attachment> = fc.oneof(
  arbitraryImageAttachment,
  arbitraryDocumentAttachment
);

// Multiple attachments
export const arbitraryAttachments = (
  minLength = 1,
  maxLength = 5
): fc.Arbitrary<Attachment[]> => fc.array(arbitraryAttachment, { minLength, maxLength });

// Image attachments only
export const arbitraryImageAttachments = (
  minLength = 1,
  maxLength = 5
): fc.Arbitrary<Attachment[]> => fc.array(arbitraryImageAttachment, { minLength, maxLength });

// Document attachments only
export const arbitraryDocumentAttachments = (
  minLength = 1,
  maxLength = 5
): fc.Arbitrary<Attachment[]> => fc.array(arbitraryDocumentAttachment, { minLength, maxLength });
