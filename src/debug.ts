// Debug Logging System for Unified LLM
// Supports DEBUG environment variable for namespaced logging

/**
 * Check if debug mode is enabled for a namespace
 */
function isDebugEnabled(namespace: string): boolean {
  if (typeof process === 'undefined' || !process.env) {
    return false;
  }

  const debugEnv = process.env.DEBUG;
  if (!debugEnv) {
    return false;
  }

  // Support wildcard patterns like "unified-llm:*" or exact matches
  const patterns = debugEnv.split(',').map((p) => p.trim());

  for (const pattern of patterns) {
    if (pattern === '*') {
      return true;
    }
    if (pattern === namespace) {
      return true;
    }
    // Handle wildcard patterns like "unified-llm:*"
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      if (namespace.startsWith(prefix)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Format a log message with timestamp and namespace
 */
function formatMessage(namespace: string, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] ${namespace}: ${message}`;
}

/**
 * Create a namespaced debug logger
 */
export function createDebugLogger(namespace: string) {
  const fullNamespace = `unified-llm:${namespace}`;

  return {
    /**
     * Log a debug message (only if DEBUG is enabled)
     */
    log: (message: string, ...args: unknown[]): void => {
      if (isDebugEnabled(fullNamespace)) {
        console.log(formatMessage(fullNamespace, message), ...args);
      }
    },

    /**
     * Log an error message (only if DEBUG is enabled)
     */
    error: (message: string, ...args: unknown[]): void => {
      if (isDebugEnabled(fullNamespace)) {
        console.error(formatMessage(fullNamespace, message), ...args);
      }
    },

    /**
     * Log a warning message (only if DEBUG is enabled)
     */
    warn: (message: string, ...args: unknown[]): void => {
      if (isDebugEnabled(fullNamespace)) {
        console.warn(formatMessage(fullNamespace, message), ...args);
      }
    },

    /**
     * Check if debug is enabled for this namespace
     */
    enabled: (): boolean => {
      return isDebugEnabled(fullNamespace);
    },

    /**
     * Get the full namespace
     */
    namespace: fullNamespace,
  };
}

// Pre-configured loggers for common namespaces
export const debug = {
  request: createDebugLogger('request'),
  response: createDebugLogger('response'),
  stream: createDebugLogger('stream'),
  provider: createDebugLogger('provider'),
  tools: createDebugLogger('tools'),
  parser: createDebugLogger('parser'),
  cost: createDebugLogger('cost'),
};

export type DebugLogger = ReturnType<typeof createDebugLogger>;
