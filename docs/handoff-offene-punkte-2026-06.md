# Offene Punkte & Hand-off — A4 + Plan 2 (Stand 2026-06-20)

> Begleitet `test-handbuch-a4-plan2-lokal.md`. Festgehalten vor dem Merge nach
> `master` + Übergabe an die nächste Session. Branch:
> `claude/library-verification-status-a1-cgg7qv`.

## 1) Fertig & grün

- **A4** (Galerie/Story) + **Plan 2** (W-A…W-G in Teilen): alle Unit-Tests grün
  (~2300+), `pnpm lint` 0 Fehler.
- **Lokal verifiziert:** A (Capture-Übersicht → Standard-Wizard → Rücksprung
  nach Erkunden), B (Wizard-Kuratierung speichern/laden), C (Typ-Leitfilter —
  verhält sich wie spezifiziert: erscheint ab ≥2 echten `detailViewType`).

## 2) Offene Bugs (vorbestehend — NICHT A4/Plan-2-Code)

### 2a) `detailViewType`-Persistenz: Event erscheint als „book"
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

### 2b) Submission-Absturz beim Event
- **Befund:** `POST /api/submissions` → `ERR_EMPTY_RESPONSE`, danach überall
  `ERR_CONNECTION_REFUSED` = **Dev-Server abgestürzt**.
- **Eingegrenzt:** Der Submission-/Inbox-Pfad nutzt **kein** A4/Plan-2-Modul
  (per Suche verifiziert). Vermutlich Dev-OOM oder Inbox-Upload/OneDrive/Azure.
- **Offen:** **Server-Terminal-Log** vom Crash-Zeitpunkt nötig.

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

## 6) Empfohlener Einstieg nächste Session

1. **2a `detailViewType`-Persistenz fixen** (entsperrt A4a real) — Pipeline,
   Modell **Opus**. Vorab: Frontmatter-Check (s. 2a) entscheidet Schreib- vs.
   Lese-Fix.
2. **D + Regression-Watch** abschließen.
3. **W-G volle Extraktion** / **W-A Auto-Seed** (größer, lokal).

Start-Kontext für die neue Session: dieses Dokument +
`test-handbuch-a4-plan2-lokal.md` + `plan1-a4-gemischte-galerie-story.md` +
`plan-praezisierung-inhalte-erfassen-kuratierte-wizards.md`.
