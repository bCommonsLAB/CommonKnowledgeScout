/**
 * @fileoverview Aufloesung der Bericht-Vorlagen (Wirkungs- + Enabler-Bericht).
 *
 * @description
 * Liefert fuer einen Bericht-Lauf die Vorlage in beiden benoetigten Formen:
 * `templateContent` (serialisiert, geht an den Secretary /transformer/template)
 * und `markdownBody` (wird nach dem LLM-Pass deterministisch mit
 * renderTemplateBody gefuellt — LLM-Felder + Code-Variablen).
 *
 * Reihenfolge (User-Entscheid 2026-07-11, editierbar ohne Code):
 * 1. explizite reportTemplateId (Fehler, wenn nicht vorhanden — kein Silent
 *    Fallback),
 * 2. Library-Vorlage mit dem Builtin-Namen (bericht-wirkung/bericht-enabler)
 *    — die Kopie aus der Vorlagenverwaltung uebersteuert den Builtin,
 * 3. Builtin aus report-templates.ts.
 */

import {
  loadTemplateFromMongoDB,
  listTemplatesFromMongoDB,
  serializeTemplateToMarkdown,
} from '@/lib/templates/template-service-mongodb'
import {
  getBuiltinReportTemplate,
  REPORT_TEMPLATE_NAMES,
  type ReportTemplateKind,
} from '@/lib/templates/report-templates'
import { toBuiltinTemplateDocument } from '@/lib/templates/default-templates'
import type { TemplateDocument } from '@/lib/templates/template-types'

export interface ResolvedReportTemplate {
  /** Serialisierte Vorlage (ohne creation-Block) fuer den Secretary-Transform. */
  templateContent: string
  /** Markdown-Body mit {{variablen}} — Layout des fertigen Berichts. */
  markdownBody: string
  /** Frontmatter-Feld-Keys (= vom LLM erwartete Felder). */
  fieldKeys: string[]
  /** 'library-id' | 'library-name' | 'builtin' — fuer Job-Trace/Transparenz. */
  source: 'library-id' | 'library-name' | 'builtin'
  templateId?: string
}

function fromDocument(
  doc: TemplateDocument,
  source: ResolvedReportTemplate['source'],
  templateId?: string,
): ResolvedReportTemplate {
  return {
    templateContent: serializeTemplateToMarkdown(doc, false),
    markdownBody: doc.markdownBody || '',
    fieldKeys: doc.metadata.fields.map((f) => f.key),
    source,
    templateId,
  }
}

export async function resolveReportTemplate(
  kind: ReportTemplateKind,
  libraryId: string,
  userEmail: string,
  reportTemplateId?: string,
): Promise<ResolvedReportTemplate> {
  if (reportTemplateId) {
    const doc = await loadTemplateFromMongoDB(reportTemplateId, libraryId, userEmail)
    if (!doc) {
      throw new Error(
        `Bericht-Vorlage "${reportTemplateId}" nicht gefunden — ` +
        `Vorlage anlegen oder reportTemplateId weglassen (Builtin "${REPORT_TEMPLATE_NAMES[kind]}").`,
      )
    }
    return fromDocument(doc, 'library-id', reportTemplateId)
  }

  // Library-Kopie mit dem Builtin-Namen uebersteuert den Builtin (Frontend-editierbar).
  const name = REPORT_TEMPLATE_NAMES[kind]
  const libraryTemplates = await listTemplatesFromMongoDB(libraryId, userEmail)
  const override = libraryTemplates.find((t) => t.name === name)
  if (override) return fromDocument(override, 'library-name', String(override._id))

  const builtin = getBuiltinReportTemplate(kind)
  return fromDocument(toBuiltinTemplateDocument(builtin, libraryId), 'builtin')
}
