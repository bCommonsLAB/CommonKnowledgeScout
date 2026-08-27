/**
 * API-Namensraum des Explorer-Moduls (Modul-Landkarte §1/§3).
 *
 * Die Landkarte weist dem Explorer `chat/[libraryId]/*` (Lese-Teil), `public/*`
 * und `markdown/*` zu — nennt aber im selben Atemzug „Bekannte Unschaerfen":
 * Routen, die im Explorer-Namensraum LIEGEN, fachlich aber woanders hingehoeren.
 *
 * Diese Datei macht beides zu Code statt zu Prosa: die Praefixe UND die
 * begruendeten Ausnahmen. Ein Test laeuft den echten Route-Baum der App dagegen
 * ab (`tests/unit/packages/module-explorer/api-gate-coverage.test.ts`) und
 * schlaegt an, sobald eine Route weder gegatet noch begruendet ausgenommen ist.
 */

/** Route-Praefixe (relativ zu `src/app/api/`), die dem Explorer zugeordnet sind. */
export const EXPLORER_API_PREFIXES: readonly string[] = [
  'chat/[libraryId]',
  'public',
  'markdown',
]

export interface ExplorerApiExclusion {
  /** Route-Pfad relativ zu `src/app/api/`, ohne `/route.ts`. */
  route: string
  /** Warum diese Route NICHT zum Explorer gehoert. */
  reason: string
}

/**
 * Routen innerhalb der Praefixe, die NICHT zum Explorer gehoeren.
 *
 * Jeder Eintrag ist eine offene Zuordnungsfrage aus Landkarte §3 — bewusst
 * nicht „schnell mitgegatet", weil das Modul-Zugehoerigkeit behaupten wuerde,
 * die noch niemand entschieden hat.
 */
export const EXPLORER_API_EXCLUSIONS: readonly ExplorerApiExclusion[] = [
  // Verarbeitung/Indexierung — liegt im Chat-Namensraum, gehoert fachlich
  // zu Archiv/Jobs (Landkarte §3, erste Unschaerfe).
  { route: 'chat/[libraryId]/ingest', reason: 'Ingestion — gehoert zu Archiv/Jobs, nicht zum Lesen' },
  { route: 'chat/[libraryId]/ingest-markdown', reason: 'Ingestion — gehoert zu Archiv/Jobs, nicht zum Lesen' },
  { route: 'chat/[libraryId]/ingestion-status', reason: 'Ingestion — gehoert zu Archiv/Jobs, nicht zum Lesen' },
  { route: 'chat/[libraryId]/index', reason: 'Indexierung — gehoert zu Archiv/Jobs' },
  { route: 'chat/[libraryId]/index-status', reason: 'Indexierung — gehoert zu Archiv/Jobs' },
  { route: 'chat/[libraryId]/index-status-extended', reason: 'Indexierung — gehoert zu Archiv/Jobs' },
  { route: 'chat/[libraryId]/upsert-file', reason: 'Schreibpfad der Indexierung — gehoert zu Archiv/Jobs' },
  { route: 'chat/[libraryId]/upsert-doc-meta', reason: 'Schreibpfad der Indexierung — gehoert zu Archiv/Jobs' },

  // Kuratierung — Landkarte §3, zweite Unschaerfe.
  { route: 'chat/[libraryId]/docs/publish', reason: 'Kuratierung, nicht Lesen — Zuordnung offen' },
  { route: 'chat/[libraryId]/docs/publish-bulk', reason: 'Kuratierung, nicht Lesen — Zuordnung offen' },
  { route: 'chat/[libraryId]/docs/delete', reason: 'Kuratierung, nicht Lesen — Zuordnung offen' },

  // Core-API: von ALLEN Modulen genutzt, in jeder App gemountet (Landkarte §3).
  { route: 'public/llm-models', reason: 'Core-API (Modell-Katalog), kein Modul-Endpunkt' },

  // Geteilter Dienst — Landkarte §3, vierte Unschaerfe.
  { route: 'public/secretary/process-audio', reason: 'secretary/* wird von Erfassung UND Archiv genutzt — Zuordnung offen' },

  // Zwischenspeicherung: Diese Routen werden heute statisch bzw. per ISR
  // ausgeliefert (`revalidate = 60` bzw. GET ohne Zugriff auf das
  // Request-Objekt). Das Gate liest den Host — der Zugriff wuerde die Route
  // dynamisch machen und den Cache aufheben. Das ist eine
  // Verhaltensaenderung (Migrationsstrategie G4) und deshalb hier
  // ausgenommen, NICHT weil die Routen fachlich nicht zum Explorer gehoeren.
  //
  // Grundsatzfolge fuer Welle M6: Ein host-abhaengiges Gate und eine
  // host-unabhaengige Zwischenspeicherung schliessen einander aus. Wer eine
  // Site mit reduziertem Modul-Satz schneidet, braucht fuer diese Routen
  // entweder einen host-abhaengigen Cache-Schluessel (`headers()` in der
  // Cache-Funktion, wie `getRootLandingTargetForHost` es macht) oder den
  // Verzicht auf die Zwischenspeicherung.
  { route: 'public/libraries/[slug]', reason: 'ISR (revalidate = 60) — Gate wuerde die Route dynamisch machen (G4)' },
  { route: 'markdown/[...path]', reason: 'statisch optimiert (GET liest das Request-Objekt nicht) — Gate wuerde das aufheben (G4)' },
]

export interface ExplorerRouteVerdict {
  /** Liegt die Route im Explorer-Namensraum? */
  inNamespace: boolean
  /** Muss die Route das Site-Gate aufrufen? */
  gated: boolean
  /** Bei `gated: false` innerhalb des Namensraums: warum nicht. */
  reason?: string
}

/**
 * Entscheidet fuer einen Route-Pfad (relativ zu `src/app/api/`, ohne
 * `/route.ts`), ob er zum Explorer gehoert und gegatet werden muss.
 *
 * Reine Funktion, damit der Abdeckungs-Test sie gegen den echten Route-Baum
 * fahren kann.
 */
export function classifyExplorerApiRoute(route: string): ExplorerRouteVerdict {
  const normalized = route.replace(/^\/+|\/+$/g, '')
  const inNamespace = EXPLORER_API_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  )
  if (!inNamespace) return { inNamespace: false, gated: false }

  const exclusion = EXPLORER_API_EXCLUSIONS.find((e) => e.route === normalized)
  if (exclusion) return { inNamespace: true, gated: false, reason: exclusion.reason }

  return { inNamespace: true, gated: true }
}
