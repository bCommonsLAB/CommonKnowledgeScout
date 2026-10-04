/**
 * @fileoverview Werkzeug `transkript_korrigieren` (Wunschliste 7, B1).
 *
 * @description
 * Das enge Fachwerkzeug fuer Hoerfehler im Transkript. Die Korrektur-Ordnung
 * (Konventionen, Vier-Schritte-Takt Schritt 3) sieht Wortlautkorrekturen „immer
 * im Transkript" vor, aber `datei_patchen` sperrt den `_`-Ordner zu Recht, und
 * `twins_synchronisieren`/`transformation_starten` aendern keinen Wortlaut.
 * Hier ist der Weg: Body-Ersetzungen, Revisions-Stempel, MongoDB zuerst,
 * Spiegel versioniert nach. Schreiblogik in `transkript-korrektur-schreiben.ts`,
 * Ersetzungen in `transkript-korrektur.ts`.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import { storageFehler } from './storage/fehler'
import { LIBRARY_ID, jsonResult, mcpUserEmail, requireLibrary, requireProvider, type ToolResult } from './tool-shared'
import { resolveSourceItem } from './tools-erschliessen-shared'
import { ErsetzungNichtEindeutigError, ErsetzungNichtGefundenError } from './transkript-korrektur'
import { korrigiereTranskript } from './transkript-korrektur-schreiben'
import {
  KeinSpiegelError,
  KeinTranskriptError,
  TranskriptKonfliktError,
  type KorrekturErgebnis,
} from './transkript-korrektur-typen'

const ERSETZUNG_SCHEMA = z.object({
  alt: z.string().min(1).describe('Woertlicher Text im Transkript-Body — muss GENAU EINMAL vorkommen (ausser alle: true)'),
  neu: z.string().describe('Was an die Stelle tritt'),
  alle: z.boolean().optional().describe('true = jedes Vorkommen ersetzen (wiederkehrender Hoerfehler)'),
})

/** Fehlerantwort mit Code — die Werkzeug-eigenen Faelle zuerst, der Rest wie bei der Storage-Schicht. */
function korrekturFehler(fehler: unknown): ToolResult {
  const antwort = (wert: Record<string, unknown>): ToolResult => ({
    isError: true,
    content: [{ type: 'text', text: JSON.stringify(wert, null, 2) }],
  })
  if (fehler instanceof ErsetzungNichtGefundenError) {
    return antwort({ fehler: fehler.code, meldung: fehler.message, wiederholbar: false, ersetzung: fehler.ersetzung })
  }
  if (fehler instanceof ErsetzungNichtEindeutigError) {
    return antwort({
      fehler: fehler.code, meldung: fehler.message, wiederholbar: false,
      ersetzung: fehler.ersetzung, anzahl: fehler.anzahl, treffer: fehler.treffer,
    })
  }
  if (fehler instanceof KeinTranskriptError || fehler instanceof KeinSpiegelError) {
    return antwort({ fehler: fehler.code, meldung: fehler.message, wiederholbar: false })
  }
  if (fehler instanceof TranskriptKonfliktError) {
    // Wiederholbar, aber NICHT unveraendert: erst import/neu lesen, dann erneut.
    return antwort({ fehler: fehler.code, meldung: fehler.message, wiederholbar: true, ...fehler.details })
  }
  return storageFehler(fehler)
}

/** Was der Agent als Naechstes tun sollte — aus dem Ergebnis abgeleitet, nicht geraten. */
function hinweisZu(ergebnis: KorrekturErgebnis): string {
  const teile: string[] = []
  if (!ergebnis.geschrieben) {
    teile.push('VORSCHAU: nichts geschrieben, die Version bleibt gleich. Fuer den echten Lauf nurVorschau weglassen.')
  } else {
    teile.push('Transkript in MongoDB korrigiert und in den Spiegel exportiert; versionNachher ist das naechste ifVersion.')
  }
  if (ergebnis.transformationen.length > 0) {
    teile.push(
      `${ergebnis.transformationen.length} Transformation(en) geben das korrigierte Transkript nicht mehr wieder ` +
        '(Befund transformation_stale) — bei Bedarf transformation_starten; das kostet und wird hier nur empfohlen.',
    )
  }
  if (ergebnis.offeneKorrekturauftraege.length > 0) {
    teile.push(
      `Zu diesem Transkript ist ein Korrekturauftrag offen. Wenn die Ersetzungen ihn erledigen: ` +
        'korrektur_melden aufrufen — dieses Werkzeug meldet NICHT selbst.',
    )
  }
  return teile.join(' ')
}

export function registerTranskriptKorrigierenTool(server: McpServer): void {
  server.registerTool(
    'transkript_korrigieren',
    {
      title: 'Hoerfehler im Transkript korrigieren (SCHREIBT)',
      description:
        'Korrigiert den WORTLAUT eines Transkripts (Body) ueber Ersetzungen — der einzige Schreibweg in den ' +
        '"_"-Ordner fuer Wortlautfehler (Korrektur-Ordnung, Takt Schritt 3). Adressiert wird die QUELLE ' +
        '(sourceId oder pfad der Audio-/PDF-Datei), nicht der Twin. Jedes `alt` muss GENAU EINMAL vorkommen ' +
        '(sonst nicht_eindeutig mit allen Stellen), ausser alle: true. Alles oder nichts. Frontmatter: ' +
        'revised_by/revised_at/revision_note werden gesetzt, generated_by/generated_at bleiben. MongoDB ist ' +
        'fuehrend; weicht der Spiegel ab (Handkorrektur) oder ist ifVersion veraltet → konflikt, nichts ' +
        'geschrieben. Danach ist jede Transformation der Familie ueberholt (transformation_stale) — ' +
        'neu transformieren nur per transformation_starten (kostet). Ein offener Korrekturauftrag wird ' +
        'genannt, NICHT gemeldet (korrektur_melden). nurVorschau: true liefert nur den Diff. Keine ' +
        'Felder nachtragen — Kurations-Felder gehen weiter ueber korrektur_melden/Werkbank.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        sourceId: z.string().min(1).optional().describe('Storage-Id der QUELLE (z. B. der .m4a). Alternative zu pfad.'),
        pfad: z.string().min(1).optional().describe('Library-relativer Pfad der QUELLE, z. B. "Organisation/Todo Oktober-1.m4a". Alternative zu sourceId.'),
        ersetzungen: z.array(ERSETZUNG_SCHEMA).min(1).max(50).describe('Ersetzungen in Reihenfolge — alles oder nichts.'),
        ifVersion: z.string().min(1).describe('version des Transkript-Spiegels aus datei_lesen/stat — Pflicht'),
        begruendung: BEGRUENDUNG,
        nurVorschau: z.boolean().optional().describe('true = Diff liefern, nichts schreiben'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, sourceId, pfad, ersetzungen, ifVersion, begruendung, nurVorschau }) => {
      try {
        return await mitProtokoll(
          {
            werkzeug: 'transkript_korrigieren', libraryId, akteur: mcpUserEmail(), begruendung, sourceId, pfad,
            ...(nurVorschau ? { modus: 'vorschau' as const } : {}),
          },
          async () => {
            const userEmail = mcpUserEmail()
            const library = await requireLibrary(userEmail, libraryId)
            const provider = await requireProvider(userEmail, libraryId)
            const source = await resolveSourceItem(provider, sourceId, pfad)
            const ergebnis = await korrigiereTranskript({
              library, userEmail, provider, source, ersetzungen, ifVersion, begruendung,
              nurVorschau: nurVorschau === true,
            })
            return jsonResult({ ...ergebnis, hinweis: hinweisZu(ergebnis) })
          },
        )
      } catch (error) {
        return korrekturFehler(error)
      }
    },
  )
}
