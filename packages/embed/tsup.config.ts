import { defineConfig, type Options } from 'tsup'

type EsbuildPlugin = NonNullable<Options['esbuildPlugins']>[number]

/** React bringt die fremde Anwendung mit — genau eine Kopie auf der Seite. */
const REACT = /^(react|react-dom)(\/.*)?$/

/**
 * React bleibt extern, aber nur ueber `import`. CommonJS-Module im Buendel
 * (`use-sync-external-store/shim` aus Radix und swr) holen React per
 * `require("react")`; dafuer liesse esbuild einen `require`-Ersatz im
 * ESM-Buendel stehen, und den lehnt Turbopack (Next 16) ab: „dynamic usage of
 * require is not supported" (Nachweis in commoning-methods, 10.09.2026). Hier
 * wird so ein `require` auf ein kleines ESM-Modul umgelenkt, das React per
 * `import` holt. Weil tsups eigenes Extern-Plugin vor diesem laeuft, steht
 * React unter `noExternal` — extern macht es dieses Plugin.
 */
const reactNurPerImport: EsbuildPlugin = {
  name: 'react-nur-per-import',
  setup(build) {
    build.onResolve({ filter: REACT }, (args) =>
      args.kind === 'require-call'
        ? { path: args.path, namespace: 'react-als-esm' }
        : { path: args.path, external: true },
    )
    build.onLoad({ filter: /.*/, namespace: 'react-als-esm' }, (args) => {
      const pfad = JSON.stringify(args.path)
      return { contents: `export * from ${pfad}\nexport { default } from ${pfad}\n`, loader: 'js' }
    })
  },
}

/**
 * Das Buendel fuer die fremde Anwendung (M5, Owner 2026-09-10: tsup).
 *
 * React bringt die fremde Anwendung mit (peerDependencies, extern) — genau
 * eine Kopie auf der Seite. Alles andere steckt im Buendel: die @ks-Pakete,
 * jotai, Radix, lucide, d3, remarkable. `next` bleibt draussen: `@ks/i18n`
 * enthaelt eine Datei mit `next/navigation`, und die fremde Anwendung ist eine
 * Next-App (AECED). Die Stile baut `scripts/build-css.mjs`.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'browser',
  target: 'es2020',
  clean: true,
  sourcemap: true,
  minify: true,
  // Die Typen entstehen nur aus `src/typen.ts`: Die oeffentliche Oberflaeche
  // braucht nichts aus den @ks-Paketen, und deren Typen lassen sich nicht
  // portabel in eine Datei giessen (Radix in @ks/ui, TS2742).
  dts: { entry: { index: 'src/typen.ts' } },
  external: [/^next(\/|$)/],
  noExternal: [REACT],
  esbuildPlugins: [reactNurPerImport],
  // Next.js App Router: Das Buendel ist eine Client-Grenze.
  banner: { js: '"use client";' },
  define: { 'process.env.NODE_ENV': '"production"' },
  esbuildOptions(options) {
    // Die Pakete des Monorepos stehen auf `jsx: preserve`, weil Next sie
    // uebersetzt; hier uebersetzt esbuild selbst.
    options.jsx = 'automatic'
  },
})
