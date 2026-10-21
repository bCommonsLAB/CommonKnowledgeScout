/**
 * @fileoverview MCP-Werkzeug `video_anmeldung_lesen` (Status der Cookie-Datei am Konto, Welle C3).
 *
 * @description
 * Liest nur: ob die Person eine Video-Anmeldung (cookies.txt fuer yt-dlp)
 * hinterlegt hat, fuer welche Domains, bis wann sie gilt. Nie der Inhalt.
 * Hinterlegen und Entfernen bleiben in der Oberflaeche (Einstellungen →
 * Mein Zugang), weil die Datei ein Sitzungsschluessel ist und nicht durch
 * einen Chat laufen soll.
 *
 * @module mcp
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { leseVideoAnmeldungStatus } from '@/lib/video-login/video-login-service'
import { errorResult, jsonResult, mcpUserEmail } from './tool-shared'

export const VIDEO_ANMELDUNG_PFAD = '/settings/account'

export function registerVideoAnmeldungTool(server: McpServer): void {
  server.registerTool(
    'video_anmeldung_lesen',
    {
      title: 'Video-Anmeldung des Kontos (Status)',
      description:
        'Nennt, ob am Konto eine Video-Anmeldung (cookies.txt fuer YouTube & Co.) hinterlegt ist, fuer welche Domains ' +
        'und bis wann sie gilt — nie den Inhalt. Die Anmeldung wird bei webseite_erschliessen und playlist_erschliessen ' +
        'automatisch mitgegeben; fehlt sie oder ist sie abgelaufen, weist YouTube den Abruf ab (Fehlerdeutung youtube_anmeldung). ' +
        'Hinterlegen nur in der Oberflaeche: Einstellungen → Mein Zugang. Liest nur.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        const status = await leseVideoAnmeldungStatus(mcpUserEmail())
        return jsonResult({
          ...status,
          hinweis: !status.hinterlegt
            ? `Keine Video-Anmeldung — YouTube-Abrufe von der Server-Adresse scheitern meist. Hinterlegen unter ${VIDEO_ANMELDUNG_PFAD} (cookies.txt aus dem Browser, eigenes YouTube-Konto).`
            : status.abgelaufen
              ? `Anmeldung abgelaufen (${status.laeuftAbAm}) — unter ${VIDEO_ANMELDUNG_PFAD} neu exportieren und hinterlegen.`
              : 'Anmeldung wird bei Medien-Aufrufen mitgegeben.',
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
