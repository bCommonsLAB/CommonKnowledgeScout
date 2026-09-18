/**
 * @fileoverview Regeln zu Notizen und Verlaufsdateien (Wunschliste 6, Teil C) — pur.
 *
 * @description
 * - `twin_core_missing` fuer Begleitdokumente: `type: notiz` und
 *   `type: verlauf` sind maschinell erzeugte Synthesen — `generated_by` und
 *   `generated_at` sind Pflicht (C1). Akteur ist hier Cowork, nicht
 *   KnowledgeScout: kein Job stempelt diese Dateien nach.
 * - `verlauf_fehlt` (C2): Der Bericht fuehrt `postfach_bis`, verweist aber auf
 *   keine Datei mit `type: verlauf` — die Korrespondenz hat keinen Ort.
 * - `entwicklung_unberichtet` (C3): Ein Eintrag einer Verlaufsdatei nennt ein
 *   Vorhaben (Wikilink in der Zeile `**Vorhaben:**`), dessen `BERICHT.md`
 *   aelter ist als der Eintrag und nicht auf dessen Sprungziel verweist. So
 *   erfaehrt ein Anwendungsvorhaben von der Programmierung, ohne dass jemand
 *   seinen Bericht anfasst.
 *
 * Grundlage sind die Begleitdokumente (`begleitdokumente.ts`): Dateien, auf
 * die ein Bericht verweist. Eine Verlaufsdatei, auf die KEIN Bericht zeigt,
 * sieht der Scan nicht — das ist Absicht (Kosten) und steht im Befundtext.
 *
 * @module agent-view
 */

import { BERICHT_FILE_NAME } from './archive-scan'
import type { ArchiveDocEntry, ArchiveFolderNode } from './archive-types'
import { begleitTyp } from './begleitdokumente'
import { createGap } from './gap-registry'
import { asString } from './sichten/bericht-lesen'
import type { CoverageGap } from './types'

/** Die beiden `type`-Werte, die Wunschliste 6 in den Twin-Contract bringt. */
export const VERLAUFS_TYPEN = ['notiz', 'verlauf'] as const

function istVerlaufsTyp(typ: string | null): typ is (typeof VERLAUFS_TYPEN)[number] {
  return typ !== null && (VERLAUFS_TYPEN as readonly string[]).includes(typ)
}

/** C1: `generated_by`/`generated_at` sind bei `notiz` und `verlauf` Pflicht. */
export function checkBegleitKern(folder: ArchiveFolderNode, docs: readonly ArchiveDocEntry[]): CoverageGap[] {
  const gaps: CoverageGap[] = []
  for (const doc of docs) {
    const typ = begleitTyp(doc)
    if (!istVerlaufsTyp(typ)) continue
    const fehlend = ['generated_by', 'generated_at'].filter((feld) => asString(doc.meta[feld]) === null)
    if (fehlend.length === 0) continue
    gaps.push(
      createGap({
        type: 'twin_core_missing',
        scope: 'folder',
        folderId: folder.folderId,
        path: doc.path,
        targetId: doc.fileId,
        targetName: doc.name,
        message: `Diese Datei (type: ${typ}) sagt nicht, wer sie wann erzeugt hat`,
        detail: fehlend.join(', '),
        actorOverride: 'cowork',
        zyklusSchrittOverride: 3,
      }),
    )
  }
  return gaps
}

/** C2: `postfach_bis` gesetzt, aber der Bericht verweist auf keine Verlaufsdatei. */
export function checkVerlaufFehlt(folder: ArchiveFolderNode, docs: readonly ArchiveDocEntry[]): CoverageGap | null {
  const bericht = folder.bericht
  if (bericht === null || asString(bericht.meta.postfach_bis) === null) return null
  if (docs.some((doc) => begleitTyp(doc) === 'verlauf')) return null
  return createGap({
    type: 'verlauf_fehlt',
    scope: 'folder',
    folderId: folder.folderId,
    path: folder.path,
    targetId: bericht.fileId,
    targetName: BERICHT_FILE_NAME,
    message: 'Der Bericht fuehrt postfach_bis, verweist aber auf keine Datei mit type: verlauf',
    detail: 'Gesucht wird unter den Markdown-Dateien des Vorhabens, auf die der Bericht verlinkt (z. B. [[Korrespondenz]])',
  })
}

export interface VerlaufEintrag {
  /** `JJJJ-MM-TT` aus der Ueberschrift. */
  datum: string
  /** Ueberschrift ohne `## ` und ohne `{#anker}`. */
  titel: string
  /** Expliziter Anker `{#…}`; null = keiner. */
  anker: string | null
  vorhaben: string[]
}

/** Liest die Eintraege einer Verlaufsdatei: `## JJJJ-MM-TT — Titel {#anker}`, darin `**Vorhaben:** [[…]]`. */
export function leseVerlaufEintraege(body: string): VerlaufEintrag[] {
  const eintraege: VerlaufEintrag[] = []
  let aktuell: VerlaufEintrag | null = null
  for (const zeile of body.split(/\r?\n/)) {
    const kopf = zeile.match(/^## ((\d{4}-\d{2}-\d{2})\b.*?)(?:\s*\{#([^}\s]+)\})?\s*$/)
    if (kopf) {
      aktuell = { datum: kopf[2], titel: kopf[1].trim(), anker: kopf[3] ?? null, vorhaben: [] }
      eintraege.push(aktuell)
      continue
    }
    if (/^#{1,2} /.test(zeile)) {
      aktuell = null
      continue
    }
    if (aktuell && zeile.includes('**Vorhaben:**')) {
      for (const link of zeile.matchAll(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g)) aktuell.vorhaben.push(link[1].trim())
    }
  }
  return eintraege
}

function verweistAuf(berichtBody: string, eintrag: VerlaufEintrag): boolean {
  if (eintrag.anker !== null && berichtBody.includes(`#${eintrag.anker}`)) return true
  return berichtBody.includes(`#${eintrag.titel}`)
}

/** C3: EIN Sammelbefund je Bericht, der Eintraege nennt, die ihn betreffen und die er nicht kennt. */
export function checkEntwicklungUnberichtet(args: {
  folders: readonly ArchiveFolderNode[]
  begleit: ReadonlyMap<string, readonly ArchiveDocEntry[]>
}): CoverageGap[] {
  const verlaeufe = new Map<string, ArchiveDocEntry>()
  for (const docs of args.begleit.values()) {
    for (const doc of docs) if (begleitTyp(doc) === 'verlauf') verlaeufe.set(doc.fileId, doc)
  }
  if (verlaeufe.size === 0) return []

  const gaps: CoverageGap[] = []
  for (const folder of args.folders) {
    const bericht = folder.bericht
    if (bericht === null || folder.name === '') continue
    const berichtTag = bericht.modifiedAt === null ? null : bericht.modifiedAt.slice(0, 10)
    const funde: string[] = []
    for (const verlauf of [...verlaeufe.values()].sort((a, b) => a.path.localeCompare(b.path))) {
      for (const eintrag of leseVerlaufEintraege(verlauf.body)) {
        if (!eintrag.vorhaben.includes(folder.name)) continue
        if (berichtTag !== null && berichtTag >= eintrag.datum) continue
        if (verweistAuf(bericht.body, eintrag)) continue
        funde.push(`„${eintrag.titel}"${eintrag.anker ? ` (#${eintrag.anker})` : ''} in ${verlauf.path}`)
      }
    }
    if (funde.length === 0) continue
    gaps.push(
      createGap({
        type: 'entwicklung_unberichtet',
        scope: 'folder',
        folderId: folder.folderId,
        path: folder.path,
        targetId: bericht.fileId,
        targetName: BERICHT_FILE_NAME,
        message: `${String(funde.length)} Verlaufseintrag/-eintraege nennen dieses Vorhaben — der Bericht ist aelter und verweist nicht darauf`,
        detail: funde.join(' | '),
      }),
    )
  }
  return gaps
}
