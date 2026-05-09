/**
 * Comprehensive HTML/text sanitization utilities
 * 
 * Uses:
 * - sanitize-html for server-side sanitization
 * - DOMPurify for client-side sanitization (when available)
 * - Fallback regex for edge cases
 * 
 * Security: Prevents XSS, SQL injection, and other injection attacks
 */

import sanitizeHtmlLib from 'sanitize-html';

/**
 * Check if we're in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Get DOMPurify from window if available
 */
function getDOMPurify() {
  if (isBrowser() && typeof (window as any).DOMPurify !== 'undefined') {
    return (window as any).DOMPurify;
  }
  return null;
}

/**
 * Allowed HTML tags for markdown content (trusted RFC content)
 */
const ALLOWED_TAGS = [
  'p', 'br', 'b', 'i', 'em', 'strong', 'u', 'del', 's', 'strike',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote', 'code', 'pre',
  'a', 'img',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'hr', 'div', 'span',
  'svg', 'g', 'path', 'rect', 'circle', 'line', 'polygon', 'polyline', 'text',
  'defs', 'radialGradient', 'stop', 'use', 'symbol', 'view', 'clipPath'
];

/**
 * Dangerous tags that should always be removed
 */
const DANGEROUS_TAGS = [
  'script', 'iframe', 'frame', 'object', 'embed', 'link', 'meta',
  'form', 'input', 'textarea', 'button', 'select', 'option',
  'applet', 'base', 'basefont', 'body', 'head', 'html', 'style'
];

/**
 * Allowed attributes for each tag
 */
const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  'a': ['href', 'title', 'class', 'id'],
  'img': ['src', 'alt', 'title', 'class', 'id', 'width', 'height'],
  'code': ['class', 'id'],
  'pre': ['class', 'id'],
  'div': ['class', 'id'],
  'span': ['class', 'id'],
  'svg': ['viewBox', 'width', 'height', 'class', 'id'],
  'path': ['d', 'fill', 'stroke', 'class', 'id'],
  'rect': ['x', 'y', 'width', 'height', 'fill', 'stroke', 'class', 'id'],
  'circle': ['cx', 'cy', 'r', 'fill', 'stroke', 'class', 'id'],
  'line': ['x1', 'y1', 'x2', 'y2', 'stroke', 'class', 'id'],
  'polygon': ['points', 'fill', 'stroke', 'class', 'id'],
  'polyline': ['points', 'fill', 'stroke', 'class', 'id'],
  'text': ['x', 'y', 'class', 'id'],
  '*': ['class', 'id']
};

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Uses sanitize-html library for robust sanitization.
 * 
 * @param dirty - The HTML content to sanitize
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';

  try {
    // Try DOMPurify in browser first (faster)
    if (isBrowser()) {
      const purify = getDOMPurify();
      if (purify) {
        return purify.sanitize(dirty, {
          ALLOWED_TAGS: ALLOWED_TAGS,
          ALLOWED_ATTR: ALLOWED_ATTRIBUTES,
          FORBID_TAGS: DANGEROUS_TAGS,
          FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onmouseout', 'onfocus', 'onblur', 'style', 'javascript:', 'data:'],
          ALLOW_DATA_ATTR: false
        });
      }
    }

    // Server-side or fallback: use sanitize-html
    return sanitizeHtmlLib(dirty, {
      allowedTags: ALLOWED_TAGS,
      allowedAttributes: ALLOWED_ATTRIBUTES,
      disallowedTagsMode: 'discard',
      allowedIframeHostnames: [],
      allowProtocolRelative: false,
      parser: {
        lowerCaseTags: true,
        lowerCaseAttributeNames: true
      },
      transformTags: {
        'a': sanitizeAnchorTag,
        'img': sanitizeImgTag
      }
    });
  } catch (err) {
    console.error('Sanitization library failed, falling back to regex:', err);
    return fallbackSanitizeHtml(dirty);
  }
}

/**
 * Sanitize anchor tags to prevent javascript: and data: URLs
 */
function sanitizeAnchorTag(tagName: string, attribs: Record<string, string>) {
  const href = attribs.href || '';
  if (href.toLowerCase().startsWith('javascript:') || href.toLowerCase().startsWith('data:')) {
    delete attribs.href;
  }
  return { tagName, attribs };
}

/**
 * Sanitize img tags to prevent javascript: and data: URLs
 */
function sanitizeImgTag(tagName: string, attribs: Record<string, string>) {
  const src = attribs.src || '';
  if (src.toLowerCase().startsWith('javascript:') || src.toLowerCase().startsWith('data:')) {
    delete attribs.src;
  }
  return { tagName, attribs };
}

/**
 * Fallback regex-based HTML sanitization (less secure, use only as last resort)
 */
function fallbackSanitizeHtml(dirty: string): string {
  let result = dirty;

  // Remove dangerous tags and their content
  for (const tag of DANGEROUS_TAGS) {
    result = result.replace(new RegExp(`<${tag}[^>]*\\/?>`, 'gi'), '');
  }

  // Remove event handlers
  result = result.replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '');

  // Remove javascript: and data: URLs from href/src
  result = result.replace(/href=["']javascript:[^"']*["']/gi, 'href="#"');
  result = result.replace(/src=["']javascript:[^"']*["']/gi, 'src=""');
  result = result.replace(/href=["']data:[^"']*["']/gi, 'href="#"');
  result = result.replace(/src=["']data:[^"']*["']/gi, 'src=""');

  // Clean up empty attributes
  result = result.replace(/\s+=""|\s+=''/g, '');

  return result;
}

/**
 * Sanitize plain text input (removes all HTML tags)
 * 
 * @param dirty - The text content to sanitize
 * @returns Sanitized plain text string
 */
export function sanitizeText(dirty: string): string {
  if (!dirty) return '';

  try {
    // In browser with DOMPurify, use it for speed
    if (isBrowser()) {
      const purify = getDOMPurify();
      if (purify) {
        return purify.sanitize(dirty, { ALLOWED_TAGS: [] });
      }
    }

    // Server-side: use sanitize-html to strip all tags
    return sanitizeHtmlLib(dirty, {
      allowedTags: [],
      allowedAttributes: {}
    });
  } catch (err) {
    // Fallback to regex
    return dirty.replace(/<[^>]*>/g, '');
  }
}

/**
 * Sanitize a URL for use in links
 * 
 * @param dirty - The URL to sanitize
 * @returns Sanitized URL or empty string if invalid
 */
export function sanitizeUrl(dirty: string): string {
  if (!dirty) return '';

  try {
    const decoded = decodeURIComponent(dirty);
    const url = new URL(decoded);

    // Only allow http, https, and mailto protocols
    if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) {
      return '';
    }

    // Validate hostname (prevent SSRF-like patterns)
    if (url.hostname && /\.\./.test(url.hostname)) {
      return '';
    }

    return url.toString();
  } catch {
    return '';
  }
}

/**
 * Sanitize an object's string properties recursively
 * 
 * @param obj - The object to sanitize
 * @returns A new object with all string properties sanitized
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeText(value);
    } else if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        result[key] = value.map(item =>
          typeof item === 'string' ? sanitizeText(item) :
          typeof item === 'object' && item !== null ? sanitizeObject(item) : item
        );
      } else {
        result[key] = sanitizeObject(value);
      }
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Sanitize CSS to prevent CSS injection attacks
 * 
 * @param dirty - The CSS string to sanitize
 * @returns Sanitized CSS string
 */
export function sanitizeCss(dirty: string): string {
  if (!dirty) return '';

  return dirty
    .replace(/url\([^)]*\)/gi, '')
    .replace(/@import\s+[^;\n]*/gi, '')
    .replace(/expression\([^)]*\)/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '');
}

/**
 * Sanitize SQL-like strings to prevent SQL injection
 * (Note: This is a secondary defense - always use parameterized queries)
 * 
 * @param dirty - The string to sanitize
 * @returns Sanitized string
 */
export function sanitizeSql(dirty: string): string {
  if (!dirty) return '';

  return dirty
    .replace(/['"]/g, '')  // Remove all quotes
    .replace(/;\s*--/g, '')  // Remove SQL comments
    .replace(/\b(DROP|DELETE|INSERT|UPDATE|SELECT|UNION|EXEC|EXECUTE|OR|AND)\b/gi, '')  // Remove SQL keywords
    .replace(/\s+/g, ' ')  // Collapse multiple spaces
    .trim();
}
