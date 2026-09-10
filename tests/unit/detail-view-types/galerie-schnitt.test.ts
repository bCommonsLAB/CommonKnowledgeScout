/**
 * Beweis-Ziel der Welle Galerie-Vertrag: Server-Code kennt die Galerie nicht mehr.
 *
 * Vor dieser Welle importierten `vector-repo`, `doc-meta-formatter`, drei
 * `external-jobs`-Phasen und die Website-Navigation aus `src/lib/gallery/` —
 * einem Ordner, dessen `types.ts` sogar `'use client'` traegt. Damit war der
 * Galerie-Ordner nicht bewegbar, ohne Server-Code mitzureissen oder zu
 * brechen (Galerie-Audit, Befund 1).
 *
 * Dieser Test haelt den Schnitt fest: Wer serverseitigen Code schreibt, der
 * Dokument-Fachlogik braucht, nimmt `@ks/contracts` oder `src/lib/documents/`
 * — nicht die Galerie.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const REPO_ROOT = process.cwd()

/** Bereiche, die serverseitig laufen oder von beiden Seiten genutzt werden. */
const SERVER_ROOTS = [
  'src/lib/repositories',
  'src/lib/external-jobs',
  'src/lib/website',
  'src/lib/mappers',
  'src/lib/chat',
  'src/app/api',
  'src/utils',
]

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return acc
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.next' || entry === 'dist') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, acc)
    } else if (/\.tsx?$/.test(entry)) {
      acc.push(full)
    }
  }
  return acc
}

describe('Galerie-Schnitt', () => {
  it('kein Server-Bereich importiert die Galerie', () => {
    // Seit M4i liegt die Galerie in `@ks/module-explorer/react` (React-Barrel)
    // bzw. unter `.../gallery/` (Interna). Das React-freie Wurzel-Barrel
    // (`@ks/module-explorer`, z. B. `localizeDocMetaJson`) darf der Server nutzen.
    const offenders: string[] = []
    for (const root of SERVER_ROOTS) {
      for (const file of collectSourceFiles(join(REPO_ROOT, root))) {
        const content = readFileSync(file, 'utf-8')
        if (/from ['"]@ks\/module-explorer\/(react|gallery)/.test(content)) {
          offenders.push(relative(REPO_ROOT, file).replace(/\\/g, '/'))
        }
      }
    }
    expect(
      offenders,
      `Server-Code importiert die Galerie:\n${offenders.join('\n')}\n` +
        'Gemeinsame Dokument-Fachlogik gehoert nach src/lib/documents/ oder ins ' +
        'React-freie Wurzel-Barrel, gemeinsame Typen nach @ks/contracts.'
    ).toEqual([])
  })

  it('src/lib/documents traegt kein "use client"', () => {
    // Der Ordner ist bewusst rahmenneutral: beide Seiten nutzen ihn.
    const offenders: string[] = []
    for (const file of collectSourceFiles(join(REPO_ROOT, 'src/lib/documents'))) {
      const content = readFileSync(file, 'utf-8')
      if (/^\s*['"]use client['"]/m.test(content)) {
        offenders.push(relative(REPO_ROOT, file).replace(/\\/g, '/'))
      }
    }
    expect(offenders, `'use client' in geteilter Fachlogik:\n${offenders.join('\n')}`).toEqual([])
  })

  it('die Galerie kennt keinen Auth-Anbieter', () => {
    // Welle „Galerie-Betrachter": Drei Stellen fragten direkt bei Clerk nach,
    // wer da ist. Damit haette das Modul einen Auth-Anbieter mitgeschleppt —
    // im Embed gibt es aber gar keine Anmeldung (ADR 0008). Der Betrachter
    // wird jetzt hereingereicht (`useGalleryViewer`).
    const GALLERY_ROOTS = [
      'packages/module-explorer/src/gallery/components',
      'packages/module-explorer/src/gallery/hooks',
      'packages/module-explorer/src/gallery/lib',
    ]
    const offenders: string[] = []
    for (const root of GALLERY_ROOTS) {
      for (const file of collectSourceFiles(join(REPO_ROOT, root))) {
        const content = readFileSync(file, 'utf-8')
        if (/from ['"]@clerk\//.test(content)) {
          offenders.push(relative(REPO_ROOT, file).replace(/\\/g, '/'))
        }
      }
    }
    expect(
      offenders,
      `Galerie-Code importiert einen Auth-Anbieter:\n${offenders.join('\n')}\n` +
        'Was die Galerie ueber den Betrachter wissen muss, steht in ' +
        'GalleryViewer (src/contexts/gallery-viewer-context.tsx) und wird ' +
        'hereingereicht — in der App per ClerkGalleryViewerBridge.'
    ).toEqual([])
  })

  it('die Galerie importiert keinen Chat-Code', () => {
    // Welle „Galerie-Chat-Mittelschicht": Was wie eine Abhaengigkeit vom Chat
    // aussah, war ein geteilter Begriff ohne Zuhause — das Referenz-Vokabular
    // liegt jetzt in @ks/contracts, und `ReferenceList` ist dorthin gezogen,
    // wo sie ohnehin ausschliesslich benutzt wurde (01-audit-galerie-chat.md).
    const GALLERY_ROOTS = ['packages/module-explorer/src/gallery/components', 'packages/module-explorer/src/gallery/hooks']

    // Keine Ausnahme mehr. `gallery-root` holte das Chat-Panel als Slot per
    // `next/dynamic`; seit M4f reicht der Montagepunkt es als `storyPanel`
    // herein. Die Galerie nennt den Chat damit an keiner Stelle mehr.
    const offenders: string[] = []
    for (const root of GALLERY_ROOTS) {
      for (const file of collectSourceFiles(join(REPO_ROOT, root))) {
        const relPath = relative(REPO_ROOT, file).replace(/\\/g, '/')
        const content = readFileSync(file, 'utf-8')
        if (/['"]@\/(components\/library\/chat|lib\/chat|types\/chat-response|types\/query-log)/.test(content)) {
          offenders.push(relPath)
        }
      }
    }
    expect(
      offenders,
      `Galerie-Code greift auf den Chat zu:\n${offenders.join('\n')}\n` +
        'Geteiltes Referenz-Vokabular liegt in @ks/contracts (DocReference, QuerySource).'
    ).toEqual([])
  })

  it('die Galerie erreicht den Auth-Anbieter auch nicht ueber einen Umweg', () => {
    // Der Test darueber prueft nur DIREKTE Importe. Beim Abarbeiten des langen
    // Schwanzes kam heraus, dass die Galerie Clerk weiterhin erreicht — ueber
    // `use-session-headers`, das intern `useUser()` ruft. Die Aussage „die
    // Galerie kennt keinen Auth-Anbieter" galt also nur eine Ebene tief.
    //
    // Dieser Test geht eine Ebene weiter: Welche App-Module importiert der
    // Galerie-Kegel, und ziehen DIESE einen Auth-Anbieter?
    const GALLERY_ROOTS = ['packages/module-explorer/src/gallery/components', 'packages/module-explorer/src/gallery/hooks', 'packages/module-explorer/src/gallery/lib']

    // Keine Ausnahmen mehr. `use-session-headers` war die letzte: Der Hook
    // bekommt den Anmeldezustand jetzt hereingereicht, statt ihn bei Clerk zu
    // erfragen. Wer Clerk ohnehin kennt, nimmt `useClerkSessionHeaders` — dort
    // sitzt die Anbindung, an genau einer Stelle.
    const BEKANNTE_UMWEGE = new Set<string>([])

    const modulPfade = new Set<string>()
    for (const root of GALLERY_ROOTS) {
      for (const file of collectSourceFiles(join(REPO_ROOT, root))) {
        const content = readFileSync(file, 'utf-8')
        for (const treffer of content.matchAll(/from ['"]@\/([a-zA-Z0-9/_-]+)['"]/g)) {
          modulPfade.add(treffer[1])
        }
      }
    }

    const offenders: string[] = []
    for (const modulPfad of modulPfade) {
      if (BEKANNTE_UMWEGE.has(modulPfad)) continue
      for (const endung of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
        let inhalt: string
        try {
          inhalt = readFileSync(join(REPO_ROOT, 'src', `${modulPfad}${endung}`), 'utf-8')
        } catch {
          continue
        }
        if (/from ['"]@clerk\//.test(inhalt)) offenders.push(modulPfad)
      }
    }

    expect(
      offenders,
      `Die Galerie erreicht einen Auth-Anbieter ueber:\n${offenders.join('\n')}\n` +
        'Solche Helfer bekommen den Anmeldezustand hereingereicht, statt ihn zu erfragen.'
    ).toEqual([])
  })

  it('der Galerie-Kegel importiert kein next/*', () => {
    // Welle M4f („Next raus"): `@ks/module-explorer` hat kein `next` in den
    // Abhaengigkeiten — was die Galerie von Next brauchte, kommt jetzt herein:
    // die Adresse ueber `GalleryNavigation`, Bilder ueber `GalleryHost.Bild`,
    // das Story-Panel als Slot. Der Kegel hier ist genau das, was in M4i
    // nach `packages/` umzieht; jede neue `next/`-Zeile darin waere ein
    // Schritt zurueck.
    const KEGEL = [
      'packages/module-explorer/src/gallery/components',
      'packages/module-explorer/src/gallery/hooks',
      'packages/module-explorer/src/gallery/lib',
      'packages/module-explorer/src/gallery/contexts',
      'packages/module-explorer/src/gallery/atoms',
    ]
    const offenders: string[] = []
    for (const root of KEGEL) {
      const abs = join(REPO_ROOT, root)
      const files = statSync(abs).isDirectory() ? collectSourceFiles(abs) : [abs]
      for (const file of files) {
        const content = readFileSync(file, 'utf-8')
        const treffer = content.match(/from ['"]next\/[^'"]*['"]/g)
        if (treffer) {
          offenders.push(`${relative(REPO_ROOT, file).replace(/\\/g, '/')}: ${treffer.join(', ')}`)
        }
      }
    }
    expect(
      offenders,
      `Galerie-Code importiert aus next/*:\n${offenders.join('\n')}\n` +
        'Adresse: GalleryNavigation. Bilder: GalleryHost.Bild. Faules Laden: React.lazy ' +
        'oder ein Slot am Montagepunkt (src/app/library/gallery/client.tsx).'
    ).toEqual([])
  })

  it('der Galerie-Kegel importiert aus components/library nur sich selbst', () => {
    // Welle M4g („fremde Bausteine als Slots"): Die zehn Detail-Renderer, die
    // Website-Landingpage, der Story-Kopf und das Verifikations-Abzeichen
    // kommen vom Montagepunkt herein; Filterleiste und Typ-Abzeichen sind in
    // den Kegel gezogen. Was die Galerie aus `components/library/*` braucht,
    // liegt damit vollstaendig unter `gallery/` — Voraussetzung fuer den
    // Umzug (M4i), bei dem `@/components/library/...` nicht mehr aufloest.
    const KEGEL = ['packages/module-explorer/src/gallery/components', 'packages/module-explorer/src/gallery/hooks', 'packages/module-explorer/src/gallery/lib']
    const offenders: string[] = []
    for (const root of KEGEL) {
      for (const file of collectSourceFiles(join(REPO_ROOT, root))) {
        const content = readFileSync(file, 'utf-8')
        const fremd = [...content.matchAll(/from ['"]@\/components\/library\/([^'"]+)['"]/g)]
          .map((m) => m[1])
          .filter((pfad) => !pfad.startsWith('gallery/') && pfad !== 'gallery')
        if (fremd.length > 0) {
          offenders.push(`${relative(REPO_ROOT, file).replace(/\\/g, '/')}: ${fremd.join(', ')}`)
        }
      }
    }
    expect(
      offenders,
      `Galerie-Code importiert fremde Bausteine aus components/library:\n${offenders.join('\n')}\n` +
        'Ein App-Baustein kommt als Slot herein (GalleryRootProps) oder zieht per git mv in den Kegel.'
    ).toEqual([])
  })

  it('die Galerie im Paket importiert nichts aus @/', () => {
    // Welle M4i (der Umzug): Der Kegel liegt in `packages/module-explorer/src/gallery`.
    // Dort loest `@/` nicht auf — `pnpm typecheck:packages` prueft das isoliert
    // mit TS2307; dieser Fall sagt es schneller und lesbarer.
    const offenders: string[] = []
    for (const file of collectSourceFiles(join(REPO_ROOT, 'packages/module-explorer/src/gallery'))) {
      const content = readFileSync(file, 'utf-8')
      const fremd = [...content.matchAll(/(?:from|import)\s*\(?\s*['"](@\/[^'"]+)['"]/g)].map((m) => m[1])
      if (fremd.length > 0) {
        offenders.push(`${relative(REPO_ROOT, file).replace(/\\/g, '/')}: ${fremd.join(', ')}`)
      }
    }
    expect(
      offenders,
      `Galerie-Code im Paket importiert aus der App:\n${offenders.join('\n')}\n` +
        'Ein Paket kennt die App nicht. Was die Galerie braucht, kommt als Slot oder ' +
        'Kontext herein oder liegt in einem Shared-Paket.'
    ).toEqual([])
  })

  it('die App importiert keine Galerie-Interna', () => {
    // Der Alias `@ks/module-explorer/gallery/*` existiert nur fuer Tests
    // (vitest.config.ts, tsconfig paths). App-Code nimmt den Einstieg
    // `@ks/module-explorer/react` — was dort nicht exportiert ist, ist
    // Paket-intern und darf sich aendern, ohne dass die App es merkt.
    const offenders: string[] = []
    for (const file of collectSourceFiles(join(REPO_ROOT, 'src'))) {
      const content = readFileSync(file, 'utf-8')
      if (/from ['"]@ks\/module-explorer\/gallery\//.test(content)) {
        offenders.push(relative(REPO_ROOT, file).replace(/\\/g, '/'))
      }
    }
    expect(
      offenders,
      `App-Code greift auf Galerie-Interna zu:\n${offenders.join('\n')}\n` +
        'Was die App braucht, exportiert packages/module-explorer/src/gallery/index.ts.'
    ).toEqual([])
  })

  it('das Paket fasst die Adresse des Gastgebers nicht an (M5)', () => {
    // Im Embed laeuft die Galerie als Gast in einer fremden Seite; deren
    // Adresse gehoert ihr nicht (Owner-Entscheidung 2026-08-29). Adressiert wird
    // ueber GalleryNavigation — in der App per Next, im Embed im Speicher.
    const MUSTER =
      /\bwindow\.location\b|\blocation\.(?:href|assign|replace|search|hash)\b|\bhistory\.(?:pushState|replaceState|back|go)\b/
    const offenders: string[] = []
    for (const file of collectSourceFiles(join(REPO_ROOT, 'packages/module-explorer/src'))) {
      readFileSync(file, 'utf-8').split('\n').forEach((zeile, i) => {
        const t = zeile.trim()
        if (t.startsWith('//') || t.startsWith('*')) return
        if (MUSTER.test(zeile)) offenders.push(`${relative(REPO_ROOT, file).replace(/\\/g, '/')}:${i + 1}: ${t}`)
      })
    }
    expect(
      offenders,
      `Das Paket greift auf die Adresse des Gastgebers zu:\n${offenders.join('\n')}\n` +
        'Adressieren ueber useGalleryNavigation() — die App schreibt in die URL, das Embed in den Speicher.'
    ).toEqual([])
  })
})
