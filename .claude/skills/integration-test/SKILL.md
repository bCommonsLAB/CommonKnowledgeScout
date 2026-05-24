---
name: integration-test
description: Führe Integration-Tests für ein Verzeichnis aus, analysiere Fehler, implementiere Fixes und wiederhole bis alle Tests grün sind. Verwende diesen Skill wenn der Benutzer Integrationstests oder "teste dieses Verzeichnis" erwähnt.
---

# Integration-Test Skill

Dieser Skill führt End-to-End Integration-Tests für das CommonKnowledgeScout Projekt aus.

## Wann verwenden

- Wenn der Benutzer "Integrationstest", "teste dieses Verzeichnis" oder ähnliches sagt
- Wenn der Benutzer ein Verzeichnis mit Dateien (PDF, Audio, Markdown, etc.) testen möchte
- Wenn der Benutzer den Test-Loop starten möchte (Test → Analyse → Fix → Repeat)

## Voraussetzungen

1. Dev-Server muss laufen (`pnpm dev`)
2. Secretary Service muss erreichbar sein (localhost:5001)
3. MongoDB muss verfügbar sein

## Parameter sammeln

Bevor du Tests startest, sammle folgende Informationen vom Benutzer:

| Parameter | Erforderlich | Beschreibung |
|-----------|--------------|--------------|
| `libraryId` | Ja | Die Library-ID (UUID) |
| `folderId` | Ja | Die Folder-ID (Base64-encoded) |
| `userEmail` | Ja | E-Mail des Benutzers |
| `fileKind` | Nein | `pdf`, `audio`, `markdown`, `txt`, `website` |
| `testCaseIds` | Nein | Komma-getrennte Liste von Test-IDs |

## Verfügbare Testcases

### Audio
- `audio_transcription.happy_path` - Einfache Audio-Transkription
- `audio_transcription.gate_skip_extract` - Überspringt Extract wenn Shadow-Twin existiert
- `audio_transcription.force_recompute` - Erzwingt Neuberechnung
- `audio_transcription.template_and_ingest` - Template + Ingestion nach Transkription

### PDF
- `pdf_mistral_report.happy_path` - PDF-Extraktion + Template
- `pdf_mistral_report.gate_skip_extract` - Überspringt Extract
- `pdf_mistral_report.force_recompute` - Erzwingt Neuberechnung
- `pdfanalyse.hitl_publish` - Human-in-the-Loop Publishing

### Markdown/TXT/Website
- `markdown_ingest.happy_path` - Markdown → Template → Ingest
- `txt_normalize.happy_path` - TXT → Normalize → Template → Ingest
- `website_normalize.happy_path` - Website → Normalize → Template → Ingest

## Test-Befehl

Führe Tests mit folgendem Befehl aus:

```bash
pnpm -s test:integration:api -- \
  --libraryId <LIBRARY_ID> \
  --folderId <FOLDER_ID> \
  --userEmail <USER_EMAIL> \
  --fileKind <FILE_KIND> \
  --testCaseIds <COMMA_SEPARATED_IDS>
```

### Beispiel

```bash
pnpm -s test:integration:api -- \
  --libraryId 7911fdb9-8608-4b24-908b-022a4015cbca \
  --folderId YXVkaW8= \
  --userEmail peter.aichner@crystal-design.com \
  --fileKind audio \
  --testCaseIds audio_transcription.happy_path,audio_transcription.template_and_ingest
```

## Agent-Loop (Definition of Done)

Führe folgende Schleife aus bis `failed = 0`:

### 1. Tests starten
Führe den Test-Befehl aus und warte auf das Ergebnis (JSON).

### 2. Ergebnis analysieren
Prüfe im JSON:
- `summary.failed` - Anzahl fehlgeschlagener Tests
- `results[].messages` - Validierungsnachrichten (type: error/warn/info)

### 3. Bei Fehlern

a) **Fehler clustern**: Gruppiere ähnliche Fehler nach Message-Text

b) **Root-Cause analysieren**:
   - Lies den Job via MongoDB oder API
   - Prüfe Trace-Events und Step-Status
   - Identifiziere die fehlerhafte Code-Stelle

c) **Minimalen Fix implementieren**:
   - 1 Fehler-Cluster → 1 Fix
   - Ändere so wenig Code wie möglich
   - Füge hilfreiche Kommentare hinzu

d) **Unit-Tests prüfen**:
   ```bash
   pnpm test
   ```

### 4. Wiederholen
Starte die Tests erneut und wiederhole bis alle grün sind.

## Globale Contracts (immer prüfen)

Diese Regeln müssen IMMER erfüllt sein:

1. **Leeres Markdown ist ein Fehler** - Keine leeren Transcripts/Transformationen
2. **completed ⇒ keine pending Steps** - Alle aktivierten Phasen müssen abgeschlossen sein
3. **completed ⇒ keine running Steps** - Keine hängenden Steps
4. **phases.X = true ⇒ Step X muss completed sein** - Aktivierte Phasen dürfen nicht pending bleiben

## Referenz-Dokumentation

Detaillierte Dokumentation findest du in:
- `docs/guides/integration-tests.md` - Hauptdokumentation
- `docs/analysis/integration-tests-agent-mode.md` - Agent-Modus Details
- `src/lib/integration-tests/test-cases.ts` - Testcase-Definitionen
- `src/lib/integration-tests/validators.ts` - Validierungslogik

## Beispiel-Interaktion

**Benutzer:** "Teste mir die Audio-Dateien im Testfolder"

**Agent:**
1. Fragt nach Library-ID und Folder-ID (falls nicht bekannt)
2. Führt aus: `pnpm -s test:integration:api -- --libraryId ... --folderId ... --fileKind audio`
3. Analysiert das JSON-Ergebnis
4. Bei Fehlern: Identifiziert Root-Cause, implementiert Fix, wiederholt
5. Meldet: "Alle X Tests bestanden" oder "Y Fehler gefunden, analysiere..."
