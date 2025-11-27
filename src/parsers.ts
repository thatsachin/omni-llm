// Built-in parsers for Unified LLM
import { ParsingError } from './errors';
import type { Parser } from './types';

/**
 * Simple XML node representation
 */
export interface XMLNode {
  tag: string;
  attributes: Record<string, string>;
  children: (XMLNode | string)[];
  text: string;
}

/**
 * Parse JSON from LLM response content
 * Handles common LLM quirks like markdown code blocks
 */
function parseJSON<T = unknown>(content: string): T {
  let cleanContent = content.trim();
  
  // Remove markdown code blocks if present
  const jsonBlockMatch = cleanContent.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    cleanContent = jsonBlockMatch[1].trim();
  }
  
  try {
    return JSON.parse(cleanContent) as T;
  } catch (error) {
    throw new ParsingError(
      `Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
      content,
      'json'
    );
  }
}

/**
 * Parse XML from LLM response content into a simple DOM-like structure
 */
function parseXML(content: string): XMLNode {
  let cleanContent = content.trim();
  
  // Remove markdown code blocks if present
  const xmlBlockMatch = cleanContent.match(/```(?:xml)?\s*([\s\S]*?)```/);
  if (xmlBlockMatch && xmlBlockMatch[1]) {
    cleanContent = xmlBlockMatch[1].trim();
  }
  
  try {
    return parseXMLNode(cleanContent);
  } catch (error) {
    throw new ParsingError(
      `Failed to parse XML: ${error instanceof Error ? error.message : 'Unknown error'}`,
      content,
      'xml'
    );
  }
}

/**
 * Internal XML parser - simple recursive descent parser
 */
function parseXMLNode(xml: string): XMLNode {
  const trimmed = xml.trim();
  
  // Match opening tag with attributes
  const openTagMatch = trimmed.match(/^<(\w+)([^>]*)>/);
  if (!openTagMatch || !openTagMatch[1]) {
    throw new Error('Invalid XML: No opening tag found');
  }
  
  const tag = openTagMatch[1];
  const attributeString = openTagMatch[2] || '';
  const attributes = parseAttributes(attributeString);
  
  // Check for self-closing tag
  if (attributeString.endsWith('/')) {
    return { tag, attributes, children: [], text: '' };
  }
  
  // Find closing tag
  const closingIndex = findClosingTag(trimmed, tag, openTagMatch[0].length);
  
  if (closingIndex === -1) {
    throw new Error(`Invalid XML: No closing tag found for <${tag}>`);
  }
  
  const innerContent = trimmed.slice(openTagMatch[0].length, closingIndex);
  const children = parseChildren(innerContent);
  const text = extractText(children);
  
  return { tag, attributes, children, text };
}

/**
 * Parse XML attributes from a string
 */
function parseAttributes(attrString: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attrRegex = /(\w+)=["']([^"']*)["']/g;
  let match;
  
  while ((match = attrRegex.exec(attrString)) !== null) {
    if (match[1] && match[2] !== undefined) {
      attributes[match[1]] = match[2];
    }
  }
  
  return attributes;
}

/**
 * Find the index of the closing tag, handling nested tags
 */
function findClosingTag(xml: string, tag: string, startIndex: number): number {
  let depth = 1;
  let i = startIndex;
  
  while (i < xml.length && depth > 0) {
    const openMatch = xml.slice(i).match(new RegExp(`^<${tag}(?:\\s|>)`));
    const closeMatch = xml.slice(i).match(new RegExp(`^</${tag}>`));
    
    if (closeMatch) {
      depth--;
      if (depth === 0) {
        return i;
      }
      i += closeMatch[0].length;
    } else if (openMatch) {
      depth++;
      i++;
    } else {
      i++;
    }
  }
  
  return -1;
}

/**
 * Parse children of an XML node
 */
function parseChildren(content: string): (XMLNode | string)[] {
  const children: (XMLNode | string)[] = [];
  let remaining = content.trim();
  
  while (remaining.length > 0) {
    if (remaining.startsWith('<')) {
      // Check for closing tag (shouldn't happen at this level)
      if (remaining.startsWith('</')) {
        break;
      }
      
      // Find the end of this element
      const tagMatch = remaining.match(/^<(\w+)/);
      if (!tagMatch || !tagMatch[1]) {
        // Not a valid tag, treat as text
        const nextTagIndex = remaining.indexOf('<', 1);
        if (nextTagIndex === -1) {
          children.push(remaining);
          break;
        }
        children.push(remaining.slice(0, nextTagIndex));
        remaining = remaining.slice(nextTagIndex);
        continue;
      }
      
      const tag = tagMatch[1];
      const closingTag = `</${tag}>`;
      const closingIndex = findClosingTag(remaining, tag, tagMatch[0].length);
      
      if (closingIndex === -1) {
        // Self-closing or malformed, try to parse what we can
        const selfCloseMatch = remaining.match(/^<\w+[^>]*\/>/);
        if (selfCloseMatch) {
          const node = parseXMLNode(selfCloseMatch[0]);
          children.push(node);
          remaining = remaining.slice(selfCloseMatch[0].length).trim();
          continue;
        }
        break;
      }
      
      const elementEnd = closingIndex + closingTag.length;
      const element = remaining.slice(0, elementEnd);
      children.push(parseXMLNode(element));
      remaining = remaining.slice(elementEnd).trim();
    } else {
      // Text content
      const nextTagIndex = remaining.indexOf('<');
      if (nextTagIndex === -1) {
        const text = remaining.trim();
        if (text) children.push(text);
        break;
      }
      const text = remaining.slice(0, nextTagIndex).trim();
      if (text) children.push(text);
      remaining = remaining.slice(nextTagIndex);
    }
  }
  
  return children;
}

/**
 * Extract text content from children
 */
function extractText(children: (XMLNode | string)[]): string {
  return children
    .map(child => (typeof child === 'string' ? child : child.text))
    .join('')
    .trim();
}

/**
 * Extract code from markdown code blocks
 * @param content - The content containing code blocks
 * @param language - Optional language to filter by
 */
function parseCodeBlock(content: string, language?: string): string {
  const trimmed = content.trim();
  
  // Pattern for code blocks with optional language
  // The \n? handles the optional newline after the language specifier
  // We capture everything between the opening fence+newline and closing fence
  const pattern = language
    ? new RegExp(`\`\`\`${language}\\n([\\s\\S]*?)\`\`\``)
    : /```(?:\w*)\n([\s\S]*?)```/;
  
  const match = trimmed.match(pattern);
  
  if (!match || match[1] === undefined) {
    throw new ParsingError(
      language
        ? `No ${language} code block found in content`
        : 'No code block found in content',
      content,
      'codeBlock'
    );
  }
  
  return match[1];
}

/**
 * Create a custom parser wrapper
 */
function createCustomParser<T>(fn: (content: string) => T): Parser<T> {
  return (content: string): T => {
    try {
      return fn(content);
    } catch (error) {
      if (error instanceof ParsingError) {
        throw error;
      }
      throw new ParsingError(
        `Custom parser failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        content,
        'custom'
      );
    }
  };
}

/**
 * Built-in parsers for LLM responses
 */
export const parsers = {
  /**
   * Parse JSON from response content
   */
  json: parseJSON,
  
  /**
   * Parse XML from response content
   */
  xml: parseXML,
  
  /**
   * Extract code from markdown code blocks
   */
  codeBlock: parseCodeBlock,
  
  /**
   * Create a custom parser
   */
  custom: createCustomParser,
};

export type { Parser };
