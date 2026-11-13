import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'server',
          environment: 'node',
          include: ['server/**/*.test.ts', 'shared/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'web',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          setupFiles: ['./src/test/setup.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['server/**', 'shared/**', 'src/**'],
      exclude: ['**/*.test.*', '**/test/**', 'src/routeTree.gen.ts', 'server/sources/fixtures-data.ts'],
    },
  },
})
