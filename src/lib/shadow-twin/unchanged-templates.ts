/**
 * @fileoverview Vorlagennamen der unveraendert publizierten Markdown-Quellen.
 *
 * @description
 * Eine Markdown-Quelle, die OHNE Sprachmodell publiziert wurde, traegt am Twin
 * eine Transformation mit festem Vorlagennamen (`website-page` oder
 * `markdown-page`). Daran erkennen Server und Oberflaeche, dass eine geaenderte
 * Quelle gefahrlos mit einem Klick neu uebernommen werden kann: Der Text bleibt
 * wortgleich, es gibt nichts zu entscheiden.
 *
 * Reine Datei ohne Server-Abhaengigkeit — sie wird auch im Client gebraucht.
 *
 * @module shadow-twin
 */

export const UNCHANGED_TEMPLATE_WEBSITE = 'website-page'
export const UNCHANGED_TEMPLATE_MARKDOWN = 'markdown-page'

const UNCHANGED_TEMPLATES: ReadonlySet<string> = new Set([
  UNCHANGED_TEMPLATE_WEBSITE,
  UNCHANGED_TEMPLATE_MARKDOWN,
])

export function isUnchangedTemplate(templateName: string | null | undefined): boolean {
  return typeof templateName === 'string' && UNCHANGED_TEMPLATES.has(templateName)
}

export interface TransformationRef {
  kind: 'transcript' | 'transformation'
  templateName?: string
}

/**
 * true, wenn die Quelle AUSSCHLIESSLICH unveraendert publiziert wurde: mindestens
 * eine Transformation, und jede traegt einen der festen Vorlagennamen. Liegt
 * daneben eine Transformation aus einer Sprachmodell-Vorlage, ist ein neuer
 * Lauf eine Entscheidung (der Text wird neu geschrieben) — dann false.
 */
export function isUnchangedPublication(artifacts: readonly TransformationRef[]): boolean {
  const transformations = artifacts.filter((a) => a.kind === 'transformation')
  return transformations.length > 0 && transformations.every((a) => isUnchangedTemplate(a.templateName))
}
