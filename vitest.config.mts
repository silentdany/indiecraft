import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The pure parts, and only those: no database, no network, no clock.
    //
    // The engine was the whole list until share-text.ts, which earns a place on
    // the same grounds — it is copy generated from data, so it goes wrong by
    // quietly producing the wrong sentence rather than by throwing. Everything
    // else in lib/ talks to Postgres and is checked by running the thing.
    //
    // accept.ts and lib/markdown/ join on that second rule. Content negotiation
    // fails silently by handing a browser markdown, or a CDN one cached variant
    // for both, and the markdown renderers are share-text's problem again at
    // page scale: data in, prose out, wrong without throwing. The route handler
    // that feeds them does talk to Postgres and is not here.
    include: [
      'engine/**/*.test.ts',
      'lib/share-text.test.ts',
      'lib/accept.test.ts',
      'lib/negotiable.test.ts',
      'lib/markdown/*.test.ts',
    ],
  },
})
