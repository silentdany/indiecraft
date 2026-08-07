import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The engine is the only part of the project worth testing.
    include: ['engine/**/*.test.ts'],
  },
})
