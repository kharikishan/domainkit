import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    cli: 'src/cli/index.ts',
    index: 'src/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
  clean: true,
  target: 'node18',
  external: ['ts-morph', 'natural', '@modelcontextprotocol/sdk'],
  banner({ format }) {
    if (format === 'esm') {
      return {
        js: '#!/usr/bin/env node\n',
      };
    }
    return {};
  },
  esbuildOptions(options, context) {
    if (context.format === 'cjs') {
      // Only add shebang to CLI entry in CJS
    }
  },
});
