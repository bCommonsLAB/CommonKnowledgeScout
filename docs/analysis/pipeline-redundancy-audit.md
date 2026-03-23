# Pipeline-Redundanz-Audit

Diese Datei beschreibt die Analyse in **einfacher Sprache**.

Ziel: Nicht nur sagen „der Code ist groß“, sondern konkret zeigen:

- wo Logik doppelt existiert,
- wo Typen mehrfach definiert sind,
- wo Status aus mehreren Quellen kommen,
- und welche Dateien vielleicht gar nicht mehr gebraucht werden.

Auch hier gilt: Das ist eine **statische Analyse**. Ich habe keine Aussage per Laufzeittest bewiesen.

---

## Die wichtigste Erkenntnis

Das Hauptproblem ist nicht nur „zu viel Code“.

Das eigentliche Problem ist:

- **gleiche Fachlogik**
- über **mehrere technische Wege**
- mit **leicht unterschiedlichen Typen**
- und **leicht unterschiedlichen Zuständen**

Genau dadurch wird das System schwer verständlich.

---

## 1) Mehrere Startwege für dieselbe Verarbeitung

Es gibt im Moment nicht nur einen Startpunkt.

### Weg A: Neuer Hauptweg

- `runPipelineUnified`
- `runPipelineForFile`
- `POST /api/pipeline/process`

Das ist der modernere Weg und sollte aus meiner Sicht der Hauptweg sein.

### Weg B: Alte Dialoge

- `transcription-dialog.tsx`
- `transformation-dialog.tsx`
- `BatchTransformService`

Diese Teile machen fachlich Ähnliches, aber auf anderem Weg.

### Weg C: Wizard

- `creation-wizard.tsx`

Der Wizard speichert und publiziert manche Dinge noch einmal auf eigene Weise.

### Warum das ein Problem ist

Wenn drei Wege fast dasselbe tun, dann entstehen fast immer:

- doppelte Logik,
- leicht verschiedene Fehlerfälle,
- leicht verschiedene Typen,
- schwer wartbarer Code.

---

## 2) Typen sind mehrfach definiert

Das ist ein sehr wichtiger Punkt für dein Ziel „zentral typisieren“.

### Beispiel: `PhasePolicies`

Der Name `PhasePolicies` kommt an mehreren Stellen vor:

- `src/lib/processing/phase-policy.ts`
- `src/types/external-jobs.ts`
- `src/lib/integration-tests/test-cases.ts`

Das Problem:

- gleicher Name,
- aber nicht exakt dieselbe Struktur.

Das ist gefährlich.  
Wenn später ein neuer Policy-Wert dazukommt, kann ein Teil des Systems korrekt sein und ein anderer Teil nicht.

### Empfehlung

Es sollte **genau einen kanonischen Typ** geben.  
Alle anderen Stellen sollten diesen Typ direkt verwenden oder bewusst anders heißen.

---

## 3) `TransformSaveOptions` ist doppelt

Auch dieser Typ ist doppelt angelegt:

- `src/lib/transform/transform-service.ts`
- `src/components/library/transform-save-options.tsx`

Das Problem:

- Die UI hat ihre eigene Variante
- Der Service hat seine eigene Variante

Dann kann es passieren, dass die UI etwas baut, das der Service anders versteht.

### Empfehlung

Entweder:

- ein gemeinsamer Typ,

oder:

- eine kleine Mapping-Funktion zwischen UI-Typ und Service-Typ.

Beides wäre besser als zwei lose Varianten.

---

## 4) Markdown mit Frontmatter wird doppelt gebaut

Hier gibt es ebenfalls doppelte Logik.

### Zentrale Variante

- `src/lib/markdown/compose.ts`

### Zweite Variante

- `TransformService.createMarkdownWithFrontmatter` in `src/lib/transform/transform-service.ts`

### Warum das problematisch ist

Dann kann derselbe fachliche Inhalt je nach Codepfad anders gespeichert werden:

- andere Sortierung,
- andere Serialisierung,
- andere Behandlung von Werten.

Das ist genau die Art von Doppelprogrammierung, die später schwer zu debuggen ist.

### Empfehlung

Es sollte nach Möglichkeit **nur noch eine** zentrale Funktion geben.

---

## 5) Status kommt aus mehreren Quellen

Auch die Statusanzeige ist nicht an einer Stelle konzentriert.

Zum Beispiel:

- `useStoryStatus` + `ingestion-status`
- PDF-spezifische Statuslogik
- Freshness- und Shadow-Twin-Status

### Folge

Die UI kann sich für Nutzer widersprüchlich anfühlen, auch wenn technisch kein einzelner Bug vorliegt.

Mit anderen Worten:

- Ein Bereich sagt „fertig“
- ein anderer Bereich sagt „noch nicht fertig“

Das kann schlicht daran liegen, dass sie nicht dieselbe Datenquelle verwenden.

---

## 6) UI kennt zu viel über `primaryStore`

Das ist eine der klarsten Stellen, wo Soll und Ist auseinanderlaufen.

Die Regeln sagen sinngemäß:

- Die UI soll **nicht** wissen, ob `mongo` oder `filesystem` der primäre Store ist.

Im Code gibt es aber doch solche Stellen:

- `src/components/library/file-preview.tsx`
- `src/components/creation-wizard/creation-wizard.tsx`
- `src/hooks/use-shadow-twin-analysis.ts`

### Warum das wichtig ist

Sobald UI-Komponenten Backend-Details kennen, wird die Trennung unsauber:

- mehr Sonderfälle in der UI,
- schwerere Tests,
- mehr Kopplung an Speicher-Details.

### Empfehlung

Die UI sollte lieber nur abstrakte Fähigkeiten kennen, zum Beispiel:

- „Transkript im Dateisystem sichtbar“
- „Mongo-Upsert nötig“
- „Binary-Upload möglich“

Diese Informationen sollten aus Hook oder API kommen, nicht direkt aus `primaryStore`.

---

## 7) Mögliche alte oder ungenutzte Dateien

Hier habe ich nur Kandidaten gesammelt. Das ist noch **kein Beweis**, dass man sie sofort löschen sollte.

### Kandidat A: `ShadowTwinViewer`

- Datei: `src/components/library/flow/shadow-twin-viewer.tsx`
- Bei der Suche gab es keine externen Imports

Das sieht nach einer Datei aus, die vielleicht einmal gebaut, aber nicht mehr aktiv verwendet wurde.

### Kandidat B: `JobArchiveTest`

- Datei: `src/components/event-monitor/job-archive-test.tsx`
- In `src/app/event-monitor/page.tsx` steht ein Kommentar, dass dieser Teil entfernt wurde

Das ist ein starker Hinweis auf totes UI.

### Kandidat C: auskommentierter `TransformService`-Import

- Datei: `src/app/api/external/jobs/[jobId]/route.ts`

Das spricht dafür, dass es früher einmal einen anderen Integrationsweg gab.

---

## 8) Was ich nicht vorschnell als „tot“ bezeichnen würde

Es gibt auch Dinge, die ähnlich aussehen, aber wahrscheinlich bewusst getrennt sind.

### Beispiel 1

- `/api/event-job/.../download-archive`
- `/api/external/jobs/.../download-archive`

Das sind vermutlich zwei verschiedene Job-Familien.

### Beispiel 2

- `ingest`
- `ingest-markdown`

Das ist nicht automatisch doppelt.  
Die beiden Dinge haben unterschiedliche Zwecke.

---

## 9) Meine einfache Prioritätenliste

Wenn du das System aufräumen willst, würde ich in dieser Reihenfolge vorgehen:

1. **Doppelte Typen aufräumen**
   - zuerst `PhasePolicies`
   - dann `TransformSaveOptions`

2. **Doppelte Markdown-Bausteine aufräumen**
   - nur noch eine Funktion für Frontmatter-Aufbau

3. **Hauptpfad festlegen**
   - `FilePreview` + `/api/pipeline/process`

4. **Legacy sichtbar machen**
   - alte Dialoge markieren oder schrittweise umbauen

5. **Erst danach tote Dateien löschen**
   - nur mit belegter Referenzanalyse

---

## Mein Fazit

Ja, dein Eindruck ist aus meiner Sicht berechtigt:

- Es gibt doppelte Logik
- Es gibt doppelte Typen
- Es gibt mehrere konkurrierende Pfade
- Es gibt wahrscheinlich auch einzelne alte Reste

Wenn du „systemisch“ aufräumen willst, dann ist die wichtigste Regel:

**Nicht zuerst löschen. Erst den einen Standardweg festlegen.**

Danach kannst du alles andere dagegen prüfen:

- braucht man es noch,
- muss es angepasst werden,
- oder kann es weg.

---

## Verweise

- `docs/analysis/pipeline-system-map.md`
- `docs/analysis/rules-gap-analysis.md`
