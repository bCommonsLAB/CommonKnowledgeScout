// Baut dist/styles.css fuer @ks/embed (M5): Tailwind fuer alle Klassen der
// eingebetteten Galerie — und jede Regel unter dem Rahmen `.ks-embed`
// (Owner-Entscheidung 2026-09-10), damit nichts auf die fremde Seite wirkt.
//
// Die Farb-Variablen kommen aus der App (src/styles/globals.css): eine Quelle,
// keine Kopie. Die highlight.js-Stile, die tsup aus @ks/viewers herauszieht
// (dist/index.css), landen im selben Rahmen in derselben Datei.

import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

const RAHMEN = '.ks-embed'
const paket = join(dirname(fileURLToPath(import.meta.url)), '..')
const repo = join(paket, '..', '..')

/** Ein Block `selektor { … }` aus der globalen CSS der App — laut, wenn er fehlt. */
function block(css, selektor) {
  const muster = new RegExp(`${selektor.replace(/[.:]/g, (z) => `\\${z}`)}\\s*\\{[^}]*\\}`)
  const treffer = css.match(muster)
  if (!treffer) throw new Error(`Theme-Variablen fehlen: "${selektor}" steht nicht in src/styles/globals.css`)
  return treffer[0]
}

/**
 * Legt einen Selektor unter den Rahmen. Wurzel-Selektoren (`:root`, `html`,
 * `body`) werden zum Rahmen selbst; was den Rahmen schon nennt, bleibt, wie es
 * ist — PostCSS ruft das Plugin nach jeder Aenderung erneut auf.
 */
function imRahmen(selektor) {
  const s = selektor.trim()
  if (s.includes(RAHMEN)) return s
  if (s === ':root' || s === 'html' || s === 'body' || s === ':host') return RAHMEN
  if (s === '.dark') return `.dark ${RAHMEN}`
  return `${RAHMEN} ${s}`
}

const rahmenPlugin = {
  postcssPlugin: 'ks-embed-rahmen',
  Rule(rule) {
    const eltern = rule.parent
    if (eltern && eltern.type === 'atrule' && /keyframes$/i.test(eltern.name)) return
    rule.selectors = rule.selectors.map(imRahmen)
  },
}

const globals = readFileSync(join(repo, 'src/styles/globals.css'), 'utf-8')
const eingabe = [
  '@tailwind base;',
  '@tailwind components;',
  '@tailwind utilities;',
  '@layer base {',
  block(globals, ':root'),
  block(globals, '.dark'),
  '  * { @apply border-border; }',
  // Was in der App `body` bekommt, bekommt hier der Rahmen.
  '  :root { @apply bg-background text-foreground; }',
  '}',
].join('\n')

const tailwind = tailwindcss({ config: join(paket, 'tailwind.config.ts') })
const ergebnis = await postcss([tailwind, rahmenPlugin, autoprefixer]).process(eingabe, {
  from: join(paket, 'src', 'styles.css'),
  to: join(paket, 'dist', 'styles.css'),
})
let css = ergebnis.css

// Was esbuild beim Buendeln an CSS herauszieht (highlight.js aus @ks/viewers,
// je Einstieg und Nachlade-Stueck eine Datei), kommt in denselben Rahmen —
// jeder Inhalt nur einmal. Die Einzeldateien verschwinden danach: Die fremde
// Seite laedt genau eine Datei, `@ks/embed/styles.css`.
const dist = join(paket, 'dist')
const schonDrin = new Set()
for (const datei of readdirSync(dist).filter((d) => d.endsWith('.css') && d !== 'styles.css')) {
  const pfad = join(dist, datei)
  const roh = readFileSync(pfad, 'utf-8').replace(/\/\*# sourceMappingURL=.*?\*\//g, '').trim()
  if (roh && !schonDrin.has(roh)) {
    schonDrin.add(roh)
    const teil = await postcss([rahmenPlugin]).process(roh, { from: pfad })
    css += `\n/* aus dem Buendel: ${datei} */\n${teil.css}`
  }
  rmSync(pfad)
  rmSync(`${pfad}.map`, { force: true })
}

writeFileSync(join(paket, 'dist', 'styles.css'), `/* @ks/embed — alle Regeln unter ${RAHMEN} (M5) */\n${css}`)
console.log(`dist/styles.css geschrieben: ${Math.round(css.length / 1024)} KB`)
