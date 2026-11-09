import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/scripts/hash-password.ts', 'src/scripts/backup.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // Bundle the workspace package (consumed as TS source); keep real deps external.
  noExternal: ['@sakinah/shared'],
});
