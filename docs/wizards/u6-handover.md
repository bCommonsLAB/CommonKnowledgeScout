# U6 — Hand-over für die lokale Session

> Stand 2026-06-15. Branch: `claude/confident-maxwell-9sz7cq` (gepusht).
> Ziel U6: alle echten Erfassungen laufen off-target über den Wartekorb (ADR-0004),
> kein Direkt-Schreiben ins Archiv mehr bei der Erfassung; KI-1 fällt weg.

## 1. Was auf dem Branch ist (alles grün)

`pnpm test` (2190) + `pnpm lint` (0 Fehler) + `tsc` (keine neuen Fehler; 99 pre-existing Baseline in fremden Test-Dateien). Monolith `creation-wizard.tsx`: 3546 → 3173 Zeilen.

| Commit | Inhalt |
|---|---|
| U6a-A | `updateSubmission`-Client-Helfer (PATCH /api/submissions/[id]) |
| U6a-B | `file-transcript-de` Compute off-target via `computeFileMediaDraft` (Datei bleibt im Speicher → Inbox) |
| U6a-C | EIN Submission-Commit (Publish PATCHt die Compute-Submission statt 2. anzulegen); `file-transcript-de` aktiv |
| U6b-1 | `selectSchemaType`-Preset + Step (8 Standard-Typen) + Renderer + canProceed |
| U6b-2 | Typ-Auswahl im `file-transcript-de`-Flow; Compute zieht auf `selectSchemaType→` |
| U6b-3 | „Inhalte erfassen" navigiert in den Wizard (Inline-Dialog entfernt) |
| U6c | `pdfanalyse`-HITL-Flow stillgelegt (disabled) — PDFs via generische Erfassung |
| U6d | Diktat (`audio-transcript-de`) bekommt `publish`-Step → Wartekorb |
| U6e-1 | Toten Resolver + Modul `builtin-collect-extract.ts` entfernt |
| U6e-2 | Tote `pdfanalyse`-Compute-Branches (collectSource + reviewMarkdown) entfernt |

## 2. Pflicht-Check vor Merge

```bash
bash scripts/welle-pre-merge-check.sh
```

## 3. Lokale Tests (Voraussetzung: `pnpm dev`, MongoDB, Azure-Inbox-Blob, Secretary)

1. **Datei-Erfassung:** Galerie → „Inhalte erfassen" → Wizard öffnet sich (`/library/create/file-transcript-de`) → PDF/Audio hochladen → Weiter → **Inhaltstyp wählen** → Weiter → Compute läuft (Secretary) → Edit → **Veröffentlichen** → Wartekorb (`pending`); als Owner sofort `published`.
2. **Diktat:** `/library/create` → „Diktat erfassen" → Text/Diktat → Dateiname → Veröffentlichen → Wartekorb.
3. **Backend-Invariante:** Quelle liegt im Inbox-Blob (`/inbox/`), Analyse-Job `providerScope='inbox'`, **kein** Archiv-Schreib bei Erfassung. (Vgl. `e2e/07-inbox-analyse.spec.ts`.)
4. **Regressions-Check (wichtig, da ich addSource/removeSource/handleNext angefasst habe):** `event-finalize` (Moderator, im Eventdetail) und **Resume** (bestehende Datei bearbeiten) müssen weiter funktionieren.

> ⚠️ **KI-2:** Owner-Sofort-Promote auf einer **lokalen** Filesystem-Library gibt 503 (separater Storage-Bug). Für den vollen Rundlauf eine **Cloud-Library (OneDrive)** nutzen; sonst bleibt die Story sicher `ready` im Wartekorb (idempotent retry-bar).

## 4. Offene Punkte (für die lokale Session)

### 4a. Ordner- / Mehrfach-Upload im Wizard
Backend ist **fertig** (nicht neu bauen): `parseMultipartCapture` liest `getAll('file')`, Route `captureWithBinary` legt EINE Submission mit mehreren `binaryRefs` an (U5e); `submission-media` deckt PDF+Audio ab; `pickAnalyzableSource` nimmt die **erste** analysierbare Quelle.

**Lücke (Frontend):** Der Wizard verarbeitet aktuell **eine** Datei.
- `src/components/creation-wizard/steps/collect-source-step.tsx`: `handleFileSelect`, Zweig `singleFileUploadMode === 'generic'` hält **eine** `file` auf der Source. → `multiple`/Ordner-Picker zulassen, mehrere `WizardSource` mit je `file` anlegen.
- `src/lib/creation/wizard-file-compute.ts`: `uploadFileMediaToInbox` lädt **eine** Datei. → Multi-Variante (alle Dateien in EINE Submission, `binaryRefs[]`) oder die Multipart-Route (`captureWithBinary`) direkt nutzen.
- `creation-wizard.tsx`, `selectSchemaType→`-Compute-Branch: nimmt heute die letzte File-Source. → über alle File-Sources iterieren.
- Entwurf aus mehreren Quellen zusammensetzen (Analyse pickt sonst nur die erste).

### 4b. Automatischer UI-E2E für den neuen Flow
- `e2e/06-inbox-capture.spec.ts` prüft jetzt nur **Button → Wizard** (I2) + manueller I3.
- Neuer Spec: voller UI-Lauf (Button → Upload → Typ → Compute → Veröffentlichen → Wartekorb). Braucht Secretary.
- Selektoren bestätigen: Wizard-Header `h1` = Creation-Typ-Label; „Weiter"-Button; Typ-Kacheln = `role=button` mit `VIEW_TYPE_LABELS` (z.B. „Buch", „Session"); Publish-Step.

### 4c. Letzter Persist-Cleanup (toter pdfanalyse-Code in LIVE-Pfaden)
Harmlos (läuft nie: `isPdfShadowTwinPublish` ist immer `false`), aber in `handleSave`/`onPublish`, die auch **event-finalize / Resume / event-publish-final** nutzen → **nach jedem Schritt lokal gegen diese Flows testen** (Charakter-Tests decken die Inline-Branches NICHT ab).

Zu entfernen in `src/components/creation-wizard/creation-wizard.tsx` (Zeilen verschieben sich, jeweils neu suchen):
- Funktion `promotePdfWizardArtifacts` (~176) + ihr Aufruf in `handleSave` (~2157, no-op).
- `isPdfShadowTwinPublish` (Def ~1777): toter `if`-Block (~1783) raus; die `!isPdfShadowTwinPublish`-Bedingungen (~2110/2152/2223) sind immer wahr → vereinfachen.
- `onPublish`-Fall-through (pdfanalyse-Publish, ~2790–Ende von `onPublish`; nutzt `pdfBaseFileId`, `promoteWizardArtifacts`/`resolveArtifactClient`/`writeArtifact`). `isGenericPublish` = `!isEventPublishFinal && !isEventFinalize` vereinfachen; Tautologie-Guard (~2424) raus.
- Danach ungenutzt → entfernen: Importe `resolveArtifactClient`/`writeArtifact`/`promoteWizardArtifacts` (Zeilen 33/34/37); ggf. Modul `wizard-artifact-promotion.ts`; WizardState-Felder `pdfBaseFileId`/`pdfTranscriptFileId`/`pdfTransformFileId`/`pdfTranscriptFolderId`; toter `isPdf`-Staging-Zweig in `collect-source-step.tsx` (prüfen, ob noch erreichbar); `reviewMarkdown`-Preset/Renderer/canProceed (prüfen, ob noch von einem lebenden Flow genutzt).
- Nach jedem Teilschritt: `pnpm test` + `pnpm lint` + `tsc` + **manueller event-finalize/Resume-Test**.

## 5. Wichtige Bausteine (Orientierung)

- `src/lib/creation/wizard-file-compute.ts` — `computeFileMediaDraft` (Upload→Inbox→Analyse→Flowback→Entwurf).
- `src/lib/creation/wizard-submit.ts` — `submitWizardCapture` (create), `updateSubmission` (PATCH), `approve`/`promote`.
- `src/lib/creation/capture-compute-fields.ts` — Ableitung der Capture-Felder (docType/detailViewType).
- `src/components/creation-wizard/steps/select-schema-type-step.tsx` — Typ-Auswahl.
- `src/lib/templates/builtin-creation-templates.ts` — Flows `file-transcript-de` + `audio-transcript-de`.
- `src/components/submissions/capture-content-button.tsx` — Einstieg (navigiert in den Wizard).
- ADR-0003/0004; `docs/wizards/umbauplan-generischer-erfassungs-wizard.md` (U6).

## 6. Modell-/Agent-Empfehlung für die lokale Arbeit

- **4a Ordner-Upload** + **4b E2E**: Sonnet reicht (klar umrissen, viel Backend schon da). 4c **Cleanup**: Opus (riskante Monolith-Chirurgie in lebenden Pfaden).
- Reihenfolge: zuerst **lokal alles Bestehende testen** (Abschnitt 3), dann 4c (Cleanup, mit Regressionstest), dann 4a/4b.
