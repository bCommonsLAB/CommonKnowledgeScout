// Prueft das fertige Buendel von @ks/embed, bevor es an eine fremde Anwendung
// geht: keine Importe aus dem Monorepo oder aus Next, Typen ohne @ks, eine
// Stil-Datei, die Client-Grenze vorn. Laut scheitern, statt ein kaputtes Paket
// still zu packen (no-silent-fallbacks.md).

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const fehler = []

for (const datei of readdirSync(dist).filter((d) => d.endsWith('.js'))) {
  const code = readFileSync(join(dist, datei), 'utf-8')
  const fremd = [...code.matchAll(/(?:from|import)\s*\(?\s*["']((?:@ks|next)(?:\/[^"']*)?)["']/g)].map((m) => m[1])
  if (fremd.length > 0) fehler.push(`${datei} importiert ${[...new Set(fremd)].join(', ')}`)
}

const typen = join(dist, 'index.d.ts')
if (!existsSync(typen)) fehler.push('dist/index.d.ts fehlt')
else {
  // Ohne Kommentare pruefen: Die Doku darf `import '@ks/embed/styles.css'` zeigen.
  const code = readFileSync(typen, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  if (/["']@ks\//.test(code)) fehler.push('dist/index.d.ts verweist auf @ks-Pakete')
}

if (!existsSync(join(dist, 'styles.css'))) fehler.push('dist/styles.css fehlt')

const einstieg = join(dist, 'index.js')
if (!existsSync(einstieg) || !readFileSync(einstieg, 'utf-8').startsWith('"use client"')) {
  fehler.push('dist/index.js fehlt oder beginnt nicht mit "use client"')
}

if (fehler.length > 0) {
  console.error(`Buendel nicht auslieferbar:\n- ${fehler.join('\n- ')}`)
  process.exit(1)
}
console.log('Buendel geprueft: keine @ks- oder next-Importe, Typen und Stile vorhanden, "use client" vorn.')
