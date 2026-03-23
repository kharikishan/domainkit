import * as AjvModule from 'ajv';

// Ajv v8 may export its constructor as the default or as .default depending on the bundler
const AjvConstructor: new (...args: unknown[]) => AjvModule.default = (
  (AjvModule as unknown as { default: typeof AjvModule.default }).default ?? AjvModule
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) as any;

/**
 * Create an Ajv instance with the correct constructor resolution
 * for both ESM and CJS bundling environments.
 */
export function createAjv(options?: Record<string, unknown>): AjvModule.default {
  return new AjvConstructor(options);
}
