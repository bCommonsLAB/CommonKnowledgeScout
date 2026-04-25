/**
 * @fileoverview Helper-Funktionen zum Extrahieren von Frontmatter-Metadaten
 * aus Template-Inhalten.
 *
 * Erster Modul-Split-Schritt der Pilot-Welle external-jobs (Plan-Schritt 4).
 * Vorher: extractFixedFieldsFromTemplate war private function in phase-template.ts.
 * Jetzt: eigene Datei unter phase-template/, Re-Export in phase-template.ts.
 *
 * Char-Tests in tests/unit/external-jobs/phase-template-empty-input.test.ts und
 * phase-template-happy-path.test.ts pruefen das Verhalten und sind nach dem
 * Split unveraendert gruen geblieben.
 *
 * @module external-jobs/phase-template
 */

/**
 * Extrahiert feste Felder (ohne {{...}}) aus dem Template-Frontmatter.
 *
 * Diese Felder werden nicht vom LLM generiert, sondern 1:1 ins Ergebnis
 * uebernommen.
 *
 * Beispiele fuer feste Felder:
 *  - sprache: de
 *  - docType: klimamassnahme
 *  - coverImagePrompt: Erstelle ein Hintergrundbild...
 *
 * @param templateContent - Der Template-Content (Markdown mit Frontmatter)
 * @returns Record mit festen Feldnamen und Werten. Leeres Objekt, wenn:
 *   - templateContent ist leer/undefined
 *   - es kein Frontmatter (`---\n...\n---`) gibt
 *   - alle Felder dynamisch (`{{...}}`) sind
 *   - alle Werte leer sind
 */
export function extractFixedFieldsFromTemplate(templateContent: string | undefined): Record<string, unknown> {
  if (!templateContent) return {}

  const fixedFields: Record<string, unknown> = {}

  // Frontmatter zwischen ersten --- und naechsten --- extrahieren
  const frontmatterMatch = templateContent.match(/^---\s*\n([\s\S]*?)\n---/)
  if (!frontmatterMatch) return {}

  const frontmatterContent = frontmatterMatch[1]
  const lines = frontmatterContent.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()

    // Leere Zeilen und Kommentare ueberspringen
    if (!trimmed || trimmed.startsWith('#')) continue

    // Suche nach Felddefinitionen: `key: value`
    const fieldMatch = line.match(/^(\w+):\s*(.+)$/)
    if (!fieldMatch) continue

    const key = fieldMatch[1].trim()
    const value = fieldMatch[2].trim()

    // Pruefe ob es ein dynamisches Feld ist (mit {{...}})
    const isDynamic = value.includes('{{') && value.includes('}}')

    // Nur feste Felder extrahieren (leere Werte ueberspringen)
    if (!isDynamic && value) {
      // Versuche JSON zu parsen (fuer Arrays wie tags). Fehler beim Parsen
      // wird bewusst gefangen und der Roh-String uebernommen — das ist
      // erwartetes Verhalten und in den Char-Tests gesichert.
      try {
        if (value.startsWith('[') || value.startsWith('{')) {
          fixedFields[key] = JSON.parse(value)
        } else if (value === 'true') {
          fixedFields[key] = true
        } else if (value === 'false') {
          fixedFields[key] = false
        } else if (value === 'null') {
          fixedFields[key] = null
        } else if (!isNaN(Number(value)) && value !== '') {
          fixedFields[key] = Number(value)
        } else {
          fixedFields[key] = value
        }
      } catch {
        // JSON.parse-Fehler: Wert als Roh-String uebernehmen (Char-Test sichert dies ab)
        fixedFields[key] = value
      }
    }
  }

  return fixedFields
}
