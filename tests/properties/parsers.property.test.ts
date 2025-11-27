/**
 * Property tests for parsers
 * **Feature: unified-llm, Property 7: JSON Parser Round-Trip**
 * **Feature: unified-llm, Property 8: Code Block Extraction**
 * **Feature: unified-llm, Property 20: Parser Error Handling**
 * **Validates: Requirements 8.1, 8.3, 8.6**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parsers } from '../../src/parsers';
import { ParsingError } from '../../src/errors';

// Configure fast-check for 100 iterations
fc.configureGlobal({ numRuns: 100 });

// Generator for JSON-serializable values
// Note: We avoid -0 because JSON.stringify(-0) === "0" but Object.is(-0, 0) === false
const arbitraryJsonValue: fc.Arbitrary<unknown> = fc.letrec((tie) => ({
  value: fc.oneof(
    { depthFactor: 0.5 },
    fc.string(),
    fc.integer(),
    fc.double({ noNaN: true, noDefaultInfinity: true }).map(n => Object.is(n, -0) ? 0 : n),
    fc.boolean(),
    fc.constant(null),
    fc.array(tie('value'), { maxLength: 5 }),
    fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), tie('value'), { maxKeys: 5 })
  ),
})).value;

// Generator for valid code content (no backticks inside to avoid regex issues)
const arbitraryCodeContent = fc.string().filter(s => !s.includes('`'));

// Generator for programming language names
const arbitraryLanguage = fc.constantFrom(
  'javascript',
  'typescript',
  'python',
  'java',
  'rust',
  'go',
  'cpp',
  'c',
  'ruby',
  'php'
);

describe('Property 7: JSON Parser Round-Trip', () => {
  /**
   * For any valid JSON object, when the LLM returns that JSON as a string
   * and the JSON parser is applied, the parsed result SHALL be deeply equal
   * to the original object.
   */

  it('should parse JSON and return deeply equal object', () => {
    fc.assert(
      fc.property(arbitraryJsonValue, (originalValue) => {
        const jsonString = JSON.stringify(originalValue);
        const parsed = parsers.json(jsonString);
        
        expect(parsed).toEqual(originalValue);
      })
    );
  });

  it('should handle JSON wrapped in markdown code blocks', () => {
    fc.assert(
      fc.property(arbitraryJsonValue, (originalValue) => {
        const jsonString = JSON.stringify(originalValue);
        const wrappedContent = `\`\`\`json\n${jsonString}\n\`\`\``;
        const parsed = parsers.json(wrappedContent);
        
        expect(parsed).toEqual(originalValue);
      })
    );
  });

  it('should handle JSON with surrounding whitespace', () => {
    fc.assert(
      fc.property(
        arbitraryJsonValue,
        fc.string().filter(s => /^\s*$/.test(s)),
        fc.string().filter(s => /^\s*$/.test(s)),
        (originalValue, leadingWhitespace, trailingWhitespace) => {
          const jsonString = JSON.stringify(originalValue);
          const paddedContent = `${leadingWhitespace}${jsonString}${trailingWhitespace}`;
          const parsed = parsers.json(paddedContent);
          
          expect(parsed).toEqual(originalValue);
        }
      )
    );
  });

  it('should preserve object key order', () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.string(), { minKeys: 1, maxKeys: 10 }),
        (obj) => {
          const jsonString = JSON.stringify(obj);
          const parsed = parsers.json<Record<string, string>>(jsonString);
          
          expect(Object.keys(parsed)).toEqual(Object.keys(obj));
        }
      )
    );
  });

  it('should handle nested structures', () => {
    fc.assert(
      fc.property(
        fc.record({
          level1: fc.record({
            level2: fc.record({
              value: fc.string(),
            }),
          }),
        }),
        (nested) => {
          const jsonString = JSON.stringify(nested);
          const parsed = parsers.json(jsonString);
          
          expect(parsed).toEqual(nested);
        }
      )
    );
  });
});

describe('Property 8: Code Block Extraction', () => {
  /**
   * For any markdown string containing code blocks, the codeBlock parser
   * SHALL extract the code content without the fence markers, preserving
   * all whitespace and content within the block.
   */

  it('should extract code content preserving content exactly', () => {
    fc.assert(
      fc.property(arbitraryCodeContent, (codeContent) => {
        // Code blocks have a newline after the opening fence
        const markdown = `\`\`\`\n${codeContent}\`\`\``;
        const extracted = parsers.codeBlock(markdown);
        
        expect(extracted).toBe(codeContent);
      })
    );
  });

  it('should extract code with language specifier', () => {
    fc.assert(
      fc.property(arbitraryCodeContent, arbitraryLanguage, (codeContent, language) => {
        const markdown = `\`\`\`${language}\n${codeContent}\`\`\``;
        const extracted = parsers.codeBlock(markdown);
        
        expect(extracted).toBe(codeContent);
      })
    );
  });

  it('should extract code for specific language when requested', () => {
    fc.assert(
      fc.property(arbitraryCodeContent, arbitraryLanguage, (codeContent, language) => {
        const markdown = `\`\`\`${language}\n${codeContent}\`\`\``;
        const extracted = parsers.codeBlock(markdown, language);
        
        expect(extracted).toBe(codeContent);
      })
    );
  });

  it('should preserve internal newlines in code', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string().filter(s => !s.includes('`')), { minLength: 2, maxLength: 10 }),
        (lines) => {
          const codeContent = lines.join('\n');
          const markdown = `\`\`\`\n${codeContent}\`\`\``;
          const extracted = parsers.codeBlock(markdown);
          
          expect(extracted).toBe(codeContent);
        }
      )
    );
  });

  it('should handle code blocks with surrounding text', () => {
    fc.assert(
      fc.property(
        arbitraryCodeContent,
        fc.string().filter(s => !s.includes('```')),
        fc.string().filter(s => !s.includes('```')),
        (codeContent, before, after) => {
          const markdown = `${before}\n\`\`\`\n${codeContent}\`\`\`\n${after}`;
          const extracted = parsers.codeBlock(markdown);
          
          expect(extracted).toBe(codeContent);
        }
      )
    );
  });
});

describe('Property 20: Parser Error Handling', () => {
  /**
   * For any invalid content that cannot be parsed by the specified parser,
   * a parsing error SHALL be thrown containing the original content for debugging.
   */

  describe('JSON parser errors', () => {
    it('should throw ParsingError with original content for invalid JSON', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => {
            try {
              JSON.parse(s);
              return false;
            } catch {
              return true;
            }
          }),
          (invalidJson) => {
            try {
              parsers.json(invalidJson);
              // Should not reach here
              expect.fail('Expected ParsingError to be thrown');
            } catch (error) {
              expect(error).toBeInstanceOf(ParsingError);
              if (error instanceof ParsingError) {
                expect(error.originalContent).toBe(invalidJson);
                expect(error.parserType).toBe('json');
                expect(error.code).toBe('PARSING_ERROR');
              }
            }
          }
        )
      );
    });
  });

  describe('Code block parser errors', () => {
    it('should throw ParsingError when no code block is found', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => !s.includes('```')),
          (contentWithoutCodeBlock) => {
            try {
              parsers.codeBlock(contentWithoutCodeBlock);
              expect.fail('Expected ParsingError to be thrown');
            } catch (error) {
              expect(error).toBeInstanceOf(ParsingError);
              if (error instanceof ParsingError) {
                expect(error.originalContent).toBe(contentWithoutCodeBlock);
                expect(error.parserType).toBe('codeBlock');
                expect(error.code).toBe('PARSING_ERROR');
              }
            }
          }
        )
      );
    });

    it('should throw ParsingError when specific language block not found', () => {
      fc.assert(
        fc.property(
          arbitraryCodeContent,
          arbitraryLanguage,
          arbitraryLanguage,
          (codeContent, actualLang, requestedLang) => {
            // Only test when languages are different and one is not a prefix of the other
            fc.pre(actualLang !== requestedLang);
            fc.pre(!actualLang.startsWith(requestedLang));
            fc.pre(!requestedLang.startsWith(actualLang));
            
            const markdown = `\`\`\`${actualLang}\n${codeContent}\`\`\``;
            
            try {
              parsers.codeBlock(markdown, requestedLang);
              expect.fail('Expected ParsingError to be thrown');
            } catch (error) {
              expect(error).toBeInstanceOf(ParsingError);
              if (error instanceof ParsingError) {
                expect(error.originalContent).toBe(markdown);
                expect(error.parserType).toBe('codeBlock');
              }
            }
          }
        )
      );
    });
  });

  describe('Custom parser errors', () => {
    it('should wrap custom parser errors in ParsingError', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          (content, errorMessage) => {
            const failingParser = parsers.custom(() => {
              throw new Error(errorMessage);
            });
            
            try {
              failingParser(content);
              expect.fail('Expected ParsingError to be thrown');
            } catch (error) {
              expect(error).toBeInstanceOf(ParsingError);
              if (error instanceof ParsingError) {
                expect(error.originalContent).toBe(content);
                expect(error.parserType).toBe('custom');
                expect(error.message).toContain(errorMessage);
              }
            }
          }
        )
      );
    });

    it('should pass through ParsingError from custom parser unchanged', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          (content, customMessage) => {
            const customParsingError = new ParsingError(customMessage, 'original', 'myParser');
            const failingParser = parsers.custom(() => {
              throw customParsingError;
            });
            
            try {
              failingParser(content);
              expect.fail('Expected ParsingError to be thrown');
            } catch (error) {
              expect(error).toBe(customParsingError);
            }
          }
        )
      );
    });
  });
});
