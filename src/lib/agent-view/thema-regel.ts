/**
 * @fileoverview Regel `thema_fehlt` (Wunschliste 5, B3c) — pur.
 *
 * @description
 * Themen sind die Andockstellen nach aussen: Ueber sie erkennt ein Agent,
 * welches Vorhaben ein Fachartikel, ein Angebot oder ein Gespraech beruehrt.
 * Bis B3 konnte nur das VORHABEN welche tragen — `24.09 KnowledgeScout`
 * fuehrt `themen: [KS-Plattform]` fuer 53 Ereignisordner und anderthalb
 * Jahre Arbeit. Das Themenregister in `PROJEKTE.md` zeigt deshalb bis zum
 * Vorhaben, nie hinein, und ein Agent muss den ganzen Ordner lesen, um ein
 * Thema zu bearbeiten.
 *
 * Seit B3a kann jeder Ordner Themen tragen. Ohne diesen Befund bliebe die
 * Vergabe eine einmalige Fleissaufgabe, die beim naechsten neuen Ordner
 * sofort wieder verfaellt — also meldet der Scan Ereignisordner ohne Thema.
 *
 * Drei Tore, alle bewusst:
 *
 * - **Ab `bearbeitungsstand: erschlossen`.** Vorher weiss niemand, worum es
 *   in dem Ordner geht; ein Thema waere geraten. Nebeneffekt: Ordner ohne
 *   `_INDEX.md` erklaeren keinen Stand und schweigen — fuer sie ist
 *   `index_missing` zustaendig, und `themen_setzen` mit `indexAnlegen`
 *   erledigt beides in einem Zug.
 * - **Nur UNTERHALB eines Vorhabens** (Definition: `istVorhabensordner`).
 *   Das Vorhaben selbst fuehrt seine Themen im `BERICHT.md` (Konventionen
 *   §`themen`) und wird im Themenregister sowie im `ohneThema`-Zaehler der
 *   Kompaktsicht gezaehlt. Bereiche, `Organisation/` und alles ausserhalb
 *   eines Vorhabens sind keine Sachfragen und schweigen.
 * - **Nur mit gepflegtem Vokabular** (`agentView.themen`). Dieselbe Form wie
 *   die Postfach- und Repo-Schwelle: Wer keine Themen fuehrt, merkt nichts.
 *   Und ohne Vokabular wuerde `themen_setzen` (A1) jede Aufloesung des
 *   Befunds mit `neuesThemaErlauben` erzwingen — ein Befund, dessen
 *   Aufloesung im Werkzeug ansteht, ist kein Befund.
 *
 * Bekannte Grenze wie bei `sicht_veraltet`: Ein Teilbaum-Scan, dessen Wurzel
 * SELBST unterhalb des Vorhabens liegt, sieht kein Vorhaben und urteilt
 * darum nicht — geraten wird nicht. Der Vorhabens-Scan (der uebliche Weg)
 * sieht alles.
 *
 * Aufloesung ist immer dieselbe: `themen_setzen` auf den Ordner.
 *
 * @module agent-view
 */

import { INDEX_FILE_NAME } from './archive-scan'
import type { ArchiveFolderNode } from './archive-types'
import { isAtLeast } from './bearbeitungsstand'
import { createGap } from './gap-registry'
import { asList } from './sichten/bericht-lesen'
import type { Bearbeitungsstand, CoverageGap } from './types'

/** Ab diesem erklaerten Stand ist ein Ordner beschreibbar — vorher nicht. */
export const THEMA_AB_STAND: Bearbeitungsstand = 'erschlossen'

/**
 * Vorhaben im Sinne DIESER Regel: Der Name passt auf das Library-Muster
 * (`JJ.MM Name`) ODER der Ordner traegt einen `BERICHT.md` — den gibt es laut
 * Konventionen genau einen je Vorhaben.
 *
 * Bewusst NICHT `isVorhaben` aus `archive-rules.ts`: Dort zaehlt bereits
 * ein erklaerter `bearbeitungsstand` als Selbstdeklaration. Den traegt aber
 * laut Konventionen JEDER Ordner, auch das Ereignis („Der Stand steht im
 * _INDEX.md jedes Ordners") — mit jener Lesart waere jeder Ereignisordner sein
 * eigenes Vorhaben und die Regel bliebe stumm.
 */
export function istVorhabensordner(folder: ArchiveFolderNode, pattern: RegExp | null): boolean {
  if (folder.bericht !== null) return true
  if (pattern === null) return false
  return folder.name !== '' && pattern.test(folder.name)
}

export interface ThemaRegelArgs {
  folders: readonly ArchiveFolderNode[]
  /** Kompiliertes Vorhaben-Muster der Library; null = nur Selbstdeklaration. */
  vorhabenPattern: RegExp | null
  /** Fuehrt die Library ein Themen-Vokabular? Ohne eines ist die Regel inaktiv. */
  vokabularGepflegt: boolean
}

/**
 * Naechster Vorhabens-Vorfahre eines Ordners (ohne ihn selbst); null, wenn
 * die Kette im gescannten Satz keines erreicht.
 */
function vorhabenVorfahre(
  folder: ArchiveFolderNode,
  byId: ReadonlyMap<string, ArchiveFolderNode>,
  vorhaben: ReadonlySet<string>,
): ArchiveFolderNode | null {
  const besucht = new Set<string>([folder.folderId])
  let elternId = folder.parentFolderId
  while (elternId !== null && !besucht.has(elternId)) {
    besucht.add(elternId)
    const eltern = byId.get(elternId)
    if (eltern === undefined) return null
    if (vorhaben.has(eltern.folderId)) return eltern
    elternId = eltern.parentFolderId
  }
  return null
}

/** `thema_fehlt` je Ereignisordner, der erschlossen ist und kein Thema traegt. */
export function checkThemaFehlt(args: ThemaRegelArgs): CoverageGap[] {
  const { folders, vorhabenPattern, vokabularGepflegt } = args
  if (!vokabularGepflegt) return []

  const vorhaben = new Set(folders.filter((f) => istVorhabensordner(f, vorhabenPattern)).map((f) => f.folderId))
  if (vorhaben.size === 0) return []
  const byId = new Map(folders.map((f) => [f.folderId, f]))

  const gaps: CoverageGap[] = []
  for (const folder of folders) {
    if (vorhaben.has(folder.folderId)) continue
    if (!isAtLeast(folder.bearbeitungsstand, THEMA_AB_STAND)) continue
    // Ein erklaerter Stand kommt nur aus dem `_INDEX.md` (archive-scan) —
    // die Pruefung macht den Zusammenhang sichtbar statt ihn anzunehmen.
    const index = folder.index
    if (index === null) continue
    if (asList(index.meta.themen).length > 0) continue
    const eltern = vorhabenVorfahre(folder, byId, vorhaben)
    if (eltern === null) continue

    gaps.push(
      createGap({
        scope: 'folder',
        folderId: folder.folderId,
        path: folder.path,
        type: 'thema_fehlt',
        targetId: index.fileId,
        targetName: INDEX_FILE_NAME,
        message: 'Dieser Ordner traegt kein Thema — ueber das Themenregister ist er nicht auffindbar',
        detail:
          `bearbeitungsstand: ${folder.bearbeitungsstand ?? 'unbekannt'}; ` +
          `Vorhaben ${eltern.path === '' ? '(Scan-Wurzel)' : eltern.path}`,
      }),
    )
  }
  return gaps
}
