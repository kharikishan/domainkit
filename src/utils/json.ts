/**
 * Safely parse a JSON string, returning a fallback value or throwing
 * a descriptive error on failure.
 */
export function safeJsonParse<T = unknown>(text: string, fallback?: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    if (fallback !== undefined) return fallback;
    const preview = text.length > 100 ? text.substring(0, 100) + '...' : text;
    throw new Error(`Failed to parse JSON: ${preview}`);
  }
}
