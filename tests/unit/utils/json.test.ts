import { describe, it, expect } from 'vitest';
import { safeJsonParse } from '../../../src/utils/json.js';

describe('safeJsonParse', () => {
  it('parses valid JSON', () => {
    expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 });
  });

  it('parses arrays', () => {
    expect(safeJsonParse('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('returns typed result', () => {
    const result = safeJsonParse<{ name: string }>('{"name":"test"}');
    expect(result.name).toBe('test');
  });

  it('returns fallback on invalid JSON', () => {
    expect(safeJsonParse('not json', { default: true })).toEqual({ default: true });
  });

  it('throws on invalid JSON when no fallback given', () => {
    expect(() => safeJsonParse('not json')).toThrow('Failed to parse JSON');
  });

  it('truncates long text in error message', () => {
    const longText = 'x'.repeat(200);
    expect(() => safeJsonParse(longText)).toThrow('...');
  });
});
