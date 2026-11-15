/**
 * @fileoverview MCP-Werkzeug `sitzung_abschliessen` (Plan sitzungen-register, Welle R4).
 *
 * @description
 * Ein Aufruf schliesst eine Arbeitssitzung ab: Beleg pruefen bzw. anlegen,
 * Register-Zeile anlegen oder ergaenzen (`alt:<Nr>` umschluesseln), Job
 * `chatverlauf-de` starten. Owner-Entscheide 15.11.: E7 — das Werkzeug
 * wartet nicht, die Antwort nennt die Folgeaufrufe fuer den Skill; E8 —
 * grosse Belege nur ueber den Dateiverweis (`belegPfad`/`belegSourceId`),
 * Text bis 100 kB. Ablauf: `abschluss-dienst.ts`, Anschluesse:
 * `sitzung-abschluss-ports.ts`. Nur `archivpflege`, mit Protokoll.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { schliesseSitzungAb } from '@/lib/agent-view/sitzungen-register/abschluss/abschluss-dienst'
import { leseAbschlussEingabe } from '@/lib/agent-view/sitzungen-register/abschluss/eingabe-lesen'
import { SITZUNGS_QUELLEN } from '@/lib/agent-view/sitzungen-register/types'
import { ARCHIVPFLEGE_HINWEIS, pruefeArchivpflege } from './archivpflege'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import { abschlussPorts } from './sitzung-abschluss-ports'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireProvider } from './tool-shared'

export function registerSitzungAbschliessenTool(server: McpServer): void {
  server.registerTool(
    'sitzung_abschliessen',
    {
      title: 'Sitzung abschliessen: Beleg, Register, Notiz-Job (SCHREIBT)',
      description:
        ARCHIVPFLEGE_HINWEIS +
        'Schliesst EINE Arbeitssitzung ab. Ort: genau einer von vorhabenPfad, vorhabenFolderId oder ohneVorhaben ' +
        '(= Organisation/Sitzungen). Beleg: genau einer von belegText+belegName (bis 100 kB; Name JJJJ-MM-TT ' +
        'Code|Chat <Titel>.md, lose im Ort), belegPfad oder belegSourceId (Hauptweg fuer grosse Belege: die Datei ' +
        'liegt schon im Speicher). Prueft VOR dem Schreiben: Kopf type chatverlauf, session_id = sitzungId, ' +
        'zugbereich = zuege_von_bis, Beleg liegt im Ort, Register nimmt die Zeile an (nrAlt: alt:<Nr> wird ' +
        'umgeschluesselt). Dann: Text anlegen bzw. bei gleicher Kennung ersetzen (andere Kennung = Fehler), ' +
        'Register-Zeile melden und Beleg anhaengen, Job chatverlauf-de starten (ohne ingest; ersetzter Beleg ' +
        'erzwingt). Antwort: beleg mit bytes und sha256 (Byte-Vergleich beim Aufrufer), register, transformation ' +
        '(jobId | abgesagt | fehler), stand, folgeaufrufe — der Aufrufer ruft sie nach job_status completed ' +
        '(Block je Vorhaben, Chronik). Fehler tragen einen code (z. B. beleg_nicht_gefunden: noch nicht ' +
        'synchronisiert, kein Warten). SCHREIBT; nur nach Bestaetigung.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        sitzungId: z.string().trim().min(20).describe('Volle Sitzungs-Kennung (UUID bzw. session_…) — muss session_id im Beleg-Kopf sein'),
        quelle: z.enum(SITZUNGS_QUELLEN).describe('code_lokal | code_cloud | cowork | chat'),
        vorhabenPfad: z.string().trim().min(1).optional().describe('Hauptvorhaben, library-relativ'),
        vorhabenFolderId: z.string().trim().min(1).optional().describe('ALTERNATIVE: folderId des Hauptvorhabens'),
        ohneVorhaben: z.boolean().optional().describe('true = Beleg in Organisation/Sitzungen, kein Block'),
        belegText: z.string().optional().describe('Beleg als Text, nur bis 100 kB (E8); braucht belegName'),
        belegName: z.string().trim().min(1).optional().describe('Dateiname zu belegText: JJJJ-MM-TT Code|Chat <Titel>.md'),
        belegPfad: z.string().trim().min(1).optional().describe('ALTERNATIVE: library-relativer Pfad des abgelegten Belegs'),
        belegSourceId: z.string().trim().min(1).optional().describe('ALTERNATIVE: Storage-Id des abgelegten Belegs'),
        nrAlt: z.string().trim().min(1).optional().describe('Nummer der alten Arbeitsliste, z. B. B45: alt:B45 wird umgeschluesselt'),
        nebenvorhaben: z.array(z.string().trim().min(1)).max(10).optional().describe('Library-relative Pfade weiterer Vorhaben (Block auch dort)'),
        zugbereich: z.object({ von: z.number().int().min(1), bis: z.number().int().min(1) }).optional()
          .describe('Teil-Beleg einer getrennten Sitzung; muss zuege_von_bis entsprechen'),
        erzwingen: z.boolean().optional().describe('Weglassen = bei ersetztem Beleg erzwingen, sonst entscheidet der Server'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ begruendung, ...roh }) => {
      try {
        return await mitProtokoll(
          {
            werkzeug: 'sitzung_abschliessen', libraryId: roh.libraryId, akteur: mcpUserEmail(), begruendung,
            pfad: roh.belegPfad ?? roh.vorhabenPfad, folderId: roh.vorhabenFolderId, sourceId: roh.belegSourceId,
          },
          async () => {
            const userEmail = mcpUserEmail()
            const library = await requireLibrary(userEmail, roh.libraryId)
            pruefeArchivpflege(library, 'sitzung_abschliessen')
            const eingabe = leseAbschlussEingabe({ ...roh, libraryId: library.id })
            const provider = await requireProvider(userEmail, roh.libraryId)
            const ports = abschlussPorts({ library, userEmail, provider, jetzt: () => new Date().toISOString() })
            return jsonResult(await schliesseSitzungAb(eingabe, ports))
          },
        )
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
