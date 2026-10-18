import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import base from '../../vite.config.ts';

const tokenPath = process.env['CLIO_DIAGRAM_REVIEW_TOKEN_FILE'];
if (!tokenPath)
  throw new Error('Set CLIO_DIAGRAM_REVIEW_TOKEN_FILE for the isolated review service.');
export default defineConfig({
  ...base,
  server: {
    ...base.server,
    host: '127.0.0.1',
    port: 5226,
    strictPort: true,
    proxy: {
      '/v1': {
        target: 'http://127.0.0.1:8221',
        headers: { Authorization: `Bearer ${readFileSync(tokenPath, 'utf8').trim()}` },
      },
    },
  },
});
