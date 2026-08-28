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
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary } from './tool-shared'

/** Feldliste je Vorlage begrenzen (Q2: Antwortgroessen sind begrenzt, immer). */
const MAX_FELDER = 40

/** Beschreibung eines benannten Frontmatter-Felds der Vorlage, falls vorhanden. */
function feldBeschreibung(vorlage: TemplateDocument, key: string): string | null {
  const feld = vorlage.metadata?.fields?.find((eintrag) => eintrag.key === key)
  const beschreibung = feld?.description?.trim()
  return beschreibung ? beschreibung : null
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
          })),
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
