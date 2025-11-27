// Error class hierarchy for Unified LLM

/**
 * Base error class for all Unified LLM errors
 */
export class UnifiedLLMError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'UnifiedLLMError';
    // Maintains proper stack trace for where error was thrown (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when authentication fails (missing or invalid API key)
 */
export class AuthenticationError extends UnifiedLLMError {
  constructor(
    message: string,
    public readonly service: string
  ) {
    super(message, 'AUTH_ERROR');
    this.name = 'AuthenticationError';
  }
}

/**
 * Error thrown when rate limiting occurs
 */
export class RateLimitError extends UnifiedLLMError {
  constructor(
    message: string,
    public readonly retryAfter?: number,
    public readonly service?: string
  ) {
    super(message, 'RATE_LIMIT');
    this.name = 'RateLimitError';
  }
}

/**
 * Error thrown when a requested model is not found
 */
export class ModelNotFoundError extends UnifiedLLMError {
  constructor(
    message: string,
    public readonly model: string,
    public readonly alternatives?: string[]
  ) {
    super(message, 'MODEL_NOT_FOUND');
    this.name = 'ModelNotFoundError';
  }
}


/**
 * Error thrown when option validation fails
 */
export class ValidationError extends UnifiedLLMError {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value?: unknown
  ) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

/**
 * Error thrown when network connectivity fails
 */
export class NetworkError extends UnifiedLLMError {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message, 'NETWORK_ERROR');
    this.name = 'NetworkError';
  }
}

/**
 * Error thrown when response parsing fails
 */
export class ParsingError extends UnifiedLLMError {
  constructor(
    message: string,
    public readonly originalContent: string,
    public readonly parserType: string
  ) {
    super(message, 'PARSING_ERROR');
    this.name = 'ParsingError';
  }
}

/**
 * Error thrown when a request is aborted
 */
export class AbortError extends UnifiedLLMError {
  constructor(message: string = 'Request was aborted') {
    super(message, 'ABORT_ERROR');
    this.name = 'AbortError';
  }
}

/**
 * Error thrown when a feature is not supported by the provider
 */
export class UnsupportedFeatureError extends UnifiedLLMError {
  constructor(
    message: string,
    public readonly feature: string,
    public readonly service: string
  ) {
    super(message, 'UNSUPPORTED_FEATURE');
    this.name = 'UnsupportedFeatureError';
  }
}

/**
 * Error code type for type-safe error handling
 */
export type ErrorCode =
  | 'AUTH_ERROR'
  | 'RATE_LIMIT'
  | 'MODEL_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'PARSING_ERROR'
  | 'ABORT_ERROR'
  | 'UNSUPPORTED_FEATURE';

/**
 * Type guard to check if an error is a UnifiedLLMError
 */
export function isUnifiedLLMError(error: unknown): error is UnifiedLLMError {
  return error instanceof UnifiedLLMError;
}

/**
 * Type guard to check if an error has a specific error code
 */
export function hasErrorCode(
  error: unknown,
  code: ErrorCode
): error is UnifiedLLMError {
  return isUnifiedLLMError(error) && error.code === code;
}
