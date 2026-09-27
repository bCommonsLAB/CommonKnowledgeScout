/**
 * @fileoverview MCP-Werkzeuge: `veroeffentlichung_lesen`, `veroeffentlichung_setzen` (B4).
 *
 * @description
 * Station 5 des Website-Wegs: `publicPublishing` der Library lesen und
 * setzen — mit derselben Validierung und demselben Merge wie das Formular
 * (`public-publishing-validation.ts`). Nur genannte Felder aendern sich.
 * `apiKey` wird nie gesetzt und nur maskiert gelesen. `isPublic: true` ist
 * die eine Aktion mit Aussenwirkung; die Antwort sagt das ausdruecklich.
 *
 * @module mcp
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { LibraryService } from '@/lib/services/library-service'
import { SITE_THEME_SCHEMA } from '@/lib/website/site-theme-schema'
import {
  geaenderteFelder, mergePublicPublishing, validierePublicPublishing, type PublicPublishing,
} from '@/lib/services/public-publishing-validation'
import { BEGRUENDUNG, mitProtokoll } from './protokoll'
import { LIBRARY_ID, errorResult, jsonResult, mcpUserEmail, requireLibrary } from './tool-shared'

const TEXT = z.string().max(2000)
const GALLERY = z.object({
  headline: TEXT.optional(), subtitle: TEXT.optional(), description: TEXT.optional(),
  filterDescription: TEXT.optional(), menuLabel: z.string().max(60).optional(), moreLinkLabel: z.string().max(60).optional(),
}).strict()

/** Sicht auf die Einstellungen ohne Geheimnis (CLAUDE.md: Token-Status statt Token-Wert). */
function sicht(pub: PublicPublishing | undefined) {
  const slug = pub?.slugName?.trim() || null
  return {
    isPublic: pub?.isPublic === true,
    slugName: slug,
    publicName: pub?.publicName ?? null,
    description: pub?.description ?? null,
    icon: pub?.icon ?? null,
    showOnHomepage: pub?.showOnHomepage ?? true,
    requiresAuth: pub?.requiresAuth === true,
    backgroundImageUrl: pub?.backgroundImageUrl ?? null,
    logoUrl: pub?.logoUrl ?? null,
    gallery: pub?.gallery ?? null,
    siteEnabled: pub?.siteEnabled === true,
    siteTheme: pub?.siteTheme ?? null,
    apiKeyGesetzt: Boolean(pub?.apiKey),
    adresse: slug ? `/explore/${slug}` : null,
    domainZuordnung: process.env.PUBLIC_DOMAIN_LIBRARY_MAP ? 'im Deployment konfiguriert (Wert nicht lesbar)' : 'keine',
  }
}

export function registerWebsiteVeroeffentlichungTools(server: McpServer): void {
  server.registerTool(
    'veroeffentlichung_lesen',
    {
      title: 'Veroeffentlichungs-Einstellungen lesen (liest nur)',
      description:
        'Liest publicPublishing der Library: isPublic, Slug, oeffentlicher Name, Beschreibung, Icon, ' +
        'showOnHomepage, requiresAuth, Logo- und Hintergrundbild-URL, Galerie-Texte, siteEnabled, ' +
        'das Design-Profil siteTheme (null = Vorlage), ob ein API-Schluessel gesetzt ist (nie sein Wert) ' +
        'und die Adresse /explore/<slug>. Liest nur.',
      inputSchema: { libraryId: LIBRARY_ID },
      annotations: { readOnlyHint: true },
    },
    async ({ libraryId }) => {
      try {
        const library = await requireLibrary(mcpUserEmail(), libraryId)
        return jsonResult(sicht(library.config?.publicPublishing))
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    'veroeffentlichung_setzen',
    {
      title: 'Veroeffentlichungs-Einstellungen setzen (SCHREIBT)',
      description:
        'Setzt Felder von publicPublishing mit derselben Validierung wie das Formular Einstellungen → ' +
        'Veroeffentlichung: Slug (Kleinbuchstaben, Zahlen, Bindestriche, ab 3 Zeichen, eindeutig), ' +
        'oeffentlicher Name ab 3, Beschreibung ab 10 Zeichen, sobald isPublic true ist; requiresAuth und ' +
        'showOnHomepage=false nur bei isPublic. Nur genannte Felder aendern sich; leere URL-Felder ' +
        'loeschen den Wert. isPublic: true macht die Inhalte anonym lesbar — das ist die eine Aktion mit ' +
        'Aussenwirkung. siteTheme (Welle S2) ist das Design-Profil der Website: fontHeading/fontBody aus ' +
        'geist|newsreader|plus-jakarta, accent/accentHover/accentText als #rrggbb, buttonShape pill|rounded, ' +
        'surfaces je Flaeche (default, light, dark, brand, linen, mint, dark-green, neutral) mit bg, text, ' +
        'heading, paragraph, kicker als #rrggbb; nur genannte Flaechen weichen von der Vorlage ab, das ' +
        'Profil ersetzt das gespeicherte als Ganzes, siteThemeLoeschen: true loescht es. Ungueltige Werte werden abgewiesen. ' +
        'Nur Owner; kein API-Schluessel ueber die Bruecke. Nur nach Bestaetigung durch den Menschen.',
      inputSchema: {
        libraryId: LIBRARY_ID,
        isPublic: z.boolean().optional(),
        slugName: z.string().max(80).optional(),
        publicName: z.string().max(200).optional(),
        description: TEXT.optional(),
        icon: z.string().max(60).optional().describe('Icon-Name; "" oder "none" loescht'),
        showOnHomepage: z.boolean().optional(),
        requiresAuth: z.boolean().optional(),
        backgroundImageUrl: z.string().max(1000).optional().describe('anonym lesbare URL; "" loescht'),
        logoUrl: z.string().max(1000).optional().describe('anonym lesbare URL; "" loescht'),
        gallery: GALLERY.optional().describe('Galerie-Texte feldweise; leerer String = Standardtext'),
        siteEnabled: z.boolean().optional().describe('true = /explore/<slug> zeigt die Website statt der Galerie'),
        siteTheme: SITE_THEME_SCHEMA.optional()
          .describe('Design-Profil als OBJEKT (kein JSON-Text); ersetzt das gespeicherte Profil als Ganzes; weglassen = unveraendert'),
        siteThemeLoeschen: z.boolean().optional().describe('true = Design-Profil loeschen, die Website rendert wieder die Vorlage'),
        begruendung: BEGRUENDUNG,
      },
      annotations: { readOnlyHint: false },
    },
    async ({ libraryId, begruendung, siteThemeLoeschen, ...rest }) => {
      // S2: `siteThemeLoeschen` wird zu `null` (loeschen); sonst gilt das Objekt oder `undefined` (unveraendert).
      const eingabe = { ...rest, siteTheme: siteThemeLoeschen ? null : rest.siteTheme }
      try {
        return await mitProtokoll(
          { werkzeug: 'veroeffentlichung_setzen', libraryId, akteur: mcpUserEmail(), begruendung },
          async () => {
            const userEmail = mcpUserEmail()
            const service = LibraryService.getInstance()
            if (!(await service.isOwner(userEmail, libraryId))) {
              throw new Error('Nur Owner koennen Veroeffentlichungs-Einstellungen aendern')
            }
            const library = await requireLibrary(userEmail, libraryId)
            const alt = library.config?.publicPublishing
            // S2: ein ungueltiges siteTheme wirft schon im Merge (validiereSiteTheme) — laut, mit Feldname.
            const neu = mergePublicPublishing(alt, eingabe, library.label)
            const verletzung = validierePublicPublishing(neu)
            if (verletzung) throw new Error(verletzung)
            if (neu.isPublic && neu.slugName && (neu.slugName !== alt?.slugName || !alt?.isPublic)) {
              const andere = await service.getPublicLibraryBySlug(neu.slugName)
              if (andere && andere.id !== libraryId) throw new Error(`Slug "${neu.slugName}" ist bereits vergeben`)
            }
            const geaendert = geaenderteFelder(alt, neu)
            if (geaendert.length === 0) {
              return jsonResult({ geaendert: [], veroeffentlichung: sicht(alt), hinweis: 'Nichts geaendert' })
            }
            const ok = await service.updateLibrary(userEmail, {
              ...library, config: { ...library.config, publicPublishing: neu },
            })
            if (!ok) throw new Error('Library konnte nicht gespeichert werden')
            return jsonResult({
              geaendert,
              veroeffentlichung: sicht(neu),
              hinweis: neu.isPublic && !alt?.isPublic
                ? 'Die Library ist jetzt OEFFENTLICH: Galerie und Dokumente sind anonym lesbar.'
                : null,
            })
          },
        )
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
