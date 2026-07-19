/**
 * Domain→Library-Zuordnung (Variante B): reine, edge-taugliche Helfer OHNE
 * DB-/Node-Abhaengigkeiten, damit sie sowohl in der Middleware (Edge-Runtime)
 * als auch serverseitig (root-landing.ts) nutzbar sind.
 *
 * Eine gemappte Domain (z.B. `oldiesforfuture.org`) ist an IHRE Library
 * gekoppelt: `/` rendert deren Landingpage, und `/explore/<fremderSlug>`
 * darf dort NICHT ausgeliefert werden (Redirect zur Hauptplattform).
 */

/** Normalisiert einen Host: lowercase, Port entfernt, fuehrendes `www.` entfernt. */
export function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, '').replace(/^www\./, '')
}

/**
 * Parst die Domain→Slug-Zuordnung aus ENV `PUBLIC_DOMAIN_LIBRARY_MAP`
 * (JSON-Objekt, z.B. {"oldiesforfuture.org":"oldiesforfuture"}).
 *
 * Kein stiller Fallback (Projektregel): ungueltiges JSON oder ungueltige
 * Eintraege werden LAUT geloggt und uebersprungen — nicht still ignoriert.
 */
export function getDomainLibraryMap(): Record<string, string> {
  const raw = process.env.PUBLIC_DOMAIN_LIBRARY_MAP
  if (!raw || raw.trim().length === 0) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    console.error(
      '[domain-library-map] PUBLIC_DOMAIN_LIBRARY_MAP ist kein gueltiges JSON — Zuordnung ignoriert.',
      e instanceof Error ? e.message : e,
    )
    return {}
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    console.error('[domain-library-map] PUBLIC_DOMAIN_LIBRARY_MAP ist kein JSON-Objekt — Zuordnung ignoriert.')
    return {}
  }
  const out: Record<string, string> = {}
  for (const [domain, slug] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof slug !== 'string' || slug.trim().length === 0) {
      console.error(`[domain-library-map] Ungueltiger Slug fuer "${domain}" — Eintrag uebersprungen.`)
      continue
    }
    out[normalizeHost(domain)] = slug.trim()
  }
  return out
}

/**
 * Domain-Kopplung: Liefert das Redirect-Ziel, wenn auf einer gemappten Domain
 * eine FREMDE Library unter `/explore/<slug>` angefordert wird — sonst `null`.
 *
 * - Eigener Slug (inkl. Unterpfade wie `/perspective`): erlaubt (null).
 * - Fremder Slug: Redirect auf die Hauptplattform (`appUrl` + Pfad + Query),
 *   damit der Inhalt dort erreichbar bleibt, statt unter falscher Domain zu
 *   erscheinen. Zeigt `appUrl` auf denselben Host (z.B. lokale Entwicklung),
 *   wird stattdessen auf `/` der Domain umgeleitet (verhindert Redirect-Loop).
 *
 * Reine Funktion (unit-testbar), Map wird explizit uebergeben.
 */
export function resolveForeignExploreRedirect(args: {
  host: string | null
  pathname: string
  search: string
  appUrl: string | undefined
  map: Record<string, string>
}): string | null {
  const { host, pathname, search, appUrl, map } = args
  if (!host) return null
  const normalized = normalizeHost(host)
  const mappedSlug = map[normalized]
  if (!mappedSlug) return null

  const m = pathname.match(/^\/explore\/([^/]+)(\/.*)?$/)
  if (!m) return null
  const requestedSlug = decodeURIComponent(m[1])
  if (requestedSlug === mappedSlug) return null

  // Fremde Library auf gekoppelter Domain: zur Hauptplattform umleiten.
  if (appUrl && appUrl.trim().length > 0) {
    try {
      const target = new URL(appUrl)
      // Loop-Schutz: Hauptplattform == aktuelle Domain -> auf die Domain-Root.
      if (normalizeHost(target.host) !== normalized) {
        return `${target.origin}${pathname}${search}`
      }
    } catch {
      console.error(`[domain-library-map] NEXT_PUBLIC_APP_URL ist keine gueltige URL: "${appUrl}"`)
    }
  }
  return '/'
}
