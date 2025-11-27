// Property tests for Abort Signal Handling
// **Feature: unified-llm, Property 13: Abort Signal Handling**
// **Validates: Requirements 12.1, 12.2, 12.3, 12.4**

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { LLM } from '../../src/llm';
import { AbortError } from '../../src/errors';

describe('Property 13: Abort Signal Handling', () => {
  /**
   * Property: Calling abort() should set up the abort controller
   * For any LLM instance, calling abort() should not throw
   */
  it('should handle abort() call without error', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const llm = new LLM(undefined, { service: 'ollama' });

        // Calling abort before any request should not throw
        expect(() => llm.abort()).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple abort() calls should be safe
   * For any number of abort calls, they should all complete without error
   */
  it('should handle multiple abort() calls safely', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (numCalls) => {
        const llm = new LLM(undefined, { service: 'ollama' });

        // Multiple abort calls should not throw
        for (let i = 0; i < numCalls; i++) {
          expect(() => llm.abort()).not.toThrow();
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: AbortError should have correct properties
   * For any abort error message, the error should have correct code and name
   */
  it('should create AbortError with correct properties', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (message) => {
          const error = new AbortError(message);

          expect(error.name).toBe('AbortError');
          expect(error.code).toBe('ABORT_ERROR');
          expect(error.message).toBe(message);
          expect(error instanceof Error).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Default AbortError message should be set
   */
  it('should use default message for AbortError when none provided', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const error = new AbortError();

        expect(error.message).toBe('Request was aborted');
        expect(error.code).toBe('ABORT_ERROR');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Pre-aborted signal should be detectable
   * For any AbortController that is aborted before use, the signal should be aborted
   */
  it('should detect pre-aborted signals', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const controller = new AbortController();
        controller.abort();

        expect(controller.signal.aborted).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: AbortController signal should propagate abort reason
   */
  it('should propagate abort reason through signal', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (reason) => {
          const controller = new AbortController();
          controller.abort(reason);

          expect(controller.signal.aborted).toBe(true);
          expect(controller.signal.reason).toBe(reason);
        }
      ),
      { numRuns: 100 }
    );
  });
});
