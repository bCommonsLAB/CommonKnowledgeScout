# Gesamtzusammenfassung: Evolution des Creation Wizards und Shadow-Twin-Managements

Diese detaillierte Zusammenfassung beleuchtet die Entwicklung, Implementierung und Fehlerbehebung im Kontext des Creation Wizards, insbesondere im Hinblick auf das Logging von Wizard-Sitzungen, die Neudefinition des Shadow-Twin-Konzepts und die Zentralisierung des Artefakt-Managements. Der Fokus liegt auf der Verbesserung der Benutzererfahrung (UX) für Human-in-the-Loop (HITL) Workflows, der Sicherstellung der Datenkonsistenz und der Robustheit der Job-Pipeline.

## 1) Geplant

### 1.1. Wizard-Sitzungs-Logging (MongoDB)
Das primäre Ziel war die Implementierung eines MongoDB-basierten Logging-Systems für Creation Wizard Sessions. Jede Wizard-Sitzung sollte als ein Dokument in der `wizard_sessions` Collection gespeichert werden, das strukturierte Events, Referenzen auf externe Jobs und Dateipfade enthält. Das Logging sollte sparsam erfolgen, um Kontextfenster nicht zu überladen, aber alle wichtigen Parameter, Zwischenschritte und Ergebnisse erfassen.

**DSGVO-Konformität:** Es sollten keine E-Mail-Adressen geloggt werden. Stattdessen war die Verwendung einer anonymisierten `userId` (von Clerk für authentifizierte Nutzer) oder einer `sessionIdAnon` (für anonyme Nutzer) vorgesehen.

**Datenstruktur (`WizardSession`, `WizardSessionEvent`):** Detaillierte Interfaces wurden geplant, die Felder wie `sessionId`, `userId` (optional), `sessionIdAnon` (optional), `templateId`, `typeId`, `libraryId`, `status` (`active`, `completed`, `abandoned`, `error`), `initialMode`, `initialStepIndex`, `finalStepIndex`, `finalFileIds`, `finalFilePaths`, `jobIds` (Array von `external_jobs.jobId`), `events` (Array von `WizardSessionEvent`), `startedAt`, `completedAt`, `lastActivityAt` und `errors` umfassen. `WizardSessionEvent` sollte `eventId`, `timestamp`, `eventType` (z.B. `wizard_started`, `step_changed`, `job_started`, `wizard_completed`, `error`) sowie optionale, kontextspezifische Felder enthalten.

**Repository und Logger Helper Functions:** Ein Repository (`src/lib/wizard-session-repository.ts`) mit CRUD-ähnlichen Methoden (`createSession()`, `appendWizardEvent()`, `setWizardSessionStatus()`, etc.) und Logger Helper Functions (`src/lib/wizard-session-logger.ts`) zur Erzeugung von User-Identifikatoren und Event-Objekten waren vorgesehen.

**Integrationspunkte:** Spezifische Events sollten an verschiedenen Stellen im Wizard (`src/components/creation-wizard/creation-wizard.tsx`) geloggt werden, z.B. `wizard_started` beim Mount, `step_changed` bei Navigation, `job_started`/`completed`/`failed` bei externen Jobs, `markdown_confirmed`, `metadata_edited` (sparsam), `file_saved`, `wizard_completed`, `wizard_abandoned` und `error`.

**File Path Tracking:** Bei `handleSave()` sollten `finalFileIds` und `finalFilePaths` geloggt werden.

**Sparsames Logging:** Keine vollständigen Textinhalte oder Metadaten-Objekte, nur IDs, Längen, Keys oder Zusammenfassungen.

**Integration mit External Jobs:** `jobId` in Events und `jobIds` Array speichern, Referenz auf `external_jobs` Collection für Details.

**Debugging UI (optional, später):** Eine Seite `/library/wizard-sessions` zum Anzeigen von Sessions, Filtern und Event-Timeline war angedacht.

### 1.2. Neudefinition des Shadow-Twin-Konzepts und Publish-Flow für `pdfanalyse`

**Shadow-Twin Definition (Update):** Für `pdfanalyse` sollte `Save/Speichern` keine neue finale `.md`-Datei erzeugen. Stattdessen sollte die bereits existierende Transformationsdatei im Shadow-Twin (`*.pdfanalyse.de.md`) mit den korrigierten Frontmatter-Daten überschrieben werden. Danach sollte die Promotion der Artefakte in den Zielordner und ein expliziter Ingest/Publish-Aufruf erfolgen. Die `soerensen-bedding-netto-ek-preisliste-2025.md` sollte nicht mehr benötigt werden.

**Implementierung des \"Publish\"-Schritts im Wizard:** Nach der Vorschau sollte ein expliziter \"Publizieren\"-Schritt eingeführt werden, der den Publish-Vorgang (Promotion, Shadow-Twin-Update, Ingestion) startet und den Fortschritt anzeigt.

**UX-Verbesserung für PDF-HITL-Flow:** Der Wizard sollte den Nutzer linear durch die Schritte führen: PDF auswählen → OCR/Extract (mit Progress) → Markdown prüfen/korrigieren → Metadaten/Template (mit Progress) → Metadaten prüfen → Vorschau → Publizieren (mit Progress) → Wizard abgeschlossen.

**Shadow-Twin Publish Contract:** Die kanonische Datei für `pdfanalyse` sollte die Transformationsdatei im Shadow-Twin (`*.pdfanalyse.de.md`) sein. Beim Speichern im Wizard sollte dieses Artefakt überschrieben (nur Frontmatter aktualisiert, Body bleibt) und anschließend explizit die Ingestion (RAG) ausgelöst werden. Es sollte keine zusätzliche \"finale\" Markdown-Datei außerhalb des Shadow-Twins erzeugt werden.

**Promotion von Wizard-Artefakten:** Staging-Artefakte aus `.wizard-sources` sollten beim Speichern in den Zielordner verschoben werden (Variante C).

**Logging-Verbesserung:** Der `stepPreset` sollte im `wizard_completed`-Event korrekt mitgeloggt werden.

### 1.3. Zentralisierung des Artefakt-Managements (Shadow-Twin V2)

**Zentralisierung der Artefakt-Erkennung und des Artefakt-Writers:** Ablösung der heuristischen Dateierkennung (`listItems + expectedTransformName`) und der manuellen `delete + upload` Logik durch einen zentralen Resolver (`resolveArtifactClient`) und Writer (`writeArtifact()`).

**Enforcement des Job-Contracts:** Sicherstellen, dass `setJobCompleted()` (zentrale Job-Abschlusslogik) den `savedItemId` auf das korrekte Artefakt (Transformation für Template-Jobs, Transcript für Extract-only-Jobs) validiert und ggf. korrigiert.

**Entfernung von UI-Sonderlogik:** Beseitigung von Fallback-Logiken im Wizard, die zentrale Fehler kaschieren würden.

**V2-Only Modus:** Konsequente Umstellung auf Shadow-Twin V2-Modus, bei dem Legacy-Logik sofort einen Fehler wirft. Dies beinhaltet die Erweiterung der Library-Config um `shadowTwinMode`, eine API-Route zum Umschalten des Modus, einen UI-Button in den Library-Settings und einen \"minimalen Converter\" (Backfill) ohne Storage-Move.

### 1.4. `TransformService` und Externe Jobs Start API

**`TransformService`:** Bereitstellung eines einheitlichen Dienstes (`TransformService`) für verschiedene Dateitypen (Audio, Video, PDF, Bild, Text). Dieser sollte Metadaten extrahieren, Shadow-Twin-Dateien erstellen, Bildextraktion (PDF) unterstützen, asynchrone PDF-Verarbeitung handhaben, Doc-Meta Upsert durchführen und Platzhalter ersetzen. Die zentrale Artefakt-Schreiblogik sollte in `writeArtifact()` konsolidiert werden.

**Externe Jobs Start API (`/api/external/jobs/[jobId]/start`):** Orchestrierung des Starts externer Jobs, die Dateitransformationen auslösen. Dies umfasst Authentifizierung, Watchdog-Management, robuste Fehlerbehandlung, Shadow-Twin-Analyse zu Beginn eines Jobs, deterministische Shadow-Twin-Ordnererstellung, Ausführung von Phasen-Preprozessoren, Gate-basierte Phasensteuerung, Policy-basierte Phasensteuerung (`force`, `skip`, `auto`, `ignore`, `do`), Unterstützung von Ingest-Only- und Template-Only-Flows, Integration mit dem Secretary Service und kontinuierliche Aktualisierung des Job-Status.

### 1.5. Integrationstests

**Validierung von Shadow-Twin-Artefakten und Ingestion:** Sicherstellen, dass Shadow-Twin-Artefakte korrekt erstellt und abgelegt werden und die Ingestion-Phase erfolgreich war.

**Validierung von MongoDB Vector Search:** Detaillierte Prüfung von Meta-Dokumenten, Chunk-Vektoren, Vector Search Index und Queries.

**Globale Contract-Validierung:** Überprüfung allgemeiner Regeln wie `result.savedItemId` bei `completed` Jobs und Konsistenz von Step-Status mit Policies.

**V2-only Modus:** Tests sollten den `v2-only` Modus für Shadow-Twin-Artefakte validieren.

**Debugging-Verbesserung für Integrationstests:** Die Integrationstests sollten auch bei Fehlern Job-IDs und detaillierte Fehlermeldungen liefern.

## 2) Umgesetzt

### 2.1. Wizard-Sitzungs-Logging

**Schema & Types:** `src/types/wizard-session.ts` wurde definiert, inklusive `WizardSession` und `WizardSessionEvent` Interfaces mit allen geplanten Feldern.

**Repository:** `src/lib/wizard-session-repository.ts` wurde implementiert. `createWizardSessionId()` erzeugt eine eindeutige Session-ID. `createWizardSession()` erstellt ein neues Session-Dokument. `appendWizardEvent()` fügt Events hinzu, wobei `jobIds` mit `$addToSet` aktualisiert wird, um Duplikate zu vermeiden. `setWizardSessionStatus()` aktualisiert den Status. Indizes wurden einmalig erstellt.

**Logger Helper Functions:** `src/lib/wizard-session-logger.ts` wurde implementiert, inklusive `getWizardUserIdentifier()` (Clerk `userId` oder `X-Session-ID` Header `sessionIdAnon`), `createEventId()` und `createWizardEvent()`.

**API Routes:**
*   `POST /api/wizard-sessions/start`: Erstellt eine neue Wizard-Session und loggt `wizard_started`.
*   `POST /api/wizard-sessions/[sessionId]/events`: Fügt ein Event hinzu (mit Owner-Check).
*   `POST /api/wizard-sessions/[sessionId]/finalize`: Finalisiert eine Session (mit Owner-Check).

**Client-Side Logger:** `src/lib/wizard-session-logger-client.ts` bietet Wrapper für die API-Routen. `getFilePathsClient()` extrahiert Pfade aus Base64-kodierten File-IDs.

**Integration in Wizard (`src/components/creation-wizard/creation-wizard.tsx`):**
*   **Fix für Hook-Order-Bug:** Cleanup-`useEffect` wurde vor frühe `return`-Statements verschoben.
*   `wizardSessionCompletedRef`: Verhindert fälschliche `abandoned`-Markierung.
*   `logWizardEvent()`: Wrapper-Funktion für konsistentes Logging.
*   `scheduleMetadataEditedLog()`: Debounced Logging für `metadata_edited` (nur `keysCount`, `keysSample`).

### 2.2. Neudefinition des Shadow-Twin-Konzepts und Publish-Flow für `pdfanalyse`

**`handleSave()` Logik für `pdfanalyse` angepasst (Variante C):**
*   **Keine neue `.md`-Datei:** Die Erzeugung einer separaten `soerensen-bedding-netto-ek-preisliste-2025.md` wurde entfernt.
*   **Promotion:** `promotePdfWizardArtifacts()` verschiebt Basis-PDF und Shadow-Twin-Ordner aus `.wizard-sources` in den Zielordner.
*   **Overwrite Shadow-Twin:** Die `*.pdfanalyse.de.md` Datei im Shadow-Twin-Ordner wird mit aktualisiertem Frontmatter und ursprünglichem Body überschrieben.
*   **Ingest:** Ein `ingest-markdown` API-Aufruf wird getätigt.
*   **Fehlerbehandlung:** Logging für `upload_image_failed` und `wizard_artifact_promotion_failed` wurde hinzugefügt.

**Neues Step-Preset \"publish\":** Das Preset `publish` wurde in `src/lib/templates/template-types.ts` und `src/components/templates/structured-template-editor.tsx` hinzugefügt.

**Neue Step-Komponente \"PublishStep\":** Eine dedizierte Komponente `src/components/creation-wizard/steps/publish-step.tsx` wurde erstellt, die den Publish-Vorgang mit Progressbar und Statusmeldungen anzeigt.

**Wizard-State für Publish-Vorgang:** Der `WizardState` wurde um `isPublishing`, `publishingProgress`, `publishingMessage`, `publishError` und `isPublished` erweitert.

**`handleNext`-Logik für Publish-Step:** Der \"Speichern\"-Button im letzten Schritt (Publish) wird zu \"Fertig\" und navigiert nach erfolgreichem Publish zur Bibliothek.

**Fehlerbehebung im `handleSave`:** Ein Syntaxfehler (`else if`-Rest) wurde behoben.

**Logging von `stepPreset` im `wizard_completed`-Event:** Die `wizard_completed`-Events loggen nun den korrekten `stepPreset`.

**Markdown-Preview:** `ReviewMarkdownStep` und `PreviewDetailStep` erhalten `provider` und `currentFolderId` zur korrekten Auflösung relativer Bildpfade.

### 2.3. Zentralisierung des Artefakt-Managements (Shadow-Twin V2)

**`artifact-naming.ts` Fix:** `parseArtifactName()` wurde korrigiert, um Dateinamen mit Punkten im Basisnamen (z.B. \"vs.\") korrekt zu parsen. Zwei Unit-Tests wurden hinzugefügt.

**`setJobCompleted()` Contract Enforcement:** Die Funktion in `src/lib/external-jobs/complete.ts` wurde überarbeitet, um den Contract „Template-Job ⇒ savedItemId muss Transformation sein“ hart durchzusetzen. Ungültige `savedItemId` werden ignoriert, das korrekte Artefakt über `resolveArtifact()` (V2-only) gesucht, und bei Nicht-Finden ein Fehler geworfen. Eine Hilfsfunktion `isExpectedSavedItem()` wurde hinzugefügt.

**`creation-wizard.tsx` Bereinigung:** Die UI-Sonderlogik zur Verifikation und Korrektur des `savedItemId` wurde entfernt.

**`artifact-writer.ts` und `artifact-resolver.ts` V2-Only Enforcement:** `writeArtifact` und `resolveArtifact` wurden mit einem `assertShadowTwinV2Only(mode)`-Guard versehen, der bei Legacy-Aufrufen einen `ShadowTwinLegacyNotAllowedError` auslöst. Die Legacy-Funktionen wurden entfernt.

**`mode-helper.ts` und `mode-client.ts` V2-Only:** `getShadowTwinMode` und `getShadowTwinModeClient` geben nun immer `'v2'` zurück.

**`errors.ts`:** `ShadowTwinLegacyNotAllowedError` und `assertShadowTwinV2Only` wurden eingeführt.

**`artifact-logger.ts`:** Die `mode`-Property wurde aus Logging-Interfaces entfernt.

**Anpassungen in Job-Phasen:** `analyze-shadow-twin.ts`, `external-jobs/phase-template.ts`, `external-jobs/extract-only.ts`, `external-jobs/storage.ts` und `transform-service.ts` wurden angepasst, um `resolveArtifact` und `writeArtifact` (V2-only) zu verwenden.

### 2.4. `TransformService` und Externe Jobs Start API

**`TransformService` Implementierung:**
*   **`transformVideo`:** Startet Secretary Service `transformVideo`, extrahiert `transformedText` und Metadaten, erstellt Markdown mit Frontmatter, speichert Shadow-Twin (kind: 'transcript') über `saveTwinFile`.
*   **`transformText`:** Startet Secretary Service `transformText`, ersetzt Platzhalter, speichert Shadow-Twin (kind: 'transformation') über `saveTwinFile`.
*   **`transformPdf`:** Bestimmt `includeOcrImages`/`includePageImages`, startet Secretary Service `transformPdf`, behandelt asynchrone Jobs, extrahiert `transformedText` und Metadaten, erstellt Shadow-Twin-Verzeichnis bei Bedarf, speichert Bilder über `ImageExtractionService`, erstellt Markdown, speichert Shadow-Twin (kind: 'transformation' oder 'transcript') über `saveTwinFile`, führt Fire-and-forget `upsert-doc-meta` aus.
*   **`transformImage`:** Startet Secretary Service `transformImage`, extrahiert `transformedText` und Metadaten, erstellt Markdown, speichert Shadow-Twin (kind: 'transcript') über `saveTwinFile`.
*   **`saveTwinFile`:** Hilfsmethode, nutzt `writeArtifact()` mit explizitem `ArtifactKey`, bestimmt `targetParentId`, bereinigt `sourceName`, aktualisiert Dateiliste.
*   **`saveTransformedText` / `saveTransformationResult`:** Speichern transformierten Text/Ergebnis, nutzen `saveTwinFile` bei `createShadowTwin`.
*   **`createMarkdownWithFrontmatter`:** Erstellt Markdown mit YAML-Frontmatter, normalisiert und sortiert Metadaten.

**Externe Jobs Start API (`/api/external/jobs/[jobId]/start`) Implementierung:**
*   **Authentifizierung:** Überprüft Benutzer/Worker.
*   **Job-Laden und Watchdog:** Lädt Job, startet/aktualisiert Watchdog.
*   **Startbarkeit und Neustart:** Prüft Startbarkeit, ermöglicht Neustart fehlgeschlagener Jobs.
*   **Storage-Provider und Datei-Laden:** Lädt Provider und Quelldatei.
*   **Trace-Initialisierung und Shadow-Twin-Analyse:** Initialisiert Trace, analysiert Shadow-Twin-Zustand.
*   **Deterministische Shadow-Twin-Ordnererstellung:** Erstellt bei Bedarf Shadow-Twin-Verzeichnis für Bilder.
*   **Preprozessoren:** Führt `preprocessorPdfExtract` und `preprocessorTransformTemplate` aus.
*   **Callback-URL und Steps-Initialisierung:** Erstellt Callback-URL, initialisiert Job-Steps.
*   **Gate-Prüfung und Phasen-Entscheidung:** Prüft Extract-Gate, bestimmt `runExtract`, `runTemplate`, `runIngestOnly` basierend auf Policies.
*   **Template-Skip-Logik:** Prüft, ob Template-Phase übersprungen werden sollte.
*   **Ingest-Only-Flow / Template-Only-Flow:** Markiert Schritte als `skipped`, lädt Shadow-Twin-Markdown, führt `runIngestPhase`/`runTemplatePhase` aus, aktualisiert Shadow-Twin-State, markiert Job als `completed`.
*   **Secretary-Flow (Extract/Template):** Generiert Job-Secret, sendet Request an Secretary Service, behandelt Responses/Fehler, aktualisiert Watchdog.
*   **Fehlerbehandlung:** Fängt alle Fehler ab, setzt Job-Status auf `failed`.

### 2.5. Integrationstests

**`integrationTestCases`:** Definiert Testfälle für PDF-Transformationen, gruppiert nach `useCaseId` (z.B. `pdf_mistral_report`), mit `id`, `label`, `description`, `category`, `phases`, `policies`, `mistralOptions`, `shadowTwinState` und `expected` Ergebnissen. Unterstützt `single_job` und `pdf_hitl_publish`.

**`validateExternalJobForTestCase`:** Lädt Job, führt globale Contract-Validierungen durch (`result.savedItemId`), prüft Step-Status, extrahiert/validiert Trace-Events, validiert Shadow-Twin-Zustand und Artefakte, validiert Ingestion und MongoDB Vector Search.

**`validateShadowTwin`:** Prüft Shadow-Twin-Verzeichnis und transformierte Markdown-Datei über `resolveArtifact`.

**`validateIngestion` / `validateMongoVectorUpsert`:** Prüft Ingestion-Erfolg, Vorhandensein von Meta-Dokumenten und Chunk-Vektoren in MongoDB, Facetten-Metadaten, Vector Search Query und Index, Chapter-Summaries.

**`validateGlobalContracts` / `validateSavedItemIdKindContract`:** Stellt sicher, dass `completed` Jobs ein `result.savedItemId` haben, keine `pending` Steps, und dass `savedItemId` auf das korrekte Artefakt zeigt.

**`prepareShadowTwinForTestCase`:** Bereitet Shadow-Twin-Zustand für Testfall vor (`clean`, `exists`).

**`runPdfHitlPublishWorkflow`:** Simuliert den Wizard-Flow für PDF HITL Publish, erstellt zwei Jobs (Extract-only, Template-only), führt Publish-Schritt durch (Frontmatter-Overwrite + Ingestion), validiert Contract.

**`runIntegrationTests`:** Orchestriert die Ausführung von Integrationstests, wählt Testfälle/PDFs, erstellt/startet Jobs, wartet auf Abschluss, validiert Ergebnisse, berechnet Zusammenfassung.

**Behebung von \"Unauthorized\" Fehlern in Callbacks:** Der Callback-Auth-Mechanismus in `src/lib/external-jobs/auth.ts` wurde angepasst, um `Authorization: Bearer <SECRETARY_SERVICE_API_KEY>` und `X-Service-Token` korrekt zu verarbeiten und `hash_mismatch`-Fehler zu vermeiden. `processId`-Mismatch wird ignoriert. `401/unauthorized` Fehler markieren Jobs nicht mehr als \"failed\". `status=completed` entfernt nun explizit alte `error`-Flags.

**Behebung von `result.savedItemId` Race-Condition:** Die Reihenfolge in `runExtractOnly()` wurde korrigiert (`repo.setResult()` vor `repo.setStatus(completed)`). Ein zentraler `savedItemId`-Fallback in `setJobCompleted()` leitet `savedItemId` deterministisch aus dem Shadow-Twin ab, falls es im `result` fehlt.

**Behebung von ZIP-Extraktionsfehlern:** In `src/lib/external-jobs/images.ts` wird die Extraktion von `mistral_ocr_images.zip` übersprungen, wenn die Response zu klein ist oder nicht wie ein ZIP aussieht. In `src/app/api/storage/filesystem/route.ts` führen ungültige/zu kleine ZIPs nicht mehr zu einem 500er-Fehler, sondern werden als \"skipped/invalid_zip\" behandelt.

## 3) Offen / Nächste Schritte

### 3.1. Verifizierung und UI-Feinschliff

*   **Manueller End-to-End Test im Wizard:** Ein vollständiger manueller Test des PDF-HITL-Flows (Upload → Publish) ist erforderlich, um die Sichtbarkeit der Progressbars, die korrekte Artefakt-Verarbeitung im Shadow-Twin und das Fehlen von störenden Konsolenfehlern zu überprüfen.
*   **Console-Fehler:** Die ursprünglichen Console-Fehler bezüglich `savedItemId is not defined` und der 404s für Bilder sollten behoben sein. Eine erneute Überprüfung der Konsole ist erforderlich.
*   **Wizard-UI Feinschliff:** Überprüfung und Bereinigung der Wizard-UI auf verbleibende Debug-Infos, Texte und Progress-Messaging.

### 3.2. Shadow-Twin Zentralisierung und Legacy-Bereinigung

*   **Frontend-Entkopplung:** Ersetzen aller UI-seitigen Shadow-Twin-Heuristiken (Dateinamen-Parsing, `list + string match`) durch den neuen `artifact-client`. Dies betrifft Komponenten wie `CreationWizard`, `transformation-dialog` und `job-report-tab`.
*   **Zentraler Writer:** Sicherstellen, dass alle Schreibpfade für Shadow-Twin-Artefakte über eine zentrale Funktion laufen, die durch `shadowTwin.mode=v2` gesteuert wird.
*   **Repo-weites Legacy-Audit:** Systematische Durchsuchung des gesamten Source-Codes nach verbleibendem Legacy-Code und V1-Lese-/Schreiblogik. Offene Stellen sollen identifiziert und für die Migration auf V2-only umgebaut werden.
*   **Migration bestehender Libraries:** Entwicklung eines separaten Migrationsprozesses für bestehende Libraries, der die alten Artefakte auf das V2-Format umstellt. Dieser Prozess soll Dry-Run-fähig und sicher sein.
*   **`saveTwinFileLegacy`:** Diese Legacy-Implementierung ist noch vorhanden, könnte aber entfernt werden.
*   **`transformAudio`:** Die alte API-Response (String) wird noch behandelt. Dies könnte entfernt werden.
*   **`transformVideo` / `transformPdf` / `transformImage`:** `console.log` Statements könnten durch `FileLogger` ersetzt oder reduziert werden.
*   **`transformPdf` Doc-Meta Upsert:** Der `fetch` Aufruf ist \"fire-and-forget\". Eine robustere Fehlerbehandlung oder Retry-Mechanismus könnte in Betracht gezogen werden.
*   **`deriveExtractGateFromShadowTwinState`:** Die Robustheit dieser Funktion bei komplexen Shadow-Twin-States könnte weiter geprüft werden.
*   **`templateSkipReason === 'legacy_markdown_adopted'` / `cleanupLegacyMarkdownAfterTemplate`:** Diese Legacy-Referenzen sollten bereinigt werden.
*   **`getShadowTwinMode`:** Der Import von `getShadowTwinMode` ist noch vorhanden, obwohl der Modus immer `v2` ist. Dies könnte entfernt werden.
*   **`templateSkipReason`:** Die Logik für `templateSkipReason` ist komplex und könnte vereinfacht werden.

### 3.3. Dokumentation und Tests

*   **Dokumentation:** Die interne Dokumentation (z.B. `docs/architecture/...`) sollte aktualisiert werden, um die neue Definition des Shadow-Twins und des Publish-Flows für `pdfanalyse` widerzuspiegeln.
*   **Linting/Testing:** Sicherstellen, dass alle Linting-Regeln eingehalten werden und bestehende Unit-Tests weiterhin erfolgreich sind. Gegebenenfalls neue Tests für den aktualisierten Save-Flow hinzufügen.
*   **Integration-Test-Validatoren:** Überprüfung und Anpassung der Integration-Test-Validatoren, um die neuen V2-only Contracts und das erwartete Verhalten der Shadow-Twin-Artefakte umfassend zu prüfen.
*   **Zusätzliche Integrationstests:** Erstellung weiterer Integrationstests für Edge-Cases und spezifische Szenarien.
*   **`integrationTestCases`:** Die `category: 'phase2'` und `testCase.id?.startsWith('TC-2.')` sollten aktualisiert werden.
*   **`validateMongoUpsert`:** Diese Funktion ist als `@deprecated` markiert und sollte entfernt werden.
*   **`prepareShadowTwinForTestCase`:** Der `state: 'exists'` führt keine Manipulation durch, was zu Abhängigkeiten zwischen Tests führen könnte. Eine explizitere Initialisierung wäre besser.
*   **`runIntegrationTests`:** Die `skipped` Zählung in der Zusammenfassung ist noch nicht implementiert.

### 3.4. Zukünftige Erweiterungen

*   **Settings \"Transkriptionsstrategie\" entwirren:** Deaktivieren der \"db\"-Option in der UI oder Hinzufügen einer Warnung.
*   **Audio/Video HITL-Flow:** Implementierung analoger HITL-Flows für Audio- und Video-Dateien, um die Generalisierbarkeit der Architektur zu beweisen. Dies würde neue Integrationstests umfassen.
*   **Docs Cleanup:** Audit-Report aktualisieren, UI/Config Legacy-Behandlung anpassen, Tests auf v2-only umstellen, Migration-Code klar markieren, `getShadowTwinModeClient` Nutzung überdenken, Hard Block im Runtime-Pfad implementieren.