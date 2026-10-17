import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  // The dependency scan otherwise globs every .html under the project, which
  // includes .worktrees/ — and a worktree's node_modules holds a junction back
  // to its own root, so the crawl never ends and the dev server serves nothing.
  optimizeDeps: { entries: ['index.html'] },
  server: { watch: { ignored: ['**/.worktrees/**', '**/scripts/tts-render/out*/**'] } },
});
