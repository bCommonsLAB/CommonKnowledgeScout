import { defineConfig } from 'tsup'

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
  external: ['react', 'react-dom', /^next(\/|$)/],
  // Next.js App Router: Das Buendel ist eine Client-Grenze.
  banner: { js: '"use client";' },
  define: { 'process.env.NODE_ENV': '"production"' },
  esbuildOptions(options) {
    // Die Pakete des Monorepos stehen auf `jsx: preserve`, weil Next sie
    // uebersetzt; hier uebersetzt esbuild selbst.
    options.jsx = 'automatic'
  },
})
