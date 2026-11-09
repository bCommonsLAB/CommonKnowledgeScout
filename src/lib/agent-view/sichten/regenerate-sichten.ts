/**
 * @fileoverview Service: AKTUELL.md, PROJEKTE.md und SITZUNGEN.md erzeugen und exportieren (W1, S1).
 *
 * @description
 * Der Berichte-Lauf (Entscheid Peter 2026-08-22): ein tiefenbegrenzter
 * Archiv-Scan (Tiefe ≤ 3 — Bereich/Projekt bzw. Bereich/Jahrgang/Projekt, wie
 * `projekte.py`) liest alle `BERICHT.md` frisch, die Renderer bauen die
 * Sichten, der Export schreibt sie nach `Organisation/`. KnowledgeScout ist
 * damit der EINE Ausfuehrungsort (Cowork orchestriert, Python-Skripte sind
 * nur noch Referenz). S1 (Plan sitzungen-sichten-und-befunde): die Chronik
 * `SITZUNGEN.md` kommt aus den Transformationen der Vorlage `chatverlauf-de`
 * in MongoDB; derselbe Scan liefert die Vorhabensordner der Belege.
 *
 * Fehlt der Ordner `Organisation`, ist das ein Fehler — nicht still anderswo hin.
 *
 * @module agent-view/sichten
 */

import { compileVorhabenPattern } from '../archive-rules'
import { scanArchive } from '../archive-scan'
import type { ArchiveFolderNode } from '../archive-types'
import { effectiveScanExcludeGlobs } from '@/lib/shadow-twin/sync-engine/scan-exclude'
import type { StorageProvider } from '@/lib/storage/types'
import { ersetzeTextDatei } from '@/lib/storage/update-text-file'
import type { Library } from '@/types/library'
import { renderAktuell } from './aktuell-render'
import { sammleProjekte, zaehleProjektordner } from './bericht-lesen'
import { renderProjekte } from './projekte-render'
import type { BelegKoepfeStatistik } from './sitzungen-beleg-kopf'
import { ladeSitzungen } from './sitzungen-laden'
import { renderSitzungen } from './sitzungen-render'
import { ALLE_SICHTEN, SITZUNGEN_FILE_NAME, type SichtName } from './sitzungen-types'
import { AKTUELL_FILE_NAME, PROJEKTE_FILE_NAME, SICHTEN_ORDNER, type ProjektDatensatz } from './types'

// Die Namen wohnen in `./types` (ohne Storage-Importe), damit die Regel
// `sicht_veraltet` sie ziehen kann; hier weiter exportiert fuer bestehende Aufrufer.
export { SICHTEN_ORDNER, AKTUELL_FILE_NAME, PROJEKTE_FILE_NAME } from './types'
/** Berichte liegen auf Ebene 2-3 (projekte.py MAX_TIEFE); tiefer sind Ereignisordner. */
export const BERICHTE_MAX_DEPTH = 3
/** Parallele Listings: 369 Ordner seriell = 80 s, mit 6 parallel 54 s (zu knapp am 60-s-Limit), mit 10 deutlich darunter. */
export const BERICHTE_SCAN_CONCURRENCY = 10

export interface SitzungenErgebnis {
  sitzungen: number
  vorhaben: number
  ohneVorhaben: number
  /** Querverweise aus `vorhaben:` der Belege (S1b). */
  querverweise: number
  uebersprungen: Array<{ beleg: string; grund: string }>
  hinweise: string[]
  /** Beleg-Koepfe: frisch gelesen vs. aus dem Merker am Twin. */
  belegKoepfe: BelegKoepfeStatistik
}

export interface SichtenErgebnis {
  /** Welche Sichten dieser Lauf gerendert (und ggf. geschrieben) hat. */
  sichten: SichtName[]
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
  /** Nur wenn `sitzungen` angefordert war. */
  sitzungen?: SitzungenErgebnis
  /** Leer bei nurVorschau. */
  geschrieben: Array<{ name: string; fileId: string }>
  /** Nur bei nurVorschau: die gerenderten Sichten. */
  vorschau?: Partial<Record<SichtName, string>>
}

/**
 * Datei im Zielordner ersetzen. Welle ST1: Existiert die Datei, wird sie an
 * Ort und Stelle geschrieben (`ersetzeTextDatei`) — sie behaelt ihre itemId,
 * und es gibt keinen Moment ohne `AKTUELL.md`. Nur der erste Lauf legt ueber
 * `uploadFile` an.
 */
async function ueberschreiben(
  provider: StorageProvider,
  organisation: ArchiveFolderNode,
  name: string,
  content: string,
): Promise<{ name: string; fileId: string }> {
  const existing = organisation.files.find((file) => file.name === name)
  if (existing) {
    const { fileId } = await ersetzeTextDatei({ provider, fileId: existing.fileId, inhalt: content })
    return { name, fileId }
  }
  const uploaded = await provider.uploadFile(
    organisation.folderId,
    new File([content], name, { type: 'text/markdown' }),
  )
  return { name, fileId: uploaded.id }
}

/** Berichte-Scan wie bisher; `sitzungen_block_schreiben` faehrt denselben ueber einen Teilbaum. */
export async function berichteScan(library: Library, provider: StorageProvider, rootFolderId: string) {
  const musterQuelle = library.config?.agentView?.vorhabenFolderPattern?.trim() || null
  // Unter einem Vorhaben liegen keine Vorhaben — der Lauf muss dort nicht absteigen (F2).
  const vorhabenMuster = compileVorhabenPattern(musterQuelle)
  const scan = await scanArchive({
    provider,
    rootFolderId,
    excludeGlobs: effectiveScanExcludeGlobs(library.config?.scanExcludeGlobs),
    maxDepth: BERICHTE_MAX_DEPTH,
    concurrency: BERICHTE_SCAN_CONCURRENCY,
    stopDescent: (node) => node.bericht !== null || (vorhabenMuster !== null && vorhabenMuster.test(node.name)),
    docs: 'nur-bericht',
  })
  return { scan, musterQuelle, vorhabenMuster }
}

export async function regenerateSichten(args: {
  library: Library
  provider: StorageProvider
  nurVorschau?: boolean
  sichten?: readonly SichtName[]
  now?: Date
}): Promise<SichtenErgebnis> {
  const { library, provider } = args
  const now = args.now ?? new Date()
  const sichten = [...(args.sichten ?? ALLE_SICHTEN)]
  if (sichten.length === 0) throw new Error('sichten darf nicht leer sein — weglassen erzeugt alle drei')
  const { scan, musterQuelle, vorhabenMuster } = await berichteScan(library, provider, 'root')
  const projekte: ProjektDatensatz[] = sammleProjekte(scan.folders)
  const ordnerzahl = zaehleProjektordner(scan.folders)
  const aktiv = projekte.filter((p) => p.status === 'aktiv')
  const gerendert: Partial<Record<SichtName, string>> = {}
  if (sichten.includes('aktuell')) gerendert.aktuell = renderAktuell(projekte, now)
  if (sichten.includes('projekte')) gerendert.projekte = renderProjekte(projekte, ordnerzahl, now)

  const ergebnis: SichtenErgebnis = {
    sichten,
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

  if (sichten.includes('sitzungen')) {
    const { zuordnung, belegKoepfe } = await ladeSitzungen({
      libraryId: library.id, provider, folders: scan.folders, vorhabenMuster, nurGescannte: false,
    })
    gerendert.sitzungen = renderSitzungen(zuordnung.sitzungen, now)
    const vorhabenIds = new Set<string>()
    for (const s of zuordnung.sitzungen) {
      if (s.vorhabenFolderId !== null) vorhabenIds.add(s.vorhabenFolderId)
      for (const v of s.weitereVorhaben) vorhabenIds.add(v.folderId)
    }
    ergebnis.sitzungen = {
      sitzungen: zuordnung.sitzungen.length,
      vorhaben: vorhabenIds.size,
      ohneVorhaben: zuordnung.sitzungen.filter((s) => s.vorhabenPfad === null).length,
      querverweise: zuordnung.sitzungen.reduce((n, s) => n + s.weitereVorhaben.length, 0),
      uebersprungen: zuordnung.uebersprungen,
      hinweise: zuordnung.hinweise,
      belegKoepfe,
    }
  }

  if (args.nurVorschau === true) return { ...ergebnis, vorschau: gerendert }

  const organisation = scan.folders.find((f) => f.depth === 1 && f.name === SICHTEN_ORDNER)
  if (!organisation) {
    throw new Error(
      `Zielordner „${SICHTEN_ORDNER}" fehlt auf der Library-Wurzel — Sichten werden nirgendwo anders abgelegt`,
    )
  }
  const dateiname: Record<SichtName, string> = { aktuell: AKTUELL_FILE_NAME, projekte: PROJEKTE_FILE_NAME, sitzungen: SITZUNGEN_FILE_NAME }
  for (const sicht of ALLE_SICHTEN) {
    const inhalt = gerendert[sicht]
    if (inhalt === undefined) continue
    ergebnis.geschrieben.push(await ueberschreiben(provider, organisation, dateiname[sicht], inhalt))
  }
  return ergebnis
}
