## Ziel

Wir möchten Integrationstests so ausführen, dass ein Agent sie **starten** und die Ergebnisse **automatisch auswerten** kann, ohne manuelles Copy/Paste aus der UI. Gleichzeitig sollen Runs reproduzierbar und debugbar bleiben (JobIds, Assertions, Logs).

## Ausgangslage (Ist)

- Es existiert bereits eine Integrationstest-Seite (`/integration-tests`) sowie serverseitige Endpoints:
  - `POST /api/integration-tests/run`: führt Tests aus und liefert Ergebnisse als JSON.
  - `POST /api/integration-tests/results`: bewertet bestehende Jobs anhand Testcases.
- Der Orchestrator (`src/lib/integration-tests/orchestrator.ts`) startet echte External Jobs, wartet auf Abschluss und validiert.
- Problem: Ein Agent kann nicht zuverlässig auf den Browser-Console-Output zugreifen, und manuelles Copy/Paste der Logs ist unpraktisch.

## Varianten

### Variante A (empfohlen): „RunId + serverseitiger Result-Store + Internal-Token“

**Idee:** `POST /api/integration-tests/run` erzeugt ein `runId`, speichert Resultate serverseitig (in-memory, dev-sicher via `globalThis`) und gibt JSON zurück. Zusätzlich erlaubt ein **Internal-Token** (z.B. `INTERNAL_TEST_TOKEN`) die Ausführung auch ohne Clerk-Session (z.B. per CLI).

**Vorteile**
- Voll automatisierbar: Agent/CI kann per HTTP starten und Ergebnis als JSON auswerten.
- Keine UI nötig, keine Copy/Paste nötig.
- Debug bleibt gut: JobIds + Validation-Messages bleiben im JSON enthalten.

**Nachteile**
- In-memory Store ist dev-geeignet; für CI/parallel wäre später Persistenz (DB) sinnvoll.

### Variante B: Headless UI-E2E (Playwright) gegen `/integration-tests`

**Idee:** Playwright klickt UI, liest DOM-Ergebnisse, bewertet.

**Vorteile**
- Testet auch UI/State/Rendering.

**Nachteile**
- Fragiler, langsamer, höherer Wartungsaufwand.
- CI-Komplexität (Browser, Auth, Timings).

### Variante C: „Nur CLI-Orchestrator“ ohne HTTP

**Idee:** Orchestrator als Node-Script direkt aufrufen, Assertions im Script.

**Vorteile**
- Einfach in CI zu integrieren.

**Nachteile**
- Umgeht API/Auth-Realität teilweise (je nach Implementierung).
- Weniger „realistisch“ als HTTP-Pfade, wenn diese sich verändern.

## Entscheidung

Wir setzen **Variante A** um, weil sie die vorhandene Architektur erweitert (statt zu duplizieren), echte HTTP-Integration ermöglicht und einen Agent/CI-Loop ohne Copy/Paste erlaubt. Optional kann später Variante B ergänzend UI-E2E abdecken.

