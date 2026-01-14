---
title: Template-System (MongoDB Templates, Secretary-Transformation, Creation Wizard)
date: 2026-01-02
status: draft
---

## Warum dieses Dokument?

Im Projekt wird „Template“ in unterschiedlichen Kontexten benutzt. Das führt leicht zu Fehlinterpretationen.
Dieses Dokument beschreibt **das tatsächliche System** (Source of Truth, Datenmodell, Flows) und übersetzt es in den „Journalist‑Moment“: *Was der Anwender im Template‑Editor definiert und was dann wo passiert.*

## Kernaussage (eine Zeile)

**Ein Template ist ein MongoDB-Dokument (`TemplateDocument`), das gleichzeitig (A) ein extraktives Schema + Regeln für Secretary und (B) einen optionalen Creation‑Flow für den Wizard enthält.**

## Begriffe (präzise)

### 1) TemplateDocument (Source of Truth)

Ein Template wird in MongoDB gespeichert und ist strukturiert:

- **`metadata.fields[]`**: Frontmatter-Felder als „Fragen“ / Platzhalter (extraktiv).
- **`systemprompt`**: Rolle/Regeln/Policies für die Transformation.
- **`markdownBody`**: Ausgabeformat als Markdown (mit Platzhaltern `{{key|...}}`).
- **`creation` (optional)**: UI-Flow für den Creation Wizard (Steps, supportedSources, preview, save rules).

Typdefinition: `src/lib/templates/template-types.ts` (`TemplateDocument`).

### 2) Secretary-Template-Content (Wire Format)

Der Secretary Service bekommt **keinen** `TemplateDocument` als JSON, sondern **Markdown mit YAML-Frontmatter + systemprompt + body**.

Wichtig: Der Secretary kann nur „flaches YAML“ – daher wird der `creation`‑Block **vor dem Senden entfernt**.

### 3) /templates Ordner im Library-Storage (Legacy/Import)

Es gibt zusätzlich ein Legacy-Konzept „Templates als Dateien im Library-Root `/templates` Ordner“.
Dieses Konzept wird heute vor allem für **Import nach MongoDB** genutzt (`/api/templates/import`).
Es ist **nicht** die primäre Quelle für die laufende Transformation, wenn Templates in MongoDB vorhanden sind.

## Der „Journalist‑Moment“ im Template‑Editor (wie der Anwender denkt)

Im Template-Editor werden (in einem Dokument) vier Dinge gepflegt:

1) **Schema / Metadaten (Frontmatter)**
   - „Welche Fälle/Felder sollen extrahiert werden?“
   - → `metadata.fields[]` (Key + Frage/Description + rawValue)

2) **Rollenanweisung / Regeln**
   - „Wie streng/extraktiv? Welche Prioritäten? Welche Normalisierung?“
   - → `systemprompt`

3) **Struktur / Ausgabeformat**
   - „Wie soll der Bericht aussehen?“ (Markdown mit Platzhaltern)
   - → `markdownBody`

4) **Creation Flow**
   - „Wie führt der Wizard den User durch die Datenerfassung?“
   - → `creation` (optional)

UI: `src/components/templates/structured-template-editor.tsx` und `src/components/templates/template-management.tsx`.

## Wie das System das Template benutzt (3 wichtigste Flows)

### Flow A: External Jobs (Artefakt-Pipeline)

```mermaid
flowchart TD
  job[External Job] --> pick[pickTemplate() aus MongoDB]
  pick --> serialize[serializeTemplateToMarkdown(includeCreation=false)]
  serialize --> secretary[Secretary /transformer/template]
  secretary --> transformMd[Transformations-Artefakt speichern]
```

- Template-Load: `src/lib/external-jobs/template-files.ts` (`pickTemplate`)
- Serialisierung: `src/lib/templates/template-service-mongodb.ts` (`serializeTemplateToMarkdown`)

### Flow B: Prozess „Text → Felder“ (Wizard & Template-Tests)

Wizard/Tests rufen heute häufig `POST /api/secretary/process-text`:

- Wenn `template` kein Standard-Template ist, wird das Template aus MongoDB geladen.
- Danach wird es in Secretary‑kompatibles Template-Content serialisiert (ohne `creation`).

Route: `src/app/api/secretary/process-text/route.ts`

### Flow C: Creation Wizard (UI)

Der Wizard lädt die Template-Konfiguration **als JSON** (inkl. `creation`) aus MongoDB:

- Client Load: `src/lib/templates/template-service-client.ts` (`loadTemplateConfig`)
- Wizard UI: `src/components/creation-wizard/creation-wizard.tsx`

Der Wizard nutzt also:

- `creation` für Steps/UX
- `metadata.fields` für Felder/Frontmatter-Keys
- `markdownBody` für Preview/Render

## Wo es leicht schiefgeht (typische Missverständnisse)

1) **„Template = template-samples/pdfanalyse.md im Repo“**
   - Das Repo-File ist eine *Snapshot/Referenz*, nicht automatisch die laufende Quelle.
   - Laufende Quelle ist: MongoDB Template-Dokument (Name `pdfanalyse`).

2) **„Creation gehört in Secretary Template“**
   - Intern ja (weil es im gleichen Dokument gespeichert ist).
   - Aber **wire-format** an Secretary: `creation` muss entfernt werden.

3) **„Template-Service lädt aus /templates, also ist /templates Source of Truth“**
   - Das stimmt nur für den *Legacy Storage Import*.
   - Für Pipeline/Wizard ist MongoDB die primäre Quelle.

## Empfehlung (aktuelle Richtung)

- **MongoDB ist Source of Truth** für Templates.
- `/templates` im Library-Storage ist optionaler Importpfad.
- Repo-Ordner `template-samples/` sollte als „Beispiel/Export“ dokumentiert werden, nicht als aktive Quelle.


