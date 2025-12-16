/**
 * @fileoverview Helpers for rendering/selecting template names in the UI.
 *
 * @description
 * Templates are stored in MongoDB and referenced by name (without ".md").
 * UI components often need a stable, deduplicated list that also includes
 * a currently configured value even if it is not (yet) present in MongoDB.
 */

export interface MergeTemplateNamesArgs {
  templateNames: string[]
  currentTemplateName?: string
}

/**
 * Returns a sorted, deduplicated list of template names.
 * Ensures the currently configured template name is included (if non-empty).
 */
export function mergeTemplateNames(args: MergeTemplateNamesArgs): string[] {
  const current = (args.currentTemplateName || '').trim()
  const raw = Array.isArray(args.templateNames) ? args.templateNames : []

  const normalized = raw
    .map((n) => (typeof n === 'string' ? n.trim() : ''))
    .filter((n) => n.length > 0)

  if (current) normalized.push(current)

  // Deduplicate case-insensitively, but keep the first encountered casing.
  const seen = new Set<string>()
  const unique: string[] = []
  for (const name of normalized) {
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(name)
  }

  return unique.sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }))
}


