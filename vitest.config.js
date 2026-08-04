import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The app's components are .jsx with no `import React`, exactly as the
  // @vitejs/plugin-react build expects. Vitest transforms them with bare
  // esbuild, whose default is the classic runtime, so a component test would
  // die on "React is not defined". This is the same runtime vite.config.js's
  // react plugin uses for the real build.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js', 'scripts/**/*.test.mjs'],
  },
});
