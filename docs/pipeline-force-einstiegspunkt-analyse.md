# Analyse: Intelligentes „Überschreiben" pro Einstiegspunkt (Pipeline-Sheet)

Stand: 2026-06-19

## 1. Problem (beobachtet)

Ein wiederhergestelltes Verzeichnis hatte bereits Transkripte in MongoDB.
Beim erneuten *Transformieren* startete das System dennoch eine neue
OCR-Transkription. Der laufende Job hatte:

```json
"policies": { "extract": "force", "metadata": "force", "ingest": "force" }
```

`extract: "force"` ignoriert das Gate (Transcript existiert) → OCR läuft erneut
(siehe `src/lib/processing/phase-policy.ts` → `shouldRunWithGate`).

## 2. Ursache (im Code belegt)

Der „Überschreiben"-Schalter im Pipeline-Sheet ist **global**, nicht pro Phase:

- `src/components/library/flow/pipeline-sheet.tsx`
  - `const active = shouldForce ? "force" : "do"` wird auf **alle** aktiven
    Phasen angewendet.
  - `handleForceChange(true)` reaktiviert zusätzlich **alle** Default-Schritte
    (inkl. Extract), auch wenn ein Transcript existiert.

Folge: „Force" ist ein Alles-oder-nichts-Schalter. „Nur Transformation neu,
Transkript behalten" lässt sich nicht ausdrücken.

## 3. Wichtige Erkenntnis: Einstiegspunkt ist bereits bekannt

`file-preview.tsx` öffnet das Sheet schon heute mit einem Einstiegspunkt:

```ts
openPipelineForPhase('transcript' | 'transform' | 'story', force?)
```

Jeder Tab (Transkript / Transformation / Story) hat „erstellen"- und
„neu generieren"-Buttons. Der Einstiegspunkt ist also vorhanden — er wird nur
bisher nicht genutzt, um Force gezielt zu steuern.

## 4. Gewünschtes Verhalten (vom Anwender)

Phasen-Reihenfolge: **Transkript (1) → Transformation (2) → Story (3)**.

- Einstieg = Transformation, „neu erstellen": Transformation **und nachfolgende**
  Story werden überschrieben. Das **vorgelagerte Transkript bleibt** (wird
  wiederverwendet).
- Einstieg = Story: **nur** die Story wird überschrieben.
- Vorgelagerte Schritte werden nie erzwungen; fehlt ein vorgelagertes Artefakt,
  wird es regulär (gate-respektierend) erzeugt — nicht erzwungen.

Regel kurz: **Force gilt ab Einstiegspunkt abwärts, nie aufwärts.**

Begründung „nach unten": Wird die Transformation neu erzeugt, wird eine
bestehende Story inhaltlich ungültig — sie muss mit neu erstellt werden.

## 5. UX: Bestätigungsdialog statt technischer Häkchen

Anwender sind keine Programmierer. Statt Force-Checkboxen ein
**Bestätigungsdialog**, der in Klartext zeigt, was passiert, z. B.:

```
Du erstellst neu:
  • Transformation   (überschreibt die bestehende)
  • Story            (wird ungültig → wird ebenfalls neu erstellt)

Wird wiederverwendet:
  • Transkript       (bleibt unverändert)

[ Abbrechen ]              [ Neu erstellen ]
```

Fehlt ein vorgelagertes Artefakt:
`• Transkript (fehlt → wird zuerst erstellt)`.

## 6. Drei Umsetzungsvarianten

### Variante A1 — Bestätigungsdialog + automatische Policy ab Einstiegspunkt (empfohlen)
- Globalen Force-Schalter entfernen.
- Policies werden aus `(entryPhase, existingArtifacts)` deterministisch
  berechnet: ab Einstiegspunkt `force` (wenn Artefakt existiert), davor
  `do`/gate-respektierend.
- Ein `AlertDialog` (shadcn) fasst vor dem Start zusammen, was überschrieben /
  wiederverwendet wird. Bestätigen → Start.
- Einfachste, klarste Lösung; am nächsten an „nicht-technisch".

### Variante A2 — Inline-Häkchen pro Phase + permanente Klartext-Zusammenfassung
- Jeder Schritt mit vorhandenem Artefakt bekommt ein eigenes
  „überschreiben"-Häkchen; darunter eine Live-Zusammenfassung.
- Mehr Kontrolle, aber technischer und mehr UI.

### Variante A3 — Hybrid: Auto-Vorbelegung + bearbeitbarer Bestätigungsdialog
- Wie A1, aber im Dialog kann der User einzelne Downstream-Schritte noch
  ab-/anwählen.
- Mächtigste, aber aufwändigste Lösung.

## 7. Betroffene Dateien (geschätzt)

- `src/components/library/flow/pipeline-sheet.tsx` (Force-Logik → Einstiegspunkt;
  globalen Schalter entfernen; Dialog einbauen)
- `src/components/library/flow/pipeline-sheet/helpers.ts` (Policy-Ableitung +
  „Plan"-Zusammenfassung als reine Funktion, testbar)
- `src/components/library/file-preview.tsx` (`openPipelineForPhase`: Einstiegs-
  phase ans Sheet durchreichen; allgemeiner Opener bekommt sinnvolle
  Default-Einstiegsphase)
- `src/components/library/file-preview/views/view-props.ts` (Typ ggf. erweitern)
- Tests: neue Unit-Tests für die Policy-Ableitung (reine Funktion).

## 8. Offene Entscheidung

Welche Variante (A1 / A2 / A3)? Empfehlung: **A1**. → Umgesetzt (A1).

## 9. Nachgelagerte Ursache: `hasTranscript` sprachabhaengig falsch

Nach Umsetzung von A1 zeigte sich ein zweiter Fehler: Im Dialog war der
Schritt „Transkript erstellen" aktiv und nicht abwaehlbar, obwohl ein
Transkript existierte.

Ursache: Die Views berechneten `existingArtifacts.hasTranscript` aus
`transcript.transcriptItem`. Dieses kommt aus `useResolvedTranscriptItem`,
das in `file-preview.tsx` mit **fest `targetLanguage: "de"`** aufgerufen wird.
Bei einem englischen Dokument (`Beyond_2012_e.pdf`, Transkript unter `en`)
liefert die Aufloesung `null` → `hasTranscript = false`. Folge: ein
Abhaengigkeits-Effekt aktivierte Extract automatisch (Transform aktiv + kein
Transkript) → Schritt 1 an und gesperrt.

Fix: `hasTranscript` aus `displayTranscriptItem` ableiten. Dieses ist
sprachunabhaengig (Artefaktliste bzw. `shadowTwinState.transcriptFiles`) und
entspricht dem, was der Transkript-Tab tatsaechlich anzeigt. Geaendert in:
`pdf-view`, `audio-view`, `video-view`, `markdown-view`, `website-view`,
`office-view` (dort zusaetzlich `displayTranscriptItem` destrukturiert).
