import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import base from '../../vite.config.ts';
// Review worktrees can share installed dependencies through a Windows junction.
const root = fileURLToPath(new URL('../../../', import.meta.url));
const dependencies = realpathSync(fileURLToPath(new URL('../../../node_modules', import.meta.url)));
const fonts = ['inter', 'jetbrains-mono'].map((name) =>
  realpathSync(
    fileURLToPath(new URL(`../../node_modules/@fontsource-variable/${name}`, import.meta.url)),
  ),
);
export default defineConfig({
  ...base,
  server: { ...base.server, fs: { allow: [root, dependencies, ...fonts] } },
});
