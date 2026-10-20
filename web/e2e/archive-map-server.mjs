import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'test-results/archive-map-fixture');
const port = Number(process.env.CLIO_ARCHIVE_MAP_PORT ?? 18849);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535)
  throw new Error('Invalid archive fixture port');
// Reuse the production worker build, inline assets and classic bundling settings.
await build({
  root,
  configFile: resolve(root, 'vite.offline.config.ts'),
  build: {
    outDir: output,
    emptyOutDir: false,
    lib: {
      entry: resolve(root, 'e2e/archive-map-fixture.tsx'),
      name: 'ArchiveMapFixture',
      formats: ['iife'],
      fileName: () => 'fixture.js',
      cssFileName: 'fixture',
    },
  },
});
const script = (await readFile(resolve(output, 'fixture.js'), 'utf8')).replace(
  /<\/script/gi,
  '<\\/script',
);
const css = await readFile(resolve(output, 'fixture.css'), 'utf8');
const hash = createHash('sha256').update(script).digest('base64');
const policy = `default-src 'none'; script-src 'sha256-${hash}' 'unsafe-eval'; style-src 'unsafe-inline'; worker-src blob:; connect-src blob: data:; img-src data: blob:; font-src data:`;
const html = `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><title>Archive map test</title><style>${css}</style><div id="root"></div><script>${script}</script>`;
createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (url.pathname === '/opaque') {
    const kind = url.searchParams.get('kind') === 'polygon' ? 'polygon' : 'points';
    response.end(
      `<!doctype html><title>Opaque map test</title><iframe title="Archive" sandbox="allow-scripts" style="width:100%;height:650px" src="/map?kind=${kind}"></iframe>`,
    );
  } else response.end(html);
}).listen(port, '127.0.0.1');
