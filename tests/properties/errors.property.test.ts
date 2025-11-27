/**
 * Property tests for error type correctness
 * **Feature: unified-llm, Property 14: Error Type Correctness**
 * **Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  UnifiedLLMError,
  AuthenticationError,
  RateLimitError,
  ModelNotFoundError,
  ValidationError,
  NetworkError,
  ParsingError,
  AbortError,
  UnsupportedFeatureError,
  isUnifiedLLMError,
  hasErrorCode,
} from '../../src/errors';

// Configure fast-check for 100 iterations
fc.configureGlobal({ numRuns: 100 });

describe('Property 14: Error Type Correctness', () => {
  /**
   * For any error condition, the appropriate error subclass SHALL be thrown
   * with relevant details (status code, message, retry-after, alternatives).
   */

  describe('AuthenticationError', () => {
    it('should have correct code and preserve service information', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          (message, service) => {
            const error = new AuthenticationError(message, service);

            expect(error).toBeInstanceOf(UnifiedLLMError);
            expect(error).toBeInstanceOf(AuthenticationError);
            expect(error.code).toBe('AUTH_ERROR');
            expect(error.name).toBe('AuthenticationError');
            expect(error.message).toBe(message);
            expect(error.service).toBe(service);
            expect(isUnifiedLLMError(error)).toBe(true);
            expect(hasErrorCode(error, 'AUTH_ERROR')).toBe(true);
          }
        )
      );
    });
  });

  describe('RateLimitError', () => {
    it('should have correct code and preserve retry-after information', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.option(fc.nat()),
          fc.option(fc.string({ minLength: 1 })),
          (message, retryAfter, service) => {
            const error = new RateLimitError(
              message,
              retryAfter ?? undefined,
              service ?? undefined
            );

            expect(error).toBeInstanceOf(UnifiedLLMError);
            expect(error).toBeInstanceOf(RateLimitError);
            expect(error.code).toBe('RATE_LIMIT');
            expect(error.name).toBe('RateLimitError');
            expect(error.message).toBe(message);
            expect(error.retryAfter).toBe(retryAfter ?? undefined);
            expect(error.service).toBe(service ?? undefined);
            expect(hasErrorCode(error, 'RATE_LIMIT')).toBe(true);
          }
        )
      );
    });
  });


  describe('ModelNotFoundError', () => {
    it('should have correct code and preserve model and alternatives', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.option(fc.array(fc.string({ minLength: 1 }), { minLength: 0, maxLength: 5 })),
          (message, model, alternatives) => {
            const error = new ModelNotFoundError(
              message,
              model,
              alternatives ?? undefined
            );

            expect(error).toBeInstanceOf(UnifiedLLMError);
            expect(error).toBeInstanceOf(ModelNotFoundError);
            expect(error.code).toBe('MODEL_NOT_FOUND');
            expect(error.name).toBe('ModelNotFoundError');
            expect(error.message).toBe(message);
            expect(error.model).toBe(model);
            expect(error.alternatives).toEqual(alternatives ?? undefined);
            expect(hasErrorCode(error, 'MODEL_NOT_FOUND')).toBe(true);
          }
        )
      );
    });
  });

  describe('ValidationError', () => {
    it('should have correct code and preserve field and value information', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.option(fc.anything()),
          (message, field, value) => {
            const error = new ValidationError(message, field, value ?? undefined);

            expect(error).toBeInstanceOf(UnifiedLLMError);
            expect(error).toBeInstanceOf(ValidationError);
            expect(error.code).toBe('VALIDATION_ERROR');
            expect(error.name).toBe('ValidationError');
            expect(error.message).toBe(message);
            expect(error.field).toBe(field);
            expect(error.value).toEqual(value ?? undefined);
            expect(hasErrorCode(error, 'VALIDATION_ERROR')).toBe(true);
          }
        )
      );
    });
  });

  describe('NetworkError', () => {
    it('should have correct code and preserve cause', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.option(fc.string({ minLength: 1 })),
          (message, causeMessage) => {
            const cause = causeMessage ? new Error(causeMessage) : undefined;
            const error = new NetworkError(message, cause);

            expect(error).toBeInstanceOf(UnifiedLLMError);
            expect(error).toBeInstanceOf(NetworkError);
            expect(error.code).toBe('NETWORK_ERROR');
            expect(error.name).toBe('NetworkError');
            expect(error.message).toBe(message);
            expect(error.cause).toBe(cause);
            expect(hasErrorCode(error, 'NETWORK_ERROR')).toBe(true);
          }
        )
      );
    });
  });

  describe('ParsingError', () => {
    it('should have correct code and preserve original content and parser type', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.string(),
          fc.constantFrom('json', 'xml', 'codeBlock', 'custom'),
          (message, originalContent, parserType) => {
            const error = new ParsingError(message, originalContent, parserType);

            expect(error).toBeInstanceOf(UnifiedLLMError);
            expect(error).toBeInstanceOf(ParsingError);
            expect(error.code).toBe('PARSING_ERROR');
            expect(error.name).toBe('ParsingError');
            expect(error.message).toBe(message);
            expect(error.originalContent).toBe(originalContent);
            expect(error.parserType).toBe(parserType);
            expect(hasErrorCode(error, 'PARSING_ERROR')).toBe(true);
          }
        )
      );
    });
  });


  describe('AbortError', () => {
    it('should have correct code with default or custom message', () => {
      fc.assert(
        fc.property(fc.option(fc.string({ minLength: 1 })), (message) => {
          const error = message ? new AbortError(message) : new AbortError();

          expect(error).toBeInstanceOf(UnifiedLLMError);
          expect(error).toBeInstanceOf(AbortError);
          expect(error.code).toBe('ABORT_ERROR');
          expect(error.name).toBe('AbortError');
          if (message) {
            expect(error.message).toBe(message);
          } else {
            expect(error.message).toBe('Request was aborted');
          }
          expect(hasErrorCode(error, 'ABORT_ERROR')).toBe(true);
        })
      );
    });
  });

  describe('UnsupportedFeatureError', () => {
    it('should have correct code and preserve feature and service', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          (message, feature, service) => {
            const error = new UnsupportedFeatureError(message, feature, service);

            expect(error).toBeInstanceOf(UnifiedLLMError);
            expect(error).toBeInstanceOf(UnsupportedFeatureError);
            expect(error.code).toBe('UNSUPPORTED_FEATURE');
            expect(error.name).toBe('UnsupportedFeatureError');
            expect(error.message).toBe(message);
            expect(error.feature).toBe(feature);
            expect(error.service).toBe(service);
            expect(hasErrorCode(error, 'UNSUPPORTED_FEATURE')).toBe(true);
          }
        )
      );
    });
  });

  describe('Type guards', () => {
    it('isUnifiedLLMError should correctly identify UnifiedLLMError instances', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (message) => {
          const unifiedError = new UnifiedLLMError(message, 'TEST');
          const regularError = new Error(message);
          const notAnError = { message, code: 'TEST' };

          expect(isUnifiedLLMError(unifiedError)).toBe(true);
          expect(isUnifiedLLMError(regularError)).toBe(false);
          expect(isUnifiedLLMError(notAnError)).toBe(false);
          expect(isUnifiedLLMError(null)).toBe(false);
          expect(isUnifiedLLMError(undefined)).toBe(false);
        })
      );
    });

    it('hasErrorCode should correctly match error codes', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.constantFrom(
            'AUTH_ERROR',
            'RATE_LIMIT',
            'MODEL_NOT_FOUND',
            'VALIDATION_ERROR',
            'NETWORK_ERROR',
            'PARSING_ERROR',
            'ABORT_ERROR',
            'UNSUPPORTED_FEATURE'
          ) as fc.Arbitrary<
            | 'AUTH_ERROR'
            | 'RATE_LIMIT'
            | 'MODEL_NOT_FOUND'
            | 'VALIDATION_ERROR'
            | 'NETWORK_ERROR'
            | 'PARSING_ERROR'
            | 'ABORT_ERROR'
            | 'UNSUPPORTED_FEATURE'
          >,
          (message, code) => {
            const error = new UnifiedLLMError(message, code);

            expect(hasErrorCode(error, code)).toBe(true);
            // Check that it doesn't match other codes
            const otherCodes = [
              'AUTH_ERROR',
              'RATE_LIMIT',
              'MODEL_NOT_FOUND',
              'VALIDATION_ERROR',
              'NETWORK_ERROR',
              'PARSING_ERROR',
              'ABORT_ERROR',
              'UNSUPPORTED_FEATURE',
            ].filter((c) => c !== code) as Array<
              | 'AUTH_ERROR'
              | 'RATE_LIMIT'
              | 'MODEL_NOT_FOUND'
              | 'VALIDATION_ERROR'
              | 'NETWORK_ERROR'
              | 'PARSING_ERROR'
              | 'ABORT_ERROR'
              | 'UNSUPPORTED_FEATURE'
            >;
            for (const otherCode of otherCodes) {
              expect(hasErrorCode(error, otherCode)).toBe(false);
            }
          }
        )
      );
    });
  });
});
