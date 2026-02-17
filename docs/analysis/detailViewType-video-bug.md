# Bug: detailViewType wird vom LLM von "session" auf "video" geändert

## Symptom

Im DB-Dokument steht `detailViewType: "video"`, obwohl das Template `event-creation-de.md`
den Wert `detailViewType: session` hardcodiert hat (Zeile 3, kein `{{}}` Placeholder).

## Ursache (Root Cause)

### Hardcodierte Felder werden fälschlicherweise ins LLM-Antwortschema aufgenommen

1. **`parseFrontmatterFields()`** (`template-parser.ts`, Z. 94-166) parst ALLE
   Frontmatter-Zeilen als Metadaten-Felder — auch solche ohne `{{}}` Placeholder.
   `detailViewType: session` wird als Feld mit `rawValue: 'session'` und
   `description: ''` gespeichert.

2. **`generateResponseSchemaFromFields()`** (`template-service-mongodb.ts`, Z. 36-69)
   generiert das LLM-Antwortschema aus ALLEN Feldern, ohne Unterscheidung.
   `detailViewType` erscheint als nacktes `"string"`-Feld:
   ```json
   {
     "docType": "string (Wird automatisch gesetzt (event))",
     "detailViewType": "string",   ← Kein Hinweis auf erlaubte Werte!
     "title": "string (Titel des Events/Talks)"
   }
   ```
   Im Vergleich: `docType` hat einen `{{}}` Placeholder mit Beschreibung, daher
   weiß das LLM, was es eintragen soll.

3. **Das LLM füllt `detailViewType` mit `video`**, weil der Content ein Video-Vortrag ist
   und das Schema keine Einschränkung enthält.

4. **`creation-wizard.tsx`** übernimmt den LLM-Wert, weil `metadataWithImages` Vorrang
   vor dem Template-Default hat.

5. **`applyEventFrontmatterDefaults()`** greift nicht, weil der Wert nicht leer ist.

### Unterschied zu korrekt funktionierenden Feldern

- `docType: {{docType|Wird automatisch gesetzt (event)}}` → Hat Placeholder mit
  Beschreibung → LLM weiß, dass es "event" eintragen soll
- `detailViewType: session` → Kein Placeholder → LLM bekommt nur `"string"` im Schema

## Betroffene Dateien

| Datei | Rolle im Bug |
|---|---|
| `src/lib/templates/template-service-mongodb.ts` | Schema-Generator nimmt alle Felder auf |
| `src/components/creation-wizard/creation-wizard.tsx` | Kein Schutz für hardcodierte Werte |
| `src/lib/events/event-frontmatter-defaults.ts` | Fallback nur bei leeren Werten |

## Fix (umgesetzt)

### 1. `generateResponseSchemaFromFields()` — Hardcodierte Felder ausschließen
Felder mit `description === ''` (kein `{{}}` Placeholder) werden nicht ins
LLM-Schema aufgenommen. Das sind System-Parameter, keine LLM-Variablen.

### 2. `serializeTemplateToMarkdown()` — Doppelte Serialisierung beseitigt
`detailViewType` aus `metadata.fields` wird übersprungen, wenn es bereits
als `metadata.detailViewType` existiert.

### 3. `creation-wizard.tsx` — Hardcodierte Felder geschützt (2 Stellen)
Bei der Frontmatter-Konstruktion (Save + Publish) haben hardcodierte Felder
(`description === ''`) jetzt Vorrang: Ihr `rawValue` aus dem Template wird
verwendet, unabhängig davon, was das LLM zurückgibt.

## Testbarkeit

Zum Testen: Im Wizard ein neues Event mit dem Template `event-creation-de` erstellen.
Nach der LLM-Transformation prüfen, ob im gespeicherten Dokument
`detailViewType: "session"` steht (nicht `"video"`).

## Datum
2026-02-16
