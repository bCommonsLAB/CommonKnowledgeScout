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
  it('kein Server-Bereich importiert aus src/lib/gallery', () => {
    const offenders: string[] = []
    for (const root of SERVER_ROOTS) {
      for (const file of collectSourceFiles(join(REPO_ROOT, root))) {
        const content = readFileSync(file, 'utf-8')
        if (/from ['"]@\/lib\/gallery\//.test(content)) {
          offenders.push(relative(REPO_ROOT, file).replace(/\\/g, '/'))
        }
      }
    }
    expect(
      offenders,
      `Server-Code importiert aus der Galerie:\n${offenders.join('\n')}\n` +
        'Gemeinsame Dokument-Fachlogik gehoert nach src/lib/documents/, ' +
        'gemeinsame Typen nach @ks/contracts.'
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
      'src/components/library/gallery',
      'src/hooks/gallery',
      'src/lib/gallery',
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
    const GALLERY_ROOTS = ['src/components/library/gallery', 'src/hooks/gallery']

    // Bewusste Ausnahme, mit Begruendung statt stillschweigend:
    // `gallery-root` laedt das Chat-Panel als SLOT per `next/dynamic`. Fuer ein
    // Paket muesste es als Prop hereinkommen — dieselbe Frage wie bei der
    // Galerie im Explorer, und sie faellt mit der Adressierungs-Welle zusammen.
    const SLOT_EXCEPTIONS = new Set(['src/components/library/gallery/gallery-root.tsx'])

    const offenders: string[] = []
    for (const root of GALLERY_ROOTS) {
      for (const file of collectSourceFiles(join(REPO_ROOT, root))) {
        const relPath = relative(REPO_ROOT, file).replace(/\\/g, '/')
        if (SLOT_EXCEPTIONS.has(relPath)) continue
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
    const GALLERY_ROOTS = ['src/components/library/gallery', 'src/hooks/gallery', 'src/lib/gallery']

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
})
