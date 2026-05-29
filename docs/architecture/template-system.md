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

---

## Template-Lifecycle: Anlegen, Aktualisieren, Sync (operational)

Diese Sektion beantwortet konkret die Frage: **„Ich habe `template-samples/foo.md` geändert — wie kommt das in MongoDB?"** Sie hat in der DIVA-Texture-Session (Mai 2026) für mehrere Iterationen Reibung erzeugt; daher hier festgehalten.

### Erst-Import (Template existiert noch nicht in MongoDB)

```
POST /api/templates/import   { fileName: "Foo.md", libraryId: "..." }
```

- Liest `Foo.md` aus dem Library-Storage `/templates`-Ordner.
- Erzeugt einen neuen MongoDB-Eintrag.
- Funktioniert **nur**, wenn der Name noch nicht existiert.

### ⚠️ Re-Import bei bestehendem Template

`importTemplateFromStorage` (in `src/lib/templates/template-import-export.ts`) **wirft** explizit:

```ts
if (exists) {
  throw new Error(`Template "${templateName}" existiert bereits in MongoDB`)
}
```

→ **Es gibt heute KEINEN Overwrite-Pfad** über den Import-Endpunkt. Die UI zeigt diesen Error möglicherweise still oder als allgemeinen Fehler. Wer denkt „ich habe re-importiert" und die DB ist trotzdem alt: vermutlich ist genau dieser Pfad gegriffen.

### Update bestehender Templates — drei Wege

| Variante | Endpunkt / Methode | Wann sinnvoll |
|---|---|---|
| **A — UI-Editor** | `PUT /api/templates` via Template-Editor | Kleinere Änderungen, einzelne Felder. Schreibt direkt `systemprompt` / `markdownBody` / `metadata`. |
| **B — Delete + Re-Import** | `DELETE /api/templates/[templateId]` → `POST /api/templates/import` | Wenn die `template-samples/*.md`-Datei die kanonische Quelle ist und mehrere Änderungen gleichzeitig kommen. **Achtung:** löscht auch alle Verknüpfungen zur Library-Config (Template-Auswahl muss ggf. neu gesetzt werden). |
| **C — direkter Mongo-Edit** | manuell via DB-Client | Nur als Notlösung / Migration. |

### Drift erkennen

Es gibt aktuell **keinen automatischen Sync** zwischen `template-samples/*.md` und der MongoDB-Version. Drift ist normal — die Datei im Repo dokumentiert den letzten gewünschten Stand, die DB-Version ist der tatsächlich produktive Stand.

**Diagnose-Tipps:**
- Das Secretary-Log zeigt `template_content_md5_8` (erste 8 Stellen des MD5 vom serialisierten Template-Content). Wenn der Hash zwischen zwei Läufen identisch ist, hat sich am Wire-Format **nichts** geändert — egal was die UI sagt.
- Beim Vergleich „Repo vs. MongoDB" hilft `serializeTemplateToMarkdown(template, false)` (ohne creation-Block), weil das genau das ist, was an den Secretary geht.

### Follow-up: `overwrite: true` im Import

Dokumentiert in `docs/refactor/diva-texture-liefersystem/AGENT-BRIEF.md` (Follow-up A1): Optionales Overwrite-Flag im Import-Endpunkt würde diesen Pain-Point eliminieren. ~30 Zeilen Code.

---

## Frontmatter-Field-Mechanik: die drei Fälle

Der Parser (`src/lib/templates/template-parser.ts`) liest jede Frontmatter-Zeile und behandelt sie nach folgender Regel — das hat im Code Konsequenzen, die nicht offensichtlich sind:

### Fall 1: `key: {{variable|description}}`

```yaml
material_class: {{material_class|Eine aus: fabric, leather, wood, ...}}
```

- Wird zu `metadata.fields[]`-Eintrag mit `description = "Eine aus: ..."`.
- Erscheint **im LLM-Schema** (System-Prompt-Auto-Schema + User-Prompt-`REQUIRED FIELDS`).
- Erscheint **im Frontmatter** des Output-Markdowns (wird vom LLM gefüllt).
- Vom Postprocessor kann es überschrieben werden, wenn deterministisch.

### Fall 2: `key: value` (ohne `{{...}}`-Token)

```yaml
sprache: de
docType: texturanalyse
detailViewType: divaTexture
```

- Wird zu `metadata.fields[]`-Eintrag mit `description = ""` und `rawValue = "de"` (etc.).
- Erscheint **NICHT im LLM-Schema** — der Filter in `generateResponseSchemaFromFields` (`template-service-mongodb.ts:45`) überspringt alle `description === ''`-Felder. Begründung im Code: ohne diesen Filter würde z.B. `detailViewType: "session"` vom LLM eigenmächtig zu `"video"` geändert.
- Erscheint **im Frontmatter** des Output-Markdowns als statischer Wert.

### Fall 3: `# kommentar`

```yaml
# review_status: string  (Lebenszyklus-Status, Lea-Regel #12)
```

- Wird vom Parser **komplett ignoriert** (greift nicht durch das Regex `^(\w+):`).
- Dient nur als Doku für Template-Autoren.

### Konsequenz für „spezielle" Felder

Felder, die SEPARAT in `metadata.detailViewType` o.ä. extrahiert werden (siehe nächste Sektion) UND zusätzlich im Frontmatter stehen, führen zu **Duplikat-Output** im serialisierten Template. Das war in DIVA-Texture-Update-3 der `detailViewType`-Bug. Wenn neue Sonderfelder eingeführt werden, **immer prüfen**: Wird das Feld auch durch den generic-Field-Parser erfasst? Wenn ja — Duplikat-Guard im Serializer einbauen oder Sonderfeld aus dem fields-Array filtern.

---

## Spezial-Mechaniken im System-Prompt

### `detailViewType` (Frontmatter)

- Wird zusätzlich aus dem Frontmatter extrahiert in `metadata.detailViewType` (siehe `template-parser.ts:48-63`).
- Steuert die Detail-Ansicht in der UI (z.B. `divaTexture`, `book`, `session`, `divaDocument`).
- Triggert auch DIVA-Texture-spezifische Pipeline-Pfade (siehe `isDivaTextureTemplate` in `first-pass-runner.ts`).
- **Bug-fix Mai 2026:** Serializer schrieb das Feld doppelt — einmal aus `metadata.fields[]` (rawValue-Fall), einmal aus `metadata.detailViewType`. Jetzt mit Duplikat-Check (`template-service-mongodb.ts:264-273`).

### „Handgeschriebenes Schema"-Marker

Die Funktion `hasHandwrittenResponseSchema` (`template-service-mongodb.ts:89`) prüft, ob der System-Prompt eines der Wörter enthält:

- `antwortschema`
- `response schema`
- `response format`

Wenn ja, **wird das Auto-Schema NICHT angehängt**. Das ist die Escape-Klappe, wenn:

- Das Template ein komplexes verschachteltes Schema hat (z.B. mit Sub-Arrays).
- Wie bei DIVA-Texture-Update-3 das Schema bereits vom Secretary im User-Prompt unter `REQUIRED FIELDS` geliefert wird und doppelte Tokens vermieden werden sollen.

Konkret im DIVA-Template:

```
HINWEIS zum Antwortschema: Das vollstaendige Schema mit allen Feldnamen + Typen
liefert der Secretary-Service AUTOMATISCH im User-Prompt unter REQUIRED FIELDS
(generiert aus den Frontmatter-Variablen dieses Templates)...
```

Das Wort „Antwortschema" hier triggert den Marker → kein Auto-Schema im System-Prompt. Spart in der Praxis ~1 k Tokens pro Lauf (gemessen 6554 → 5533 in der DIVA-Texture-Validierung).

### Wer baut was im LLM-Call (CKS ↔ Secretary)

Bei Image-Analyze-Calls über `callImageAnalyzerTemplate`:

```
CKS-Pipeline                          Secretary-Service                 LLM
──────────────────                    ───────────────────              ──────
liefert template_content   ──────►    parst Frontmatter-Variablen
(Frontmatter + Systemprompt)          (= REQUIRED FIELDS)
                                                                       sieht:
liefert context (JSON)     ──────►    baut User-Prompt:                - system_prompt
                                      - "CONTEXT: { ... }"               (von CKS)
                                      - "REQUIRED FIELDS: { ... }"     - user_prompt
                                      - "INSTRUCTIONS: ..."              (vom Secretary)
                                                                       - images
liefert images (multipart) ──────►    leitet 1:1 weiter
```

**Konsequenz:** Das LLM kennt das Schema **immer aus zwei Quellen**, wenn beide aktiv sind — System-Prompt-Auto-Schema **und** User-Prompt-`REQUIRED FIELDS`. Beide werden aus derselben Quelle generiert (`metadata.fields[]`), aber unterschiedlich formatiert. → Schema-Doppelung. Mit dem Antwortschema-Marker (oben) lässt sich das System-Prompt-Schema unterdrücken, sodass nur das User-Prompt-Schema bleibt.

Für reine Text-Transformation (`/transformer/template`) sieht der Flow ähnlich aus, aber ohne `REQUIRED FIELDS`-Block — dort ist das Auto-Schema im System-Prompt unverzichtbar.

---

## Cheat-Sheet: „Ich will X — wo geht das?"

| Ziel | Wie |
|---|---|
| Ein neues Template anlegen | `template-samples/Foo.md` schreiben → in Library `/templates` hochladen → `POST /api/templates/import` |
| Ein Template-Feld ändern (z.B. neue Enum-Option in `material_type`) | Template-Editor in der UI → speichern (`PUT /api/templates`) — KEIN Re-Import nötig |
| Den System-Prompt-Text umschreiben | Template-Editor → systemprompt-Bereich. ODER: `template-samples/Foo.md` ändern + DELETE in MongoDB + Re-Import |
| Sehen, was tatsächlich beim Secretary ankommt | `template_content_md5_8` im Secretary-Log + die volle Variante: `serializeTemplateToMarkdown(template, false)` lokal |
| Verifizieren, dass mein Update aktiv ist | `template_content_md5_8` muss sich ändern zwischen Vorher/Nachher-Lauf |
| Ein Feld deterministisch aus dem Pfad setzen (z.B. iln_nummer) | Postprocessor schreiben (Beispiel `path-derived-fields.ts` + `buildFirstPassFrontmatter`); Feld bleibt im LLM-Schema, wird aber überschrieben |
| Auto-Schema im System-Prompt unterdrücken | Wort `Antwortschema` (oder `response schema`/`response format`) irgendwo im System-Prompt-Text einbauen |


