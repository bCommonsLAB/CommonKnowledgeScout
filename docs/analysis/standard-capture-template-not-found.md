# Befund: „Template 'standard-capture' nicht gefunden" im Standard-Wizard

> Stand 2026-06-20. Modul: Creation-Wizard (Plan 2 / Δ1). Status: Fix umgesetzt,
> **lokal noch zu verifizieren** (siehe Abschnitt „Test").

## Symptom

Im Standard-Wizard („Inhalt erfassen") erscheint beim Schritt **„Inhaltstyp
wählen"** die rote Meldung:

```
Fehler beim Laden des Templates: Template "standard-capture" nicht gefunden
```

## Fehlerkette (Ursache)

1. Der Standard-Wizard hat `templateId = standard-capture`. Das ist eine
   **Flow-Entität** (Δ1), KEIN Schema-Template mit Frontmatter/Systemprompt.
2. Beim Hinzufügen der Datei-Quelle (`addSource`) rief der Wizard
   `runExtraction` auf — außer der Flow war **hartkodiert** als
   `file-transcript-de` bzw. `audio-transcript-de` erkannt.
3. `standard-capture` war dort nicht abgedeckt → landete im `else`-Zweig →
   `runExtraction`.
4. `runExtraction` schickt `template = templateId` an
   `POST /api/secretary/process-text`.
5. `process-text` sucht ein **Schema-Template** namens `standard-capture` in
   MongoDB → findet keins → wirft `Template "standard-capture" nicht gefunden`
   (404). Der Wizard speichert das als `wizardState.extractionError`.
6. Der `selectSchemaType`-Schritt rendert `extractionError` rot inline.

## Eigentlicher Konstruktionsfehler

Der `standard-capture`-Flow ist strukturell identisch zu `file-transcript-de`
(Datei-Quelle + `selectSchemaType`-Schritt + Off-target-Compute im Schritt). Der
Off-target-Compute (`computeFileMediaDraft`) ist bereits generisch. Aber die
„Datei-Flow"-Sonderbehandlung war an **hartkodierte Template-IDs** gebunden, der
generische `standard-capture` nirgends erfasst.

## Lösungsvarianten

- **A – minimal/hartkodiert:** `standard-capture` an allen Sonderfall-Stellen wie
  `file-transcript-de` behandeln. Risikoarm, aber mehr hartkodierte IDs.
- **B – generisch/flow-basiert (gewählt):** Verhalten aus dem Flow ableiten —
  „Flow mit `selectSchemaType`-Schritt = Off-target-Datei-Flow → kein
  `runExtraction`". Deckt künftige Flows automatisch ab, passt zur Δ1-Trennung
  (Flow vs. Schema) und zu `no-silent-fallbacks`.
- **C – an `process-text`/`loadTemplate`:** `standard-capture` auf ein Schema
  umbiegen. **Verworfen:** `standard-capture` ist ein Flow, der `detailViewType`
  ist zum `addSource`-Zeitpunkt noch nicht gewählt, und `runExtraction` ist für
  einen Datei-Flow der falsche Pfad.

## Umgesetzte Änderung (Variante B)

- Neuer reiner Helper `flowComputesFileInSchemaTypeStep(steps)` in
  `src/lib/creation/file-flow.ts` (+ Unit-Test
  `tests/unit/creation/file-flow.test.ts`).
- `src/components/creation-wizard/creation-wizard.tsx`: abgeleitetes Flag
  `computesFileInStep`; ersetzt die hartkodierten `file-transcript-de`-Checks in
  `addSource`, `removeSource` und beim Verlassen von `collectSource`.
- `src/components/creation-wizard/steps/collect-source-step.tsx`:
  `singleFileUploadMode` flow-basiert (Audio/Bild/Video bei `standard-capture`).
- Diktat (`audio-transcript-de`) bleibt eigener Zweig (kein `selectSchemaType`).

## Test (lokal zu verifizieren)

1. `pnpm test` (neuer Unit-Test grün) + `pnpm lint` (0 Fehler).
2. Standard-Wizard „Inhalt erfassen": Datei hochladen → „Inhaltstyp wählen" →
   einen Typ wählen → „Weiter". Erwartung: KEINE Template-Fehlermeldung; die
   Datei wird off-target verarbeitet, Entwurf erscheint, Beitrag landet im
   Wartekorb.
3. Regression: `file-transcript-de` und `audio-transcript-de` laufen
   unverändert; Text-Flows ohne `selectSchemaType` nutzen weiter `process-text`.
