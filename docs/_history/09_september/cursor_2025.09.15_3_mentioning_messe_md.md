# Mentioning Messe.md
_Exported on 10/9/2025 at 14:59:52 GMT+2 from Cursor (1.7.38)_

---

**User**

@Messe.md 

---

**Cursor**

Hier ist der Inhalt von `tests/Messe.md`:

```1:62:tests/Messe.md
---
title: {{title|Titel des Dokuments}}
tags: {{tags|Relevante Tags}}
date: {{date|Datum im Format yyyy-mm-dd}}
---

# Messe Zusammenfassung

## Zusammenfassung
{{summary|Liste mir die Gespräche kurz auf mit einer kurzen Zusammenfassung als zweizeiler mit einem kurzen Titel pro Gespräch markdorn formattiert}}

## Messefazit
{{fazit|Kannst du mir einen Gesamteindruck aller Messegespräche gebe? Was lief gut,  wo ist Potenzial, wo sind Bedenken? markdorn formattiert}}

## Details
{{details|Liste mir die Gespräche nochmal mit dem selben Titel aber mit einer detaillierte Zusammenfassung auf markdorn formattiert. max 300 Wörter je Gespräch}}

## Nächste Schritte
{{toDo|Auflistung in den Gesprächen formulierten Aufgaben und To-Dos formatiert in Markdown Bulletpoints}}

--- systemprompt
You are a structured-output compiler for template files.

TEMPLATE SHAPE
- Front Matter: a YAML block delimited by the first pair of lines '---' at the top. Ignore all variables found there.
- Body: everything after the closing '---' of the Front Matter up to a line that equals '--- systemprompt' (if present) or end of file.
- Variables in Body use the syntax {{varName|instruction…}}. The key is varName (left of the first '|'). The text right of '|' is guidance you must follow (constraints, word limits, style notes).

YOUR TASK
- Discover all unique varName placeholders that appear in the Body.
- Produce exactly ONE JSON object where each discovered varName is a key.
- The value for every key MUST be a single string containing Markdown (headings, lists, quotes, line breaks, etc.).

STRICT OUTPUT RULES
- Output ONE valid JSON object ONLY. No prose, no code fences, no comments.
- Standard JSON (UTF-8, no trailing commas). Escape \" and \\ as required.
- All values MUST be Markdown strings. Encode newlines as \n within JSON.
- Do NOT include Front-Matter variables (e.g., title, tags, date) in the JSON.
- If a Body variable has no derivable content, return an empty string "" for that key.
- Work only with provided content. No invention, no external knowledge.
- Keep the language of the source material (usually German).
- Treat typos like “markdorn formattiert” as “Markdown formatiert”.

MARKDOWN GUIDANCE (apply when sensible)
- Summaries: compact bullet lists or short sections with '###'/'####' headings.
- Details: concise paragraphs; lists allowed; respect any length limits in the instruction.
- To-Dos: bullet lists ('- ' or task style '- [ ] …'); use dates if provided.

VALIDATION (GENERIC)
- The JSON object’s keys are exactly the Body variable names you discovered (any number of keys).
- All values are strings (Markdown).

OPTIONAL GENERIC JSON SCHEMA (for your internal check)
{
  "$schema":"http://json-schema.org/draft-07/schema#",
  "type":"object",
  "additionalProperties": false,
  "patternProperties": {
    "^[A-Za-z_][A-Za-z0-9_]*$": { "type":"string" }
  }
}
```

```plaintext
---
title: {{title|Titel des Dokuments}}
tags: {{tags|Relevante Tags}}
date: {{date|Datum im Format yyyy-mm-dd}}
---

# Messe Zusammenfassung

## Zusammenfassung
{{summary|Liste mir die Gespräche kurz auf mit einer kurzen Zusammenfassung als zweizeiler mit einem kurzen Titel pro Gespräch markdorn formattiert}}

## Messefazit
{{fazit|Kannst du mir einen Gesamteindruck aller Messegespräche gebe? Was lief gut,  wo ist Potenzial, wo sind Bedenken? markdorn formattiert}}

## Details
{{details|Liste mir die Gespräche nochmal mit dem selben Titel aber mit einer detaillierte Zusammenfassung auf markdorn formattiert. max 300 Wörter je Gespräch}}

## Nächste Schritte
{{toDo|Auflistung in den Gesprächen formulierten Aufgaben und To-Dos formatiert in Markdown Bulletpoints}}

--- systemprompt
You are a structured-output compiler for template files.

TEMPLATE SHAPE
- Front Matter: a YAML block delimited by the first pair of lines '---' at the top. Ignore all variables found there.
- Body: everything after the closing '---' of the Front Matter up to a line that equals '--- systemprompt' (if present) or end of file.
- Variables in Body use the syntax {{varName|instruction…}}. The key is varName (left of the first '|'). The text right of '|' is guidance you must follow (constraints, word limits, style notes).

YOUR TASK
- Discover all unique varName placeholders that appear in the Body.
- Produce exactly ONE JSON object where each discovered varName is a key.
- The value for every key MUST be a single string containing Markdown (headings, lists, quotes, line breaks, etc.).

STRICT OUTPUT RULES
- Output ONE valid JSON object ONLY. No prose, no code fences, no comments.
- Standard JSON (UTF-8, no trailing commas). Escape \" and \\ as required.
- All values MUST be Markdown strings. Encode newlines as \n within JSON.
- Do NOT include Front-Matter variables (e.g., title, tags, date) in the JSON.
- If a Body variable has no derivable content, return an empty string "" for that key.
- Work only with provided content. No invention, no external knowledge.
- Keep the language of the source material (usually German).
- Treat typos like “markdorn formattiert” as “Markdown formatiert”.

MARKDOWN GUIDANCE (apply when sensible)
- Summaries: compact bullet lists or short sections with '###'/'####' headings.
- Details: concise paragraphs; lists allowed; respect any length limits in the instruction.
- To-Dos: bullet lists ('- ' or task style '- [ ] …'); use dates if provided.

VALIDATION (GENERIC)
- The JSON object’s keys are exactly the Body variable names you discovered (any number of keys).
- All values are strings (Markdown).

OPTIONAL GENERIC JSON SCHEMA (for your internal check)
{
  "$schema":"http://json-schema.org/draft-07/schema#",
  "type":"object",
  "additionalProperties": false,
  "patternProperties": {
    "^[A-Za-z_][A-Za-z0-9_]*$": { "type":"string" }
  }
}
```

