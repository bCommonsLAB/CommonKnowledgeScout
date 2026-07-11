/**
 * @fileoverview Builtin-Vorlagen der Galerie-Berichte (Wirkungsbericht +
 * Enabler-Bericht) — im Sourcecode persistiert, analog default-templates.ts.
 *
 * @description
 * User-Entscheid 2026-07-11: BEIDE Berichte sind vollstaendig
 * template-getrieben und in der Vorlagenverwaltung sichtbar/kopierbar:
 * - Frontmatter = Datenschema der LLM-Felder ({{feld|Anweisung}}),
 * - Markdown-Body = Bericht-Layout mit Variablen — LLM-Felder UND
 *   deterministisch vom Code gelieferte Variablen (z.B. {{ergebnis_tabelle}},
 *   {{hebel_tabellen}}, {{kennzahlen}}, {{stand}}) — inklusive der statischen
 *   Methodik-Erklaerung als editierbarer Text,
 * - Schlussblock = Systemprompt (Prompt-Design transparent).
 *
 * Aufloesung zur Laufzeit (report-template-resolver.ts): explizite
 * reportTemplateId → Library-Vorlage GLEICHEN NAMENS (editierbarer Override)
 * → diese Builtins. Die Namen sind bewusst NICHT reserviert, damit eine
 * Library-Kopie den Builtin ueberschreiben kann.
 */

import { parseTemplate } from './template-parser'
import type { ParsedTemplate } from './template-types'

export type ReportTemplateKind = 'overlap' | 'enabler'

/** Vorlagen-Namen; eine gleichnamige Library-Vorlage uebersteuert den Builtin. */
export const REPORT_TEMPLATE_NAMES: Record<ReportTemplateKind, string> = {
  overlap: 'bericht-wirkung',
  enabler: 'bericht-enabler',
}

const WIRKUNG_TEMPLATE = `---
title: {{title|Kurzer, sachlicher Titel des Berichts (max. 80 Zeichen), beginnend mit "Wirkungsbericht"}}
themenfelder: {{themenfelder|Markdown-Abschnitt: welche inhaltlichen Cluster/Themenfelder es gibt, wo sie sich ueberschneiden und welche Massnahmen (Nr) dazugehoeren. 2-5 Absaetze.}}
groessenordnungen: {{groessenordnungen|Markdown-Abschnitt: welche Cluster/Massnahmen wie viel beitragen (kt CO2, EUR), wo die grossen Hebel liegen, wie weit naive und bereinigte Summe auseinanderliegen und warum. Zahlen NUR aus der Vorlage uebernehmen, nicht selbst rechnen.}}
handlungsempfehlungen: {{handlungsempfehlungen|Markdown-Abschnitt: konkrete, priorisierte Empfehlungen — welche Massnahmen-Buendel zuerst, wo Buendelung Kosten spart, wo Daten fehlen ("was waere jetzt zu tun").}}
---
# {{title}}

*Stand: {{stand}} · Modell: {{modell}} · Alle bereinigten Werte sind SCHAETZUNGEN; die naive Summe ist die Obergrenze.*

## Wie dieser Bericht gerechnet wird

Naive Summen ueberschaetzen, weil sich Massnahmen dieselben Emissionen bzw.
Kosten teilen koennen (Doppelzaehlung/Policy Overlap). Ein LLM vergibt pro
Massnahme zwei Korrekturfaktoren in [0..1] — greedy, absteigend nach Wirkung:
jede Massnahme wird relativ zu den bereits gezaehlten bewertet. Faktor CO2
korrigiert Doppelzaehlung geteilter Emissionen; Faktor Kosten schaetzt
Synergien durch Buendelung (gemeinsame Infrastruktur/Beschaffung). Die Summen
der Ergebnis-Tabelle rechnet anschliessend deterministischer Code — nie das LLM.

## Kennzahlen

{{kennzahlen}}

## Themenfelder

{{themenfelder}}

## Groessenordnungen

{{groessenordnungen}}

## Was jetzt zu tun waere

{{handlungsempfehlungen}}

## Ergebnis-Tabelle

{{ergebnis_tabelle}}

{{ohne_angabe}}

## Methodik und Grenzen

Auch LLM-Urteile sind Schaetzungen — jede Zeile der Ergebnis-Tabelle traegt
eine Begruendung und sollte stichprobenartig geprueft werden. Massnahmen ohne
LLM-Faktor zaehlen voll (die naive Summe bleibt die Obergrenze) und sind in
den Kennzahlen ausgewiesen.

--- systemprompt
Du schreibst die Management-Zusammenfassung eines Klimamassnahmen-Wirkungsberichts auf Deutsch.
Grundlage sind eine fertig gerechnete Ergebnis-Tabelle (Korrekturfaktoren fuer
Doppelzaehlung der CO2-Wirkung und Kosten-Synergien) sowie Kennzahlen; beides steht im
Quelltext, die Rohdaten zusaetzlich strukturiert im Kontext. Rechne NICHT selbst —
uebernimm Zahlen ausschliesslich aus der Vorlage. Nuechtern, praezise, keine Floskeln.
Kennzeichne Schaetzungen als solche: die naive Summe ist die Obergrenze, die bereinigte
eine konservative Schaetzung auf Basis von LLM-Faktoren.
`

const ENABLER_TEMPLATE = `---
title: {{title|Kurzer, sachlicher Titel des Berichts (max. 80 Zeichen), beginnend mit "Enabler-Bericht"}}
cluster_analyse: {{cluster_analyse|Markdown-Abschnitt: je Cluster ein kurzer Prosa-Absatz, der die wichtigsten Hebel-Massnahmen NENNT und ERKLAERT, warum sie zentral sind — welche Massnahmen sie aktivieren, wie viel bereinigte Wirkung daran haengt, welche Abhaengigkeiten sie aufloesen. Zahlen NUR aus der Vorlage uebernehmen, nicht selbst rechnen.}}
handlungsempfehlungen: {{handlungsempfehlungen|Markdown-Abschnitt: konkrete, priorisierte Empfehlungen — welche Enabler zuerst angegangen werden sollten und warum, welche Cluster ohne ihre Enabler blockiert sind, wo Daten oder Beziehungen fehlen.}}
---
# {{title}}

*Stand: {{stand}} · Hebel-Rechnung deterministisch aus den berechneten Beziehungen · Prosa: {{modell}} · Beziehungs-Stand: {{beziehungs_stand}}*

## Was ist ein Enabler und wie wird der Hebel gerechnet

Enabler sind Massnahmen, die andere Massnahmen erst ermoeglichen (gerichtete
"unterstuetzt"-Beziehungen). Sie erben ANTEILIG die bereinigte CO2-Wirkung der
von ihnen aktivierten Massnahmen: 1 Hop, mehrere Enabler teilen sich die
Wirkung nach Kantengewicht, Daempfung beta = {{beta}}. Die Hebelwirkung ist
eine ZUSCHREIBUNGS-SCHAETZUNG und wird NIE zur eigenen Wirkung addiert —
sonst wuerde dieselbe Einsparung doppelt gezaehlt. Wo vorhanden, fliessen die
Stufe-3-Korrekturfaktoren des Wirkungsberichts ein; sonst gelten die naiven
CO2-Werte.

## Kennzahlen

{{kennzahlen}}

## Die wichtigsten Enabler je Cluster

{{cluster_analyse}}

## Hebel-Tabellen je Cluster

{{hebel_tabellen}}

## Was jetzt zu tun waere

{{handlungsempfehlungen}}

## Methodik und Grenzen

Die Hebel-Rechnung ist deterministisch, haengt aber von der Qualitaet der
berechneten Beziehungen ab (LLM-generierte Kanten, siehe Beziehungs-Stand im
Kopf). Hat sich der Katalog seither geaendert, lohnt ggf. eine Neuberechnung
der Beziehungen — sie ist teuer, die Entscheidung liegt beim Anwender.

--- systemprompt
Du schreibst die Management-Zusammenfassung eines Enabler-Berichts (Hebel-Massnahmen) auf Deutsch.
Grundlage sind fertig gerechnete Hebel-Tabellen je Cluster (Enabler mit eigener bereinigter
Wirkung, Hebelwirkung und den wichtigsten aktivierten Massnahmen) sowie Kennzahlen; beides
steht im Quelltext, die Rohdaten zusaetzlich strukturiert im Kontext. Rechne NICHT selbst —
uebernimm Zahlen ausschliesslich aus der Vorlage. Erklaere in Prosa, WARUM die genannten
Enabler zentral sind (was sie aktivieren, was ohne sie blockiert waere). Nuechtern, praezise,
keine Floskeln. Kennzeichne die Hebelwirkung stets als Zuschreibungs-Schaetzung, die nie zur
eigenen Wirkung addiert werden darf.
`

const MARKDOWN_BY_KIND: Record<ReportTemplateKind, string> = {
  overlap: WIRKUNG_TEMPLATE,
  enabler: ENABLER_TEMPLATE,
}

/**
 * Roh-Markdown einer Bericht-Vorlage — Quelle der Sample-Dateien unter
 * template-samples/ (Konsistenz-Test haelt beide synchron).
 */
export function getReportTemplateMarkdown(kind: ReportTemplateKind): string {
  return MARKDOWN_BY_KIND[kind]
}

const cache = new Map<ReportTemplateKind, ParsedTemplate>()

/** Builtin-Bericht-Vorlage als ParsedTemplate (gecacht, Parse-Fehler = Bug). */
export function getBuiltinReportTemplate(kind: ReportTemplateKind): ParsedTemplate {
  const cached = cache.get(kind)
  if (cached) return cached
  const { template, errors } = parseTemplate(MARKDOWN_BY_KIND[kind], REPORT_TEMPLATE_NAMES[kind])
  if (errors.length > 0) {
    throw new Error(
      `Bericht-Vorlage "${REPORT_TEMPLATE_NAMES[kind]}" ist nicht parsebar: ${errors.map((e) => e.message).join('; ')}`,
    )
  }
  cache.set(kind, template)
  return template
}

/** Beide Bericht-Vorlagen (fuer die Templates-Liste der API, read-only). */
export function listBuiltinReportTemplates(): ParsedTemplate[] {
  return (Object.keys(REPORT_TEMPLATE_NAMES) as ReportTemplateKind[]).map(getBuiltinReportTemplate)
}
