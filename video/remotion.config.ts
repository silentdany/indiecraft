import { existsSync } from 'node:fs'
import path from 'node:path'
import { Config } from '@remotion/cli/config'

/**
 * Find the app, by looking for it.
 *
 * Neither of the two obvious answers works here. `import.meta.url` is empty —
 * the CLI evaluates this file as CommonJS. `__dirname` is worse than empty: it
 * resolves to somewhere inside @remotion/cli, which turned the alias below
 * into a mapping onto the CLI's own package and produced a "cannot resolve
 * @/app/globals.css" that pointed at a directory nobody had written. So: walk
 * up from wherever the process started until the stylesheet is underfoot.
 */
function findRepoRoot(): string {
  let directory = process.cwd()
  for (let up = 0; up < 6; up++) {
    if (existsSync(path.join(directory, 'app', 'globals.css'))) return directory
    const parent = path.dirname(directory)
    if (parent === directory) break
    directory = parent
  }
  throw new Error(
    'Could not find the Indiecraft app above ' +
      `${process.cwd()} — this project renders the real components and needs them on disk.`,
  )
}

const repoRoot = findRepoRoot()
const here = path.join(repoRoot, 'video')

Config.setVideoImageFormat('jpeg')
Config.setOverwriteOutput(true)
/* The sheet is a still page of flat colour: crf is cheap here and the gold
   banding shows immediately if it is not. */
Config.setCrf(17)

/**
 * Teach the bundler to read the app.
 *
 * Everything in src/scenes imports the real components out of ../components,
 * so the two things Next normally provides have to come from somewhere: the
 * `@/` alias, and the `next/*` modules those components import. Both are
 * pointed at this project's own files. Nothing is copied, which is the point.
 */
/**
 * Say which JSX runtime, rather than letting it be inferred.
 *
 * Remotion's esbuild loader normally reads jsx out of tsconfig.json, but it
 * does so through `typescript.sys` — which TypeScript 7 does not expose on its
 * CommonJS export, and TypeScript 7 is what this repo is on. The read silently
 * yields nothing, esbuild falls back to the classic runtime, and every app
 * component that writes JSX without importing React (all of them: Next has not
 * needed that import since 17) dies at module scope with "React is not
 * defined". Stating it here is both the fix and the documentation.
 */
const withAutomaticJsx = (rule: unknown): unknown => {
  if (!rule || typeof rule !== 'object') return rule
  const entry = rule as { use?: unknown; options?: Record<string, unknown> }

  if (Array.isArray(entry.use)) {
    return { ...entry, use: entry.use.map(withAutomaticJsx) }
  }
  // The esbuild loader is the one carrying `remotionRoot`; nothing else does.
  if (entry.options && 'remotionRoot' in entry.options) {
    return {
      ...entry,
      options: {
        ...entry.options,
        tsconfigRaw: { compilerOptions: { jsx: 'react-jsx' } },
      },
    }
  }
  return rule
}

Config.overrideWebpackConfig((current) => ({
  ...current,
  resolve: {
    ...current.resolve,
    alias: {
      ...current.resolve?.alias,
      // Order matters to webpack: the two exact module names have to be
      // listed before the '@' prefix, or a request for 'next/link' would
      // never be reached.
      'next/link': path.join(here, 'src/shims/next-link.tsx'),
      'next/navigation': path.join(here, 'src/shims/next-navigation.ts'),
      '@': repoRoot,
    },
  },
  module: {
    ...current.module,
    /* The cast is the price of touching webpack's rule union from a file
       that does not depend on @types/webpack. The walk above only ever
       rebuilds objects it recognises and returns everything else untouched. */
    rules: (current.module?.rules ?? []).map(withAutomaticJsx) as NonNullable<
      typeof current.module
    >['rules'],
  },
}))
