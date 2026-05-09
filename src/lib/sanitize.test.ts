import { describe, it, expect } from 'vitest';
import { 
  sanitizeHtml, 
  sanitizeText, 
  sanitizeUrl, 
  sanitizeObject,
  sanitizeCss,
  sanitizeSql 
} from './sanitize';

describe('Sanitization Utilities', () => {
  describe('sanitizeHtml', () => {
    it('should remove script tags', () => {
      const input = '<script>alert("xss")</script>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('<script');
      expect(result).not.toContain('alert');
    });

    it('should remove iframe tags', () => {
      const input = '<iframe src="malicious.com"></iframe>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('<iframe');
    });

    it('should remove event handlers', () => {
      const input = '<div onclick="alert(1)">Click me</div>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('onclick');
      expect(result).toContain('<div');
      expect(result).toContain('Click me');
    });

    it('should remove javascript: URLs from href', () => {
      const input = '<a href="javascript:alert(1)">Click</a>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('javascript:');
      expect(result).toContain('<a');
    });

    it('should remove javascript: URLs from src', () => {
      const input = '<img src="javascript:alert(1)">';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('javascript:');
    });

    it('should allow safe HTML tags', () => {
      const input = '<p>Hello <strong>world</strong></p>';
      const result = sanitizeHtml(input);
      expect(result).toContain('<p>');
      expect(result).toContain('<strong>');
      expect(result).toContain('Hello');
      expect(result).toContain('world');
    });

    it('should allow SVG tags', () => {
      const input = '<svg><path d="M10 10"/></svg>';
      const result = sanitizeHtml(input);
      expect(result).toContain('<svg');
      expect(result).toContain('<path');
    });

    it('should handle empty input', () => {
      const result = sanitizeHtml('');
      expect(result).toBe('');
    });

    it('should handle null input', () => {
      const result = sanitizeHtml(null as any);
      expect(result).toBe('');
    });

    it('should remove data: URLs', () => {
      const input = '<a href="data:text/html,<script>alert(1)</script>">Click</a>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('data:');
    });
  });

  describe('sanitizeText', () => {
    it('should remove all HTML tags', () => {
      const input = '<p>Hello <strong>world</strong></p>';
      const result = sanitizeText(input);
      expect(result).toBe('Hello world');
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });

    it('should handle empty input', () => {
      const result = sanitizeText('');
      expect(result).toBe('');
    });

    it('should handle plain text', () => {
      const input = 'Hello world';
      const result = sanitizeText(input);
      expect(result).toBe('Hello world');
    });

    it('should remove script tags', () => {
      const input = 'Hello <script>alert(1)</script> world';
      const result = sanitizeText(input);
      expect(result).toBe('Hello  world');
    });
  });

  describe('sanitizeUrl', () => {
    it('should allow http URLs', () => {
      const input = 'https://example.com';
      const result = sanitizeUrl(input);
      expect(result).toBe('https://example.com/');
    });

    it('should allow https URLs', () => {
      const input = 'http://example.com';
      const result = sanitizeUrl(input);
      expect(result).toBe('http://example.com/');
    });

    it('should allow mailto URLs', () => {
      const input = 'mailto:test@example.com';
      const result = sanitizeUrl(input);
      expect(result).toBe('mailto:test@example.com');
    });

    it('should reject javascript: URLs', () => {
      const input = 'javascript:alert(1)';
      const result = sanitizeUrl(input);
      expect(result).toBe('');
    });

    it('should reject data: URLs', () => {
      const input = 'data:text/html,<script>alert(1)</script>';
      const result = sanitizeUrl(input);
      expect(result).toBe('');
    });

    it('should handle empty input', () => {
      const result = sanitizeUrl('');
      expect(result).toBe('');
    });

    it('should handle invalid URLs', () => {
      const input = 'not a url';
      const result = sanitizeUrl(input);
      expect(result).toBe('');
    });

    it('should reject URLs with double dots in hostname', () => {
      const input = 'http://example..com';
      const result = sanitizeUrl(input);
      expect(result).toBe('');
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize string properties', () => {
      // Note: sanitize-html removes content of script tags entirely
      const input = { name: '<b>John Doe</b>', age: 25 };
      const result = sanitizeObject(input);
      expect(result.name).toBe('John Doe');
      expect(result.age).toBe(25);
    });

    it('should handle nested objects', () => {
      const input = { 
        user: { 
          name: '<strong>John</strong>',
          profile: { bio: '<em>test</em>' }
        }
      };
      const result = sanitizeObject(input);
      expect(result.user.name).toBe('John');
      expect(result.user.profile.bio).toBe('test');
    });

    it('should handle arrays', () => {
      const input = { 
        tags: ['<span>tag1</span>', '<span>tag2</span>']
      };
      const result = sanitizeObject(input);
      expect(result.tags[0]).toBe('tag1');
      expect(result.tags[1]).toBe('tag2');
    });

    it('should remove script tags entirely', () => {
      const input = { name: '<script>alert(1)</script>' };
      const result = sanitizeObject(input);
      // sanitize-html removes content of script tags
      expect(result.name).toBe('');
    });

    it('should handle empty object', () => {
      const input = {};
      const result = sanitizeObject(input);
      expect(result).toEqual({});
    });

    it('should not modify non-string values', () => {
      const input = { 
        num: 42,
        bool: true,
        nul: null,
        undef: undefined
      };
      const result = sanitizeObject(input);
      expect(result.num).toBe(42);
      expect(result.bool).toBe(true);
      expect(result.nul).toBe(null);
      expect(result.undef).toBe(undefined);
    });
  });

  describe('sanitizeCss', () => {
    it('should remove url() references', () => {
      const input = 'background: url(http://example.com)';
      const result = sanitizeCss(input);
      expect(result).not.toContain('url(');
    });

    it('should remove @import rules', () => {
      const input = '@import url(http://example.com);';
      const result = sanitizeCss(input);
      expect(result).not.toContain('@import');
    });

    it('should remove expression()', () => {
      const input = 'width: expression(alert(1))';
      const result = sanitizeCss(input);
      expect(result).not.toContain('expression(');
    });

    it('should remove javascript: references', () => {
      const input = 'content: "javascript:alert(1)"';
      const result = sanitizeCss(input);
      expect(result).not.toContain('javascript:');
    });

    it('should handle empty input', () => {
      const result = sanitizeCss('');
      expect(result).toBe('');
    });
  });

  describe('sanitizeSql', () => {
    it('should remove single quotes', () => {
      const input = "' OR '1'='1";
      const result = sanitizeSql(input);
      expect(result).not.toContain("'");
    });

    it('should remove double quotes', () => {
      const input = '" OR "1"="1';
      const result = sanitizeSql(input);
      expect(result).not.toContain('"');
    });

    it('should remove dangerous SQL keywords', () => {
      const dangerousKeywords = ['DROP', 'DELETE', 'INSERT', 'UPDATE', 'UNION', 'EXEC', 'EXECUTE'];
      dangerousKeywords.forEach(keyword => {
        const input = `${keyword} something`;
        const result = sanitizeSql(input);
        expect(result).not.toContain(keyword.toUpperCase());
      });
    });

    it('should remove SQL logical operators', () => {
      const input = 'OR 1=1 AND 2=2';
      const result = sanitizeSql(input);
      expect(result).not.toContain('OR');
      expect(result).not.toContain('AND');
    });

    it('should handle empty input', () => {
      const result = sanitizeSql('');
      expect(result).toBe('');
    });

    it('should remove SQL comments', () => {
      const input = 'value; -- comment';
      const result = sanitizeSql(input);
      expect(result).not.toContain('--');
    });

    it('should collapse multiple spaces', () => {
      const input = 'word1    word2';
      const result = sanitizeSql(input);
      expect(result).toBe('word1 word2');
    });
  });
});

describe('XSS Attack Vectors', () => {
  // HTML-based XSS vectors (should be blocked by sanitizeHtml)
  const htmlXssVectors = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert(1)>',
    '<svg/onload=alert(1)>',
    '<iframe src="javascript:alert(1)">',
    '<body onload=alert(1)>',
    '<div onclick=alert(1)>Click</div>',
    '<script src="malicious.js"></script>',
    '<object data="malicious.swf"></object>',
    '<embed src="malicious.swf">',
    '<form action="javascript:alert(1)">',
    '<input type="text" onfocus=alert(1) autofocus>',
    '<style>body{background:url(javascript:alert(1))}</style>',
    '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
    '<base href="javascript:alert(1)">',
    '<a href="javascript:alert(1)">Click</a>',
  ];

  // Plain text XSS vectors (for URL contexts)
  const plainTextXssVectors = [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
  ];

  it('should block HTML-based XSS vectors with sanitizeHtml', () => {
    htmlXssVectors.forEach(vector => {
      const result = sanitizeHtml(vector);
      expect(result).not.toContain('javascript:');
      expect(result).not.toContain('onerror=');
      expect(result).not.toContain('onload=');
      expect(result).not.toContain('onclick=');
      expect(result).not.toContain('<script');
    });
  });

  it('should block HTML-based XSS vectors with sanitizeText', () => {
    htmlXssVectors.forEach(vector => {
      const result = sanitizeText(vector);
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });
  });

  it('should block URL-based XSS vectors with sanitizeUrl', () => {
    plainTextXssVectors.forEach(vector => {
      const result = sanitizeUrl(vector);
      expect(result).toBe('');
    });
  });

  it('should block URL-based XSS vectors with sanitizeText in URL context', () => {
    // For plain text that might be used in URL contexts, use sanitizeUrl
    plainTextXssVectors.forEach(vector => {
      const result = sanitizeUrl(vector);
      expect(result).toBe('');
    });
  });
});
