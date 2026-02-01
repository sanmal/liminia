import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      $lib: resolve(__dirname, 'src/lib'),
      $types: resolve(__dirname, 'src/lib/types'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    globals: false, // 明示的にimportを使用
  },
});
