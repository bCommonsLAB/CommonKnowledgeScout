# Wizard: Transformation als Source, Single Point of Truth, Redundanz

## Ausgangslage

Die Wizard-generierte Datei ist **bereits eine Transformation** – sie ist gleichzeitig Transcript und Transformation. Es gibt nur diese eine Datei im Filesystem; sie dient als Aufhänger für die in MongoDB verwalteten Daten (RAG-Index).

**Offene Fragen:**
1. Wie den Transformationsprozess überspringen und direkt ins Publizieren kommen?
2. Anwender möchte ggf. noch ein Bild generieren oder die Transformation bearbeiten – wie handhaben?
3. Frontmatter-Flag vs. redundante Artefakte?
4. Wenn MongoDB und Ausgangsdatei unterschiedlich sind → Verwirrung. Wie vermeiden?

---

## 1. Single Point of Truth: Datei vs. MongoDB

### Aktueller Ingestion-Flow

- **ingest-markdown** liest entweder:
  - aus **MongoDB** (wenn `fileId` eine Mongo Shadow-Twin ID ist), oder
  - aus dem **Provider/Filesystem** (Standardfall)
- Für Wizard-generierte Dateien: `fileId` ist eine Provider-Datei-ID → **immer Lesen aus dem Filesystem**

### Konsequenz

| Szenario | Source of Truth | Divergenz-Risiko |
|----------|-----------------|------------------|
| Wizard-Datei, Ingestion via fileId | **Datei** | Keins – RAG wird aus Datei befüllt |
| JobWorker, primaryStore='mongo' | **MongoDB** | Ja – wenn Datei separat bearbeitet wird |
| JobWorker, primaryStore='filesystem' | **Datei** | Keins |

**Empfehlung für Wizard:** Die Datei ist der Single Point of Truth. Keine redundante Speicherung in MongoDB. Ingestion liest immer die Datei. Bearbeitung erfolgt an der Datei → Re-Ingestion aktualisiert den RAG-Index.

---

## 2. Transformationsschritt überspringen: Frontmatter-Flag

### Option A: Explizites Flag

```yaml
# Im Frontmatter
creationWizardSource: true   # oder: transformationSource: true
```

- **Vorteil:** Eindeutig, Pipeline kann gezielt prüfen.
- **Nachteil:** Zusätzliches Feld, muss konsistent gesetzt werden.

### Option B: Implizit über creationFlowMetadata

```yaml
creationFlowMetadata:
  creationTypeId: event-creation-de
  creationTemplateId: ...
```

- **Vorteil:** Bereits vorhanden, keine Änderung nötig.
- **Nachteil:** Semantik „bereits Transformation“ ist nicht explizit.

### Option C: Kombination

- `creationFlowMetadata` vorhanden → Wizard-Quelle.
- Zusätzlich `transformationSource: true` als klare Pipeline-Anweisung.

**Empfehlung:** Option C – `creationFlowMetadata` für Herkunft, `transformationSource: true` für Pipeline-Steuerung.

---

## 3. Transformationsschritt: „Source als Transformation“ behandeln

Auch wenn die Datei schon eine Transformation ist, kann der Anwender:

- die Datei **bearbeiten** (Text, Frontmatter),
- ein **Bild** ergänzen oder generieren.

### Möglicher Ablauf

1. **Pipeline erkennt** `transformationSource: true` (oder `creationFlowMetadata`).
2. **Extract:** Überspringen (Markdown ist bereits Text).
3. **Template:** Überspringen (bereits transformiert).
4. **Optionaler „Edit/Enrich“-Schritt:**
   - UI: „Bearbeiten“, „Bild hinzufügen“, „Cover generieren“.
   - Änderungen werden in der **Datei** gespeichert.
5. **Ingest:** Datei lesen und indexieren.

### Keine Redundanz nötig

- Die Datei bleibt die einzige Quelle.
- Kein separates Transcript/Transformation-Artefakt.
- `resolveArtifact` kann bei `transformationSource: true` die **Source-Datei selbst** als Transformation zurückgeben („self-reference“).

---

## 4. Redundanz: Wann nötig, wann nicht?

| Modell | Redundanz | Verwendung |
|--------|-----------|------------|
| **Wizard-Output (eine Datei)** | Nein | Datei = Transformation. Kein Shadow-Twin. |
| **JobWorker, filesystem** | Ja (Shadow-Twin) | Transcript + Transformation im Dot-Folder. |
| **JobWorker, mongo** | Ja (MongoDB) | Transcript + Transformation in MongoDB. |

**Für den Wizard:** Keine Redundanz. Die eine Datei reicht. Sie wird direkt ingestiert.

**Divergenz-Problem** entsteht nur, wenn:
- In MongoDB ein Shadow-Twin existiert (JobWorker, mongo),
- und die Datei im Filesystem separat bearbeitet wird.

**Lösung:** Bei Wizard-Dateien gibt es keinen MongoDB-Shadow-Twin. Alles läuft über die Datei.

---

## 5. Zusammenfassung: Empfohlener Ansatz

1. **Frontmatter:** `transformationSource: true` + `creationFlowMetadata` (bereits vorhanden).
2. **Pipeline:** Bei `transformationSource: true`:
   - Extract überspringen,
   - Template überspringen,
   - Optional: Edit/Enrich-Schritt (Bild, Cover),
   - Ingest aus der Datei.
3. **Keine Redundanz:** Kein Shadow-Twin, keine MongoDB-Kopie für Wizard-Dateien.
4. **File-Preview:** Bei `transformationSource: true` die Source-Datei als Transformation anzeigen (self-reference in `resolveArtifact`).
5. **Single Point of Truth:** Immer die Datei im Filesystem.

---

## 6. Offene Implementierungsfragen

- Wo genau wird `transformationSource` in der Pipeline ausgewertet? (run-pipeline, phase-template, pipeline/process)
- Wie wird der „Edit/Enrich“-Schritt in der UI angeboten – als eigener Step oder integriert in die File-Preview?
- Soll `resolveArtifact` bei Wizard-Dateien die Source-ID als Transformation-ID zurückgeben (self-reference)?
