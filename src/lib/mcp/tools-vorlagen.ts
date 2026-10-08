/**
 * @fileoverview MCP-Werkzeug: `vorlagen_auflisten` (Welle ST6).
 *
 * @description
 * Live-Befund 28.08.2026: Eine Sitzung liess fuenfzehn Vertrags- und
 * Vergabeunterlagen mit dem Library-Standard `standard-meeting`
 * transformieren. Alle vierzehn Template-Schritte scheiterten — Vertraege,
 * AGB und Anlagen sind keine Besprechungen.
 *
 * Der Agent hatte den Verdacht selbst angemeldet und konnte ihn trotzdem
 * nicht pruefen: `transformation_starten` NIMMT ein `template` (und kennt
 * sogar `nur_transkript`), aber kein Werkzeug sagte, WELCHE Vorlagen es
 * gibt. Die Wahl fiel auf den Standard, weil die Alternativen unsichtbar
 * waren — und das kostete fuenfzehn bezahlte Jobs.
 *
 * Dieses Werkzeug macht die Liste sichtbar, bevor jemand dafuer bezahlt.
 *
 * @module mcp
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { TemplateDocument } from '@/lib/templates/template-types'
import { listTemplatesFromMongoDB } from '@/lib/templates/template-service-mongodb'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from './tool-shared'

/**
 * Dateien in `templates/` der Library (Handover W2): Vorlagen leben in MongoDB,
 * eine Datei wirkt erst nach dem Import. Ohne diese Sicht liefen Datei
 * (05.10.) und Mongo (07.10.) unbemerkt auseinander. Legt den Ordner NICHT an.
 */
async function vorlagenDateien(userEmail: string, libraryId: string): Promise<Map<string, string> | { fehler: string }> {
  try {
    const provider = await requireProvider(userEmail, libraryId)
    const ordner = (await provider.listItemsById('root')).find((it) => it.type === 'folder' && it.metadata.name.toLowerCase() === 'templates')
    const dateien = new Map<string, string>()
    if (!ordner) return dateien
    for (const it of await provider.listItemsById(ordner.id)) {
      if (it.type !== 'file' || !it.metadata.name.toLowerCase().endsWith('.md')) continue
      const geaendert = it.metadata.modifiedAt instanceof Date ? it.metadata.modifiedAt.toISOString() : String(it.metadata.modifiedAt)
      dateien.set(it.metadata.name.replace(/\.md$/i, '').toLowerCase(), geaendert)
    }
    return dateien
  } catch (error) {
    return { fehler: error instanceof Error ? error.message : String(error) }
  }
}

/** Feldliste je Vorlage begrenzen (Q2: Antwortgroessen sind begrenzt, immer). */
const MAX_FELDER = 40

/** Beschreibung eines benannten Frontmatter-Felds der Vorlage, falls vorhanden. */
function feldBeschreibung(vorlage: TemplateDocument, key: string): string | null {
  const feld = vorlage.metadata?.fields?.find((eintrag) => eintrag.key === key)
  const beschreibung = feld?.description?.trim()
  return beschreibung ? beschreibung : null
}

/** `updatedAt` als ISO-Text — die Vorlage traegt ihn als Date oder schon als Text. */
function aktualisiertAmIso(vorlage: TemplateDocument): string | undefined {
  const wert: unknown = vorlage.updatedAt
  if (wert instanceof Date) return wert.toISOString()
  return typeof wert === 'string' && wert.trim() !== '' ? wert : undefined
}

/**
 * Wann wurde die benannte Vorlage zuletzt geaendert? Fuer die Frage, ob eine
 * vorhandene Transformation ueberholt ist (`transformation-erzwingen.ts`).
 * `undefined` = in MongoDB nicht gefunden. Das ist KEIN Fehler: Der Worker kennt
 * auch eingebaute Vorlagen (`template-files.ts`); ob der Name gilt, entscheidet
 * er. Der Aufrufer nennt den unbekannten Zeitpunkt in seiner Meldung beim Namen.
 * Namensvergleich ohne Gross/Klein — wie der Worker.
 */
export async function vorlageAktualisiertAm(
  libraryId: string,
  userEmail: string,
  template: string,
): Promise<string | undefined> {
  const vorlagen = await listTemplatesFromMongoDB(libraryId, userEmail)
  const vorlage = vorlagen.find((eintrag) => eintrag.name.toLowerCase() === template.toLowerCase())
  return vorlage ? aktualisiertAmIso(vorlage) : undefined
}

/** Registriert `vorlagen_auflisten`. */
export function registerVorlagenTool(server: McpServer): void {
  server.registerTool(
    'vorlagen_auflisten',
    {
      title: 'Transformations-Vorlagen der Library',
      description:
        'Listet die Vorlagen (Templates), die `transformation_starten` und `quelle_erschliessen` ' +
        'im Feld `template` annehmen — mit Name, docType und Beschreibung, damit die Wahl zum ' +
        'Dokument passt. VOR einem Stapel kostenpflichtiger Jobs aufrufen: Ein Vertrag mit einer ' +
        'Besprechungs-Vorlage zu transformieren scheitert, und der Fehlschlag kostet trotzdem. ' +
        'Nennt auch das Standard-Template der Library. Passt keine Vorlage, ist ' +
        '`template: "nur_transkript"` der ehrliche Weg — dann bleibt es beim Transkript. Liest nur.',
      inputSchema: { libraryId: LIBRARY_ID },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId }) => {
      try {
        const userEmail = mcpUserEmail()
        const library = await requireLibrary(userEmail, libraryId)
        const vorlagen = await listTemplatesFromMongoDB(libraryId, userEmail)
        const dateien = await vorlagenDateien(userEmail, libraryId)
        const dateiStand = (name: string): { geaendertAm: string; neuerAlsMongo: boolean | null } | null => {
          if (!(dateien instanceof Map)) return null
          const geaendertAm = dateien.get(name.toLowerCase())
          if (!geaendertAm) return null
          const mongo = aktualisiertAmIso(vorlagen.find((v) => v.name === name) as TemplateDocument)
          return { geaendertAm, neuerAlsMongo: mongo ? geaendertAm > mongo : null }
        }

        // Kein stiller Fallback: Ein leeres Ergebnis wird als solches benannt,
        // statt als „keine passende Vorlage" missverstanden zu werden.
        const standard = library.config?.secretaryService?.template?.trim() || null

        return jsonResult({
          standardTemplate: standard,
          anzahl: vorlagen.length,
          vorlagen: vorlagen.map((vorlage) => ({
            name: vorlage.name,
            // `docType` ist KEIN Feld auf `metadata`, sondern ein Eintrag in
            // `metadata.fields` — und seine `description` ist der Hinweis,
            // den das Template dem LLM gibt („Eine aus: report, other. Nutze
            // report fuer Besprechungsprotokolle …"). Genau der sagt einem
            // Agenten, wofuer die Vorlage gedacht ist.
            docTypeHinweis: feldBeschreibung(vorlage, 'docType'),
            beschreibung: vorlage.creation?.ui?.description ?? null,
            detailAnsicht: vorlage.metadata?.detailViewType ?? null,
            /** Welche Metadaten die Vorlage ueberhaupt extrahiert. */
            felder: (vorlage.metadata?.fields ?? []).map((feld) => feld.key).slice(0, MAX_FELDER),
            aktualisiertAm: vorlage.updatedAt instanceof Date
              ? vorlage.updatedAt.toISOString()
              : (vorlage.updatedAt ?? null),
            /** Gleichnamige Datei in templates/ — neuerAlsMongo: true heisst, die Datei wirkt noch nicht. */
            datei: dateiStand(vorlage.name),
          })),
          ...(dateien instanceof Map
            ? { nurAlsDatei: [...dateien.keys()].filter((n) => !vorlagen.some((v) => v.name.toLowerCase() === n)) }
            : { dateienFehler: dateien.fehler }),
          herkunft: 'Vorlagen leben je Library in MongoDB; eine Datei in templates/ wirkt erst nach vorlage_uebernehmen (datei).',
          hinweis: vorlagen.length === 0
            ? 'Diese Library hat KEINE Vorlagen — Transformationen koennen nur als "nur_transkript" laufen.'
            : 'Vorlage passend zum Dokument waehlen; passt keine, "nur_transkript" verwenden statt zu raten.',
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
