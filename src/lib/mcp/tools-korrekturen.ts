/**
 * @fileoverview MCP-Werkzeuge fuer Peters Korrekturauftraege (K4).
 *
 * @description
 * Der Rueckkanal Mensch → Agent. Peter geht die Werkbank am Handy durch und
 * diktiert, was mit einer Datei geschehen soll; hier holt Cowork die Auftraege
 * ab und meldet Vollzug.
 *
 * `korrekturen_lesen` hat ZWEI Verdichtungsgrade an EINEM Werkzeug — das loest
 * den Zielkonflikt „ich will nicht jedes Verzeichnis einzeln pruefen" gegen
 * „ich will beim Aufraeumen von 25.11 nichts aus 26.02 mitgeschleppt bekommen":
 * ohne `ordner` eine verdichtete Uebersicht je Ordner (zum Entscheiden), mit
 * `ordner` die Volltexte dieses Teilbaums (zum Arbeiten).
 *
 * Beides OHNE Scan: Die Auftraege stehen im Frontmatter der Twins, also in
 * MongoDB — der Unterschied zum abgeleiteten Coverage-Report. Pfade werden nur
 * fuer die TREFFER aufgeloest, nie fuer die ganze Library.
 *
 * @module mcp
 */

import { z } from 'zod'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  sammleKorrekturen,
  verdichteNachOrdner,
  type KorrekturMitPfad,
} from '@/lib/agent-view/korrekturen'
import { isInSubtree } from '@/lib/agent-view/teilbaum'
import { findKorrekturKandidaten } from '@/lib/repositories/shadow-twin-repo'
import { applyCurationPatch } from '@/lib/shadow-twin/curation-patch'
import type { StorageProvider } from '@/lib/storage/types'
import { normalisiere } from './storage/adressierung'
import {
  FOLDER_ID,
  LIBRARY_ID,
  SCOPE_PFAD,
  errorResult,
  jsonResult,
  mcpUserEmail,
  requireLibrary,
  requireProvider,
  resolveScope,
} from './tool-shared'

/**
 * Loest die Ordnerpfade der Treffer auf — EIN Listing je eindeutigem Ordner,
 * nicht je Auftrag. Ein Ordner, der sich nicht aufloesen laesst, bekommt einen
 * leeren Pfad und wird in der Antwort benannt (kein geratener Ort).
 */
async function ergaenzePfade(
  provider: StorageProvider,
  auftraege: readonly ReturnType<typeof sammleKorrekturen>[number][],
): Promise<KorrekturMitPfad[]> {
  const pfade = new Map<string, string>()
  for (const parentId of new Set(auftraege.map((auftrag) => auftrag.parentId))) {
    try {
      pfade.set(parentId, normalisiere(await provider.getPathById(parentId)))
    } catch {
      pfade.set(parentId, '')
    }
  }
  return auftraege.map((auftrag) => ({ ...auftrag, ordnerPfad: pfade.get(auftrag.parentId) ?? '' }))
}

function registerLesenTool(server: McpServer): void {
  server.registerTool(
    'korrekturen_lesen',
    {
      title: 'Peters Korrekturauftraege lesen',
      description:
        'Was Peter an einzelnen Dateien korrigiert haben will — diktiert in der Werkbank, ' +
        'gespeichert im Frontmatter des Twins. OHNE Scan, weil die Auftraege in MongoDB stehen. ' +
        'ZWEI Betriebsarten: (a) OHNE ordner/pfad eine verdichtete UEBERSICHT je Ordner (Anzahl, ' +
        'aeltester Auftrag, Auszug) — damit entscheidest du, wo du anfaengst, ohne in jedes ' +
        'Verzeichnis zu schauen. (b) MIT ordner/pfad die ARBEITSLISTE dieses Teilbaums im ' +
        'Volltext, mit sourceId und Artefakt-Referenz. Beim Aufraeumen eines Ordners IMMER (b) ' +
        'als ERSTEN Schritt aufrufen: ein Auftrag loest meist Umbenennen oder Verschieben aus, ' +
        'und die gehoeren vor die Erschliessung. Liest nur.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        ordner: FOLDER_ID,
        pfad: SCOPE_PFAD,
      },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId, ordner, pfad }) => {
      try {
        const userEmail = mcpUserEmail()
        await requireLibrary(userEmail, libraryId)
        const kandidaten = await findKorrekturKandidaten(libraryId)
        const offene = sammleKorrekturen(kandidaten)
        if (offene.length === 0) {
          return jsonResult({
            modus: ordner || pfad ? 'arbeitsliste' : 'uebersicht',
            offen: 0,
            hinweis: 'Kein offener Korrekturauftrag in dieser Library.',
          })
        }

        const provider = await requireProvider(userEmail, libraryId)
        const mitPfad = await ergaenzePfade(provider, offene)
        const scopeId = await resolveScope({ userEmail, libraryId, folderId: ordner, pfad })

        if (scopeId === undefined) {
          const zeilen = verdichteNachOrdner(mitPfad)
          return jsonResult({
            modus: 'uebersicht',
            offen: mitPfad.length,
            ordner: zeilen,
            hinweis:
              'Verdichtet: je Ordner eine Zeile, die vollsten zuerst. Fuer die Volltexte denselben ' +
              'Aufruf mit ordner=<folderId> wiederholen — dann kommen nur die Auftraege dieses ' +
              'Teilbaums, ohne Fremdes aus anderen Vorhaben.',
          })
        }

        const scopePfad = normalisiere(await provider.getPathById(scopeId))
        const imScope = mitPfad.filter(
          (auftrag) =>
            auftrag.parentId === scopeId ||
            (auftrag.ordnerPfad !== '' && isInSubtree(auftrag.ordnerPfad, scopePfad)),
        )
        return jsonResult({
          modus: 'arbeitsliste',
          scope: { folderId: scopeId, pfad: scopePfad },
          offen: imScope.length,
          ausserhalb: mitPfad.length - imScope.length,
          auftraege: imScope,
          hinweis:
            'Reihenfolge: erst einordnen/umbenennen (familie_umziehen), dann bei Bedarf neu ' +
            'erschliessen. Den Korrekturhinweis fuer die Transformation formulierst DU aus dem ' +
            'Auftrag — der Auftragstext gehoert nicht roh in einen Prompt, er enthaelt Saetze ueber ' +
            'Ort und Namen. Danach je Auftrag korrektur_melden; zog eine Familie ueber eine ' +
            'Vorhabensgrenze, BEIDE Ordner scannen (Quell- und Zielordner).',
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}

function registerMeldenTool(server: McpServer): void {
  server.registerTool(
    'korrektur_melden',
    {
      title: 'Korrekturauftrag als erledigt melden (SCHREIBT)',
      description:
        'Meldet Vollzug fuer EINEN Korrekturauftrag: setzt `korrektur_erledigt_at` ueber denselben ' +
        'geschuetzten Kurations-Weg wie die Werkbank (Spiegel-Drift-Guard, Feld-Patch). Der ' +
        'Auftragstext BLEIBT stehen — er ist der Beleg, an dem Peter prueft. Der Befund ' +
        '`korrektur_offen` erlischt, die Werkbank zeigt „repariert, bitte ansehen"; aufgeloest wird ' +
        'die Sache erst durch Peters Verifizieren (Abnahme bleibt menschlich, ADR 0006). ' +
        'Artefakt-Referenz exakt aus korrekturen_lesen uebernehmen — ohne offenen Auftrag wird die ' +
        'Meldung abgelehnt statt still angenommen. Erst NACH getaner Arbeit aufrufen.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        sourceId: z.string().min(1).describe('Quelle des Auftrags (aus korrekturen_lesen)'),
        kind: z.enum(['transcript', 'transformation'])
          .describe('Artefakt-Art des Auftrags (aus korrekturen_lesen)'),
        templateName: z.string().min(1).optional()
          .describe('PFLICHT bei kind=transformation, verboten beim Transkript'),
        zielsprache: z.string().optional()
          .describe('PFLICHT bei kind=transformation; beim Transkript leer lassen'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ libraryId, sourceId, kind, templateName, zielsprache, begruendung }) => {
      try {
        return await mitProtokoll(
          { werkzeug: 'korrektur_melden', libraryId, akteur: mcpUserEmail(), begruendung, sourceId },
          async () => {
            const userEmail = mcpUserEmail()
            const library = await requireLibrary(userEmail, libraryId)
            const ergebnis = await applyCurationPatch({
              library,
              userEmail,
              sourceId,
              artifact: {
                kind,
                targetLanguage: zielsprache ?? '',
                templateName: kind === 'transformation' ? templateName : undefined,
              },
              verify: false,
              meldeKorrekturErledigt: true,
            })
            return jsonResult({
              gemeldet: ergebnis.curation,
              hinweis:
                'Der Befund korrektur_offen erlischt beim naechsten Scan. Peter sieht in der ' +
                'Werkbank „repariert, bitte ansehen" — erst sein Verifizieren raeumt den Auftrag weg.',
            })
          },
        )
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}

/** Registriert `korrekturen_lesen` und `korrektur_melden` (siehe Datei-Kommentar). */
export function registerKorrekturTools(server: McpServer): void {
  registerLesenTool(server)
  registerMeldenTool(server)
}
