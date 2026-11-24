/**
 * @fileoverview MCP-Werkzeug `seite_lesen` — eine Webseite woertlich lesen, ohne zu schreiben.
 *
 * @description
 * Der erste Schritt, bevor aus einer Seite Dokumente werden: Was steht dort,
 * und worauf verweist sie? Der Agent bekommt den Seitentext als Markdown
 * (Listen, Tabellen, Ueberschriften unveraendert) und jede Verknuepfung mit
 * Text, Adresse, Art und dem Block, in dem sie steht. Der Server laedt die
 * Seite — der Agent braucht dafuer weder Shell noch eigenen Netzzugang.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { leseSeite } from '@/lib/web-source/seite-lesen'
import type { LinkArt } from '@/lib/web-source/seite-links'
import { errorResult, jsonResult, mcpUserEmail } from './tool-shared'

const LINK_ARTEN = ['seite', 'pdf', 'dokument', 'medium', 'bild', 'mail'] as const
const VORGABE_ZEICHEN = 60_000
const VORGABE_LINKS = 300

export function registerSeiteLesenTool(server: McpServer): void {
  server.registerTool(
    'seite_lesen',
    {
      title: 'Webseite woertlich lesen (Text und Links)',
      description:
        'Laedt eine Webseite und gibt sie OHNE Sprachmodell zurueck: Titel und Metadaten (Open Graph, JSON-LD), den Seitentext ' +
        'woertlich als Markdown (Ueberschriften, Absaetze, Listen, Tabellen, Definitionslisten — nichts gefiltert, nichts ' +
        'zusammengefasst) und die Linkliste mit Text, Adresse, Art (seite | pdf | dokument | medium | bild | mail — nur aus der ' +
        'Endung gelesen), abschnitt (letzte Ueberschrift davor) und kontext (die Zeile, in der der Link steht). Gelesen wird der ' +
        'Inhaltsbereich (main, sonst das einzige article, sonst body ohne Navigation und Fuss); ganzeSeite nimmt alles. ' +
        'maxZeichen/offset blaettern im Markdown, linkArten/maxLinks begrenzen die Linkliste. Kein JavaScript: Baut die Seite ' +
        'ihren Inhalt erst im Browser auf, ist das Markdown leer und hinweise sagt es. Interne Adressen werden nicht abgerufen. Liest nur.',
      inputSchema: {
        url: z.string().url().describe('Adresse der Seite (http/https)'),
        ganzeSeite: z.boolean().optional().describe('true = ganzer body inkl. Navigation und Fuss; Vorgabe false'),
        maxZeichen: z.number().int().min(100).max(400_000).optional().describe(`Laenge des Markdown-Ausschnitts, Vorgabe ${VORGABE_ZEICHEN}`),
        offset: z.number().int().min(0).optional().describe('Zeichen-Offset im Markdown (naechsterOffset aus der vorigen Antwort)'),
        linkArten: z.array(z.enum(LINK_ARTEN)).min(1).optional().describe('Nur Links dieser Arten liefern, z. B. ["pdf","medium"]; weglassen = alle'),
        maxLinks: z.number().int().min(0).max(2000).optional().describe(`Hoechstzahl gelieferter Links, Vorgabe ${VORGABE_LINKS}; 0 = keine Linkliste`),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ url, ganzeSeite, maxZeichen, offset, linkArten, maxLinks }) => {
      try {
        mcpUserEmail()
        const seite = await leseSeite(url, { ganzeSeite: ganzeSeite === true })
        const ab = offset ?? 0
        if (ab > seite.markdown.length) throw new Error(`offset ${ab} liegt hinter dem Ende des Markdown (${seite.markdown.length} Zeichen)`)
        const bis = Math.min(seite.markdown.length, ab + (maxZeichen ?? VORGABE_ZEICHEN))
        const linksNachArt: Partial<Record<LinkArt, number>> = {}
        for (const l of seite.links) linksNachArt[l.art] = (linksNachArt[l.art] ?? 0) + 1
        const gewaehlt = linkArten ? seite.links.filter((l) => linkArten.includes(l.art)) : seite.links
        const grenze = maxLinks ?? VORGABE_LINKS
        return jsonResult({
          adresse: seite.adresse,
          endAdresse: seite.endAdresse,
          bereich: seite.bereich,
          titel: seite.meta.title,
          beschreibung: seite.meta.description,
          quelle: seite.meta.siteName,
          autor: seite.meta.author,
          datum: seite.meta.datePublished,
          sprache: seite.meta.language,
          bild: seite.meta.imageUrl,
          medien: seite.meta.media,
          markdown: seite.markdown.slice(ab, bis),
          zeichenGesamt: seite.markdown.length,
          gekuerzt: bis < seite.markdown.length,
          naechsterOffset: bis < seite.markdown.length ? bis : null,
          links: gewaehlt.slice(0, grenze),
          linksGesamt: seite.links.length,
          linksNachArt,
          linksGekuerzt: gewaehlt.length > grenze,
          hinweise: seite.hinweise,
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
