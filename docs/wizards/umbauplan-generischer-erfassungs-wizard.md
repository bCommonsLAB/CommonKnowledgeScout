# Umbauplan: EIN generischer Erfassungs-Wizard (off-target) für alle Schemas

> Stand 2026-06-14. Einstiegs-Doc für eine separate Session. Ziel: die heutige
> **PDF-Inbox-Scheibe** + den **monolithischen Creation-Wizard** zu **einem
> generischen, geführten Erfassungs-Flow** zusammenführen, der **immer** über die
> abgespeckte Inbox-Speicherung läuft und mit **allen** Schemas/`detailViewType`s
> funktioniert.
>
> **Reihenfolge/Kontext:** Dieser Plan ist **Plan 2b** im Gesamt-Fahrplan
> `docs/roadmap-formatunabhaengige-library-und-onboarding.md`. Davor laufen **Plan 1**
> (Library formatunabhängig) und **Plan 2a** (Templates entflechten, ADR-0003).
>
> **Pflichtlektüre:** `docs/adr/0003-wizard-schema-template-trennen.md`,
> `docs/adr/0004-capture-publish-entkopplung-inbox-modell.md`,
> `docs/refactor/welle-3-vi-creation-wizard/00-refactor-plan.md` + `SESSION-HANDOFF.md`,
> `docs/wizards/status-und-testplan-2026-06.md`.

## 1. Die Vision (vom Owner)

EIN Flow, immer über einen Wizard, der den Anwender begleitet:
1. **Erklären** · 2. **Führen** · 3. **Ergebnis berechnen** (Transkription/Transformation)
· 4. **Abnehmen & abschließen**.
Einziger Unterschied zum „normalen" Pfad: er arbeitet mit der **abgespeckten
(Inbox-)Speicherung**. Muss mit **allen Templates und detailViewTypes** laufen.

**Das ist exakt ADR-0003 ⊕ ADR-0004:** generischer Wizard ⊕ Schema (Felder +
Renderer + Extractor) → Submission in der Quarantäne. Die 4 Phasen = die
bestehenden Flow-Presets: Welcome (Erklären), Collect/SelectArtifacts (Führen),
Generate (Berechnen), Edit/Preview/Submit (Abnehmen).

## 2. Was schon gebaut ist (nutzen, NICHT neu bauen)

| Baustein | Wo | Status |
|---|---|---|
| Inbox-Provider (off-target Blob) | `src/lib/storage/inbox/*`, `getInboxProvider` | ✅ |
| Submission-Modell + Repo + Status-Maschine `draft→pending→ready→publishing→published` | `src/lib/repositories/wizard-submissions-*`, `submission-status.ts` | ✅ |
| **Generische Abnahme** über `detailViewType` (alle Templates) | `submission-review.ts`, `submission-edit-fields.tsx`, `DetailViewRenderer`, `VIEW_TYPE_REGISTRY` | ✅ |
| **Storage-Scope-Weiche** `archive\|inbox` in der Pipeline | `src/lib/external-jobs/provider.ts` (`resolveJobProvider`), `ExternalJob.providerScope` | ✅ (Welle III) |
| Analyse off-target (F11-Default-Template `standard-<viewType>`) | `submission-analysis-job.ts`, `/api/submissions/[id]/analyze` | ✅ |
| Default-Schemas je Inhaltstyp | `src/lib/templates/default-templates.ts` (F11) | ✅ |
| Promotion (Review → Archiv + RAG) | `feat/inbox-promote` (Handover offen) | 🟡 in Arbeit |

**Kernpunkt:** Die schwierigen, generischen Teile (Abnahme, Off-target-Pipeline,
Submission-Modell, Renderer-Registry) existieren. Es fehlt der **generische
Wizard-Runtime** und seine Verdrahtung auf die Inbox.

## 3. Was fehlt / hartkodiert ist (der eigentliche Umbau)

- `creation-wizard.tsx` ist **4.219 Z. Monolith** mit Direkt-Persistenz, 14+
  `if (templateId === …)`, Storage-Branch in der UI (`:2666`), `window`-Hack
  (`:1268`), 3 konkurrierende Speicherpfade (`:2611/2672/2735`), 0 Tests.
- Die **Inbox-Erfassung** ist eine **separate, hart auf PDF/`pdfanalyse`/`book`
  verdrahtete** Scheibe (`capture-content-button.tsx`), und die Analyse ist
  PDF-fest (`submission-analysis-job.ts`: `job_type:'pdf'`).
- **Generische Merge-Runtime (ADR-0003 P3a) ist nicht umgesetzt** — `editDraft`
  bindet hartkodierte Feldnamen statt Schema-Feld-Metadaten (O1).
- **Renderer-Drift:** `resolveWizardPreviewViewType` (`wizard-flow.ts`) kennt nur
  4 von 8 `detailViewType`s und fällt still auf `'session'` zurück.
- **Zwei Compute-Pfade:** Der generische Wizard transformiert **synchron** über
  `POST /api/secretary/process-text` (`generate-draft-step.tsx`), die Inbox-
  Analyse läuft **asynchron** über die external-jobs-Pipeline (`providerScope`).
  Diese beiden müssen versöhnt werden (siehe U5, offene Entscheidung).

## 4. Zielarchitektur (Soll)

```
        Schema (docType)                      Wizard (Flow)
   Felder+inputType (O1) · detailViewType ·   Presets · Quelltypen
   systemprompt/Extractor                     (generisch, community-fähig)
            └──────────────┬──────────────────────┘
                           ▼  Laufzeit-Merge + Kompatibilitätsprüfung
                  EINE Wizard-Instanz  ── storageScope = 'inbox' ──▶ Submission
                           │                                          (Quarantäne)
   Phasen:  Welcome(Erklären) · Collect/SelectArtifacts(Führen) ·
            Generate(Berechnen, Pipeline mit providerScope='inbox') ·
            Edit/Preview/Submit(Abnehmen) ──▶ Wartekorb ──▶ Promote(→Archiv+RAG)
```

Invarianten:
- **Wizard kennt kein Storage-Backend** und keinen `detailViewType`-Sonderfall —
  Renderer kommt aus `VIEW_TYPE_REGISTRY`, Felder aus Schema-Feld-Metadaten.
- **Erfassung schreibt NIE ins Ziel** — `storageScope='inbox'` durchgängig
  (Compute + Persist); der einzige Archiv-Schreibschritt ist Promote.
- **Datengetrieben:** neues Schema/Template = **kein** Wizard-Kern-Code.
- Ein atomarer Submission-Commit statt 3 Speicherpfade.

## 5. Umbau in Arbeitspaketen (je: DoD = grüner Test)

> Reihenfolge verbindlich (Netz → Engine → State → Felder → Storage-Scope →
> Compute → Ablösung → Promote). Jedes WP endet grün (Unit + Playwright-E2E nach
> der vereinheitlichten Methode aus `status-und-testplan-2026-06.md`).

> **Fortschritt (Stand 2026-06-22):**
> - ✅ **U0–U2** (PR #102): Sicherheitsnetz, datengetriebene Step-Engine, kanonischer State.
> - 🟡 **U3** (PR #102, teils): schema-getriebener `editDraft` (`selectEditableFields`,
>   O1-Groundwork `editableContentFields`) gemergt; die volle `kind`/`inputType`-
>   Feld-Taxonomie ist Teil von **Plan 2a** (Entflechten).
> - 🟡 **U4** (PR #102): Wizard → Wartekorb für **Text/URL** gemergt; Datei-Medien als
>   `binaryRefs` in die Inbox hängen an U5.
> - ✅ **U5a** (PR #103): `resolveComputeMode` (text-sync vs inbox-job, reine Naht).
>   ✅ **U5b**: medien-agnostische Analyse-Job-Fabrik (`submission-media.ts`: PDF + Audio).
>   ✅ **U5e**: Multi-Binary-Inbox-Capture (Ordner).
>   ▢ **U5c — OFFEN (nächstes WP):** `resolveComputeMode` in den Wizard verdrahten —
>   Datei-Medien laufen über den Inbox-Analyse-Job statt synchron über `process-text`.
> - ▢ **U6 — OFFEN:** PDF-Button → EIN generischer Einstieg.
> - ✅ **U7** (`feat/inbox-promote`): Promote Inbox → Archiv + RAG.
> - ▢ **U8** (Editoren): später.
> - Nebenfix (PR #115, Merge ausstehend): Preview-Renderer-Drift behoben —
>   `resolveWizardPreviewViewType` kennt alle 8 `detailViewType`s, kein stiller
>   `'session'`-Fallback mehr.
>
> Kickoff-Briefs für U5c + U6: siehe §8.1.

- **U0 · Sicherheitsnetz** (3-VI-a): Audit + Characterization-Tests des heutigen
  Wizards (Flow-Steuerung, Persistenz-Mapping, Job-Runner). **DoD:** `pnpm test` grün, Ist-Verhalten als Snapshot.
- **U1 · Step-Engine + Preset-Registry** (3-VI-d): datengetriebene State-Machine
  über `flow.steps`, ersetzt `renderStep`-if/else. **DoD:** Unit + E2E mit 2 verschiedenen Templates.
- **U2 · Kanonischer State** (3-VI-c): Jotai+Zod, EINE Metadaten-Quelle statt
  Fallback-Kette. **DoD:** Felder überleben Vor/Zurück + Speichern (E2E).
- **U3 · Schema-Feld-Metadaten + generischer editDraft** (ADR-0003 O1):
  `kind(content/system/structural)` + `inputType` ins Schema; editDraft rendert
  rein daraus, hartkodierte Feldnamen/Heuristiken raus. **DoD:** editDraft rendert beliebiges Schema korrekt (Unit + E2E je detailViewType).
- **U4 · Storage-Scope-Abstraktion (Herzstück):** `storageScope` durch Compute +
  Persist fädeln; **Persist = Submission anlegen** (kein Direkt-Schreiben).
  Die 3 Speicherpfade + `promoteWizardArtifacts` durch EINEN Submission-Commit
  ersetzen. **DoD:** Wizard-Lauf (beliebiges Template) → `pending`-Submission in
  der Inbox; Invarianten wie WP-3 (`providerScope=inbox`, kein Archiv-Schreib) grün.
- **U5 · Compute off-target für alle Medien** (zentrale Designentscheidung —
  die „storage-unabhängige Herausforderung" aus `contributor-pdf-upload-wizard.md`):
  Die zwei Compute-Pfade versöhnen. Optionen:
  **(X)** alles über die **external-jobs-Pipeline mit `providerScope='inbox'`**
  (reuse der Weiche; deckt PDF/Audio/Bild/Office ab) — der Wizard-`generateDraft`
  ruft dann statt `process-text` einen Inbox-Analyse-Job; **(Y)** `process-text`
  off-target erweitern (synchron, gut für reinen Text/URL) + Datei-Medien über
  Pfad X. Empfehlung: **X als Default**, Y nur für reine Textquellen.
  **DoD:** je Quelltyp (Text/URL/Datei/Ordner/Audio) ein grüner Integration/E2E-
  Fall mit Flowback in die Submission, Pipeline off-target (`providerScope=inbox`).
- **U6 · PDF-Button ablösen → EIN Einstieg:** Der generische Wizard hat bereits
  die Route `/library/create/[typeId]`. `capture-content-button` wird zu „Wizard
  starten mit `storageScope=inbox` + Schema-/Typ-Auswahl" (statt hart PDF/`book`).
  Die alte Hartverdrahtung + der separate Upload-Dialog entfallen. **DoD:**
  Capture-E2E (`06-inbox-capture`) grün **über den generischen Wizard**.
- **U7 · Promote integrieren** (Welle V / `feat/inbox-promote`): Abnahme →
  Veröffentlichung. **DoD:** Promote-E2E grün.
- **U8 · Editoren** (ADR-0003 P4, später): Schema-Editor + Wizard-Editor —
  erst nach stabiler Runtime.

**Parallelisierbar:** U0 sofort. U1/U2 nacheinander. U3 nach U1. U4 ist der
kritische Pfad (braucht U1–U3). U5 nach U4. U6 nach U4/U5. U7 unabhängig (läuft
schon als `feat/inbox-promote`).

## 6. Entschiedenes / Leitplanken
- **O1 entschieden** (ADR-0003 Nachtrag 2026-06-02): generische, schema-getriebene
  Feldbindung (kind=content), KEINE Rollen-Indirektion, KEINE hartkodierten Namen.
- Regeln: Code englisch, Kommentare/Commits deutsch; Dateien ≤200 Z.; kein `any`/
  leeres `catch`; **keine Silent Fallbacks**; **UI kennt kein Storage-Backend**;
  ADR-0001 (event-job ≠ external-jobs) wahren.
- **Test = erledigt:** jede sichtbare Story als Playwright-E2E (UX + Backend-
  Invariante in einem Spec); Pipeline-Tiefe per Integration-Harness.

## 7. Branching (Owner wählt)
- **Variante A (empfohlen, dein aktueller Stil):** pro WP ein Feature-Branch von
  `master`, PR erst wenn grün — kleine, prüfbare Schritte.
- **Variante B (SESSION-HANDOFF):** langlebiger Integrationsbranch
  `feature/wizard-neuordnung`, Sub-Wellen als Commits, regelmäßig `master`
  reinmergen; großer Merge am Ende.

## 8. Kickoff für die separate Session (U0 zuerst)

> „Branch von `master` (`feat/wizard-u0-charnetz` o.ä.). Pflichtlektüre:
> dieses Doc, ADR-0003, ADR-0004, `docs/refactor/welle-3-vi-creation-wizard/00-refactor-plan.md`.
> Ziel U0: Characterization-Tests für `src/components/creation-wizard/creation-wizard.tsx`
> (Flow-Step-Filter, `canProceed` je Preset, Persistenz-Mapping, Job-Runner) —
> reines Sicherheitsnetz, **kein** Verhaltens-Refactor. Findet ein Test einen
> bestehenden Bug → dokumentieren, nicht fixen. DoD: `pnpm test` + `pnpm lint`
> grün. Regeln: Code engl., Kommentare/Commits dt., ≤200 Z., keine Silent
> Fallbacks. Auf dem Branch committen, kein PR ohne Auftrag. Danach U1
> (Step-Engine)."

> **Modell:** Opus (Architektur/Engine). **Pro WP neuer Agent** mit dem
> jeweiligen U-Abschnitt als Brief + dieses Doc + die zwei ADRs als Pflichtlektüre.

## 8.1 Nächste WPs (Stand 2026-06-22): U5c, dann U6

> **Wichtig (Verifikation):** U5c und U6 berühren UI + API + Job-Pipeline im noch
> wenig getesteten Monolithen. DoD ist hier ein **grüner Playwright-E2E** plus die
> Backend-Invariante — das braucht eine **laufende App + MongoDB + echten Storage**
> und läuft daher **lokal** (nicht in einer reinen Cloud-Session). Pro WP ein
> Feature-Branch von `master`, **neuer Opus-Agent**, PR erst wenn grün.

### Kickoff U5c — Compute-Verdrahtung (Datei-Medien off-target)

```
Branch von master (z.B. feature/wizard-u5c-compute-wiring). Pflichtlektüre:
docs/wizards/umbauplan-generischer-erfassungs-wizard.md (§3 Compute-Pfade, §5 U5),
docs/adr/0003-wizard-schema-template-trennen.md, docs/adr/0004-capture-publish-
entkopplung-inbox-modell.md, docs/wizards/status-und-testplan-2026-06.md, .cursorrules,
alle .cursor/rules/*.mdc mit alwaysApply, AGENTS.md.

Ziel U5c: Die zwei Compute-Pfade versöhnen. Der Wizard transformiert heute ALLES
synchron über POST /api/secretary/process-text (generate-draft-step.tsx). Künftig:
Text/URL bleibt text-sync; Datei-Medien (PDF/Audio) laufen über den Inbox-Analyse-
Job (providerScope='inbox') statt synchron. Pro Quelle entscheidet die schon
gemergte, reine Funktion resolveComputeMode (src/lib/creation/compute-mode.ts) —
KEINE neuen if(templateId===)-Sonderfälle.

Bestehende Bausteine (nutzen, NICHT neu bauen): resolveComputeMode (compute-mode.ts),
buildSubmissionAnalysisJob/buildSubmissionAnalysisParameters/pickAnalyzableSource
(src/lib/submissions/submission-analysis-job.ts), submission-media.ts (PDF+Audio),
Route POST /api/submissions/[id]/analyze (src/app/api/submissions/[id]/analyze/route.ts),
der Ergebnis-Rückfluss applyAnalysisResult (submission-analysis.ts).

Im Fokus (UI/Verdrahtung): src/components/creation-wizard/steps/generate-draft-step.tsx
und der Aufrufpfad in creation-wizard.tsx (Stellen mit process-text). Datei-Medien:
erst Submission anlegen (binaryRefs in Inbox) -> analyze-Job starten -> auf Completion
warten/pollen -> Ergebnis fließt in die Submission. Text/URL unverändert sync.

DoD: je Quelltyp ein grüner Fall — Text/URL (text-sync) und PDF + Audio (inbox-job)
— mit Flowback in die Submission; Pipeline off-target (providerScope='inbox'), KEIN
Archiv-Schreibzugriff. Unit für die Entscheidungs-/Parameter-Naht; Playwright-E2E
nach status-und-testplan-2026-06.md. Regeln: Code engl., Kommentare/Commits dt.,
Dateien <=200 Z., kein any / leeres catch, KEINE Silent Fallbacks, UI kennt kein
Storage-Backend. Auf dem Branch committen, PR erst wenn grün.
```

### Kickoff U6 — PDF-Button → EIN generischer Einstieg (nach U5c)

```
Branch von master (z.B. feature/wizard-u6-single-entry). Pflichtlektüre wie U5c.

Ziel U6: Den hart auf PDF/pdfanalyse/book verdrahteten Capture-Einstieg
(src/components/submissions/capture-content-button.tsx) durch den generischen
Wizard ersetzen: „Wizard starten mit storageScope=inbox + Schema-/Typ-Auswahl"
über die bestehende Route src/app/library/create/[typeId]/page.tsx. Den separaten
Upload-Dialog + die Hartverdrahtung entfernen. Einstieg/Sichtbarkeit pro Rolle
gemäß ADR-0004 (contributor/co-creator/owner) beibehalten.

DoD: Capture-E2E (06-inbox-capture aus status-und-testplan-2026-06.md) grün ÜBER
den generischen Wizard; keine PDF/book-Hartverdrahtung mehr. Regeln wie U5c.
Voraussetzung: U5c gemergt (Datei-Medien laufen off-target).
```


## 9. Ist-Code-Karte (Stand 2026-06-14, Zeilen ggf. neu verifizieren)

| Bereich | Datei | Symbole / Hinweis |
|---|---|---|
| Wizard-Einstieg (Route) | `src/app/library/create/[typeId]/page.tsx` | Query: `resumeFileId, templateIdOverride, seedFileId, targetFolderId, sourceFolderId` |
| Wizard-Kern (Monolith) | `src/components/creation-wizard/creation-wizard.tsx` | `CreationWizard(...)`; Step-Dispatch ~2870–3500; `handleSave` ~1814–2700 |
| Flow-Engine | `src/lib/creation/wizard-flow.ts` | `filterWizardSteps`, `canProceedFromStep`, `resolveWizardPreviewViewType` (4-vs-8-Drift), `selectEditableFields` |
| Presets/Typen | `src/lib/templates/template-types.ts` | `TemplateCreationConfig`, `CreationFlowStepRef`, Preset-Liste |
| Typ-Auflösung | `src/lib/templates/library-creation-config.ts` | `findCreationType(libraryId, typeId)` |
| Compute (sync) | `src/components/creation-wizard/steps/generate-draft-step.tsx` | `POST /api/secretary/process-text`; Korpus aus `lib/creation/corpus.ts` |
| Persist (Direkt-Schreiben) | `creation-wizard.tsx` | 4× `provider.uploadFile` (~2405/2471/2529/2566); Dual-Save Mongo+FS; Storage-Branch ~2666 |
| Alt-Promotion | `src/lib/creation/wizard-artifact-promotion.ts` | `promoteWizardArtifacts` (`.wizard-sources`-Staging) |
| Bild-Upload | `/api/creation/upload-image` | Scope `books|sessions` aus `detailViewType` |
| Resume | `src/lib/creation/resume-meta.ts` | `creationTypeId/creationTemplateId/...` im Frontmatter |
| Renderer + Pflichtfelder | `detail-view-renderer.tsx`, `detail-view-types/registry.ts`, `content-fields.ts` | `VIEW_TYPE_REGISTRY` (8 Typen), `contentRequiredFields` |

**Wiederverwendbar für off-target:** Provider-Abstraktion ist backend-agnostisch
(neuer Scope via `getInboxProvider`), Flow ist datengetrieben, Frontmatter
per-Template. **Lücken:** `targetFolderId` nimmt „aktuellen Ordner" an (Inbox
braucht den `{username}`-Ordner); Dual-Save (Transcript+Transformation) nimmt
Archiv an → für Inbox auf den EINEN Submission-Commit reduzieren.
