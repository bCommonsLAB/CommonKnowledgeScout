/**
 * @fileoverview Bericht-Template fuer den LLM-Overlap-Bericht (Stufe 3e).
 *
 * @description
 * Die Prosa des Berichts entsteht ueber den Secretary-Endpoint
 * `/transformer/template` (User-Entscheid 2026-07-08): Das Template traegt
 * System-Prompt + Abschnitts-Prompts und ist damit in der Vorlagenverwaltung
 * editierbar (options.reportTemplateId); ohne konfigurierte Vorlage greift
 * der hier eingebaute Default (im Job-Trace ausgewiesen, kein Silent
 * Fallback). Der Maßnahmen-Kontext geht als `text` (Ergebnis-Tabelle) plus
 * strukturiertes JSON im `context`-Parameter mit; das LLM-Modell (z.B. ein
 * 1M-Kontext-Modell) ist Parameter des Laufs.
 *
 * Frontmatter-Contract: FLACHE Felder — die drei Prosa-Abschnitte kommen als
 * einzelne Text-Felder zurueck; die Zahlen/Tabelle rechnet weiterhin unser
 * Code (kein LLM-Rechnen).
 */

import { loadTemplateFromMongoDB, serializeTemplateToMarkdown } from '@/lib/templates/template-service-mongodb'

/** Feld-Keys, die das Bericht-Template liefern MUSS (Antwortschema). */
export const OVERLAP_REPORT_FIELDS = ['title', 'themenfelder', 'groessenordnungen', 'handlungsempfehlungen'] as const

/** Eingebautes Default-Template (Format wie serializeTemplateToMarkdown, ohne creation-Block). */
export const DEFAULT_OVERLAP_REPORT_TEMPLATE = `---
title: {{title|Kurzer, sachlicher Titel des Berichts (max. 80 Zeichen), beginnend mit "Wirkungsbericht"}}
themenfelder: {{themenfelder|Markdown-Abschnitt: welche inhaltlichen Cluster/Themenfelder es gibt, wo sie sich ueberschneiden und welche Massnahmen (Nr) dazugehoeren. 2-5 Absaetze.}}
groessenordnungen: {{groessenordnungen|Markdown-Abschnitt: welche Cluster/Massnahmen wie viel beitragen (kt CO2, EUR), wo die grossen Hebel liegen, wie weit naive und bereinigte Summe auseinanderliegen und warum. Zahlen NUR aus der Vorlage uebernehmen, nicht selbst rechnen.}}
handlungsempfehlungen: {{handlungsempfehlungen|Markdown-Abschnitt: konkrete, priorisierte Empfehlungen — welche Massnahmen-Buendel zuerst, wo Buendelung Kosten spart, wo Daten fehlen ("was waere jetzt zu tun").}}
---

--- systemprompt
Du schreibst die Management-Zusammenfassung eines Klimamassnahmen-Berichts auf Deutsch.
Grundlage sind eine fertig gerechnete Ergebnis-Tabelle (Korrekturfaktoren fuer
Doppelzaehlung der CO2-Wirkung und Kosten-Synergien) sowie Kennzahlen; beides steht im
Quelltext, die Rohdaten zusaetzlich strukturiert im Kontext. Rechne NICHT selbst —
uebernimm Zahlen ausschliesslich aus der Vorlage. Nuechtern, praezise, keine Floskeln.
Kennzeichne Schaetzungen als solche: die naive Summe ist die Obergrenze, die bereinigte
eine konservative Schaetzung auf Basis von LLM-Faktoren.`

export interface ResolvedReportTemplate {
  templateContent: string
  /** 'library' = Vorlage aus der Vorlagenverwaltung, 'builtin' = Default. */
  source: 'library' | 'builtin'
  templateId?: string
}

/**
 * Loest das Bericht-Template auf: explizit konfigurierte Library-Vorlage
 * (Fehler, wenn sie nicht existiert — kein Silent Fallback) oder der
 * eingebaute Default.
 */
export async function resolveOverlapReportTemplate(
  libraryId: string,
  userEmail: string,
  reportTemplateId?: string,
): Promise<ResolvedReportTemplate> {
  if (reportTemplateId) {
    const doc = await loadTemplateFromMongoDB(reportTemplateId, libraryId, userEmail)
    if (!doc) {
      throw new Error(
        `overlap-report: Bericht-Vorlage "${reportTemplateId}" nicht gefunden — ` +
        `Vorlage anlegen oder reportTemplateId weglassen (eingebauter Default).`,
      )
    }
    return {
      templateContent: serializeTemplateToMarkdown(doc, false),
      source: 'library',
      templateId: reportTemplateId,
    }
  }
  return { templateContent: DEFAULT_OVERLAP_REPORT_TEMPLATE, source: 'builtin' }
}
