## Shadow‑Twin `processingStatus` – Analyse und Fix‑Varianten

### Ist‑Zustand

- **Beobachtung TC‑1.2**: `shadowTwinState.processingStatus` ist `null`, obwohl der Jobstatus `completed` ist und ein gültiges Transcript (`Livique_Sørensen.md`) sowie Bilder im Shadow‑Twin‑Verzeichnis existieren.  
- **Datenfluss**:
  - Beim **Job‑Start** analysiert `analyzeShadowTwin` die Datei und `start/route.ts` setzt `processingStatus: 'processing'` über `toMongoShadowTwinState({ ...shadowTwinState, processingStatus: 'processing' })`.
  - Im **Extract‑Only‑Pfad** speichert `runExtractOnly` zuerst das Transcript‑Markdown und ruft danach erneut `analyzeShadowTwin` auf; das Ergebnis wird aktuell mit `toMongoShadowTwinState(updatedShadowTwinState)` gespeichert – **ohne** `processingStatus`. Dadurch kann ein zuvor gesetzter Status überschrieben werden.
  - Am **Ende von `runExtractOnly`** wird versucht, den Status mit einem separaten `repo.get(jobId)` nochmals auf `'ready'` zu setzen; Fehler in diesem Block werden jedoch stumm geschluckt.
- **Problem**: Der Status wird de facto in zwei Schritten verwaltet (Start‑Route und Extract‑Only‑Finalisierung). Ein späteres Überschreiben ohne `processingStatus` plus ein potentiell fehlschlagender, stumm gefangener Update‑Versuch erklären, warum in einzelnen Jobs `processingStatus` auf `null` bzw. `undefined` landet.

### Varianten für einen Fix

- **Variante A – Minimaler, lokaler Fix in `runExtractOnly` (empfohlen)**  
  - Beim Neuberechnen des Shadow‑Twin‑States nach dem Speichern des Transcripts (`analyzeShadowTwin` in `runExtractOnly`) wird der Status direkt auf **`'ready'`** gesetzt:  
    - `const mongoState = toMongoShadowTwinState({ ...updatedShadowTwinState, processingStatus: 'ready' })`.  
  - Der abschließende Block, der nochmals `processingStatus: 'ready'` setzt, bleibt als idempotente Absicherung erhalten.  
  - **Vorteile**: Sehr kleiner Eingriff, keine Änderungen an Start‑Route oder Callback‑Route, garantiert für alle künftigen Extract‑Only‑Jobs einen konsistenten `processingStatus: 'ready'`.  
  - **Nachteile**: Semantisch wird der Status bereits vor Abschluss der Bilder‑Verarbeitung auf `'ready'` gesetzt – in der Praxis tolerierbar, da Bild‑Fehler ohnehin nicht fatal sind und der Jobstatus selbst auf `completed` gesetzt wird.

- **Variante B – Zentrale Helper‑Funktion für Shadow‑Twin‑Status**  
  - Einführung eines Helpers `updateShadowTwinProcessingStatus(jobId, status)`, der:
    - den aktuellen Job lädt (`repo.get`),
    - vorhandenen `shadowTwinState` mit `processingStatus: status` merged und
    - über `setShadowTwinState` speichert.  
  - Verwendung dieses Helpers an allen Stellen, an denen heute der Status direkt gesetzt wird (`start/route.ts`, `extract-only.ts`, `route.ts`).  
  - **Vorteile**: Einheitliche Statuslogik, klarere Verantwortlichkeit, weniger Risiko für inkonsistente Updates.  
  - **Nachteile**: Größerer Refactor, mehr berührte Dateien, höheres Risiko für Regressionen – nicht ideal für einen ersten gezielten Bugfix.

- **Variante C – UI‑seitige Toleranz + Logging**  
  - Im Frontend (`job-report-tab.tsx`) würde `processingStatus === null` wie `undefined` behandelt werden (`isReady` auch bei `null` true).  
  - Serverseitig würde zusätzlich Logging ergänzt, falls das finale Setzen von `'ready'` in `runExtractOnly` fehlschlägt.  
  - **Vorteile**: Behebt kurzfristig Anzeige‑Probleme für historische Jobs.  
  - **Nachteile**: Lässt die inkonsistente Datenlage in MongoDB unangetastet und verbessert die Traceability nicht – entspricht nicht dem Ziel „korrekte und saubere Statuskommunikation“.

### Entscheidung

- Für den aktuellen Durchgang wird **Variante A** umgesetzt:  
  - Sie ist **lokal** (nur `runExtractOnly`), ändert keine externen APIs und keine anderen Phasen.  
  - Sie sorgt dafür, dass Shadow‑Twin‑States für reine Extract‑Jobs deterministisch mit `processingStatus: 'ready'` geschrieben werden, sobald das Transcript erfolgreich im Shadow‑Twin‑Verzeichnis gespeichert wurde.  
  - Der bestehende Abschluss‑Block bleibt als zusätzliche, idempotente Absicherung bestehen.





