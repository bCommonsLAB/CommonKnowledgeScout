---
name: von-menschen-gepruefte-veranstaltung
overview: "Eine Veranstaltung aus Audios, Folien und Einladung wird zu Vortragsseiten mit Slide-Akkordeon; zwischen Transkript und Vorlage steht ein Schritt, in dem ein Mensch die Sprecher-Zuordnung und Hörfehler bei Namen und Zahlen bestätigt. Sechs Pakete über zwei Repos (P1, P2 Secretary; P3 bis P6 KnowledgeScout). Owner-Abnahme der Pakete 06.10.2026. Konzept, Drehbuch mit Soll-Zeiten und Start-Prompts im Archiv: 24.09 KnowledgeScout/2026-10-06 Konzept Von Menschen geprüfte Veranstaltung/. Prüffall: Journalistenschulung 25.09.2026, Library „Dachverband für Soziales" (3559f1ee-0c99-4356-869a-75c1e31c2179)."
vorhaben: [24.09 KnowledgeScout]
status: abgenommen
todos:
  - id: p1-secretary-sprecher
    content: "Secretary (Repo CommonSecretaryServices): Endpunkt POST /audio/process-diarized nach den Wellen B1 und B2 des Plans audio-namensraum-und-diarisierung (Use-Case diarized_transcription in der Modell-Maske, response_format diarized_json, chunking_strategy auto). Stücke bis 20 Minuten, an Sprechpausen geschnitten statt hart nach Zeit; Sprecher-Labels je Stück eindeutig benannt (Stück 1 Sprecher A). Antwort: segments mit speaker, start, end, text; speakers; output_text mit Präfix je Absatz. Cache-Schlüssel kennt den Modus. KEINE Stimmproben, KEIN Namensraum-Umzug (A1/A2 bleiben im alten Plan). Kontext (prompt, keywords) wird für dieses Modell verworfen und als dropped gemeldet, nicht still. Grenzen laut OpenAI-Doku 06.10.2026: 25 MB und 1500 s je Anfrage. Prüffall: 48-Minuten-Diskussion mit zwei Sprecherinnen und Publikum liefert drei Stücke mit lesbaren Sprecherwechseln."
    status: pending
  - id: p2-secretary-korrekturvorschlag
    content: "Secretary: Dienst POST /transcript/korrekturvorschlag. Eingabe: Audio-Transkript (Markdown, optional mit Sprecher-Präfixen), Begleittexte mit Name und Text (Einladung mit Sprecherliste, Folien-Transkripte), Zielsprache. Ausgabe nur Vorschläge: ersetzungen [{alt, neu, zeile, kontext, begruendung, beleg}] für Hörfehler bei Namen, Zahlen, Fachbegriffen; sprecher [{label, name, begruendung, beleg}] für Label-zu-Person; beleg aus einladung, folie <N>, selbstvorstellung, unsicher. Nur Namen aus den Begleittexten; alles andere bleibt Rolle. alt muss genau einmal vorkommen, damit KnowledgeScout die Liste unverändert an transkript_korrigieren (Wunschliste 7) übergeben kann. Antwortschema explizit im Prompt-Text (Secretary erzwingt schema_json nicht). Prüffall: Diskussion der Journalistenschulung mit Flyer und zwei Folien-Transkripten; Antworten den richtigen Referentinnen zugeordnet, unsichere Fälle als unsicher."
    status: pending
  - id: p3a-scout-kontext-datei-weg
    content: "KnowledgeScout, Teil A: Der Datei-Weg schickt heute keinen Kontext (src/lib/external-jobs/secretary-request.ts sendet nur Datei und Sprachen). prompt (Thema, Anlass) und keywords (Namen, Begriffe) für Audio-Jobs ergänzen; Quellen: Library-Feld extractionKnownNames plus optionaler Freitext im Transformations-Dialog (audio-transform.tsx). Sprecher-Modus als Per-Library-Feld nach docs/contracts/library-config-field.md plus Übersteuerung pro Datei, bis in secretary-request.ts durchgereicht (Plan audio-namensraum C0, C1). extract-audio-text.ts: Sprecher-Präfixe je Absatz, speakers flach im Frontmatter (C2)."
    status: pending
  - id: p3b-scout-korrektur-schritt
    content: "KnowledgeScout, Teil B: Am Audio-Transkript im Archiv ein Knopf „Korrektur vorschlagen" mit Auswahl der Begleitdokumente aus demselben Ordner (Transkripte der PDFs). Aufruf transcript/korrekturvorschlag (P2). Vorschlagsliste: je Eintrag annehmen, ablehnen, ändern; Sprecher-Zuordnung als eigene Liste. Erst mit Bestätigung schreiben, mit der Semantik aus Wunschliste 7: nur Body, Frontmatter revised_by, revised_at, revision_note; generated_* bleibt; vorhandene Transformation gilt als überholt (transformation_stale); alles oder nichts; Konflikt bei veralteter Version. Vor dem Bau klären: eigener Reiter am Transkript oder Teil der Werkbank. Prüffall: Diskussion der Journalistenschulung ohne Obsidian korrigiert und bestätigt; Reiter Transformation zeigt überholt."
    status: pending
  - id: p4-vorlage-abnahme
    content: "KnowledgeScout: template-samples/vortrag-session-de.md anpassen, sobald Transkripte Sprecher-Präfixe und bestätigte Namen tragen: diskussion_md ordnet Fragen NUR der Person zu, deren Label antwortet; Namen NUR aus dem bestätigten Transkript bzw. speakers, sonst „Frage aus dem Publikum"; Regel auch im Systemprompt. Danach Sammeldateien 02 und 03 der Library Dachverband für Soziales mit metadata force neu transformieren und ingestieren. Abnahme (aus dem Handover 06.10.): beide Vortragsseiten ohne falsche Zuordnung und ohne unbelegte Namen; Chat-Frage zur Diskussion nennt die richtige Referentin mit Quellenangabe Anhang."
    status: pending
  - id: p5-wizard-schritt
    content: "KnowledgeScout: Erfassungs-Wizard um das Preset reviewTranscript zwischen selectFolderArtifacts und generateDraft erweitern: zeigt je Audio die Korrekturvorschläge (P3 Teil B) und lässt sie bestätigen; ohne Bestätigung kein Weiter. selectFolderArtifacts erweitern, damit der Anwender Audios, Folien und Einladung je Vortrag zuordnet; daraus entstehen die Sammeldateien (kind composite-transcript, _source_files, _media_files mit Seitenbildern) statt von Hand. Contracts: contracts-templates-media, ADR 0003/0004. Prüffall: Journalistenschulung von Upload bis zu drei veröffentlichten Seiten ohne Datei-Handarbeit; Zeiten je Schritt gegen das Drehbuch im Archiv messen."
    status: pending
  - id: p6-idee-f-optionen
    content: "KnowledgeScout: Zwei Optionen im Dialog „Aufbereiten & Publizieren", Abschnitt Optionen. (1) „Slides als Tabelle führen": nur sichtbar, wenn die gewählte Vorlage ein Feld slides hat; ohne Haken wird das Feld für diesen Lauf aus der Vorlage genommen. (2) „Anhänge als Text in die Suche": steuert den unsichtbaren Ingest-Anhang (src/lib/external-jobs/ingest-source-appendix.ts); dazu ein Per-Library-Feld als Voreinstellung nach docs/contracts/library-config-field.md mit Hinweis auf die Indexgröße (Teil 2 Britsko: 17 ohne, 239 Chunks mit Anhang). Beide Werte bis in phase-template bzw. phase-ingest durchreichen, kein stiller Default. Doku in docs/architecture: wie Sammeldatei, Vorlage, Slides und Anhang zusammenspielen. Prüffall: eine Transformation mit und ohne Haken."
    status: pending
---

# Von Menschen geprüfte Veranstaltung

## Warum

Die Journalistenschulung vom 25.09.2026 (zwei Vorträge, danach eine
Diskussion, in der zwei Referentinnen abwechselnd antworten) wurde am
05.10.2026 als Event-Library gebaut (PR #348): Sammeldatei je Vortrag,
Vorlagen `vortrag-session-de` und `veranstaltung-einleitung-de`,
Slide-Akkordeon, unsichtbarer Ingest-Anhang. Das Transkript kennt keine
Sprecher, die Vorlage hat die Antworten geraten und falsch zugeordnet. Der
Owner will ein Feature, das sich von den automatischen Objekten an genau
einer Stelle unterscheidet: Zwischen Transkript und Vorlage bestätigt ein
Mensch Sprecher-Zuordnung und Hörfehler. Alles andere ist der bestehende
Fluss.

## Befunde, die den Schnitt bestimmen (06.10.2026)

1. **Kontext und Sprechererkennung schließen sich im Audio-Schritt aus.**
   `gpt-4o-transcribe-diarize` nimmt keinen Prompt an (OpenAI-Doku; im
   Secretary bereits `MODELS_WITHOUT_PROMPT`). Das normale Modell nimmt nur
   einen kurzen Freitext und eine Begriffsliste. Der volle Kontext
   (Einladung, Slides) kann erst in einem Textschritt wirken.
2. **25 MB und 1500 Sekunden je Anfrage**, auch beim Sprecher-Modell. Die
   heutigen 5-Minuten-Stücke sind unsere Einstellung (`segment_duration`),
   20 Minuten sind möglich.
3. **Sprecher-Labels gelten nur innerhalb einer Anfrage.** OpenAI empfiehlt
   nichts; Stimmproben oder überlappende Stücke sind Behelfe aus dem Forum.
4. **Der Datei-Weg schickt heute keinen Kontext** an den Secretary, nur
   das Live-Diktat tut es.

Kosten: Sprecher-Modell 0,006 USD je Minute gegenüber rund 0,0045 heute;
für 2 h 13 min Audio 0,80 statt 0,60 USD. Der Textschritt liegt im
Cent-Bereich.

## Entscheidungen (Owner, 06.10.2026)

- **Zwei Durchgänge:** Sprecher im Audio-Schritt (ohne Kontext), Kontext in
  der Korrektur (Textschritt). Kein Doppel-Transkribieren mit Verschmelzung
  über Zeitmarken.
- **Keine Stimmproben.** Die Zuordnung über Stückgrenzen übernimmt der
  Korrektur-Schritt mit dem Menschen.
- **Namen nur, wenn belegt:** aus Einladung oder Sprecherliste, vom Menschen
  bestätigt. Alles andere bleibt Rolle („Frage aus dem Publikum").
- **Korrektur-Schritt mit Mensch** zwischen Transkript und Vorlage, manuell
  ausgelöst, später als Wizard-Schritt. Schreibweg ist der aus Wunschliste 7
  (`transkript_korrigieren`: nur Body, `revised_*`, Transformation überholt).
- **Namensraum-Umzug** `realtime` → `audio` (A1/A2 im alten Plan) ist nicht
  Teil dieser Pakete; eigenes Aufräum-Paket.

## Ablauf im Archiv

| Schritt | Secretary-Aufruf | Artefakt | Dauer |
|---|---|---|---|
| 1 Transkript (Phase 1, automatisch) | `pdf/process`; **neu** `audio/process-diarized` | Transkript PDF mit Seitenmarkern und Seitenbildern; Transkript Audio mit „Sprecher A/B" je Stück | 1–3 min je PDF; 3–6 min je Stunde Audio (Schätzung) |
| 2 Korrektur (**neu**, manuell, Mensch) | **neu** `transcript/korrekturvorschlag` | korrigiertes Transkript mit `revised_*`, Namen belegt; Transformation überholt | 1 min Maschine; 10–20 min Mensch je Diskussion |
| 3 Transformation (Phase 2) | `resolveCompositeTranscript` + `transform-by-template` | Frontmatter mit Facetten, Cover Folie 2, Anhänge, `slides`; Body mit Vortrag, Folien, Diskussion, Veranstaltung | ca. 1 min je Vortrag (gemessen) |
| 4 Ingestion (Phase 3) | `rag/embed` mit Anhang | Dokument-Meta, Vektoren mit Herkunft je Chunk, Ereignis-Seite | ca. 15 s, ca. 240 Chunks (gemessen) |

Der Wizard darüber hat sieben Schritte; alle Presets außer Schritt 3
(`reviewTranscript`) gibt es. Schemata, Drehbuch mit Soll-Zeiten und
kopierbare Start-Prompts je Paket liegen im Archiv-Ordner (siehe
`overview`); FigJam: https://www.figma.com/board/MTsQK3yNMcbRKSoqnshb3c.

## Reihenfolge

```
P1 (Secretary: Sprecher) ─┐
P2 (Secretary: Vorschlag) ─┼─▶ P3b (Korrektur-Schritt) ─▶ P4 (Vorlage, Abnahme) ─▶ P5 (Wizard)
P3a (Kontext im Datei-Weg) ┘
P6 (Idee F) unabhängig
```

P3a und P3b können vor P1 beginnen: Die Korrektur mit Begleitdokumenten
hilft bei Namen und Zahlen schon ohne Sprecher-Labels; die Labels machen sie
bei Diskussionen treffsicher. P4 braucht P1 bis P3. P6 hängt an nichts.

## Nicht in diesem Plan

- Namensraum-Umzug `realtime` → `audio` (A1/A2 in `geplant/audio-namensraum-und-diarisierung`).
- Schneiden an Sprechpausen für den **normalen** Datei-Weg `audio/process`
  (dort bleibt `segment_duration` 300 s); P1 schneidet nur den
  diarisierten Weg so.
- Ereignis-Ansicht im Embed-Paket `@ks/embed`; Veröffentlichung der Library
  (Slug, Galerie-Texte, Logo); zweite Vorlage für Leitfäden und Berichte mit
  denselben Facetten-Listen.
- Prompt-Inspektion der Transformation: eigener Plan
  `prompt-inspektion-transformation.plan.md`.

## Prüffall

Library „Dachverband für Soziales", Ordner `events/Journalisten Schulung`:
vier Audios (2 h 13 min), drei Folien- und Unterlagen-PDFs, der Flyer. Soll
laut Drehbuch: rund 70 Minuten vom Upload bis zur geprüften Seite, davon
etwa 50 Minuten Mensch. Abnahme: keine Antwort der falschen Referentin
zugeordnet, kein Name ohne Beleg, jede Korrektur im Transkript erkennbar,
kein Datei-Handgriff außerhalb des Wizards.
