# User-Test-Plan: Pilot-Welle `external-jobs`

Stand: 2026-04-25. Erstellt fuer User-Verifikation NACH dem Cloud-Agent-Pilot.
Bezug: [`04-acceptance.md`](./04-acceptance.md), Playbook R3.

## Ziel

Bevor die naechste Refactor-Welle (`storage`) startet, soll der User die
Pilot-Welle `external-jobs` lokal verifizieren. Drei konkrete Code-Aenderungen
sollen funktional unauffaellig sein, und das Modul soll insgesamt nicht
schlechter laufen als vorher.

## Was wurde im Pilot tatsaechlich am Code geaendert

| # | Aenderung | Datei | Test-Risiko |
|---|---|---|---|
| 1 | Silent-Fallback in `setStepStatusInternal` dokumentiert + Trace-Source-Attribut defensiv extrahiert | `src/lib/external-jobs-repository.ts:310-330` | Trace-Spans fuer Job-Steps koennten anders aussehen (z.B. fehlendes `source`-Attribut) |
| 2 | `extractFixedFieldsFromTemplate` aus `phase-template.ts` ausgelagert nach `phase-template/extract-meta.ts` (reiner Move + Re-Export) | `src/lib/external-jobs/phase-template.ts`, `src/lib/external-jobs/phase-template/extract-meta.ts` | Template-Frontmatter-Extraktion (alle Jobs mit `template: true`); Char-Tests sichern Verhalten ab |
| 3 | 2 ungenutzte Files entfernt: `callback-body-parser.ts`, `preprocessor-ingest.ts` | geloescht | Build muss noch sauber durchgehen, keine Imports brechen |

**Was NICHT geaendert wurde (bleibt fuer Nachsorge offen):**

- 75 leere `catch {}`-Bloecke im Modul
- 14 Files > 200 Zeilen (insbes. `phase-template.ts` mit 2.040 Zeilen)
- Architektur-Frage `external-jobs-{worker,watchdog,repository}.ts` ins Modulverzeichnis ziehen

---

## Phase A — Automatisierte Tests (5 Min)

Im Projekt-Root:

```powershell
pnpm install
pnpm test
```

**Erwartung:**
- 451/451 Tests gruen (vorher 431, +20 Char-Tests in der Pilot-Welle)
- Keine neuen Fehler

```powershell
pnpm lint 2>&1 | Select-String -Pattern "error" | Measure-Object | Select-Object -ExpandProperty Count
```

**Erwartung:** 0 Errors. Warnings (191 insgesamt, 75 in `external-jobs/`) sind
**erwartet** (siehe `04-acceptance.md`, R5: das ist der "Lint-Wolken-Befund",
der in einer Folge-PR-Serie aufgeraeumt wird).

```powershell
pnpm health --module external-jobs
```

**Erwartung:** identisch zu `01-inventory.md` mit drei Aenderungen:
- Files: 39 (vorher 40, durch Dead-Code-Pass: 2 raus, 1 neu = `extract-meta.ts`)
- Max-Zeilen: 2.040 (vorher 2.097)
- Leere Catches: 75 (unveraendert — Bewusste Nicht-Aufgabe der Pilot-Welle)

---

## Phase B — Build-Sanity-Check (3 Min)

Damit wir wissen, dass der Production-Build nicht durch fehlende Imports
o.ae. broken ist:

```powershell
pnpm build
```

**Erwartung:** Build laeuft durch, keine TypeScript-Errors, keine
"Module not found" auf die geloeschten Files (`callback-body-parser`,
`preprocessor-ingest`).

**Bei Fehlern:** Im Output nach Imports der geloeschten Files suchen:

```powershell
Select-String -Path src,tests,electron -Pattern "callback-body-parser|preprocessor-ingest" -Recurse 2>&1
```

Sollte nichts liefern.

---

## Phase C — Lokale UI-Smoke-Tests (15-30 Min, je nach Auswahl)

App lokal starten:

```powershell
pnpm dev
```

Im Browser: `http://localhost:3000/integration-tests`

Voraussetzungen:
- Library aktiv (z.B. "Onedrive Test" laut Screenshot vom 25.04.)
- Testordner gewaehlt (z.B. "Onedrive Test / Inbox")
- MongoDB + Secretary erreichbar (siehe `.env`)

### Empfohlene Test-Reihenfolge (Risiko-priorisiert)

Die Reihenfolge entspricht dem Risiko, dass eine der drei Pilot-Aenderungen
auffaellt:

| # | UseCase | Szenario | Warum dieser Test? | Kategorie |
|---|---|---|---|---|
| 1 | `pdf_mistral_report` | `happy_path` | Voller Pipeline-Lauf (Extract → Template → Ingest). Triggert `extractFixedFieldsFromTemplate` (Aenderung 2) und Trace-Span-Logik (Aenderung 1) | **MUSS gruen** |
| 2 | `pdf_mistral_report` | `gate_skip_extract` | Shadow-Twin existiert, Extract soll geskipped werden. Prueft Skip-Semantik (von PR #15 in Contract geschaerft) | **MUSS gruen** |
| 3 | `audio_transcription` | `template_and_ingest` | Bug-Fix-Validation Case: Template-only + Ingest. Prueft Vertrag "wenn phases.ingest=true, muss ingest_rag completed sein" | **MUSS gruen** |
| 4 | `pdf_mistral_report` | `force_recompute` | Erzwungener Neulauf trotz Shadow-Twin. Stresst Repository-Status-Updates | sollte gruen |
| 5 | `pdf_mistral_report` | `repair_frontmatter` | Frontmatter unvollstaendig → Template repariert. Triggert `extractFixedFieldsFromTemplate` mit Edge-Case-Input | sollte gruen |
| 6 | `audio_transcription` | `happy_path`, `gate_skip_extract`, `force_recompute` | Audio-Pfad analog zu PDF | sollte gruen |
| 7 | `image_texture_analysis` | `diva_happy_path` | Image-Pfad mit Template (kein Extract). Trigger fuer `extractFixedFieldsFromTemplate` aus Image-Kontext | sollte gruen |
| 8 | `markdown_ingest` | `happy_path` | Markdown-only, kein Extract. Stresst Template+Ingest-Pfad | sollte gruen |

**Minimales Smoke-Test-Set** (10 Min, wenn Zeit knapp): 1 + 2 + 3.

**Vollstaendiges Set** (30+ Min, wenn moeglich): alle 13 in der UI sichtbaren UseCases.

### Was bei Failure beobachten

- Welcher Step ist `failed`? (Extract / Template / Ingest)
- Steht eine Error-Message im Trace?
- Ist `result.savedItemId` (Shadow-Twin) wie erwartet?
- Vergleich mit Erwartung aus `src/lib/integration-tests/test-cases.ts` (jeder Case hat ein `expected`-Block)

Ergebnis dokumentieren:

```markdown
## Test-Lauf am <Datum>

| UseCase | Status | Befund |
|---|---|---|
| pdf_mistral_report.happy_path | OK | savedItemId=..., dauerte 45s |
| pdf_mistral_report.gate_skip_extract | OK | Extract skipped wie erwartet |
| ... | ... | ... |
```

---

## Phase D — Befund konsolidieren

Nach Phase A-C: User entscheidet eine von drei Optionen.

### Option 1: Alles gruen → Pilot-Welle ist abgenommen

- Acceptance-Bericht (`04-acceptance.md`) bleibt wie ist
- Naechste Welle (`storage`) kann starten
- Nachsorge-PRs fuer external-jobs (75 leere Catches, phase-template-Split)
  in den Backlog

### Option 2: Failures, aber bekannt (z.B. Mongo nicht da, Secretary down)

- Befund in `05-user-test-plan.md` ergaenzen ("nicht testbar mangels X")
- Pilot-Welle als "best effort verifiziert" markieren
- Naechste Welle starten

### Option 3: Echte Regression

- Konkrete UseCase + Stack-Trace in eine Mini-Welle "Pilot-Hotfix" packen
- 1 Agent (case-by-case-Prinzip aus R2) macht den Fix
- Lokal testen
- Push erst nach OK

---

## Was wir ueber das Modul lernen wollen (Erkenntnis-Ziele)

Diese Test-Phase ist gleichzeitig **die erste Anwendung der neuen Methodik**
(Playbook R1-R5). Wir wollen daraus ableiten:

1. **Wie lange dauert ein realistischer User-Test pro Welle?** (Daten fuer Storage-Welle-Planung)
2. **Welche UseCases sind die "Smoke-Test-3" pro Modul?** (Dokumentieren als Welle-Vorlage)
3. **Wo bricht die UI auf, wenn Mongo/Secretary nicht da sind?** (Klares Skip-Statement vs Fehler)
4. **Ist `pnpm test:integration:api` wertvoll genug, dass wir es zur DoD-Pflicht machen?** (oder reicht UI-Smoke?)

Antworten kommen in `06-pilot-retro.md` (entsteht nach Test-Lauf).
