## Ziel

Integrationstests sollen neben PDF auch **Audio-Dateien** abdecken (Transkription + optional Template-Transformation) und die UI soll so vereinfacht werden, dass man **nur Dateityp (PDF/AUDIO)** und optional **eine konkrete Datei** auswählt (statt File-IDs zu kopieren).

## Änderungen (Design)

- **Testcases bekommen ein `target`** (`pdf` | `audio`), damit
  - der Orchestrator die richtigen Test-Targets im Ordner findet,
  - die UI eine Suite-Auswahl („Nur PDF / Nur Audio / Alle“) anbieten kann.
- **Testdatei-Listung wird generisch** (`listIntegrationTestFiles(kind)`), statt nur `listPdfTestFiles`.
- **Internal Create Route unterstützt Audio**:
  - `src/app/api/external/jobs/internal/create/route.ts` leitet `job_type` und `correlation.source.mediaType` aus `mimeType` ab (oder optional über `mediaType`).
  - Steps werden entsprechend mit `extract_audio` statt `extract_pdf` initialisiert (als Platzhalter; die Start-Route initialisiert Steps ohnehin neu).
- **Validatoren werden medientyp-agnostisch**:
  - Extract-Step-Name wird aus `job.job_type` abgeleitet.
  - Für Extract-only Runs (`phases.template=false`) wird im Shadow‑Twin **Transcript** statt **Transformation** validiert.
- **UI Vereinfachung**:
  - Auswahl: `Dateityp` + `Datei (optional)` → füllt die (legacy) File-ID automatisch.
  - Suite-Filter: „Alle / Nur PDF / Nur Audio“.

## Audio-Testcases (Minimal-Suite)

Ziel ist eine stabile Basis, die ohne spezielle Templates funktioniert:

- `audio_transcription.happy_path`:
  - Extract-only (Transkription), Template/Ingest deaktiviert.
  - Erwartung: Job `completed`, `savedItemId` zeigt auf Transcript.
- `audio_transcription.gate_skip_extract`:
  - Transcript existiert bereits → Extract wird per Gate/Policy übersprungen.
- `audio_transcription.force_recompute`:
  - Transcript existiert, aber Extract wird forciert.

Optional kann später ein eigener UseCase für „Audio + Template“ ergänzt werden (wenn ein passendes Template existiert).

