# Status & Testplan — Inbox/Upload + Settings-UX (Stand 2026-06-13)

> Einstiegs-Doc nach der Integration mehrerer Wellen auf `master`. Zweck:
> Überblick zurückgewinnen, klare „erledigt = grüner Test"-Definition, und
> unabhängige Arbeitspakete für (auch parallele) Folge-Sessions.

## 1. Was ist auf `master` (faktisch, PRs)

| PRs | Welle | Inhalt |
|---|---|---|
| #78–88 | vibrant-mayer | Graph/Gallery (Relations, Fokus-Modus, Suche) |
| #89 | great-curie | Settings-UX-Umbau (me/we/usSpace, F1–F11, E1–E7), Cleanup, Security-Masking, **F11 Default-Templates** |
| #90, #92 | confident-knuth | **Inbox/Upload-Welle I–III** (diese Linie) |
| #91, #93 | fix/settings-ux-nachziehen | `'inbox'`-Build-Fix in Settings-Formularen, **Playwright-E2E-Harness** (`e2e/`), Start-Dashboard |

**Keine doppelte Upload-Implementierung** — der „eigene Upload-Pfad" = die Inbox-Welle (confident-knuth). Bestätigt per Datei-Inventur.

## 2. Status: fertig / halb / offen

| Bereich | Status | Test-Lage |
|---|---|---|
| Archiv-Pipeline (pdf/audio/md) | ✅ fertig | ✅ API-Integration-Harness |
| Settings-UX (me/we/usSpace, F1–F11, E1–E7, Security) | ✅ implementiert | Unit grün; **E2E-Harness da, Folgeplan offen** (`docs/settings-ux/07-…`) |
| Inbox I–III (Provider, Capture-Upload, „Inhalte erfassen", providerScope, Analyze-Route, Flowback, „Meine Beiträge", Pre-flight) | ✅ implementiert + unit-getestet | ❌ **kein Akzeptanz-Test** (weder E2E noch Integration) |
| **F11 ↔ Inbox-Analyse-Template** | 🟡 divergiert (s. §3) | — (Blocker beim manuellen Test) |
| Inbox IV (Owner-Sichten) | ⛔ nicht begonnen | — |
| Inbox V (Promote/Publish) | ⛔ nicht begonnen | — |
| Confidence-Highlighting | ⛔ nicht verdrahtet | — |

**Kernlücke (deine „erledigt = grüner Test"-Definition):** Die Inbox-Welle ist
unit-getestet, hat aber keinen Akzeptanz-Test, der den echten Fluss durchspielt.

## 3. Wichtigste Integrations-Erkenntnis: F11 ↔ Inbox-Analyse

great-curies F11 stellte die Template-Wahl um:
- `src/lib/templates/default-templates.ts`: **Standard-Vorlagen je Inhaltstyp**
  (z.B. `standard-book`), die `language`+`targetLanguage` bereits führen.
- `src/lib/external-jobs/template-files.ts`: Pipeline nutzt jetzt das
  **Default-Template des Library-Inhaltstyps** statt hart `pdfanalyse`.

Die Inbox-Analyse (`src/lib/submissions/submission-analysis-job.ts`) setzt aber
noch `template: submission.docType` (= `pdfanalyse`), und der Pre-flight-Check
(`/api/submissions/[id]/analyze`) verlangt genau ein `pdfanalyse`-Template. Auf
einer F11-Library (hat `standard-book`, kein `pdfanalyse`) scheitert das → das
ist der beim manuellen Test gesehene „Template fehlt"-Blocker.
→ **WP-1** versöhnt das.

## 4. Test-Strategie: EINE Methode für User-Stories

**Entscheidung:** Playwright-E2E (`e2e/`) ist die **kanonische User-Story-Ebene**.
Die API-Integration-Harness bleibt — aber mit anderer Rolle.

| System | Rolle künftig | Wann |
|---|---|---|
| **Playwright (`e2e/`)** | **User-Story-Akzeptanz** — 1 Story = 1 Spec; UI-Ende-zu-Ende | Für **alle** User-Stories (Inbox, Settings, Galerie, …) |
| **API-Integration (`test:integration:api`)** | Pipeline-/Contract-Regression + Agent-Loop | Archiv-Pipeline + tiefe Backend-Invarianten, die der Browser nicht sieht |
| **Vitest Unit** | Reine Funktionen/Komponenten | wie gehabt |

**Warum nicht eines löschen:** E2E sieht die UX, aber keine Backend-Fakten
(Job-/Mongo-Zustand, „kein RAG", „providerScope=inbox", Blob-Pfad). Die
API-Harness sieht das. Sie ergänzen sich.

**Brücke statt Doppelung:** E2E-Specs sind Node → dürfen API/Mongo direkt prüfen.
Dafür Backend-Assert-Helfer in `e2e/helpers.ts` bauen, z.B.:
`expectSubmissionStatus(id, 'pending')`, `expectNoArchiveWrite(libraryId)`,
`expectProviderScopeInbox(jobId)`. So deckt EIN Story-Test UX **und** Contract ab.

**Konvention:**
- Datei: `e2e/<NN>-<bereich>-<story>.spec.ts` (z.B. `06-inbox-capture.spec.ts`).
- Jede Story endet mit einer Backend-Invarianten-Assertion, wo sinnvoll.
- **User-Story-Katalog** (Tabelle unten) hält Story → Spec → DoD aktuell.
- Optional künftig: ein `e2e-test`-Skill analog `integration-test` (Agent-Loop:
  Spec schreiben → `playwright test` → Fehler analysieren → fixen → wiederholen).

### User-Story-Katalog (Pflege-Tabelle)

| Story | Spec | Status |
|---|---|---|
| Settings Akt 1 (Quelle) | `e2e/01-akt1-quelle.spec.ts` | 🟡 Harness, Folgeplan offen |
| Settings Akt 1 (Verarbeitung) | `e2e/02-akt1-verarbeitung.spec.ts` | 🟡 |
| Settings Akt 2 (Cloud) | `e2e/03-akt2-cloud.spec.ts` | 🟡 |
| Settings Akt 3 (Publish) | `e2e/04-akt3-publish.spec.ts` | 🟡 |
| **Inbox: Erfassen → Wartekorb** | `e2e/06-inbox-capture.spec.ts` *(zu erstellen)* | ⛔ |
| **Inbox: Analyse → Flowback** | `e2e/07-inbox-analyse.spec.ts` *(zu erstellen)* | ⛔ |

## 5. Arbeitspakete (unabhängig; je grüner Test = erledigt)

**Prio 1 — verifizieren, was gebaut ist:**
- **WP-1 · F11 ↔ Inbox-Analyse versöhnen** (Code-Fix, kritischer Pfad). Inbox-
  Analyse nutzt das Inhaltstyp-Default-Template (F11) statt hart `pdfanalyse`;
  Pre-flight + Fixtures angleichen (eine Quelle der Wahrheit). **DoD:** `pnpm test`+`pnpm lint` grün.
- **WP-2 · Inbox-Analyse als API-Integration-Cases** (`submission_capture.happy_path`,
  `submission_analyze.happy_path` mit Flowback, `…template_missing`) + Invarianten.
  **DoD:** `pnpm test:integration:api` grün. *Braucht Harness-Erweiterung (Submission-Form).*
- **WP-3 · Inbox-Flow E2E (Playwright)** — `06-inbox-capture.spec.ts` (+ `07-…analyse`).
  **DoD:** `pnpm exec playwright test e2e/06-inbox-capture.spec.ts` grün.

**Prio 2 — Settings abschließen:**
- **WP-4 · Settings-UX-E2E** nach `docs/settings-ux/07-folgeplan-start-flow-und-e2e.md`.
  **DoD:** `pnpm exec playwright test` grün.

**Prio 3 — Feature fertig:**
- **WP-5 · Welle IV Owner-Sichten** (+ Tests). **WP-6 · Welle V Promote/Publish**
  (+ Tests; Vorbild `pdfanalyse.hitl_publish`).

**Abhängigkeiten:** WP-1 zuerst (entsperrt echte Läufe). Danach **parallel**: WP-2, WP-3, WP-4.
WP-5/6 erst auf verifizierter Inbox-Basis.

## 6. Kickoff-Prompts für neue Sessions

**WP-3 (Sonnet):** „Branch von master. Lesen: `e2e/*.spec.ts`, `e2e/helpers.ts`,
`playwright.config.ts`, `docs/wizards/contributor-pdf-upload-wizard.md`. Ziel:
`e2e/06-inbox-capture.spec.ts` — contributor erfasst PDF → pending-Submission in
„Meine Beiträge" → Wartekorb zeigt sie; + Backend-Assert (`providerScope=inbox`,
kein Archiv-Schreib). DoD: `playwright test e2e/06-inbox-capture.spec.ts` grün."

**WP-4 (Sonnet):** „Branch von master. Lesen: `docs/settings-ux/07-folgeplan-…`,
`docs/settings-ux/06-testdrehbuch*.md`, `e2e/*`. Ziel: Folgeplan abarbeiten,
Akt-1–3-Specs vervollständigen. DoD: `playwright test` grün."

**WP-2 (Opus):** „Branch von master. Lesen: `src/lib/integration-tests/test-cases.ts`,
`validators.ts`, `scripts/run-integration-tests.mjs`, `docs/guides/integration-tests.md`.
Ziel: Submission-Form in der Harness + Cases `submission_capture.happy_path` /
`submission_analyze.happy_path` (Flowback) / `…template_missing` + Invarianten.
DoD: `pnpm test:integration:api` grün."
