/**
 * @fileoverview MCP-Werkzeuge `vorlage_lesen` und `vorlage_schreiben` — eine Vorlage als Text.
 *
 * @description
 * Vorlagen leben je Library in MongoDB. `vorlagen_auflisten` zeigt nur
 * Feldnamen; wer die Form sehen oder aendern wollte, musste eine Datei in
 * `templates/` finden (oft die einer anderen Library) und sie ueber
 * `vorlage_uebernehmen` einspielen. Hier geht beides direkt: lesen als
 * Markdown (Frontmatter-Felder, Body, Systemprompt, creation-Block), schreiben
 * aus demselben Markdown.
 *
 * Geschrieben wird nur, was der Vorlagen-Parser fehlerfrei liest und dessen
 * Facetten-Platzhalter (`<<werte:…>>`, `<<legende:…>>`) im Schema der Library
 * aufloesbar sind. Eine vorhandene Vorlage wird nur mit `ueberschreiben: true`
 * ersetzt.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { formatiereBindungsFehler, gebundeneFacetten, pruefeFacettenPlatzhalter } from '@/lib/external-jobs/facetten-bindung'
import { ladeBindungsFacetten } from '@/lib/external-jobs/facetten-bindung-job'
import { leseFeldBindungen } from '@/lib/external-jobs/feld-bindungen'
import { parseTemplate } from '@/lib/templates/template-parser'
import { listTemplatesFromMongoDB, serializeTemplateToMarkdown } from '@/lib/templates/template-service-mongodb'
import type { TemplateDocument } from '@/lib/templates/template-types'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary, requireOwner } from './tool-shared'
import { schreibeVorlage } from './vorlage-uebernahme'

const NAME = z.string().min(1).max(120).regex(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/, 'Name: Buchstaben, Ziffern, - _ . (ohne Leerzeichen, ohne .md)')
const VORGABE_ZEICHEN = 60_000

function stand(vorlage: TemplateDocument): string | null {
  const wert: unknown = vorlage.updatedAt
  if (wert instanceof Date) return wert.toISOString()
  return typeof wert === 'string' && wert.trim() !== '' ? wert : null
}

async function eigeneVorlagen(libraryId: string, userEmail: string): Promise<TemplateDocument[]> {
  return (await listTemplatesFromMongoDB(libraryId, userEmail)).filter((v) => v.libraryId === libraryId)
}

export function registerVorlageTextTools(server: McpServer): void {
  server.registerTool(
    'vorlage_lesen',
    {
      title: 'Vorlage als Text lesen',
      description:
        'Gibt EINE Vorlage der Library als Markdown zurueck, so wie sie in templates/ als Datei stuende: Frontmatter-Felder ' +
        '({{feld|beschreibung}}), Body, Systemprompt, creation-Block. Dazu stand, felder und gebundeneFacetten (Felder, die ' +
        'per <<werte:…>>/<<legende:…>> an das Facetten-Woerterbuch gebunden sind). maxZeichen/offset blaettern. Derselbe Text ' +
        'geht — geaendert — an vorlage_schreiben. Namen aus vorlagen_auflisten. Liest nur.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        name: z.string().min(1).describe('Name der Vorlage (aus vorlagen_auflisten), Gross/Klein egal'),
        maxZeichen: z.number().int().min(100).max(400_000).optional().describe(`Vorgabe ${VORGABE_ZEICHEN}`),
        offset: z.number().int().min(0).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId, name, maxZeichen, offset }) => {
      try {
        const userEmail = mcpUserEmail()
        await requireLibrary(userEmail, libraryId)
        const vorlagen = await eigeneVorlagen(libraryId, userEmail)
        const vorlage = vorlagen.find((v) => v.name.toLowerCase() === name.toLowerCase())
        if (!vorlage) throw new Error(`Vorlage "${name}" gibt es in dieser Library nicht — vorhanden: ${vorlagen.map((v) => v.name).join(', ') || '(keine)'}`)
        const text = serializeTemplateToMarkdown(vorlage, true)
        const ab = offset ?? 0
        if (ab > text.length) throw new Error(`offset ${ab} liegt hinter dem Ende (${text.length} Zeichen)`)
        const bis = Math.min(text.length, ab + (maxZeichen ?? VORGABE_ZEICHEN))
        return jsonResult({
          name: vorlage.name,
          stand: stand(vorlage),
          felder: vorlage.metadata?.fields?.length ?? 0,
          gebundeneFacetten: gebundeneFacetten(text),
          inhalt: text.slice(ab, bis),
          zeichenGesamt: text.length,
          gekuerzt: bis < text.length,
          naechsterOffset: bis < text.length ? bis : null,
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    'vorlage_schreiben',
    {
      title: 'Vorlage aus Text anlegen oder ersetzen (SCHREIBT)',
      description:
        'Schreibt EINE Vorlage der Library aus Markdown (Form wie vorlage_lesen: Frontmatter mit {{feld|beschreibung}}, Body, ' +
        '„--- systemprompt"). Der Vorlagen-Parser muss sie fehlerfrei lesen; Facetten-Platzhalter <<werte:metaKey>> und ' +
        '<<legende:metaKey>> muessen im Facetten-Schema der Library aufloesbar sein (sie binden das Feld: Werte ausserhalb des ' +
        'Woerterbuchs werden bei der Transformation verworfen und als Befund gemeldet). In Feldbeschreibungen ausserdem: ' +
        '<<max:N>> (Liste, hinten gekuerzt + Befund), <<maxWoerter:N>> (Text, Befund) und berechnete Felder, deren Beschreibung mit = ' +
        'beginnt: =quellen("muster"), =zeilen("abschnitt", "text"), =quellenarten(wert: "muster"; …). Vorhandene Vorlage nur mit ' +
        'ueberschreiben: true — immer der GANZE Text, kein Teil-Update; vorher vorlage_lesen. Nur der Owner. Bestehende ' +
        'Transformationen aendern sich nicht, erst ein neuer Lauf. Nur nach Bestaetigung durch den Menschen.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        name: NAME.describe('Name der Vorlage, z. B. "session-de"'),
        inhalt: z.string().min(10).max(400_000).describe('Die ganze Vorlage als Markdown'),
        ueberschreiben: z.boolean().optional().describe('vorhandene Vorlage ersetzen; Vorgabe false'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false },
    },
    async ({ libraryId, name, inhalt, ueberschreiben, begruendung }) => {
      try {
        return await mitProtokoll({ werkzeug: 'vorlage_schreiben', libraryId, akteur: mcpUserEmail(), begruendung, pfad: name }, async () => {
          const userEmail = mcpUserEmail()
          await requireOwner(userEmail, libraryId)
          const { template, errors } = parseTemplate(inhalt, name)
          if (errors.length > 0) throw new Error(`Vorlage "${name}" laesst sich nicht lesen: ${errors.map((e) => e.message).join('; ')} — nichts geschrieben`)
          if ((template.metadata?.fields?.length ?? 0) === 0) throw new Error(`Vorlage "${name}" traegt kein Frontmatter-Feld — nichts geschrieben`)
          const fehler = pruefeFacettenPlatzhalter(inhalt, await ladeBindungsFacetten(userEmail, libraryId))
          if (fehler.length > 0) throw new Error(`Facetten-Platzhalter nicht auflösbar — ${formatiereBindungsFehler(fehler)}. Nichts geschrieben`)
          // Obergrenzen und Berechnungen: ein Schreibfehler faellt hier auf, nicht erst im ersten bezahlten Job.
          let feldBindungen
          try {
            feldBindungen = leseFeldBindungen(inhalt)
          } catch (bindungsFehler) {
            throw new Error(`${bindungsFehler instanceof Error ? bindungsFehler.message : String(bindungsFehler)}. Nichts geschrieben`)
          }
          const zielBestand = await eigeneVorlagen(libraryId, userEmail)
          const aktion = await schreibeVorlage({
            inhalt: { name, metadata: template.metadata, systemprompt: template.systemprompt, markdownBody: template.markdownBody, creation: template.creation },
            zielLibraryId: libraryId, userEmail, ueberschreiben: ueberschreiben === true, zielBestand,
          })
          return jsonResult({
            name, aktion, felder: template.metadata.fields.length, gebundeneFacetten: gebundeneFacetten(inhalt),
            feldBindungen: feldBindungen.map((b) => ({ feld: b.feld, ...(b.max !== undefined ? { max: b.max } : {}), ...(b.maxWoerter !== undefined ? { maxWoerter: b.maxWoerter } : {}), ...(b.berechnet ? { berechnet: b.berechnet.art } : {}) })),
            hinweis: 'Bestehende Transformationen bleiben, wie sie sind — neu transformieren, wo die Aenderung wirken soll.',
          })
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
