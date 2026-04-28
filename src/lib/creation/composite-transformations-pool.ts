/**
 * @fileoverview Pool-Lookup fuer Sammel-Transformationen.
 *
 * Liefert fuer eine Menge von Quelldateien die Liste der vorhandenen
 * Transformations-Templates (gefiltert nach Zielsprache). Wird vom Dialog
 * (Template-Dropdown) und der API-Route (Validierung) benutzt.
 *
 * Hintergrund: Pro Quelle koennen mehrere Transformationen mit unterschiedlichen
 * Templates existieren (z.B. `gaderform-bett-steckbrief`, `kurz-zusammenfassung`).
 * Wir wollen dem User nur die Templates anbieten, fuer die mindestens eine
 * markierte Quelle eine Transformation hat — und ihm pro Template anzeigen,
 * welche Quellen sie haben und welche nicht.
 */

import { getShadowTwinsBySourceIds } from '@/lib/repositories/shadow-twin-repo'
import { FileLogger } from '@/lib/debug/logger'

/** Eingabe fuer `findCommonTemplatesForSources`. */
export interface FindCommonTemplatesArgs {
  libraryId: string
  /** sourceIds (Storage-Item-IDs) der markierten Quelldateien. */
  sourceIds: string[]
  /** Map von sourceId → Dateiname (fuer Reporting in `coveredSources` / `missingSources`). */
  sourceNamesById: Record<string, string>
  /** Zielsprache, z.B. `'de'`. */
  targetLanguage: string
}

/** Ergebnis pro gefundenem Template. */
export interface CommonTemplateEntry {
  /** Template-Name (z.B. `gaderform-bett-steckbrief`). */
  templateName: string
  /** Dateinamen der Quellen, die dieses Template + die Sprache besitzen. */
  coveredSources: string[]
  /** Dateinamen der Quellen, denen dieses Template fehlt. */
  missingSources: string[]
}

/** Ergebnis von `findCommonTemplatesForSources`. */
export interface FindCommonTemplatesResult {
  /** Alle Templates, die mindestens eine der markierten Quellen besitzt. */
  templates: CommonTemplateEntry[]
  /** Anzahl markierter Quellen, fuer die GAR kein Shadow-Twin gefunden wurde. */
  sourcesWithoutShadowTwin: number
}

/**
 * Liest die Shadow-Twin-Dokumente aus MongoDB und sammelt die verfuegbaren
 * Transformations-Templates pro Quelle. Die Ergebnis-Liste ist nach
 * `coveredSources.length` absteigend sortiert (Templates, die alle Quellen
 * abdecken, stehen oben), bei Gleichstand alphabetisch.
 *
 * Wirft NICHT bei "keine Transformationen gefunden" — leeres Templates-Array
 * ist der erwartete Output, der Caller soll daraufhin eine 400 oder eine
 * leere UI-Liste anzeigen.
 */
export async function findCommonTemplatesForSources(
  args: FindCommonTemplatesArgs,
): Promise<FindCommonTemplatesResult> {
  const { libraryId, sourceIds, sourceNamesById, targetLanguage } = args

  if (sourceIds.length === 0) {
    return { templates: [], sourcesWithoutShadowTwin: 0 }
  }

  const docs = await getShadowTwinsBySourceIds({ libraryId, sourceIds })

  // sourceId → Set<templateName>, das die Sprache `targetLanguage` enthaelt
  const sourceToTemplates = new Map<string, Set<string>>()
  let sourcesWithoutShadowTwin = 0

  for (const sourceId of sourceIds) {
    const doc = docs.get(sourceId)
    if (!doc) {
      sourcesWithoutShadowTwin += 1
      sourceToTemplates.set(sourceId, new Set())
      continue
    }

    const transformationByTemplate = (doc.artifacts?.transformation ?? {}) as Record<
      string,
      Record<string, unknown> | undefined
    >
    const templates = new Set<string>()
    for (const [templateName, langBucket] of Object.entries(transformationByTemplate)) {
      if (!langBucket) continue
      // Nur Templates aufnehmen, fuer die diese Zielsprache existiert.
      if (langBucket[targetLanguage]) {
        templates.add(templateName)
      }
    }
    sourceToTemplates.set(sourceId, templates)
  }

  // Inverse Aggregation: templateName → covered/missing sourceIds
  const allTemplates = new Set<string>()
  for (const set of sourceToTemplates.values()) {
    for (const t of set) allTemplates.add(t)
  }

  const templates: CommonTemplateEntry[] = []
  for (const templateName of allTemplates) {
    const coveredSources: string[] = []
    const missingSources: string[] = []
    for (const sourceId of sourceIds) {
      const sourceName = sourceNamesById[sourceId] ?? sourceId
      if (sourceToTemplates.get(sourceId)?.has(templateName)) {
        coveredSources.push(sourceName)
      } else {
        missingSources.push(sourceName)
      }
    }
    templates.push({ templateName, coveredSources, missingSources })
  }

  templates.sort((a, b) => {
    const diff = b.coveredSources.length - a.coveredSources.length
    if (diff !== 0) return diff
    return a.templateName.localeCompare(b.templateName)
  })

  FileLogger.info('composite-transformations-pool', 'Pool-Lookup abgeschlossen', {
    libraryId,
    sourceCount: sourceIds.length,
    templateCount: templates.length,
    sourcesWithoutShadowTwin,
  })

  return { templates, sourcesWithoutShadowTwin }
}
