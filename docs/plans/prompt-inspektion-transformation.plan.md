---
name: prompt-inspektion-transformation
overview: "Jede Transformation bekommt ein Prompt-Protokoll: was wirklich an das Sprachmodell ging (Systemprompt der Vorlage, Auftragsrahmen des Secretary mit Feldbeschreibungen, das Material samt Quellen und Verfügbaren Medien, Modell, Token, rohe Antwort). Gespeichert am Transformations-Artefakt des Twins, angezeigt als aufbereitetes Markdown über einen Knopf im Reiter Transformation und im Job-Monitor, lesbar über die MCP-Brücke. Owner-Wunsch 06.10.2026; Konzept im Archiv: 24.09 KnowledgeScout/2026-10-06 Konzept Von Menschen geprüfte Veranstaltung/2026-10-06 Konzept Prompt-Inspektion der Transformation.md"
vorhaben: [24.09 KnowledgeScout]
status: geplant
todos:
  - id: i1-secretary-protokoll
    content: "Secretary (Repo CommonSecretaryServices): transform-by-template liefert in der Antwort ein Feld prompt_protokoll mit model, provider, system_prompt (wörtlich wie gesendet), user_prompt_ohne_text (Auftragsrahmen mit Platzhalter TEXT), context, field_descriptions, token_schaetzung (text, system, rahmen), duration_ms, raw_response (Antwort vor dem Parsen). Den Text selbst NICHT zurückschicken. Betroffen: src/utils/transcription_utils.py (Prompt-Bau), src/processors/transformer_processor.py (TransformationResult erweitern), src/core/models/transformer.py, Route transformer_routes.py. Test: System- und User-Prompt im Protokoll sind byteidentisch mit dem, was an den Provider ging (Provider-Mock)."
    status: pending
  - id: i2-scout-speichern
    content: "KnowledgeScout: phase-template nimmt prompt_protokoll aus der Antwort, ergänzt den gesendeten Text (extractedText aus template-run.ts) und speichert das Protokoll als eigenes Feld am Transformations-Artefakt im Shadow-Twin (MongoDB, Repository shadow-twin-repo; nicht im Frontmatter, nicht im Job). Bei Sammeldateien bleibt der Text so, wie resolveCompositeTranscript ihn gebaut hat (Abschnitte Quellen und Verfügbare Medien). Neu-Lauf ersetzt das Protokoll. Determinismus laut shadow-twin-contracts: Schlüssel bleibt der ArtifactKey, kein zweiter Wahrheitsort. Fehlt das Protokoll in der Antwort (alter Secretary), laut melden, nicht still weglassen."
    status: pending
  - id: i3-scout-anzeige
    content: "KnowledgeScout UI: Knopf „Prompt ansehen" im Reiter Transformation der Datei-Vorschau (file-preview-tab-architecture.md beachten) und am Template-Schritt im Job-Monitor (src/components/shared/trace-viewer.tsx, job-monitor-panel.tsx). Renderer baut aus dem Protokoll ein Markdown in fünf Abschnitten: Kopf (Modell, Dauer, Token, Vorlage, Zielsprache, Job), Systemprompt, Aufgabe (Rahmen, Kontext, geforderte Felder), Material (bei Sammeldateien je Quelle Name, Art, Zeichen; Verfügbare Medien als Liste), Antwort roh. Lange Abschnitte eingeklappt mit sichtbarer Länge; Herunterladen als .md. API-Route unter /api/library/[libraryId]/shadow-twins/… nach api-route-conventions.md. Live-Prüfung an „02 Vortrag Britsko.md" (Library Dachverband für Soziales): fünf Quellen, 22 Seitenbilder unter Verfügbare Medien, Systemprompt von vortrag-session-de, Feld slides sichtbar."
    status: pending
  - id: i4-bruecke
    content: "MCP-Brücke: lesendes Werkzeug transformation_inspizieren (libraryId, sourceId oder pfad, templateName, targetLanguage) liefert dasselbe Markdown wie die Anzeige, optional nur den Kopf. In tools-info Soll-Liste und Werkzeugsatz-Version eintragen; Skill archiv-aufraeumen nennt es beim Prüfen von Transformationen."
    status: pending
---

# Prompt-Inspektion der Transformation

## Warum

Beim Prüfen einer Transformation sieht man Frontmatter und Body, aber nie,
was an das Sprachmodell ging. Ohne diesen Blick ist nicht zu beurteilen,
ob ein Fehler am Material, an der Vorlage oder am Modell liegt. Der Owner
will einen Inspektions-Knopf, der den Prompt als aufbereitetes Markdown
zeigt, und dieselbe Sicht über die Brücke.

## Befund (06.10.2026)

- KnowledgeScout schickt Text, Vorlagentext, Quell-Kontext und Modell an
  `transformer/transform-by-template` ([template-run.ts](../../src/lib/external-jobs/template-run.ts),
  `callTemplateTransform`). Der Trace speichert nur Längen. Das
  Sammel-Transkript wird nie persistiert ([composite-transcript.ts](../../src/lib/creation/composite-transcript.ts)).
- Der Secretary baut den eigentlichen Prompt: Systemprompt aus dem
  `--- systemprompt`-Block der Vorlage, dazu den englischen Auftragsrahmen
  „Analyze the following text … TEXT / CONTEXT / REQUIRED FIELDS /
  INSTRUCTIONS" mit den Feldbeschreibungen als JSON. Er schätzt Token und
  loggt sie, gibt aber nur `text` und `structured_data` zurück; vom Material
  bleibt ein 100-Zeichen-Auszug.

Der Prompt existiert nur im Moment des Aufrufs.

## Zielbild

Ein Prompt-Protokoll je Transformation, am Twin gespeichert, als Markdown
anzeigbar: Kopf, Systemprompt, Aufgabe, Material, Antwort roh. Details und
Schnitt zwischen den Diensten im Archiv-Konzept (siehe `overview`).

## Reihenfolge

```
I1 (Secretary) ─▶ I2 (speichern) ─▶ I3 (anzeigen) ─▶ I4 (Brücke)
```

I1 zuerst, sonst gibt es nichts zu speichern. I3 und I4 können parallel
laufen, sobald I2 steht.

## Nicht in diesem Plan

- Eingriff in den Prompt; ändern geht weiter nur über die Vorlage.
- Protokolle für Transkription oder Embedding; dasselbe Muster später,
  wenn die Transformation steht.

## Prüffall

Transformation von „02 Vortrag Britsko.md" in der Library „Dachverband für
Soziales" (`3559f1ee-0c99-4356-869a-75c1e31c2179`). Im Protokoll müssen
fünf Quellen plus „Verfügbare Medien" mit 22 Seitenbildern, der Systemprompt
der Vorlage `vortrag-session-de` und das Feld `slides` unter den geforderten
Feldern sichtbar sein.
