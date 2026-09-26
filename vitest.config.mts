import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The pure parts, and only those: no database, no network, no clock.
    //
    // The engine was the whole list until share-text.ts, which earns a place on
    // the same grounds — it is copy generated from data, so it goes wrong by
    // quietly producing the wrong sentence rather than by throwing. The poster
    // line, the handle parser and the poster path are the same kind of thing.
    // Everything
    // else in lib/ talks to Postgres and is checked by running the thing.
    //
    // accept.ts and lib/markdown/ join on that second rule. Content negotiation
    // fails silently by handing a browser markdown, or a CDN one cached variant
    // for both, and the markdown renderers are share-text's problem again at
    // page scale: data in, prose out, wrong without throwing. The route handler
    // that feeds them does talk to Postgres and is not here.
    //
    // crawl-plan.ts is the same rule applied to the crawler: it decides what
    // tonight collects, out of lists and dates, and a wrong answer is a list of
    // the wrong length in the wrong order rather than an exception. The rest of
    // the crawler is network and Postgres and is not here.
    //
    // crawl-workflow.test.ts is the one filesystem exception here: the subject
    // IS the file. Where compute gets triggered from is not checkable any other
    // way short of losing another week of nights to find out.
    include: [
      'engine/**/*.test.ts',
      'lib/share-text.test.ts',
      'lib/handle.test.ts',
      'lib/poster-copy.test.ts',
      'lib/card-image.test.ts',
      'lib/accept.test.ts',
      'lib/negotiable.test.ts',
      'lib/markdown/*.test.ts',
      'lib/crawl-plan.test.ts',
      'scripts/crawl-workflow.test.ts',
    ],
  },
})
