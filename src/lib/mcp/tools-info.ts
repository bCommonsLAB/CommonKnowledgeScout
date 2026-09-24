/**
 * @fileoverview Werkzeugsatz-Version der MCP-Bruecke + `bruecke_info` (A2).
 *
 * @description
 * Pilot-Befund A2: Die Desktop-App cached die Toolliste — nach
 * Schema-Aenderungen sieht der Agent alte Werkzeuge, bis der Mensch die
 * Erweiterung aus- und einschaltet. Serverseitig ist der Cache in unserem
 * statuslosen HTTP-Transport nicht invalidierbar (kein Push-Kanal) — aber
 * Drift wird ERKENNBAR: `bruecke_info` nennt Version und Soll-Toolliste des
 * Servers; sieht der Agent etwas anderes, bittet er den Menschen um den
 * Toggle, statt raetselhaft zu scheitern.
 *
 * REGEL: `TOOLSET_VERSION` bei JEDER Werkzeug-/Schema-Aenderung erhoehen
 * (sie erscheint auch als serverInfo.version im initialize-Handshake).
 *
 * @module mcp
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { jsonResult } from './tool-shared'

/** Version des Werkzeugsatzes — bei jeder Werkzeug-/Schema-Aenderung erhoehen. */
export const TOOLSET_VERSION = '2.31.0'

/** Soll-Liste der Werkzeuge (Reihenfolge = Registrierung in tools.ts). */
export const TOOL_NAMES = [
  'bibliotheken_auflisten',
  'abdeckung_lesen',
  'abdeckung_scannen',
  'twins_pruefen',
  'twins_synchronisieren',
  'familie_umziehen',
  'quelle_verwerfen',
  'ordner_erstellen',
  'ordner_umbenennen',
  // Welle ST2 — generische Storage-Schicht (alle Provider, nicht nur OneDrive).
  'ordner_listen',
  'pfad_aufloesen',
  'datei_lesen',
  'stat',
  'datei_schreiben',
  'datei_patchen',
  'datei_anlegen',
  'datei_binaer_lesen',
  'datei_binaer_anlegen',
  'ordner_anlegen',
  'verschieben',
  'loeschen',
  'speicher_info',
  'quelle_erschliessen',
  // K4 — Peters Korrekturauftraege (Rueckkanal Mensch → Agent).
  'korrekturen_lesen',
  'korrektur_melden',
  'vorlagen_auflisten',
  'transformation_starten',
  'job_status',
  'job_liste',
  'jobs_aufraeumen',
  'job_abbrechen',
  'sichten_regenerieren',
  'aenderungen_seit',
  'erschliessung_block_schreiben',
  'stand_setzen',
  'themen_setzen',
  'protokoll_lesen',
  'bruecke_info',
] as const

/**
 * Was sich mit dieser Version an BESTEHENDEN Werkzeugen geaendert hat. Die
 * Soll-Toolliste zeigt nur neue Namen; ein neuer Parameter oder ein neues
 * Antwortfeld bliebe sonst unsichtbar (Wunschliste 6 brachte kein neues
 * Werkzeug, aber vier Schema-Aenderungen).
 */
export const NEU_IN_VERSION: readonly string[] = [
  '2.31.0: bibliotheken_auflisten liefert je Library archivpflege (= Agentensicht aktiviert). stand_setzen, themen_setzen, erschliessung_block_schreiben und sichten_regenerieren sind bei archivpflege=false GESPERRT (Fehler statt _INDEX.md/BERICHT.md-Struktur in einer fremd gebauten Library); alle uebrigen Werkzeuge bleiben generisch nutzbar',
  '2.30.5: familie_umziehen/quelle_verwerfen: result.newSourceId, sourceIdChanged, vectorsRekeyed — auf pfadbasierten Providern (Nextcloud) aendert Umbenennen/Verschieben die Storage-Id; Twin-Dokument wird umgeschluesselt, der Schaufenster-Eintrag (docs/doc-meta) auf die neue Id umgeschrieben, Export laeuft mit der neuen Id. Bei Id-Wechsel steht die neue Id im hinweis',
  '2.30.4: transformation_starten: jobs[].hinweis, wenn am Twin schon eine ANDERE Vorlage haengt als die gestartete (ohne template gilt die Library-Vorgabe, nicht die Vorlage des Twins). job_abbrechen wirkt jetzt: ein beendeter Job schreibt weder Transformation noch Schaufenster-Eintrag und wird nicht mehr completed',
  '2.30.3: transformation_starten kennt erzwingen — automatisch bei juengerer Vorlage, juengerem Transkript oder nur anderer Vorlage am Twin (jobs[].erzwungen nennt den Grund); eine AKTUELLE Transformation wird ohne Job abgesagt statt still uebersprungen. job_status: Hinweis, wenn transform_template uebersprungen wurde, obwohl andere Schritte liefen',
  '2.30.2: transformation_starten nimmt Markdown-Quellen und Sammeldateien (kind: composite-transcript) OHNE Transkript — Job-Form wie im KS-UI; nicht aufloesbare _source_files kommen als Fehler mit Dateinamen vor dem Job-Start',
  '2.30.1: bericht_ueberholt liest kein Datum mehr aus Linkzielen ([[2026-09-08 … — Notiz]]); verweis_tot meldet im TEILBAUM-Scan nur noch Verweise, deren Ziel im Teilbaum liegen muesste — blosse Namen und Pfade nach aussen beurteilt der Voll-Scan',
  'datei_lesen: bereich {art: "gliederung"} — Ueberschriften mit Zeilenbereich, Bytes, offenen Punkten; kein Body',
  'datei_patchen/datei_schreiben/datei_anlegen: bei BERICHT.md groesseNachher, schwelle, schwelleUeberschritten (+ hinweis bei neuem ##-Abschnitt)',
  'abdeckung_lesen: Block "berichte" (berichtBytes je Vorhaben); conventions um berichtMaxBytes, statusMaxZeilen, ueberholtNachTagen',
  'neue Befunde: bericht_zu_lang, status_zu_lang, bericht_ueberholt, verlauf_fehlt, entwicklung_unberichtet',
]

/** Registriert `bruecke_info` (siehe Datei-Kommentar). */
export function registerInfoTool(server: McpServer): void {
  server.registerTool(
    'bruecke_info',
    {
      title: 'Bruecken-Version + Soll-Toolliste',
      description:
        'Nennt Werkzeugsatz-Version und Soll-Toolliste des Servers. Weicht die eigene Sicht ab ' +
        '(fehlende/andere Werkzeuge), ist die Toolliste der Desktop-App veraltet — den Menschen ' +
        'bitten, die Erweiterung aus- und wieder einzuschalten. Liest nur.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      return jsonResult({
        toolsetVersion: TOOLSET_VERSION,
        werkzeuge: TOOL_NAMES,
        neuInDieserVersion: NEU_IN_VERSION,
        hinweis:
          'Fehlt hier gelistetes Werkzeug in deiner Sicht: Toolliste der Desktop-App ist veraltet — ' +
          'Erweiterung aus-/einschalten (Einstellungen → Erweiterungen).',
      })
    },
  )
}
