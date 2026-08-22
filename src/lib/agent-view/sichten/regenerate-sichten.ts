/**
 * @fileoverview Service: AKTUELL.md + PROJEKTE.md erzeugen und exportieren (W1).
 *
 * @description
 * Der Berichte-Lauf (Entscheid Peter 2026-08-22): ein tiefenbegrenzter
 * Archiv-Scan (Tiefe ≤ 3 — Bereich/Projekt bzw. Bereich/Jahrgang/Projekt, wie
 * `projekte.py`) liest alle `BERICHT.md` frisch, die Renderer bauen die zwei
 * Sichten, der Export schreibt sie nach `Organisation/`. KnowledgeScout ist
 * damit der EINE Ausfuehrungsort (Cowork orchestriert, Python-Skripte sind
 * nur noch Referenz).
 *
 * Ueberschreiben = Loeschen + Hochladen: OneDrive-Upload hat
 * `conflictBehavior: rename` und wuerde sonst „AKTUELL 1.md" erzeugen. Fehlt
 * der Ordner `Organisation`, ist das ein Fehler — nicht still anderswo hin.
 *
 * @module agent-view/sichten
 */

import { compileVorhabenPattern } from '../archive-rules'
import { scanArchive } from '../archive-scan'
import type { ArchiveFolderNode } from '../archive-types'
import { effectiveScanExcludeGlobs } from '@/lib/shadow-twin/sync-engine/scan-exclude'
import type { StorageProvider } from '@/lib/storage/types'
import type { Library } from '@/types/library'
import { renderAktuell } from './aktuell-render'
import { sammleProjekte, zaehleProjektordner } from './bericht-lesen'
import { renderProjekte } from './projekte-render'
import type { ProjektDatensatz } from './types'

export const SICHTEN_ORDNER = 'Organisation'
export const AKTUELL_FILE_NAME = 'AKTUELL.md'
export const PROJEKTE_FILE_NAME = 'PROJEKTE.md'
/** Berichte liegen auf Ebene 2-3 (projekte.py MAX_TIEFE); tiefer sind Ereignisordner. */
export const BERICHTE_MAX_DEPTH = 3
/** Parallele Listings: 369 Ordner seriell = 80 s, mit 6 parallel 54 s (zu knapp am 60-s-Limit), mit 10 deutlich darunter. */
export const BERICHTE_SCAN_CONCURRENCY = 10

export interface SichtenErgebnis {
  projekte: number
  aktiv: number
  ordnerzahl: number
  /** Naechste Termine der aktiven Vorhaben (Agent-Kurzblick). */
  termine: Array<{ termin: string; projekt: string; fixiert: boolean }>
  /** Vorhaben ohne Themen — PROJEKTE.md weist sie aus, hier als Arbeitsliste. */
  ohneThemen: string[]
  gescannteOrdner: number
  /** Ordner je Tiefe (0 = Wurzel) — zeigt, wo die Listings anfallen. */
  ordnerJeTiefe: Record<number, number>
  /** Null, wenn kein Vorhaben-Muster konfiguriert ist (dann liest der Lauf bis Tiefe 3). */
  vorhabenMuster: string | null
  scanFehler: string[]
  /** Leer bei nurVorschau. */
  geschrieben: Array<{ name: string; fileId: string }>
  /** Nur bei nurVorschau: die gerenderten Sichten. */
  vorschau?: { aktuell: string; projekte: string }
}

/** Datei im Zielordner ersetzen (loeschen + hochladen, siehe Datei-Kommentar). */
async function ueberschreiben(
  provider: StorageProvider,
  organisation: ArchiveFolderNode,
  name: string,
  content: string,
): Promise<{ name: string; fileId: string }> {
  const existing = organisation.files.find((file) => file.name === name)
  if (existing) await provider.deleteItem(existing.fileId)
  const uploaded = await provider.uploadFile(
    organisation.folderId,
    new File([content], name, { type: 'text/markdown' }),
  )
  return { name, fileId: uploaded.id }
}

export async function regenerateSichten(args: {
  library: Library
  provider: StorageProvider
  nurVorschau?: boolean
  now?: Date
}): Promise<SichtenErgebnis> {
  const { library, provider } = args
  const now = args.now ?? new Date()
  // Vorhaben-Muster der Library (F2: Archiv-Konvention ist Konfiguration): Unter
  // einem Vorhaben liegen keine Vorhaben — der Lauf muss dort nicht absteigen.
  const musterQuelle = library.config?.agentView?.vorhabenFolderPattern?.trim() || null
  const vorhabenMuster = compileVorhabenPattern(musterQuelle)
  const scan = await scanArchive({
    provider,
    rootFolderId: 'root',
    excludeGlobs: effectiveScanExcludeGlobs(library.config?.scanExcludeGlobs),
    maxDepth: BERICHTE_MAX_DEPTH,
    concurrency: BERICHTE_SCAN_CONCURRENCY,
    stopDescent: (node) => node.bericht !== null || (vorhabenMuster !== null && vorhabenMuster.test(node.name)),
    docs: 'nur-bericht',
  })
  const projekte: ProjektDatensatz[] = sammleProjekte(scan.folders)
  const ordnerzahl = zaehleProjektordner(scan.folders)
  const aktuell = renderAktuell(projekte, now)
  const projekteMd = renderProjekte(projekte, ordnerzahl, now)
  const aktiv = projekte.filter((p) => p.status === 'aktiv')

  const ergebnis: SichtenErgebnis = {
    projekte: projekte.length,
    aktiv: aktiv.length,
    ordnerzahl,
    termine: aktiv
      .filter((p) => p.naechsterTermin !== null)
      .sort((a, b) => (a.naechsterTermin ?? '').localeCompare(b.naechsterTermin ?? ''))
      .map((p) => ({ termin: p.naechsterTermin ?? '', projekt: p.projekt, fixiert: p.terminFixiert })),
    ohneThemen: projekte.filter((p) => p.themen.length === 0).map((p) => p.projekt || p.ordner),
    gescannteOrdner: scan.folders.length,
    ordnerJeTiefe: scan.folders.reduce<Record<number, number>>((acc, f) => ({ ...acc, [f.depth]: (acc[f.depth] ?? 0) + 1 }), {}),
    vorhabenMuster: musterQuelle,
    scanFehler: scan.folders.filter((f) => f.error).map((f) => `${f.path || '(Wurzel)'}: ${f.error}`),
    geschrieben: [],
  }

  if (args.nurVorschau === true) {
    return { ...ergebnis, vorschau: { aktuell, projekte: projekteMd } }
  }

  const organisation = scan.folders.find((f) => f.depth === 1 && f.name === SICHTEN_ORDNER)
  if (!organisation) {
    throw new Error(
      `Zielordner „${SICHTEN_ORDNER}" fehlt auf der Library-Wurzel — Sichten werden nirgendwo anders abgelegt`,
    )
  }
  ergebnis.geschrieben.push(await ueberschreiben(provider, organisation, AKTUELL_FILE_NAME, aktuell))
  ergebnis.geschrieben.push(await ueberschreiben(provider, organisation, PROJEKTE_FILE_NAME, projekteMd))
  return ergebnis
}
