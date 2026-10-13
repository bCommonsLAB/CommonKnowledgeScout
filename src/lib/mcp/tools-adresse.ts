/**
 * @fileoverview MCP-Werkzeug `adresse_setzen` (Wunschliste 8, Plan Abschnitt 6, G1).
 *
 * @description
 * Setzt den Adress-Slug einer Library — den Teil von `[[@<slug>/<pfad>]]`,
 * unter dem andere Dokumente auf ihren Inhalt verweisen. Ohne gesetzten Slug
 * gilt der veroeffentlichte, sonst einer aus dem Namen; der aus dem Namen ist
 * nicht stabil (Namensaenderung bricht Adressen). Deshalb dieses Werkzeug:
 *
 * - instanzweit eindeutig gegen gesetzte, fruehere und veroeffentlichte Slugs
 *   ALLER Libraries (`LibraryService.findeAdressSlugBelegung`);
 * - Merker: der bisher wirksame Slug wandert nach `frueher` (Owner-Entscheid 8
 *   des Plans), bestehende Adressen treffen weiter;
 * - der Veroeffentlichungs-Slug (`publicPublishing.slugName`) bleibt unberuehrt;
 * - nur Owner, mit Protokoll.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { bestimmeSlugs, pruefeSlug } from '@/lib/library-adresse/slug'
import { LibraryService } from '@/lib/services/library-service'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary } from './tool-shared'

export function registerAdresseTools(server: McpServer): void {
  server.registerTool(
    'adresse_setzen',
    {
      title: 'Adress-Slug einer Library setzen (SCHREIBT)',
      description:
        'Setzt den Slug, unter dem Dokumente mit [[@<slug>/<pfad>]] auf Inhalt dieser Library verweisen. ' +
        'Erlaubt: a-z, 0-9, Bindestrich, 1–64 Zeichen. Instanzweit eindeutig (gegen gesetzte, fruehere und ' +
        'veroeffentlichte Slugs aller Libraries). Der bisher wirksame Slug (gesetzt, veroeffentlicht oder aus dem ' +
        'Namen abgeleitet, siehe bibliotheken_auflisten) wird unter frueher gemerkt — bestehende Adressen treffen ' +
        'weiter. Der Veroeffentlichungs-Slug bleibt unberuehrt. Nur Owner. Nur nach Bestaetigung durch den Menschen.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        slug: z.string().min(1).max(64).describe('Neuer Adress-Slug, z. B. "klima-archiv"'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false },
    },
    async ({ libraryId, slug, begruendung }) => {
      try {
        return await mitProtokoll({ werkzeug: 'adresse_setzen', libraryId, akteur: mcpUserEmail(), begruendung }, async () => {
          const userEmail = mcpUserEmail()
          const service = LibraryService.getInstance()
          if (!(await service.isOwner(userEmail, libraryId))) throw new Error('Nur Owner koennen den Adress-Slug setzen')
          const neu = pruefeSlug(slug)
          const library = await requireLibrary(userEmail, libraryId)
          const eigene = bestimmeSlugs(await service.getUserLibraries(userEmail))
          const vorher = eigene.find((eintrag) => eintrag.libraryId === libraryId) ?? null

          if (library.config?.adresse?.slug === neu) {
            return jsonResult({ slug: neu, geaendert: false, frueher: library.config.adresse.frueher ?? [], hinweis: 'Dieser Slug ist bereits gesetzt' })
          }
          const belegt = (await service.findeAdressSlugBelegung(neu)).filter((lib) => lib.id !== libraryId)
          if (belegt.length > 0) {
            throw new Error(`Slug "${neu}" ist bereits belegt: ${belegt.map((lib) => `${lib.label} (${lib.id})`).join(', ')}`)
          }

          const wirksamVorher = vorher?.slug ?? null
          const frueher = [...new Set([
            ...(library.config?.adresse?.frueher ?? []),
            ...(wirksamVorher !== null ? [wirksamVorher] : []),
          ])].filter((alt) => alt !== neu)
          const ok = await service.updateLibrary(userEmail, {
            ...library,
            config: { ...library.config, adresse: { slug: neu, frueher } },
          })
          if (!ok) throw new Error('Library konnte nicht gespeichert werden')

          // Eine eigene Library mit demselben ABGELEITETEN Slug verliert ihn jetzt
          // (gesetzt schlaegt abgeleitet) — benennen, nicht still verschieben.
          const verdraengt = eigene
            .filter((eintrag) => eintrag.libraryId !== libraryId && eintrag.slug === neu && eintrag.herkunft === 'abgeleitet')
            .map((eintrag) => ({ libraryId: eintrag.libraryId, name: eintrag.name }))
          return jsonResult({
            slug: neu,
            geaendert: true,
            vorher: vorher ? { slug: wirksamVorher, herkunft: vorher.herkunft } : null,
            frueher,
            verdraengt,
            hinweis: verdraengt.length > 0
              ? `Diese Libraries hatten "${neu}" als abgeleiteten Slug und haben jetzt keinen: ${verdraengt.map((v) => v.name).join(', ')} — dort ebenfalls adresse_setzen.`
              : null,
          })
        })
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
