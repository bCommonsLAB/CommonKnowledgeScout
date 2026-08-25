/**
 * @fileoverview Baum bis zum Artefakt (Welle A2) — pur.
 *
 * @description
 * Vier Ebenen: Bereich → Vorhaben → Ordner → Artefakt (Entscheidung 1,
 * 24.08.2026). Diese Datei liefert das Zeilenmodell UNTER einem
 * aufgeklappten Vorhaben (Ordner- und Artefakt-Zeilen fuer die
 * virtualisierte Liste) und die geteilten Pruef-Praedikate: „geprueft" ist
 * ein Artefakt mit `verification: 'mensch'`, eine Familie erst, wenn ALLE
 * vorhandenen pruefbaren Artefakte (Transkript + Zusammenfassung) geprueft
 * sind. Zaehlerform `n/m` je Ebene (Entscheidung 2).
 *
 * Ordner ohne Familie im Teilbaum erscheinen nicht — die Werkbank prueft
 * Artefakte, leere Ordner tragen nichts Pruefbares. Reports aus Scans vor
 * A2/W4 werden benannt, nie geraten (`no-silent-fallbacks.mdc`).
 *
 * Reine Funktionen, kein I/O.
 *
 * @module agent-view
 */

import type { CoverageTreeNode, LeadingArtifactSummary, TwinFamilySummary } from './types'

/** Ein Artefakt gilt als geprueft mit MENSCHLICHER, gueltiger Verifikation. */
export function artefaktGeprueft(artefakt: LeadingArtifactSummary): boolean {
  return artefakt.verification === 'mensch'
}

export type FamilienPruefstand = 'geprueft' | 'offen' | 'unbekannt'

/**
 * Pruefstand einer Familie: `unbekannt` = Report aus einem Scan vor A2
 * (Felder fehlen); `geprueft` = mindestens ein pruefbares Artefakt vorhanden
 * und ALLE vorhandenen geprueft; sonst `offen` — auch die Familie ganz ohne
 * pruefbares Artefakt bleibt offen (dort fehlt das Artefakt, nicht die Pruefung).
 */
export function familienPruefstand(familie: TwinFamilySummary): FamilienPruefstand {
  if (familie.transkript === undefined || familie.zusammenfassung === undefined) return 'unbekannt'
  const vorhanden = [familie.transkript, familie.zusammenfassung].filter(
    (artefakt): artefakt is LeadingArtifactSummary => artefakt !== null,
  )
  if (vorhanden.length === 0) return 'offen'
  return vorhanden.every(artefaktGeprueft) ? 'geprueft' : 'offen'
}

/** Schluessel eines Artefakts fuer Kurations-Overrides (eine Familie hat mehrere). */
export function artefaktKey(sourceId: string, artefakt: Pick<LeadingArtifactSummary, 'kind' | 'templateName' | 'targetLanguage'>): string {
  return `${sourceId}|${artefakt.kind}|${artefakt.templateName ?? ''}|${artefakt.targetLanguage}`
}

/**
 * Familie mit uebergelagertem Kurationszustand (frische Verifikationen bis
 * zum naechsten Scan): Overrides sind je Artefakt-Key abgelegt.
 */
export function effektiveFamilie(
  familie: TwinFamilySummary,
  overrides: ReadonlyMap<string, LeadingArtifactSummary>,
): TwinFamilySummary {
  const ersetze = (artefakt: LeadingArtifactSummary | null | undefined) =>
    artefakt == null ? artefakt : overrides.get(artefaktKey(familie.sourceId, artefakt)) ?? artefakt
  return { ...familie, transkript: ersetze(familie.transkript), zusammenfassung: ersetze(familie.zusammenfassung) }
}

export interface PruefZaehler {
  geprueft: number
  gesamt: number
  /** Familien mit unbekanntem Stand (Scan vor A2) — sichtbar, nicht geraten. */
  unbekannt: number
}

/** Zaehler `n/m` ueber Familien (Vorhaben-, Ordner- und Kopf-Ebene teilen ihn). */
export function zaehlePruefstand(familien: readonly TwinFamilySummary[]): PruefZaehler {
  let geprueft = 0
  let unbekannt = 0
  for (const familie of familien) {
    const stand = familienPruefstand(familie)
    if (stand === 'geprueft') geprueft += 1
    else if (stand === 'unbekannt') unbekannt += 1
  }
  return { geprueft, gesamt: familien.length, unbekannt }
}

export interface BaumOrdnerZeile {
  art: 'ordner'
  node: CoverageTreeNode
  /** Einruecktiefe unterhalb des Vorhabens (1 = direktes Kind). */
  tiefe: number
  zaehler: PruefZaehler
  aufgeklappt: boolean
  zeilenKey: string
}

export interface BaumArtefaktZeile {
  art: 'baum-artefakt'
  familie: TwinFamilySummary
  /** Vorhaben, unter dem die Zeile steht — Auswahl setzt beide URL-Parameter. */
  vorhabenId: string
  tiefe: number
  zeilenKey: string
}

export interface BaumHinweisZeile {
  art: 'baum-hinweis'
  text: string
  zeilenKey: string
}

export type BaumZeile = BaumOrdnerZeile | BaumArtefaktZeile | BaumHinweisZeile

/** Familien je Ordner-Id — Zuordnung der Artefakte zu ihren Baum-Ordnern. */
function familienNachOrdner(familien: readonly TwinFamilySummary[]): Map<string, TwinFamilySummary[]> {
  const map = new Map<string, TwinFamilySummary[]>()
  for (const familie of familien) {
    const bucket = map.get(familie.folderId)
    if (bucket) bucket.push(familie)
    else map.set(familie.folderId, [familie])
  }
  return map
}

function familienImKnoten(node: CoverageTreeNode, nachOrdner: Map<string, TwinFamilySummary[]>): TwinFamilySummary[] {
  const eigene = nachOrdner.get(node.folderId) ?? []
  return [...eigene, ...node.children.flatMap((child) => familienImKnoten(child, nachOrdner))]
}

/**
 * Ordner NEUESTE ZUERST: die Ordnernamen beginnen mit Jahr/Monat
 * (`2026-04-02 Besprechung …`), darum ist absteigend alphabetisch zugleich
 * chronologisch rueckwaerts (Befund Testsession 25.08.2026). Dieselbe Regel
 * wie in der Vorhaben-Liste (`sortiereVorhaben`).
 *
 * Die Artefakte INNERHALB eines Ordners behalten die Report-Reihenfolge —
 * Dateinamen tragen kein Datum, dort brauchte die Umkehr niemand.
 */
export function neuesteZuerst(children: readonly CoverageTreeNode[]): CoverageTreeNode[] {
  return [...children].sort((a, b) => b.name.localeCompare(a.name))
}

/**
 * Zeilen UNTER einem aufgeklappten Vorhaben: erst dessen direkte Artefakte,
 * dann rekursiv die Ordner mit Familien im Teilbaum (zugeklappte Ordner
 * behalten die Zeile, lassen den Inhalt aus). Jeder Leerzustand ist benannt.
 */
export function baueTeilbaumZeilen(args: {
  vorhabenFolderId: string
  /** Baumknoten des Vorhabens; null = nicht im Baum des Reports. */
  knoten: CoverageTreeNode | null
  /** Familien des Teilbaums (via `familienImTeilbaum`, effektiv nach Overrides). */
  familien: readonly TwinFamilySummary[] | undefined
  /** Zugeklappte Ordner (folderIds) — Ordner starten aufgeklappt. */
  ordnerZu: ReadonlySet<string>
}): BaumZeile[] {
  const { vorhabenFolderId, knoten, familien, ordnerZu } = args
  if (familien === undefined) {
    return [{ art: 'baum-hinweis', text: 'Report aus einem Scan vor Welle 4 — Artefakte erscheinen nach „Neu scannen".', zeilenKey: `${vorhabenFolderId}::vor-w4` }]
  }
  if (familien.length === 0) {
    return [{ art: 'baum-hinweis', text: 'Keine Quelle mit Twin-Familie in diesem Teilbaum.', zeilenKey: `${vorhabenFolderId}::leer` }]
  }

  const nachOrdner = familienNachOrdner(familien)
  const zugeordnet = new Set<string>()
  const zeilen: BaumZeile[] = []

  const artefaktZeilen = (ordnerId: string, tiefe: number) => {
    for (const familie of nachOrdner.get(ordnerId) ?? []) {
      zugeordnet.add(familie.sourceId)
      zeilen.push({ art: 'baum-artefakt', familie, vorhabenId: vorhabenFolderId, tiefe, zeilenKey: `${vorhabenFolderId}::${familie.sourceId}` })
    }
  }

  const ordnerZeilen = (node: CoverageTreeNode, tiefe: number) => {
    for (const child of neuesteZuerst(node.children)) {
      const imTeilbaum = familienImKnoten(child, nachOrdner)
      if (imTeilbaum.length === 0) continue
      const aufgeklappt = !ordnerZu.has(child.folderId)
      zeilen.push({
        art: 'ordner', node: child, tiefe, zaehler: zaehlePruefstand(imTeilbaum),
        aufgeklappt, zeilenKey: `${vorhabenFolderId}::${child.folderId}`,
      })
      if (!aufgeklappt) {
        for (const familie of imTeilbaum) zugeordnet.add(familie.sourceId)
        continue
      }
      artefaktZeilen(child.folderId, tiefe + 1)
      ordnerZeilen(child, tiefe + 1)
    }
  }

  artefaktZeilen(vorhabenFolderId, 1)
  if (knoten !== null) ordnerZeilen(knoten, 1)

  // Familien, deren Ordner nicht im Baum steht (Teilbaum-Report, geloeschter
  // Ordner): sichtbar am Vorhaben statt still verschluckt.
  const uebrig = familien.filter((familie) => !zugeordnet.has(familie.sourceId))
  for (const familie of uebrig) {
    zeilen.push({ art: 'baum-artefakt', familie, vorhabenId: vorhabenFolderId, tiefe: 1, zeilenKey: `${vorhabenFolderId}::${familie.sourceId}` })
  }
  return zeilen
}
