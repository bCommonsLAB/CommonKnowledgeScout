# Offene Punkte & Hand-off — A4 + Plan 2 (Stand 2026-06-20, aktualisiert 2026-06-22)

> Begleitet `test-handbuch-a4-plan2-lokal.md`. Festgehalten vor dem Merge nach
> `master` + Übergabe an die nächste Session. Branch:
> `claude/library-verification-status-a1-cgg7qv`.
>
> **Update 2026-06-22:** Beide unter §2 gelisteten Bugs sind inzwischen behoben
> und in `master`: §2a über PR #111 (detailViewType-Persistenz beim Promote),
> §2b über den Größen-Guard 1b (Branch `claude/brave-galileo-i9z63s`). Der A1-
> Verifikationsstatus (Plan 1) ist über PR #109 in `master`. Nächster Strang:
> Plan 2 — generischer Assistent (2b / U-Reihe) + 2a Templates-Entflechten
> (Hauptteil). Aktuelle Plan-Stände im
> [`roadmap-…`](roadmap-formatunabhaengige-library-und-onboarding.md).

## 1) Fertig & grün

- **A4** (Galerie/Story) + **Plan 2** (W-A…W-G in Teilen): alle Unit-Tests grün
  (~2300+), `pnpm lint` 0 Fehler.
- **Lokal verifiziert:** A (Capture-Übersicht → Standard-Wizard → Rücksprung
  nach Erkunden), B (Wizard-Kuratierung speichern/laden), C (Typ-Leitfilter —
  verhält sich wie spezifiziert: erscheint ab ≥2 echten `detailViewType`).

## 2) Offene Bugs (vorbestehend — NICHT A4/Plan-2-Code)

> **Beide GELÖST (2026-06-22):** 2a → PR #111, 2b → Größen-Guard 1b
> (`claude/brave-galileo-i9z63s`). Befunde bleiben als Historie stehen.

### 2a) ✅ GELÖST (PR #111) — `detailViewType`-Persistenz: Event erscheint als „book"
- **Befund:** Die Library-Vorlage `event-creation-de` setzt `detailViewType:
  session` korrekt (Metadaten-Tab), aber der Wert landet **nicht** im
  veröffentlichten Dokument (`docMetaJson`) → die Galerie fällt auf den
  Library-Default `book` zurück. `docType: event` kommt dagegen an.
- **Eingegrenzt:** Die Galerie **liest** `detailViewType` korrekt
  (Projektion `vector-repo.ts:1063` + Mapping `gallery/types.ts:257`). Also liegt
  die Ursache im **Schreiben** beim Erfassen/Veröffentlichen der „Auto-/System-
  Felder" im **Text-Flow** (Secretary/process-text), nicht in A4/Galerie.
- **Offener Diagnose-Schritt:** veröffentlichte `.md` (Archiv) prüfen — steht
  `detailViewType: session` im Frontmatter?
  - **Nein** → Fix beim **Schreiben** (Transform/Publish der System-Felder).
  - **Ja** → Fix bei der **Ingestion** (Wert wird nicht in `docMetaJson` übernommen).
- **Wirkung:** Ohne `detailViewType` greifen weder Typ-Anzeige noch der
  A4a-Leitfilter real → **entsperrt A4a**, daher Prio.

### 2b) ✅ GELÖST (1b, `claude/brave-galileo-i9z63s`) — Submission-Absturz beim Event
- **Befund:** `POST /api/submissions` → `ERR_EMPTY_RESPONSE`, danach überall
  `ERR_CONNECTION_REFUSED` = **Dev-Server abgestürzt**.
- **Ursache (verifiziert):** `captureWithBinary` → `uploadInboxBinary` puffert
  große/mehrere Dateien vollständig im RAM (`formData()` + `Buffer.from(
  arrayBuffer)` + erneutes `File`-Umpacken) → Dev-OOM. Es gab **kein**
  Größenlimit.
- **Fix (Variante A):** reiner Größen-Guard `src/lib/submissions/capture-size-guard.ts`
  — Pre-Parse-Check über `Content-Length` (vor dem Puffern) + autoritativer
  Post-Parse-Check pro Datei + Summe (vor dem Upload). Überschreitung →
  **HTTP 413** statt Crash (kein Silent Fallback). Limits als dokumentierte
  Konstanten, per ENV überschreibbar (`SUBMISSION_MAX_FILE_BYTES` /
  `SUBMISSION_MAX_TOTAL_BYTES`).
- **Fix (Variante C, Diagnose):** `src/lib/debug/process-error-logging.ts`
  loggt idempotent `uncaughtExceptionMonitor` + `unhandledRejection` (echtes
  Heap-OOM erreicht JS-Handler aber nicht — daher ist A der eigentliche Fix).
- **Lokaler Realtest (durch den User):** großes Ordner-/Datei-Event erfassen →
  erwartet sauberer 413-Hinweis statt Crash.

## 3) Offene lokale Tests

- **D** — Story-Verweise je Format (braucht Story mit gemischten Anhängen:
  Bild/Audio/Video/PDF/Link).
- **Regression-Watch:** Einzeltyp-Galerie unverändert · Vorlagen-Editor
  „Creation Flow"-Tab unverändert · Diktat-Wortlaut „Im Archiv speichern".
- **A4-Playwright-E2E** (`e2e/`) ausführen (Selektoren stehen im Handbuch).

## 4) Bewusst offene Folgeschritte (Plan)

- **A4a Designfrage:** Leitfilter auf `detailViewType` (aktuell) **vs.** `docType`.
  Offen gelassen — entscheiden, sobald eine echte Misch-Library (≥2
  `detailViewType`, z. B. Buch + Session) getestet ist. Hängt mit 2a zusammen.
- **A4c:** `session-detail` erledigt; **mobiler Feinschliff** offen.
- **W-A:** Seed wird **nicht automatisch** ausgelöst; der Standard-Wizard läuft
  über den **Code-Fallback** `file-transcript-de`. Echte gespeicherte
  Flow-Entität + Auto-Seed = späterer Schritt.
- **W-E:** Betriebsart gebündelt; **tiefere Step-Engine-Integration** (mit U4) offen.
- **W-G:** Flow-Validierung herausgelöst; **volle `CreationFlowEditor`-Extraktion**
  (~1345 Z.) + eigenständige Wizard-Editor-Route offen (groß, lokal).

## 5) Merge nach `master` (Git-Stand)

- Branch ist **~28 Commits vor** `master`, aber **~11 hinter** `master`
  (divergiert). Master hat u. a.: „Export/Import verlieren keine Config-Felder
  (Deny-List)", Pipeline-/Migrations-Fixes.
- **Vor dem Merge:** `master` in den Branch integrieren (merge **oder** rebase),
  Konflikte v. a. erwartbar in:
  - `src/types/library.ts` + `src/lib/services/library-service.ts`
    (Config-Felder ↔ neues `captureWizards`),
  - `src/components/creation-wizard/creation-wizard.tsx`.
  Danach `pnpm test` + `pnpm lint` grün → mergen.

### Merge-Schritte (lokal, wo man testen kann)
```bash
git checkout claude/library-verification-status-a1-cgg7qv
git fetch origin
git merge origin/master            # Konflikte lösen (s. o.)
pnpm install --frozen-lockfile
pnpm test && pnpm lint             # grün?
git push
# dann PR/Merge nach master über euren üblichen Weg
```

## 6) Empfohlener Einstieg nächste Session (aktualisiert 2026-06-22)

Die ursprünglich hier gelisteten Punkte sind erledigt (2a → #111; A1 → #109;
Submission-Crash → 1b). Nächster Strang ist **Plan 2** (siehe Roadmap):

1. **2a — Templates entflechten (Hauptteil):** Schema-Einheit pro Inhaltstyp,
   `extends`, generische Feld-Bindung (`kind`/`inputType`) auf dem schon
   gemergten `editableContentFields`/Phase-3a-1 aufbauen. Kickoff: Umbauplan §8
   (U0 zuerst). Modell **Opus**.
2. **2b — der eine generische Assistent (U-Reihe):** geführter Flow gegen jedes
   Schema, immer über den Wartekorb, Veröffentlichen = rechte-gateter Promote.
   Fundament (U0–U4.1 #102, U5a #103, Inbox/Promote) liegt in `master`.
3. **Rest-Feinschliff Plan 1:** A4c mobiler Feinschliff, A4-E2E lokal,
   D + Regression-Watch.

Start-Kontext für die neue Session: dieses Dokument +
`roadmap-formatunabhaengige-library-und-onboarding.md` +
`docs/wizards/umbauplan-generischer-erfassungs-wizard.md` (U0–U8) +
`docs/adr/0003-wizard-schema-template-trennen.md` +
`docs/adr/0004-capture-publish-entkopplung-inbox-modell.md`.
