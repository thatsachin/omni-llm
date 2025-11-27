// Attachment Processor for Unified LLM
import * as fs from 'fs';
import * as path from 'path';
import type {
  Attachment,
  AttachmentType,
  ContentPart,
  ServiceName,
} from './types';
import { UnsupportedFeatureError, ValidationError } from './errors';

/**
 * MIME type to attachment type mapping
 */
const MIME_TYPE_MAP: Record<string, AttachmentType> = {
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'application/pdf': 'document',
};

/**
 * Extension to MIME type mapping
 */
const EXTENSION_MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

/**
 * Provider capabilities for attachments
 */
const PROVIDER_CAPABILITIES: Record<string, { vision: boolean; documents: boolean }> = {
  openai: { vision: true, documents: false },
  anthropic: { vision: true, documents: true },
  google: { vision: true, documents: true },
  groq: { vision: true, documents: false },
  ollama: { vision: true, documents: false },
  xai: { vision: true, documents: false },
  deepseek: { vision: true, documents: false },
};


/**
 * Processes file attachments for multimodal LLM requests
 */
export class AttachmentProcessor {
  /**
   * Create an attachment from a file path (Node.js only)
   */
  static async fromPath(filePath: string): Promise<Attachment> {
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = EXTENSION_MIME_MAP[ext];

    if (!mimeType) {
      throw new ValidationError(
        `Unsupported file extension: ${ext}`,
        'path',
        filePath
      );
    }

    const buffer = await fs.promises.readFile(filePath);
    const base64Data = buffer.toString('base64');
    const attachmentType = MIME_TYPE_MAP[mimeType] as AttachmentType;

    return {
      type: attachmentType,
      source: 'path',
      data: base64Data,
      mimeType,
    };
  }

  /**
   * Create an attachment from a URL
   */
  static fromUrl(url: string, type: AttachmentType = 'image'): Attachment {
    return {
      type,
      source: 'url',
      data: url,
      mimeType: undefined,
    };
  }

  /**
   * Create an attachment from base64 data
   */
  static fromBase64(
    data: string,
    mimeType: string,
    type?: AttachmentType
  ): Attachment {
    const attachmentType = type ?? MIME_TYPE_MAP[mimeType];

    if (!attachmentType) {
      throw new ValidationError(
        `Unsupported MIME type: ${mimeType}`,
        'mimeType',
        mimeType
      );
    }

    return {
      type: attachmentType,
      source: 'base64',
      data,
      mimeType,
    };
  }

  /**
   * Create an attachment from a Buffer
   */
  static fromBuffer(
    buffer: Buffer,
    mimeType: string,
    type?: AttachmentType
  ): Attachment {
    const attachmentType = type ?? MIME_TYPE_MAP[mimeType];

    if (!attachmentType) {
      throw new ValidationError(
        `Unsupported MIME type: ${mimeType}`,
        'mimeType',
        mimeType
      );
    }

    return {
      type: attachmentType,
      source: 'buffer',
      data: buffer.toString('base64'),
      mimeType,
    };
  }

  /**
   * Convert an attachment to a ContentPart for a specific provider
   */
  static toContentPart(
    attachment: Attachment,
    provider: ServiceName
  ): ContentPart {
    const capabilities = PROVIDER_CAPABILITIES[provider] ?? {
      vision: false,
      documents: false,
    };

    // Check if provider supports the attachment type
    if (attachment.type === 'image' && !capabilities.vision) {
      throw new UnsupportedFeatureError(
        `Provider ${provider} does not support image attachments`,
        'vision',
        provider
      );
    }

    if (attachment.type === 'document' && !capabilities.documents) {
      throw new UnsupportedFeatureError(
        `Provider ${provider} does not support document attachments`,
        'documents',
        provider
      );
    }

    // Handle URL-based attachments
    if (attachment.source === 'url') {
      if (attachment.type === 'image') {
        return {
          type: 'image_url',
          image_url: {
            url: attachment.data as string,
            detail: 'auto',
          },
        };
      }
      // Documents from URL need to be fetched first
      throw new ValidationError(
        'Document attachments from URL must be fetched first',
        'source',
        'url'
      );
    }

    // Handle base64/buffer/path attachments (all stored as base64 internally)
    const base64Data =
      attachment.source === 'buffer' || attachment.source === 'path'
        ? (attachment.data as string) // Already converted to base64
        : (attachment.data as string);

    const mimeType = attachment.mimeType ?? 'application/octet-stream';

    if (attachment.type === 'image') {
      // Provider-specific image formatting
      if (provider === 'anthropic') {
        return {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mimeType,
            data: base64Data,
          },
        };
      }

      // OpenAI and others use data URL format
      return {
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${base64Data}`,
          detail: 'auto',
        },
      };
    }

    // Document attachment
    return {
      type: 'document',
      source: {
        type: 'base64',
        media_type: mimeType,
        data: base64Data,
      },
    };
  }

  /**
   * Get the MIME type for a file extension
   */
  static getMimeType(extension: string): string | undefined {
    const ext = extension.startsWith('.') ? extension : `.${extension}`;
    return EXTENSION_MIME_MAP[ext.toLowerCase()];
  }

  /**
   * Check if a MIME type is supported
   */
  static isSupportedMimeType(mimeType: string): boolean {
    return mimeType in MIME_TYPE_MAP;
  }

  /**
   * Check if a provider supports a specific attachment type
   */
  static isSupported(
    provider: ServiceName,
    attachmentType: AttachmentType
  ): boolean {
    const capabilities = PROVIDER_CAPABILITIES[provider];
    if (!capabilities) return false;

    if (attachmentType === 'image') return capabilities.vision;
    if (attachmentType === 'document') return capabilities.documents;
    return false;
  }
}
