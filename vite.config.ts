import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import license from 'rollup-plugin-license';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [
    solid(),
    license({
      thirdParty: {
        allow: {
          test: '(MIT OR ISC OR 0BSD OR BSD-2-Clause OR BSD-3-Clause OR Apache-2.0)',
          failOnUnlicensed: true,
          failOnViolation: true,
        },
        output: { file: resolve('dist/licenses/npm-renderer.txt') },
      },
    }),
  ],
  server: {
    host: '127.0.0.1',
    port: 4187,
    strictPort: true,
    watch: { ignored: ['**/release/**', '**/test-results*/**', '**/.cache-eia/**'] },
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
  build: { target: 'es2022' },
});
