import { describe, it, expect } from 'vitest';
import { createAjv } from '../../../src/utils/ajv.js';

describe('createAjv', () => {
  it('creates a working Ajv instance', () => {
    const ajv = createAjv();
    expect(ajv).toBeDefined();
    expect(typeof ajv.compile).toBe('function');
  });

  it('accepts options', () => {
    const ajv = createAjv({ allErrors: true });
    expect(ajv).toBeDefined();
  });

  it('can compile and validate a schema', () => {
    const ajv = createAjv();
    const validate = ajv.compile({
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    });

    expect(validate({ name: 'test' })).toBe(true);
    expect(validate({})).toBe(false);
  });
});
