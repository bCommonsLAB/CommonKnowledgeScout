/**
 * Paketgrenze des Website-Moduls (Plan `startseite-als-embed`, Abschnitt 3.4;
 * Regeln wie im Story-Modul):
 *
 * - kein `next/*` (das Paket laeuft im Startseiten-Embed ohne Next; die
 *   Schriften aus `next/font` bleiben in der App, `src/lib/website/site-fonts.ts`),
 * - kein Clerk (die Anmeldung kommt als Prop oder Slot),
 * - kein `@/` (App-Code bleibt in der App; Vokabular ueber `@ks/contracts`),
 * - kein `@commonux/*` (der Player bleibt in der App, Plan `commonux-buehne-fragen-sektion` 3.1),
 * - keine Adresszeile (`window.location`, `history`) — Wege nach aussen laufen
 *   ueber die Navigation-Schnittstelle (`WebsiteNavigation`), die App bzw. das
 *   Embed bindet sie an ihre Adresse,
 * - kein nacktes `fetch` (ab WE2 laufen Abrufe ueber `instanz.fetch`).
 *
 * Dazu: Das Wurzel-Barrel bleibt zur Laufzeit React- und Galerie-frei, weil
 * Bruecke und Server (`website-pruefung.ts`, `website-seite.ts`) dort Parser
 * und Regeln holen. Bis WE1 hielt das `galerie-schnitt.test.ts` fuer
 * `src/lib/website` fest; fuer die Regeln im Paket gilt es hier.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { collectTsFiles, nacktesFetchImPaket } from '../paket-fetch-schnitt'

const REPO_ROOT = process.cwd()
const PAKET = 'packages/module-website/src'

interface Verbot {
  name: string
  muster: RegExp
}

const VERBOTE: Verbot[] = [
  { name: 'next/*', muster: /from\s+['"]next(\/|['"])/ },
  { name: '@clerk/*', muster: /from\s+['"]@clerk\// },
  { name: '@/ (App-Code)', muster: /from\s+['"]@\// },
  // Der Player reist nicht ins Embed: Das Gespraech steht als eigener Typ in `story-gespraech.ts`.
  { name: '@commonux/*', muster: /from\s+['"]@commonux\// },
  { name: 'Adresszeile', muster: /\b(window\.location|location\.(href|assign|replace|search|hash)|history\.(pushState|replaceState))\b/ },
]

/** React selbst (`react`, `react/jsx-runtime`, …); als reiner Typ-Import erlaubt, der wird geloescht. */
const REACT = /^react(\/|$)/
/** Galerie-Teile des Explorers; das React-freie Wurzel-Barrel `@ks/module-explorer` waere erlaubt. */
const GALERIE = /^@ks\/module-explorer\/(react|gallery)/

function fundstellen(inhalt: string, muster: RegExp): string[] {
  return inhalt.split('\n').flatMap((zeile, i) => (muster.test(zeile) ? [`${i + 1}: ${zeile.trim()}`] : []))
}

interface Importiert {
  modul: string
  nurTyp: boolean
}

/** Import- und Re-Export-Quellen einer Datei aus dem Syntaxbaum (mehrzeilige Importe inklusive). */
function importiert(inhalt: string): Importiert[] {
  const quelle = ts.createSourceFile('x.ts', inhalt, ts.ScriptTarget.Latest, false)
  return quelle.statements.flatMap((s): Importiert[] => {
    if (ts.isImportDeclaration(s) && ts.isStringLiteral(s.moduleSpecifier)) {
      const klausel = s.importClause
      const benannt = klausel?.namedBindings
      const alleTyp =
        !!klausel &&
        (klausel.isTypeOnly ||
          (!klausel.name && !!benannt && ts.isNamedImports(benannt) && benannt.elements.length > 0 &&
            benannt.elements.every((e) => e.isTypeOnly)))
      return [{ modul: s.moduleSpecifier.text, nurTyp: alleTyp }]
    }
    if (ts.isExportDeclaration(s) && s.moduleSpecifier && ts.isStringLiteral(s.moduleSpecifier)) {
      return [{ modul: s.moduleSpecifier.text, nurTyp: s.isTypeOnly }]
    }
    return []
  })
}

/** Verstoesse gegen das Wurzel-Barrel: React zur Laufzeit, Galerie ueberhaupt. */
function barrelVerstoesse(inhalt: string): string[] {
  return importiert(inhalt)
    .filter((i) => (REACT.test(i.modul) && !i.nurTyp) || GALERIE.test(i.modul))
    .map((i) => i.modul)
}

function verbot(name: string): RegExp {
  const gefunden = VERBOTE.find((v) => v.name === name)
  if (!gefunden) throw new Error(`Kein Verbot "${name}"`)
  return gefunden.muster
}

function paketDateien(): string[] {
  return collectTsFiles(join(REPO_ROOT, PAKET))
}

describe('Website-Modul: Paketgrenze', () => {
  it('das Paket enthaelt die Regeln (sonst waeren die Pruefungen leer gruen)', () => {
    expect(paketDateien().length).toBeGreaterThanOrEqual(18)
  })

  for (const verbot of VERBOTE) {
    it(`importiert kein ${verbot.name}`, () => {
      const offenders: string[] = []
      for (const file of paketDateien()) {
        const rel = relative(REPO_ROOT, file).replace(/\\/g, '/')
        for (const treffer of fundstellen(readFileSync(file, 'utf-8'), verbot.muster)) {
          offenders.push(`${rel}:${treffer}`)
        }
      }
      expect(offenders, `${verbot.name} im Website-Modul:\n${offenders.join('\n')}`).toEqual([])
    })
  }

  it('kein nacktes fetch im Paket', () => {
    const offenders = nacktesFetchImPaket(REPO_ROOT, PAKET)
    expect(offenders, `Nacktes fetch im Website-Modul:\n${offenders.join('\n')}`).toEqual([])
  })

  it('das Wurzel-Barrel ist zur Laufzeit React- und Galerie-frei (Bruecke und Server holen dort die Regeln)', () => {
    const barrel = readFileSync(join(REPO_ROOT, PAKET, 'index.ts'), 'utf-8')
    const quellen = importiert(barrel).map((i) => i.modul)
    expect(quellen.length).toBeGreaterThan(0)
    // Das Barrel reicht nur eigene Dateien weiter; jede davon wird geprueft.
    expect(quellen.filter((m) => !m.startsWith('./'))).toEqual([])
    const offenders: string[] = []
    for (const modul of quellen) {
      const inhalt = readFileSync(join(REPO_ROOT, PAKET, `${modul.slice(2)}.ts`), 'utf-8')
      for (const quelle of barrelVerstoesse(inhalt)) offenders.push(`${modul} → ${quelle}`)
    }
    expect(offenders, `React oder Galerie im Wurzel-Barrel:\n${offenders.join('\n')}`).toEqual([])
  })

  it('Gegenprobe: die Muster fangen, was sie fangen sollen', () => {
    expect(verbot('next/*').test("import Link from 'next/link'")).toBe(true)
    expect(verbot('next/*').test("import localFont from 'next/font/local'")).toBe(true)
    expect(verbot('next/*').test("import { nextThing } from './next-step'")).toBe(false)
    expect(verbot('@/ (App-Code)').test("import { cn } from '@/lib/utils'")).toBe(true)
    expect(verbot('@/ (App-Code)').test("import { cn } from '@ks/util'")).toBe(false)
    expect(verbot('Adresszeile').test('window.location.href = ziel')).toBe(true)
    expect(verbot('Adresszeile').test('history.pushState({}, "", url)')).toBe(true)

    expect(barrelVerstoesse("import * as React from 'react'")).toEqual(['react'])
    expect(barrelVerstoesse("import {\n  useState,\n} from 'react'")).toEqual(['react'])
    expect(barrelVerstoesse("import { jsx } from 'react/jsx-runtime'")).toEqual(['react/jsx-runtime'])
    expect(barrelVerstoesse("import type { CSSProperties } from 'react'")).toEqual([])
    expect(barrelVerstoesse("import { type CSSProperties } from 'react'")).toEqual([])
    expect(barrelVerstoesse("import { cn } from '@ks/util'\nimport type { CSSProperties } from 'react'")).toEqual([])
    expect(barrelVerstoesse("import { DocumentCard } from '@ks/module-explorer/react'")).toEqual(['@ks/module-explorer/react'])
    expect(barrelVerstoesse("import { localizeDocMetaJson } from '@ks/module-explorer'")).toEqual([])
  })
})
