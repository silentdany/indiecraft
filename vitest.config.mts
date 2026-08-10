import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The pure parts, and only those: no database, no network, no clock.
    //
    // The engine was the whole list until share-text.ts, which earns a place on
    // the same grounds — it is copy generated from data, so it goes wrong by
    // quietly producing the wrong sentence rather than by throwing. Everything
    // else in lib/ talks to Postgres and is checked by running the thing.
    include: ['engine/**/*.test.ts', 'lib/share-text.test.ts'],
  },
})
