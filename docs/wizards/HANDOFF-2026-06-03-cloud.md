# Hand-off Cloud → Lokal — Inbox W1–W4 (+ ADR-0005)

> Cloud-Session **2026-06-03**, Branch `claude/knowledge-scout-wizard-ux-yjOwS`
> (gepusht), PR **#81**. Fortsetzung von `docs/wizards/HANDOFF.md`.
> Zweck: lokal weiterarbeiten/testen — alles an einem Ort.

## Verlauf analysieren (lokal)

- `git log --oneline origin/master..HEAD` — alle Commits dieser Welle.
- PR **#81** — Gesamt-Diff + Hand-off-Block im PR-Body.
- Dieses Dokument — Zusammenfassung + nächste Schritte.

## Was diese Session gebaut hat (ADR-0004 Inbox-Strang)

| Welle | Inhalt | Dateien (neu/▲geändert) |
|---|---|---|
| **W1** | Submission-Datenmodell + reine Status-Maschine + Azure-Blob-Inbox-Helfer + MongoDB-Repo (CRUD + Status-Übergänge) | `src/types/wizard-submission.ts`, `src/lib/submissions/{submission-status,inbox-blob}.ts`, `src/lib/repositories/wizard-submissions-{store,repo}.ts` |
| **W2** | Capture → Inbox: reiner Mapper + `POST/GET /api/submissions`, `GET /api/submissions/[id]` (Preview) | `src/lib/submissions/submission-capture.ts`, `src/app/api/submissions/**` |
| **W3** | `contributor`-Rolle (Modell + Auth + Invite/Labels exhaustiv) | ▲`src/types/library-members.ts`, ▲`src/types/library.ts`, ▲`library-members-repo.ts` (+`getActiveMemberRole`), ▲`submission-capture.ts` (+`resolveCreatorRole`), ▲diverse UI-/Invite-Sites |
| **W4** | Abnahme-UI: Review-Routen (`approve`/`reject`/`PATCH`) + reine Helfer + 3 prop-driven Komponenten | `src/lib/submissions/{submission-review,review-actions}.ts`, `src/app/api/submissions/[id]/{approve,reject}/route.ts`, `src/components/submissions/*.tsx` |

**Commits:** `0a8408a` `457120e` (W1) · `72524be` (W2) · `530a66c` (W3) ·
`3d8cc1f` (W4) · `285b46f` `a04bc63` `2df7120` (ADR-0005).

**Status:** `pnpm test` = **244 Dateien / 1.828 Tests grün**, `pnpm lint` sauber,
keine neuen `tsc`-Fehler. **Kein** `pnpm build` (Cloud-Kostenregel).

## Was cloud NICHT verifiziert ist → lokal testen

### Stufe A — Backend/DB + API (läuft ohne weiteres Wiring)
Mit echter MongoDB + eingeloggtem User die Routen direkt testen:
- `POST /api/submissions` — owner/co-creator/**contributor** → `pending`;
  moderator/reader → **403**.
- `GET /api/submissions?libraryId=…[&status=]` (nur Reviewer),
  `GET /api/submissions/[id]` (Reviewer **oder** Erfasser).
- `POST …/[id]/approve` (pending→ready), `…/reject`, `PATCH …/[id]`
  (409 wenn nicht editierbar).
- **W3:** in Settings „Mitwirkenden" einladen → Badge/Label „Mitwirkender";
  als contributor erfassen → Submission `pending`.

### Stufe B — Flow/UI (braucht das kleine, bewusst lokale Wiring)
1. **W2 — Wizard auf Inbox umhängen** (`src/components/creation-wizard/creation-wizard.tsx`):
   - `provider.uploadFile()` (Zeilen **1579, 2405, 2471, 2529, 2566, 3647**) +
     `provider.createFolder()` durch **einen** `POST /api/submissions`-Call ersetzen.
   - `promoteWizardArtifacts`-Aufrufe entfernen (Import **40**, Zeilen **241,
     2279–2283, 3858**).
   - Binär-Inbox-Upload-Route (nutzt W1 `getInboxBlobPath` + `AzureStorageService`),
     liefert `SubmissionBinaryRef` → in den POST-Body.
2. **W4 — Abnahme-UI einbinden** (Archiv-Ansicht):
   - `SubmissionInboxList` + `SubmissionReviewPanel` platzieren
     (`key={submission.id}` setzen!).
   - Daten-Hook auf `GET /api/submissions?libraryId=…`; Handler rufen
     `approve`/`reject`/`PATCH`.

**Vor Merge:** `bash scripts/welle-pre-merge-check.sh`.

## W5 — Promotion-Job (PAUSIERT, vorbereitet)

Auf Wunsch gestoppt — **nur Recherche, kein Code**. Geplanter Cloud-Slice beim
Fortsetzen: `promotion-plan.ts` (rein) + `promotion-errors.ts` (Klassifikation) +
`promotion.ts` (Orchestrierung mit injiziertem Executor, State-Machine
ready→publishing→published + Rollback) + `POST /api/submissions/[id]/promote`;
echter Provider-Executor lokal-verifiziert.

**Bausteine (aus der Kartierung, zum Wiederverwenden):**
- `getServerProvider(userEmail, libraryId)` → `StorageProvider`
  (`src/lib/storage/server-provider.ts:57`).
- Markdown schreiben: `createMarkdownWithFrontmatter(body, meta)`
  (`src/lib/markdown/compose.ts`) → `new File([md], name, {type:'text/markdown'})`
  → `provider.uploadFile(folderId, file)`.
- RAG: `IngestionService.upsertMarkdown(userEmail, libraryId, fileId, fileName,
  markdown, meta?, jobId?, provider?)` (`src/lib/chat/ingestion-service.ts`).
- Inbox-Binär laden: `fetch(binaryRef.url)` (öffentliche Azure-URL).
- Fehler-Klassifikation: `StorageError` mit `code` `'AUTH_ERROR'` (401/403) →
  **Token** (bleibt `ready` + Re-Auth); Netzfehler/`'API_ERROR'` → **Storage**
  (Backoff-Retry). `src/lib/storage/types.ts:211`.
- Job-Infra: External-Jobs (`src/lib/external-jobs-*`) — **eigene Domäne**
  (ADR-0001), nicht vermischen. Co-Autor-Pfad kann synchron laufen.

## ADR-0005 (deponiert, nicht umgesetzt)

Co-Creator-Storage-Auth: Rechte liegen **im Storage** (Nextcloud-/OneDrive-Sharing),
Owner bestimmt das gemeinsame Root-Verzeichnis, Co-Creator gibt **sein eigenes**
Root an; Login validiert echten Zugriff. **Offen/zu untersuchen:** ob geteilte
Ressourcen konto-übergreifend **identische File-IDs** liefern (Testdatei-Probe).
Eigene spätere Welle, getrennt vom Inbox-Strang.

## Nächste Entscheidung

1. **Stufe A** lokal verifizieren (bestätigt das Fundament).
2. Dann entscheiden: **Stufe B** verdrahten (ganzer Flow sichtbar) **oder** direkt
   **W5** fortsetzen — W5 sollte auf einem verifizierten Fundament aufsetzen.
