/**
 * Input sanitization to prevent XSS attacks.
 * Strips HTML tags and dangerous patterns from user text input.
 */

/** Strip all HTML tags and dangerous patterns */
export function sanitizeInput(input: string): string {
  return input
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove javascript: protocol
    .replace(/javascript\s*:/gi, '')
    // Remove data: URIs
    .replace(/data\s*:[^;]*;/gi, '')
    // Remove on* event handlers
    .replace(/on\w+\s*=/gi, '')
    // Remove script tags (double protection)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Encode remaining angle brackets
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .trim();
}

/** Recursively sanitize all string values in an object */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  for (const key of Object.keys(result)) {
    const value = result[key];
    if (typeof value === 'string') {
      (result as any)[key] = sanitizeInput(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      (result as any)[key] = sanitizeObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      (result as any)[key] = value.map((item) =>
        typeof item === 'string'
          ? sanitizeInput(item)
          : typeof item === 'object' && item !== null
            ? sanitizeObject(item as Record<string, unknown>)
            : item
      );
    }
  }
  return result;
}
