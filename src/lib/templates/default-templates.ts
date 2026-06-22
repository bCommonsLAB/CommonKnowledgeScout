/**
 * Standard-Vorlagen ("Default-Templates") je Inhaltstyp — im Sourcecode
 * persistiert (F11, User-Entscheid 2026-06-12).
 *
 * Jede Standard-Vorlage wird zur Laufzeit aus der VIEW_TYPE_REGISTRY
 * generiert und erzeugt damit per Konstruktion GENAU die Default-Felder
 * des Inhaltstyps (required + optional). Der Konsistenz-Test
 * tests/unit/settings/default-templates.test.ts erzwingt das in CI.
 *
 * Verwendung:
 * - Pipeline (external-jobs/template-files.ts): Ist in der Library keine
 *   Vorlage gesetzt (''), wird der Standard des Inhaltstyps geladen —
 *   ohne MongoDB-Roundtrip. Standard-Namen ("standard-<typ>") werden
 *   ebenfalls hier aufgeloest.
 * - Templates-API: Standard-Vorlagen erscheinen read-only in der Liste;
 *   ihre Namen sind fuer Mongo-Templates reserviert.
 */

import { parseTemplate } from './template-parser'
import type { ParsedTemplate, TemplateDocument } from './template-types'
import {
  DETAIL_VIEW_TYPES,
  getOptionalFields,
  getRequiredFields,
  isValidDetailViewType,
  type DetailViewType,
} from '@/lib/detail-view-types/registry'
import { BASE_REQUIRED_FIELDS } from '@/lib/detail-view-types/base-fields'

/** Namens-Praefix der Standard-Vorlagen (reserviert, nicht ueberschreibbar) */
export const DEFAULT_TEMPLATE_PREFIX = 'standard-'

/** Kuratierte Feld-Anweisungen fuer das LLM (Fallback: generisch) */
const FIELD_DESCRIPTIONS: Record<string, string> = {
  title: 'Ein treffender Titel — nur Text ohne Sonderzeichen, max. 70 Zeichen',
  shortTitle: 'Ein praegnanter Kurztitel, max. 40 Zeichen',
  teaser: 'Ein motivierender Teaser-Satz, der Lust auf den Inhalt macht',
  summary:
    'Eine ausfuehrliche Zusammenfassung: zuerst ein kurzer Ueberblick, danach in sinnvolle Abschnitte gegliedert (Abschnitts-Titel fett, Absaetze mit \\n getrennt)',
  language: 'Sprache des Originaldokuments als ISO-Code (z.B. de, en)',
  targetLanguage: 'Zielsprache dieser Ausgabe als ISO-Code (z.B. de, en)',
  date: 'Datum des Inhalts im Format yyyy-mm-dd (Erscheinen/Aufnahme/Veranstaltung), falls erkennbar',
  authors: 'Alle Autorinnen und Autoren, kommagetrennt',
  authors_image_url: 'URL eines Autorenbilds, falls im Material vorhanden — sonst leer lassen',
  year: 'Erscheinungs- bzw. Aufnahmejahr (yyyy)',
  coverImageUrl: 'URL eines Titelbilds, falls im Material vorhanden — sonst leer lassen',
  chapters: 'Kapitel- bzw. Abschnittsliste mit kurzen Beschreibungen',
  pages: 'Seitenanzahl, falls erkennbar',
  region: 'Geografischer Bezug (Ort, Region oder Land), falls erkennbar',
  topics: 'Die wichtigsten Themen, kommagetrennt',
  tags: 'Max. 10 Schluesselwoerter, Leerzeichen durch Bindestriche ersetzt, kommagetrennt',
  docType: 'Dokumentart (z.B. Studie, Bericht, Anleitung, Protokoll)',
  source: 'Quellenangabe (Publikation, Veranstaltung oder Herkunft), falls erkennbar',
  speakers: 'Alle erwaehnten Sprecherinnen und Sprecher, kommagetrennt',
  speakers_image_url: 'URL eines Sprecherbilds, falls vorhanden — sonst leer lassen',
  track: 'Track bzw. Programmschiene der Veranstaltung, falls erkennbar',
  markdown: 'Der ausgearbeitete Beitrag in Markdown (Ueberschriften, Absaetze, Listen)',
  galleryImageUrls: 'URLs von Bildern aus dem Material, kommagetrennt — sonst leer lassen',
  author_name: 'Name der Person, die hier zu Wort kommt',
  author_role: 'Rolle oder Funktion der Person, falls erwaehnt',
  author_image_url: 'URL eines Portraitbilds, falls vorhanden — sonst leer lassen',
  q1_experience: 'Antwort auf: Was wurde erlebt? In eigenen Worten der Person',
  q2_key_insight: 'Antwort auf: Was war die wichtigste Erkenntnis?',
  q3_why_important: 'Antwort auf: Warum ist das wichtig?',
  category: 'Die passende Kategorie der Massnahme',
  dokumentTyp: 'Dokumenttyp der Lieferung (z.B. Katalog, Preisliste)',
  produktname: 'Name des Produkts',
  lieferant: 'Name des Lieferanten',
  modell: 'Modellbezeichnung des Geraets',
}

/** Typ-spezifischer Einleitungssatz fuer den Journalist-Systemprompt */
const VIEW_TYPE_PROMPT_FOCUS: Record<DetailViewType, string> = {
  book: 'Du bereitest Buecher, Studien und Dokumente als verstaendliche Wissensbeitraege auf.',
  session:
    'Du bereitest Vortraege und Gespraeche einer Veranstaltung auf — mit Sprechern, Kernaussagen und Kontext.',
  testimonial:
    'Du bereitest persoenliche Erfahrungsberichte auf und bewahrst dabei die Stimme der Person.',
  blog: 'Du verwandelst Rohmaterial in einen gut lesbaren Blog-Beitrag.',
  climateAction:
    'Du bereitest Klima-Massnahmen strukturiert auf: Inhalt, Zustaendigkeiten und Bewertungen.',
  divaDocument: 'Du extrahierst strukturierte Produktdaten aus DIVA-Lieferdokumenten.',
  divaTexture: 'Du extrahierst Material- und Texturattribute aus DIVA-Lieferdaten.',
  refurbedDevice: 'Du extrahierst technische Daten und Zustand eines aufbereiteten Geraets.',
  website: 'Du strukturierst eine Webseite/Landingpage in Hero, Inhalts-Sektionen und Aufruf zur Handlung.',
}

/** LLM-Anweisung fuer ein Feld (kuratiert, sonst generischer Fallback). */
export function describeField(key: string): string {
  return FIELD_DESCRIPTIONS[key] ?? `Das Feld "${key}" passend aus dem Material befuellen — falls nicht erkennbar, leer lassen`
}

/** Name der Standard-Vorlage fuer einen Inhaltstyp (z.B. 'standard-book') */
export function getDefaultTemplateNameForViewType(viewType: string): string {
  return `${DEFAULT_TEMPLATE_PREFIX}${viewType.toLowerCase()}`
}

/** Prueft, ob ein Template-Name eine (reservierte) Standard-Vorlage bezeichnet */
export function isBuiltinDefaultTemplateName(name: string | undefined | null): boolean {
  if (!name) return false
  const normalized = name.trim().toLowerCase()
  if (!normalized.startsWith(DEFAULT_TEMPLATE_PREFIX)) return false
  const typePart = normalized.slice(DEFAULT_TEMPLATE_PREFIX.length)
  return DETAIL_VIEW_TYPES.some(t => t.toLowerCase() === typePart)
}

/** Markdown-Quelltext einer Standard-Vorlage generieren (Registry-getrieben) */
export function buildDefaultTemplateMarkdown(viewType: DetailViewType): string {
  // Verbindliche Basis-Felder zuerst (gemeinsamer Nenner jeder Library, siehe
  // base-fields.ts), danach die typ-spezifischen Pflicht- und optionalen Felder.
  // Dedupliziert: Basis-Felder, die ein Typ ohnehin fuehrt (z.B. title, language),
  // erscheinen nur einmal.
  const seen = new Set<string>()
  const fields: string[] = []
  for (const key of [...BASE_REQUIRED_FIELDS, ...getRequiredFields(viewType), ...getOptionalFields(viewType)]) {
    if (seen.has(key)) continue
    seen.add(key)
    fields.push(key)
  }
  const frontmatterLines = fields.map(key => `${key}: {{${key}|${describeField(key)}}}`)
  // detailViewType als hartes Feld (ohne {{}}): wird nicht ans LLM gegeben,
  // macht die Vorlage selbst-beschreibend und konsistenz-pruefbar.
  frontmatterLines.push(`detailViewType: ${viewType}`)

  return `---
${frontmatterLines.join('\n')}
---
# {{title|${describeField('title')}}}

> [!hinweis]-
> Dieser Beitrag wurde mit der Standard-Vorlage "${getDefaultTemplateNameForViewType(viewType)}" aus dem Quellmaterial generiert.

## Inhalt

{{summary|${describeField('summary')}}}

--- systemprompt
Du bist ein praeziser Journalist: Du verwandelst Rohmaterial (Transkripte, Dokumente, Notizen) in strukturierte Beitraege. ${VIEW_TYPE_PROMPT_FOCUS[viewType]}
- Befuelle ausschliesslich die definierten Felder — erfinde keine Inhalte.
- Kommuniziere klar und verstaendlich; erklaere Fachbegriffe kurz.
- Felder, die sich aus dem Material nicht ergeben, bleiben leer.
`
}

const builtinCache = new Map<DetailViewType, ParsedTemplate>()

/** Standard-Vorlage eines Inhaltstyps als ParsedTemplate (gecacht) */
export function getBuiltinDefaultTemplate(viewType: DetailViewType): ParsedTemplate {
  const cached = builtinCache.get(viewType)
  if (cached) return cached

  const markdown = buildDefaultTemplateMarkdown(viewType)
  const { template, errors } = parseTemplate(markdown, getDefaultTemplateNameForViewType(viewType))
  if (errors.length > 0) {
    // Generator und Parser leben im selben Repo — Fehler hier sind Bugs.
    throw new Error(
      `Standard-Vorlage fuer "${viewType}" ist nicht parsebar: ${errors.map(e => e.message).join('; ')}`
    )
  }
  builtinCache.set(viewType, template)
  return template
}

/** Standard-Vorlage anhand ihres reservierten Namens aufloesen */
export function resolveBuiltinDefaultTemplateByName(name: string): ParsedTemplate | null {
  if (!isBuiltinDefaultTemplateName(name)) return null
  const typePart = name.trim().toLowerCase().slice(DEFAULT_TEMPLATE_PREFIX.length)
  const viewType = DETAIL_VIEW_TYPES.find(t => t.toLowerCase() === typePart)
  if (!viewType || !isValidDetailViewType(viewType)) return null
  return getBuiltinDefaultTemplate(viewType)
}

/** Alle Standard-Vorlagen (z.B. fuer die Templates-Liste der API) */
export function listBuiltinDefaultTemplates(): ParsedTemplate[] {
  return DETAIL_VIEW_TYPES.map(viewType => getBuiltinDefaultTemplate(viewType))
}

/**
 * Standard-Vorlage als TemplateDocument-kompatibles Objekt — fuer
 * serializeTemplateToMarkdown() und die Templates-API (read-only).
 */
export function toBuiltinTemplateDocument(
  template: ParsedTemplate,
  libraryId: string
): TemplateDocument {
  return {
    _id: `builtin:${template.name}`,
    name: template.name,
    libraryId,
    user: 'builtin',
    metadata: template.metadata,
    systemprompt: template.systemprompt,
    markdownBody: template.markdownBody,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    version: 1,
  } as unknown as TemplateDocument
}
