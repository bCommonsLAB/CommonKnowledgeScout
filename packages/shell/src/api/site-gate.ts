/**
 * SiteConfig-Gate fuer Modul-APIs (Welle M4, Modul-Landkarte §3).
 *
 * Prinzip der Landkarte: Modul-Routen sind pro Site freigeschaltet — ist das
 * Modul fuer die angefragte Site nicht aktiv, antwortet die Route mit 404.
 * Damit liefert die eine Instanz je nach Host unterschiedliche API-Oberflaechen,
 * ohne dass ein zweites Deployment noetig waere (ADR 0008).
 *
 * BEWUSST kein Higher-Order-Wrapper (`export const GET = withSiteGate(...)`),
 * obwohl die Landkarte ihn so skizziert: Der Wrapper ist die Zielform fuer den
 * Tag, an dem die Handler-Ruempfe im Modul-Paket liegen. Heute liegen sie in
 * der App — ein Wrapper darum verlagert nichts, er verkleidet nur. Ausserdem
 * laesst der Guard die exportierte Handler-Signatur unveraendert, gegen die
 * Next.js beim Build seine generierten Route-Typen prueft.
 */

import type { SiteModule } from '@ks/contracts'
import { resolveSiteConfigForHost } from '../site/site-registry'

/**
 * Minimal-Sicht auf einen Request. Absichtlich nicht `NextRequest`: Das Gate
 * soll nicht an `next/server` haengen, damit `@ks/shell` auch in einer
 * Embed-/Electron-Huelle ohne Next benutzbar bleibt. `NextRequest` und das
 * Web-`Request` erfuellen diese Form beide.
 */
export interface SiteGateRequest {
  headers: { get(name: string): string | null }
}

/**
 * Host des Requests. Gleiche Reihenfolge wie im Root-Layout
 * (`x-forwarded-host` vor `host`), damit Layout und API dieselbe Site sehen —
 * hinter einem Proxy traegt `host` sonst den internen Namen.
 */
export function getRequestHost(request: SiteGateRequest): string | null {
  return request.headers.get('x-forwarded-host') ?? request.headers.get('host')
}

/** Ist das Modul fuer die Site dieses Hosts freigeschaltet? */
export function isModuleActiveForHost(module: SiteModule, host: string | null): boolean {
  return resolveSiteConfigForHost(host).modules.includes(module)
}

/**
 * Prueft, ob das Modul fuer die angefragte Site aktiv ist.
 *
 * @returns `null`, wenn die Route ausgeliefert werden darf — sonst die
 *          404-Antwort, die der Handler unveraendert zurueckgeben muss.
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   const gated = siteGate('explorer', request)
 *   if (gated) return gated
 *   // ...
 * }
 */
export function siteGate(module: SiteModule, request: SiteGateRequest): Response | null {
  if (isModuleActiveForHost(module, getRequestHost(request))) return null
  return Response.json(
    { error: `Modul "${module}" ist fuer diese Site nicht aktiv.` },
    { status: 404 },
  )
}
