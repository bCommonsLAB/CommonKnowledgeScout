/**
 * @fileoverview Template Body Builder (External Jobs)
 *
 * @description
 * Baut den Markdown-Body für Transformations-Artefakte.
 *
 * Motivation:
 * - Die Template-Transformation liefert Metadaten (structured_data), häufig inkl. `bodyInText`.
 * - Für stabile Artefakte wollen wir:
 *   1) `bodyInText` bevorzugen (vollständiger Blog-/Artikeltext),
 *   2) sonst den Template-Markdown-Body mit `{{key|...}}`/`{{key}}` Platzhaltern rendern,
 *   3) sonst ein minimales Fallback (Titel/Zusammenfassung/etc.).
 *
 * WICHTIG: Keine sensiblen Inhalte loggen – dieses Modul ist rein deterministisch.
 */
import { parseTemplate } from '@/lib/templates/template-parser'

export type TemplateBodyBuildStrategy = 'bodyInText' | 'template_markdownBody' | 'fallback'

export interface BuildTransformationBodyArgs {
  meta: Record<string, unknown>
  templateContent?: string | null
  templateNameForParsing?: string
}

export interface BuildTransformationBodyResult {
  body: string
  strategy: TemplateBodyBuildStrategy
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

/**
 * Normalisiert "doppelt escaped" Newlines.
 *
 * Hintergrund:
 * Manche LLMs liefern in JSON Strings wie "\\n\\n" (wörtlich Backslash+n),
 * statt echter Newlines. Das bricht die Markdown-Darstellung, weil Zeilenumbrüche
 * nicht als Zeilenumbrüche interpretiert werden.
 *
 * Heuristik:
 * - Nur anwenden, wenn der String `\\n` enthält, aber KEINE echten Newlines.
 * - Dann: `\\r\\n` und `\\n` in `\n` umwandeln (optional auch `\\t`).
 */
function normalizeEscapedNewlines(input: string): string {
  // Wenn bereits echte Newlines vorhanden sind, ist i.d.R. alles gut.
  if (input.includes('\n')) return input
  // Nur, wenn Backslash-n vorkommt.
  if (!input.includes('\\n') && !input.includes('\\r\\n')) return input
  return input
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
}

function toRenderableString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return normalizeEscapedNewlines(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  // Arrays/Objects: JSON als lesbarer Fallback
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

/**
 * Rendert den Template-Body mit Platzhaltern.
 *
 * Ersetzt:
 * - `{{key|description}}`
 * - `{{key}}`
 *
 * Missing values werden zu "" (leerer String), damit die Struktur erhalten bleibt.
 */
export function renderTemplateBody(args: { body: string; values: Record<string, unknown> }): string {
  const { body, values } = args
  let result = body || ''

  // Ersetze {{key|description}} Patterns
  result = result.replace(/\{\{([^}|]+)\|([\s\S]*?)\}\}/g, (_m, rawKey: string) => {
    const key = String(rawKey || '').trim()
    return toRenderableString(values[key])
  })

  // Ersetze auch {{key}} Patterns ohne Pipe
  result = result.replace(/\{\{([^}]+)\}\}/g, (_m, rawKey: string) => {
    const key = String(rawKey || '').trim()
    // Überspringe, wenn bereits durch vorheriges Pattern ersetzt
    if (rawKey.includes('|')) return _m
    return toRenderableString(values[key])
  })

  return result
}

function buildFallbackBodyFromMeta(meta: Record<string, unknown>): string {
  const title = isNonEmptyString(meta.title) ? meta.title.trim() : ''
  const summary = isNonEmptyString(meta.summary) ? meta.summary.trim() : (isNonEmptyString(meta.teaser) ? meta.teaser.trim() : '')
  const messages = isNonEmptyString(meta.messages) ? meta.messages.trim() : ''
  // historischer Tippfehler: `nexsSteps`
  const nextSteps = isNonEmptyString(meta.nextSteps) ? meta.nextSteps.trim() : (isNonEmptyString(meta.nexsSteps) ? meta.nexsSteps.trim() : '')

  const blocks: string[] = []
  if (title) blocks.push(`# ${title}`)
  if (summary) blocks.push(`## Zusammenfassung\n${summary}`)
  if (messages) blocks.push(`## Inhalte\n${messages}`)
  if (nextSteps) blocks.push(`## Nächste Schritte\n${nextSteps}`)
  return blocks.join('\n\n').trim()
}

export function buildTransformationBody(args: BuildTransformationBodyArgs): BuildTransformationBodyResult {
  const { meta, templateContent, templateNameForParsing } = args

  // 1) Bevorzugt: `bodyInText` aus Secretary structured_data.
  // Das ist typischerweise der vollständig gerenderte Artikel/Blogtext.
  const bodyInText = meta.bodyInText
  if (isNonEmptyString(bodyInText)) {
    return { body: normalizeEscapedNewlines(bodyInText).trim(), strategy: 'bodyInText' }
  }

  // 2) Wenn verfügbar: Template-Markdown-Body rendern.
  // Das ermöglicht „Template-Struktur + Antworten“, sobald die Felder (intro/worum/...) im Meta vorhanden sind.
  if (isNonEmptyString(templateContent)) {
    try {
      const templateName = isNonEmptyString(templateNameForParsing) ? templateNameForParsing : 'unknown-template'
      const { template } = parseTemplate(templateContent, templateName)
      const markdownBody = template.markdownBody || ''
      if (isNonEmptyString(markdownBody)) {
        const rendered = normalizeEscapedNewlines(renderTemplateBody({ body: markdownBody, values: meta })).trim()
        if (rendered.length > 0) {
          return { body: rendered, strategy: 'template_markdownBody' }
        }
      }
    } catch {
      // Parsing/Rendering Fehler ⇒ fallback
    }
  }

  // 3) Minimaler Fallback (historisches Verhalten)
  return { body: buildFallbackBodyFromMeta(meta), strategy: 'fallback' }
}

