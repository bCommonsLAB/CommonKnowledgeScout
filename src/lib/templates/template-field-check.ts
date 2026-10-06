/**
 * @fileoverview Frontmatter-Felder einer Vorlage pruefen und fuer einen Lauf entfernen (P6).
 *
 * @description
 * Option „Slides als Tabelle fuehren" im Dialog „Aufbereiten & Publizieren":
 * Ist sie fuer einen Lauf abgewaehlt, wird das Feld (z. B. `slides`) aus dem
 * Frontmatter der Vorlage genommen, BEVOR der Secretary das Antwortschema
 * daraus baut — das Modell bekommt das Feld dann weder als Pflicht noch als
 * Option. Die Vorlage in MongoDB bleibt unveraendert; es ist ein Lauf-Parameter.
 *
 * Reine Textfunktionen auf dem Wire-Format der Vorlage (`---` … `---`), damit
 * UI (Sichtbarkeit der Option) und Pipeline (Entfernen) dieselbe Regel nutzen.
 * Ein Feld ist eine Zeile `key: …` auf oberster Ebene des ersten
 * Frontmatter-Blocks (Fall 1 und 2 der Frontmatter-Field-Mechanik,
 * `docs/architecture/template-system.md`).
 */

const FRONTMATTER_BLOCK = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/

function fieldLineRegex(field: string): RegExp {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${escaped}\\s*:`)
}

function splitFrontmatter(content: string): { before: string; block: string; after: string } | null {
  const match = FRONTMATTER_BLOCK.exec(content)
  if (!match) return null
  return {
    before: '---\n',
    block: match[1],
    after: content.slice(match[0].length - (match[2]?.length ?? 0)),
  }
}

/** true, wenn die Vorlage das Feld im ersten Frontmatter-Block fuehrt. */
export function templateHasFrontmatterField(content: string, field: string): boolean {
  const parts = splitFrontmatter(content)
  if (!parts) return false
  const regex = fieldLineRegex(field)
  return parts.block.split(/\r?\n/).some((line) => regex.test(line))
}

export interface RemoveFieldResult {
  content: string
  /** false, wenn die Vorlage das Feld nicht hatte — der Aufrufer meldet das, statt still weiterzugehen. */
  removed: boolean
}

/**
 * Entfernt die Feldzeile(n) aus dem ersten Frontmatter-Block. Mehrzeilige
 * Token (`{{x|…` ueber mehrere Zeilen) werden bis zum schliessenden `}}`
 * mitgenommen.
 */
export function removeTemplateFrontmatterField(content: string, field: string): RemoveFieldResult {
  const parts = splitFrontmatter(content)
  if (!parts) return { content, removed: false }
  const regex = fieldLineRegex(field)
  const lines = parts.block.split(/\r?\n/)
  const kept: string[] = []
  let removed = false
  let skippingToken = false
  for (const line of lines) {
    if (skippingToken) {
      if (line.includes('}}')) skippingToken = false
      continue
    }
    if (regex.test(line)) {
      removed = true
      const opens = (line.match(/{{/g) ?? []).length
      const closes = (line.match(/}}/g) ?? []).length
      if (opens > closes) skippingToken = true
      continue
    }
    kept.push(line)
  }
  if (!removed) return { content, removed: false }
  return { content: `${parts.before}${kept.join('\n')}\n---${parts.after}`, removed: true }
}
