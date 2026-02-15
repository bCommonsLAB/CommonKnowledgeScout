# Analyse: Template-Transformation – Wizard vs. JobWorker

## Übersicht

Die Template-Transformation wird an **zwei Stellen** verwendet:
1. **JobWorker** (External Jobs): `phase-template.ts` + `template-body-builder.ts`
2. **Creation Wizard**: `GenerateDraftStep` → `/api/secretary/process-text`

## JobWorker-Flow (phase-template.ts)

1. **Eingabe**: Transkript-Text aus vorheriger Phase
2. **Secretary-Aufruf**: `runTemplateTransform` (adapter) → Secretary `/transformer/template`
3. **Antwort**: `structured_data` (JSON mit Metadaten inkl. `bodyInText`)
4. **Body-Aufbau** (zentral in `template-body-builder.ts`):
   - **1) bodyInText**: Wenn `meta.bodyInText` nicht leer → direkt verwenden
   - **2) template_markdownBody**: Template-Body mit `{{key}}`-Platzhaltern rendern (Werte aus meta)
   - **3) fallback**: `buildFallbackBodyFromMeta` (title, summary, messages, nextSteps)
5. **Ergebnis**: `createMarkdownWithFrontmatter(bodyOnly, metaForFrontmatter)`

## Wizard-Flow (GenerateDraftStep)

1. **Eingabe**: `buildCorpusText(sources)` – Korpus aus ausgewählten Artefakten
2. **API-Aufruf**: `/api/secretary/process-text` (FormData: text, template, target_language)
3. **process-text Route**: Lädt Template aus MongoDB, ruft Secretary auf, gibt `data.data` zurück
4. **GenerateDraftStep**: Nutzt `result.markdown` und `result.structured_data` **direkt**
5. **Problem**: Kein Aufruf von `buildTransformationBody` – wenn Secretary `markdown`/`text` leer liefert (z.B. `content: null` vom LLM), bleibt die Vorschau leer

## Doppelte Implementierung?

**Nein** – die Logik ist nicht doppelt, aber **inkonsistent genutzt**:

- **JobWorker**: Verwendet `buildTransformationBody` immer – auch wenn `bodyInText` leer ist, greifen Fallbacks (template_markdownBody, buildFallbackBodyFromMeta).
- **Wizard**: Verwendet nur die rohe Secretary-Antwort. Kein Fallback, wenn `markdown`/`text` fehlt.

## Secretary-Service Log (content: null)

Das Log zeigt `response: { content: null }` – das LLM hat keine Antwort geliefert (z.B. Timeout, Filter, Token-Limit). Trotzdem kann der Secretary `structured_data` zurückgeben, wenn er aus einer Teilantwort oder einem Fallback parst. Die Metadaten (title, teaser, date, …) sind im Screenshot sichtbar – also wurde `structured_data` geliefert.

## Lösung

Die **zentrale Logik** (`buildTransformationBody`) soll auch im Wizard-Pfad genutzt werden:

- **process-text Route**: Nach dem Secretary-Aufruf: Wenn `structured_data` vorhanden, aber `markdown`/`text` leer ist → `buildTransformationBody` mit `structured_data` + `templateContent` aufrufen und den generierten Body als `markdown` zurückgeben.
- Damit wird dieselbe Logik wie im JobWorker verwendet; die Markdown-Vorschau zeigt mindestens den Fallback-Body (z.B. Titel + Teaser).
