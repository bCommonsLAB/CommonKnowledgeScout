# Transcript API Endpoints (Secretary)

Textschritte **am** Transkript. Der Secretary schreibt hier nichts — es entstehen nur
Vorschläge; geschrieben wird erst nach Bestätigung durch den Menschen über
`transkript_korrigieren` (Wunschliste 7, Paket P3b).

## POST /api/transcript/korrekturvorschlag

Paket P2 des Plans `von-menschen-gepruefte-veranstaltung`. Hält ein Audio-Transkript
gegen Begleittexte derselben Veranstaltung (Einladung mit Sprecherliste,
Folien-Transkripte) und schlägt `ersetzungen` (Hörfehler bei Namen, Zahlen,
Fachbegriffen) und `sprecher` (Label → Person) vor. Modell: Use-Case `chat_completion`,
Temperatur 0; Antwortschema steht im Prompt, der Dienst prüft die Antwort streng.

### Request (`application/json`)

```json
{
  "transkript": "**Stück 1 Sprecher A:** Guten Morgen, ich bin Frau Mahler …",
  "begleittexte": [
    { "name": "Einladung", "text": "… Referentinnen: Dr. Anna Mahlknecht …" },
    { "name": "Folien Vortrag 1", "text": "Folie 3: Anteil 2023: 14 Prozent" }
  ],
  "zielsprache": "de"
}
```

### Response (Success), `data`

```json
{
  "ersetzungen": [
    { "alt": "Frau Mahler", "neu": "Frau Mahlknecht", "zeile": 1, "kontext": "…",
      "begruendung": "Name laut Einladung", "beleg": "einladung" }
  ],
  "sprecher": [
    { "label": "Stück 1 Sprecher A", "name": "Dr. Anna Mahlknecht",
      "begruendung": "stellt sich vor", "beleg": "selbstvorstellung" }
  ],
  "verworfen": ["ersetzung 'Sprecher A': kommt 3x im Transkript vor, erwartet genau 1x"],
  "modell": "gpt-4.1-mini", "tokens": 4821, "dauer_ms": 3120.4
}
```

### Zusicherungen für den KnowledgeScout

- `alt` kommt im Transkript **genau einmal** vor → die Liste kann unverändert an
  `transkript_korrigieren` gehen.
- `zeile` ist aus dem Transkript berechnet (1-basiert), nicht vom Modell geraten.
- `name` steht in einem Begleittext; sonst bleibt das Label Rolle („Frage aus dem Publikum").
- `beleg` ∈ `einladung`, `folie <N>`, `selbstvorstellung`, `unsicher`.
- Verworfene Modellvorschläge stehen mit Begründung unter `verworfen`.

### Fehler

| HTTP | `error.code` |
|------|--------------|
| 400 | `MISSING_TRANSKRIPT`, `INVALID_BEGLEITTEXTE` |
| 413 | `INPUT_TOO_LARGE` (über 600.000 Zeichen) |
| 502 | `INVALID_LLM_RESPONSE` |
| 503 | `NO_MODEL_CONFIGURED` |
