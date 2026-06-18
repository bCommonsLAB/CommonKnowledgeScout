# U6 — Hand-over für die lokale Session

> Stand 2026-06-16. Branch: `claude/confident-maxwell-9sz7cq` (gepusht).
> Ziel U6: alle echten Erfassungen laufen off-target über den Wartekorb (ADR-0004),
> kein Direkt-Schreiben ins Archiv mehr bei der Erfassung; KI-1 fällt weg.
> Dieses Dokument ist der Wissensstand zum Weiterentwickeln/Testen offline.

## 1. Branch-Stand (alles grün)

`pnpm test` (2190) + `pnpm lint` (0 Fehler) + `tsc` (keine NEUEN Fehler; 99 pre-existing
Baseline in fremden Test-Dateien). Monolith `creation-wizard.tsx`: 3546 → 3173 Zeilen.

Commits (neueste zuletzt):

| Commit | Inhalt |
|---|---|
| U6a-A | `updateSubmission`-Client-Helfer (PATCH /api/submissions/[id]) |
| U6a-B | `file-transcript-de` Compute off-target via `computeFileMediaDraft` |
| U6a-C | EIN Submission-Commit (Publish PATCHt die Compute-Submission); `file-transcript-de` aktiv |
| U6b-1 | `selectSchemaType`-Preset + Step (8 Standard-Typen) + Renderer + canProceed |
| U6b-2 | Typ-Auswahl im Flow; Compute zieht auf `selectSchemaType→` |
| U6b-3 | „Inhalte erfassen" navigiert in den Wizard (Inline-Dialog entfernt) |
| U6c | `pdfanalyse`-HITL-Flow stillgelegt (disabled) |
| U6d | Diktat (`audio-transcript-de`) bekommt `publish`-Step → Wartekorb |
| U6e-1/2 | Toten pdfanalyse-Code entfernt (Resolver, Modul, Compute-Branches) |
| fix | Capture-Titel „Datei importieren und verarbeiten" + sichtbares Compute-Feedback |
| feat | Secretary-Fortschritt im Wizard (JobProgressBar, Phase-Label wie im Archiv) |

## 2. Was funktioniert (alle echten Erfassungen → Wartekorb, off-target)

- „Inhalte erfassen" (Galerie) → Wizard `/library/create/file-transcript-de`:
  Willkommen → Datei → **Inhaltstyp wählen** → Compute (Inbox, Secretary) →
  Edit → Veröffentlichen → Wartekorb (Owner: sofort `published`).
- Diktat → Wartekorb.
- PDF: über die generische Erfassung (Typ „Buch" wählen); der alte pdfanalyse-Flow ist stillgelegt.
- event-finalize: **bewusst unverändert** — moderator-only Sonderlösung (Index-Swap im Archiv), passt nicht in den Wartekorb (ADR-0004 erlaubt Owner-Bypass).

## 3. Pflicht-Check vor Merge

```bash
bash scripts/welle-pre-merge-check.sh
```

## 4. Lokale Tests (Voraussetzung: `pnpm dev`, MongoDB, Azure-Inbox-Blob, Secretary)

1. Datei-Erfassung end-to-end (s.o.), Backend-Invariante: Quelle im Inbox-Blob (`/inbox/`),
   Analyse-Job `providerScope='inbox'`, kein Archiv-Schreib bei Erfassung.
2. Diktat → Wartekorb.
3. **Regression:** event-finalize (Moderator, Eventdetail) + Resume (Datei bearbeiten).
4. ⚠️ **KI-2:** Owner-Promote auf **lokaler** FS-Library gibt 503 (separater Storage-Bug).
   Für den vollen Rundlauf eine **Cloud-Library (OneDrive)** nutzen; sonst bleibt die Story
   sicher `ready` im Wartekorb.

## 5. Offene Punkte

### 5a. NEU: Option „Nur importieren und transkribieren" (Design fertig, umsetzbar)
Im Schritt „Inhaltstyp wählen" eine zusätzliche Option: nur Transkript (extract), **keine**
Transformation. **Die Pipeline kann das schon** — `phases.template=false` ⇒ `complete.ts`
setzt `expectedKind='transcript'` und der Rückfluss (`applyAnalysisResult`) schreibt das
Transkript in die Submission. Umsetzung (klein, 3 Schichten):

- **Backend** `src/lib/submissions/submission-analysis-job.ts`:
  `buildSubmissionAnalysisParameters(submission, media, opts?: { transcriptOnly?: boolean })` →
  bei `transcriptOnly`: `phases:{extract:true,template:false,ingest:false}`,
  `policies:{extract:'do',metadata:'ignore',ingest:'ignore'}`. Steps unverändert lassen
  (Pipeline markiert `transform_template` als `phase_disabled`). Kein Pre-flight-Umbau nötig,
  wenn der transcript-Default-`detailViewType='session'` ist (standard-session existiert).
- **Route** `src/app/api/submissions/[id]/analyze/route.ts`: Body `{ mode?: 'transcript' }`
  lesen → `transcriptOnly = mode==='transcript'` → an `buildSubmissionAnalysisParameters` geben.
- **Client** `src/lib/creation/wizard-file-compute.ts`: `startSubmissionAnalysis(id, fetch, { transcriptOnly })`
  POSTet Body `{ mode:'transcript' }`; `computeFileMediaDraft({ …, transcriptOnly })` reicht es durch.
- **UI** `select-schema-type-step.tsx` + Renderer: Option „Nur importieren und transkribieren"
  (Sub-Label „Ohne weitere Verarbeitung — nur den Originaltext"). State-Feld
  `WizardState.captureTranscriptOnly`; `WizardProceedContext.captureTranscriptOnly`;
  canProceed `selectSchemaType` = `!!selectedDetailViewType || !!captureTranscriptOnly` (isExtracting-Guard bleibt).
- **Compute-Branch** (`creation-wizard.tsx`, `selectSchemaType→`): bei transcriptOnly
  `detailViewType='session'`, `fields:[{key:'docType',rawValue:'transcript'}]`,
  `computeFileMediaDraft({…, transcriptOnly:true})`.
- **Tests:** `submission-analysis-job.test.ts` (phases/policies bei transcriptOnly),
  `wizard-file-compute.test.ts` (mode im Body), `wizard-flow.test.ts` (canProceed).

### 5b. Ordner-/Mehrfach-Upload im Wizard
Backend fertig (`parseMultipartCapture` `getAll('file')`, `captureWithBinary` → EINE Submission
mit mehreren `binaryRefs`, U5e). Frontend lädt noch **eine** Datei. Stellen:
`collect-source-step.tsx` (`handleFileSelect`, `singleFileUploadMode==='generic'`),
`wizard-file-compute.ts` (`uploadFileMediaToInbox` = eine Datei → Multi-Variante),
`creation-wizard.tsx` `selectSchemaType→`-Branch. `pickAnalyzableSource` nimmt die erste Quelle.

### 5c. Automatischer UI-E2E
`e2e/06-inbox-capture.spec.ts` prüft nur Button→Wizard (I2). Voller UI-Lauf als Playwright-Spec
(Upload → Typ → Compute → Veröffentlichen → Wartekorb) fehlt; braucht Secretary. Selektoren lokal bestätigen.

### 5d. Letzter Persist-Cleanup (toter pdfanalyse-Code in LIVE-Pfaden)
Harmlos (`isPdfShadowTwinPublish` immer `false`), aber in `handleSave`/`onPublish` (auch
event-finalize/Resume/event-publish-final). Charakter-Tests decken diese Inline-Branches NICHT
ab → **nach jedem Schritt event-finalize/Resume manuell testen**. Zu entfernen:
`promotePdfWizardArtifacts` (+Aufruf), `isPdfShadowTwinPublish`-Block, `onPublish`-pdfanalyse-
Fall-through, danach Importe `resolveArtifactClient`/`writeArtifact`/`promoteWizardArtifacts`,
WizardState-`pdf*`-Felder, `reviewMarkdown`-Preset/Renderer (wenn ungenutzt).

## 6. So instruierst du die lokale Session / den Agent

1. Branch holen: `git fetch && git checkout claude/confident-maxwell-9sz7cq`.
2. Dieses Dokument ist die Quelle der Wahrheit — der Commit-Verlauf (U6a→…) erzählt die Story.
3. Start-Prompt für den lokalen Agent (kopierbar):

> „Lies `docs/wizards/u6-handover.md` + ADR-0003/0004 +
> `docs/wizards/umbauplan-generischer-erfassungs-wizard.md` (U6). Branch
> `claude/confident-maxwell-9sz7cq`. Setze zuerst **5a** um (Option ‚Nur importieren und
> transkribieren') nach dem dortigen Design; danach lokal testen (`pnpm dev` + Secretary +
> Cloud-Library wegen KI-2). Regeln: Code engl., Kommentare/Commits dt., ≤200 Z., kein `any`/
> leeres `catch`, keine Silent-Fallbacks, UI kennt kein Storage-Backend. Nach jeder Scheibe
> `pnpm test` + `pnpm lint` grün, dann ich teste. Auf dem Branch committen, kein PR ohne
> Auftrag. Reihenfolge danach: 5b (Ordner-Upload) → 5c (E2E) → 5d (Cleanup, riskant, mit
> event-finalize/Resume-Regressionstest)."

**Modell:** 5a/5b/5c Sonnet reicht; 5d (Monolith-Chirurgie) Opus.

## 7. Wichtige Bausteine (Orientierung)

- `src/lib/creation/wizard-file-compute.ts` — `computeFileMediaDraft` (Upload→Inbox→Analyse→Flowback).
- `src/lib/creation/wizard-submit.ts` — `submitWizardCapture`/`updateSubmission`/`approve`/`promote`.
- `src/lib/creation/capture-compute-fields.ts` — Capture-Felder (docType/detailViewType).
- `src/lib/submissions/submission-analysis-job.ts` — Job-Fabrik (Phasen/Policies/Steps).
- `src/lib/external-jobs/complete.ts` — Completion + Rückfluss (`expectedKind` extract vs transform).
- `src/lib/submissions/submission-analysis.ts` — `applyAnalysisResult` (Flowback in die Submission).
- `src/components/creation-wizard/steps/select-schema-type-step.tsx` — Typ-Auswahl + Progress.
- `src/components/library/file-preview/job-progress-bar.tsx` — geteilte Progress-Anzeige (Archiv + Wizard).
- `src/lib/templates/builtin-creation-templates.ts` — Flows `file-transcript-de` + `audio-transcript-de`.
- `src/components/submissions/capture-content-button.tsx` — Einstieg.
- ADR-0003/0004; `docs/wizards/umbauplan-generischer-erfassungs-wizard.md` (U6).
