# Analyse: Wizard-Speicherarchitektur – MongoDB vs. Dateisystem, Single Point of Truth

## Ausgangslage (User-Beobachtung)

Nach dem Event-Creation-Wizard:
- **Galerie**: Ergebnis sichtbar und inspizierbar ✓
- **Archiv**: Unterverzeichnis mit Markdown-Datei erstellt ✓
- **File-Preview**: Original-Tab zeigt Inhalt ✓, Story-Tab zeigt gerenderte Ansicht ✓
- **Transformation-Tab**: "Keine Transformationsdaten vorhanden" ✗
- **Übersicht**: "Kein Transcript gefunden", "Keine Transformation gefunden" ✗
- **Artefakte**: Keine gespeicherten Daten sichtbar ✗

## Architektur-Übersicht

### Was wird wo gespeichert?

| Daten | Speicherort | Verantwortlich |
|-------|-------------|----------------|
| **Haupt-Markdown** (Event-Inhalt) | Dateisystem (Provider) | `handleSave` → `provider.uploadFile()` |
| **Transcript** (Rohkorpus) | Dateisystem (Provider) | `write-bundle` → `writeArtifact(provider)` |
| **Transformation** (Template-Output) | Dateisystem (Provider) | `write-bundle` → `writeArtifact(provider)` |
| **RAG-Index** (für Galerie/Suche) | MongoDB | `ingest-markdown` liest Datei vom Provider, indexiert |

### Wichtiger Unterschied: Wizard vs. JobWorker

| Aspekt | Creation Wizard | JobWorker (External Jobs) |
|--------|-----------------|---------------------------|
| **Schreiben** | `write-bundle` → `writeArtifact(provider)` nur Dateisystem | `TransformService` / `storage.ts` → MongoDB + optional Dateisystem |
| **MongoDB** | Wizard schreibt **nie** in MongoDB | Bei `primaryStore: 'mongo'` schreibt JobWorker in MongoDB |
| **Dateisystem** | Immer (via Provider) | Nur wenn `persistToFilesystem: true` |

### Das Problem

1. **Creation Wizard** schreibt Transcript und Transformation ausschließlich über `writeArtifact(provider)` → **nur Dateisystem**.
2. **resolve API** prüft zuerst `ShadowTwinService` (MongoDB bei `primaryStore: 'mongo'`).
3. Bei `serviceResult === null` wird **kein Provider-Fallback** ausgeführt – die API gibt sofort `artifact: null` zurück.
4. Der Provider-Fallback läuft nur bei einem **geworfenen Fehler** im Service, nicht bei "nicht gefunden".

**Folge**: Bei Bibliotheken mit `primaryStore: 'mongo'` findet die resolve API die Wizard-Artefakte nicht, obwohl sie im Dateisystem liegen.

## Single Point of Truth

- **Für die Galerie**: RAG-Index (MongoDB) – die Ingestion liest die Markdown-Datei vom Provider und indexiert sie.
- **Für die Bearbeitung**: Die Markdown-Datei im Dateisystem ist die kanonische Quelle.
- **Für die File-Preview**: Die Tabs "Original" und "Story" nutzen die Hauptdatei direkt. "Transformation" und "Transcript" erwarten separate Artefakte, die über `resolveArtifact` gefunden werden.

## Nachträgliche Bearbeitung und erneutes Publizieren

1. **Bearbeiten**: Die Haupt-Markdown-Datei im Archiv öffnen und im Original-Tab bearbeiten.
2. **Erneut publizieren**: Nach dem Speichern `ingest-markdown` aufrufen (z.B. über "Jetzt erstellen" oder einen expliziten Publish-Button).

**Einschränkung**: Wenn der Transformation-Tab leer bleibt, fehlt die Möglichkeit, die Transformation separat zu bearbeiten. Die Hauptdatei enthält aber bereits den vollständigen Inhalt (Frontmatter + Body).

## Empfohlene Maßnahmen

1. **Fix**: resolve API – bei `serviceResult === null` Provider-Fallback ausführen, bevor `artifact: null` zurückgegeben wird.
2. **Optional**: write-bundle erweitern, um bei `primaryStore: 'mongo'` auch in MongoDB zu schreiben (analog zum JobWorker). Das würde Konsistenz herstellen, ist aber aufwändiger.
3. **Dokumentation**: In der UI klarmachen, dass die Hauptdatei der Single Point of Truth ist und der Transformation-Tab bei Wizard-Erzeugnissen optional sein kann.
