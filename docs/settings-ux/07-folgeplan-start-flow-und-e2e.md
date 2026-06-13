# Folgeplan: Start-Flow, „keine Library"-Modus & E2E-Drehbuch

Stand 2026-06-13. Festgehalten am Ende der Session auf Branch
`claude/great-curie-efb28y` (vor dem Merge nach `master`). Diese Datei ist der
Übergabepunkt für die nächste Session, die **von `master`** startet.

## 1. Was diese Session geliefert hat

### 1a. Settings-UX: „keine Library gewählt"-Modus + Start-Dashboard (A–E)

Grundlegende Lösung des blockierenden Re-Auth-Dialogs und ein angemeldetes
Willkommens-Dashboard:

- **A — Auto-Select abgeschaltet.** Nach dem Login wird nicht mehr zwangsweise
  die zuletzt genutzte Bibliothek aktiviert; es gibt einen definierten
  „keine Library gewählt"-Zustand (`noLibrarySelectedAtom` in
  [`library-atom.ts`](../../src/atoms/library-atom.ts),
  Auswahllogik in [`storage-context.tsx`](../../src/contexts/storage-context.tsx)).
- **B — Re-Auth-Dialog abbrechbar.** „Später" **deselektiert** die Bibliothek
  (`onDismissLibrary`) statt den Dialog nur lokal auszublenden — er blockiert
  damit nicht mehr bei jedem Seitenladen
  ([`storage-reauth-dialog.tsx`](../../src/components/shared/storage-reauth-dialog.tsx)).
- **C — Cold-Load-Redirect-Bug** in
  [`settings-client.tsx`](../../src/app/settings/settings-client.tsx) behoben
  (Creator wurde beim direkten Aufruf kurzzeitig auf `/` geworfen, weil
  `isCreator` gegen die noch leeren `libraries` geprüft wurde).
- **D — `/start`-Dashboard** ([`start-client.tsx`](../../src/app/start/start-client.tsx)):
  Willkommen + Bibliotheks-Teaser ([`library-teasers.tsx`](../../src/components/start/library-teasers.tsx))
  + „Neue Bibliothek"-Teaser; Navigation/„Home" (eingeloggt) führt hierher,
  anonyme Besucher auf die Marketing-Startseite.
- **E — Anlage-Wizard + SpaceOverview extrahiert** aus den Settings in eigene
  Module ([`create-library-wizard.tsx`](../../src/components/flows/create-library-wizard.tsx),
  [`space-overview.tsx`](../../src/components/spaces/space-overview.tsx)).

Damit sind die beiden E2E-Befunde dieser Session (Cold-Load-Redirect; global
blockierender Re-Auth-Dialog) **an der Wurzel** gelöst.

### 1b. E2E-Drehbuch-Harness (Playwright)

Wiederholbares Sicherheitsnetz neben den Unit-Tests, unter [`e2e/`](../../e2e/):

- `pnpm test:e2e` (headless), `pnpm test:e2e:ui` (Live-Browser + Szenarien-Baum,
  Zeitreise), `pnpm test:e2e:headed`, `pnpm test:e2e:report`.
- Login einmalig per `@clerk/testing`-Token + gespeicherter Session
  (`tmp/e2e-auth.json`, gitignored). Setup wartet beim ersten Lauf auf den
  manuellen Owner-Login.
- Jeder Drehbuch-Schritt wird als PASS/FAIL/MANUELL protokolliert
  (`tmp/e2e-results/*.json`); `global-teardown` erzeugt daraus automatisch
  [`06-testdrehbuch-ergebnis.md`](06-testdrehbuch-ergebnis.md).
- Aktive Bibliothek wird deterministisch über `localStorage` gesetzt (mit Guard,
  damit nie eine echte Bibliothek angefasst wird); Test-Bibliotheken tragen das
  Präfix `TEST-Drehbuch` und werden zu Beginn von Akt 1 gelöscht.

## 2. Verifikation vor dem Merge

- `pnpm lint` ✓ · `pnpm test` (Vitest) ✓ (beide grün gelaufen).
- `/start`-Flow: Preview-Verifikation (siehe Task „Verifikation").
- `bash scripts/welle-pre-merge-check.sh` lokal vor dem Merge (Pflicht laut
  AGENTS.md).

## 3. Offen für die nächste Session (von `master`)

### 3a. E2E-Drehbuch auf die neuen Flows ausrichten (Phase 3)

Die Specs wurden gegen den ALTEN Flow geschrieben; nach A–E anpassen:

- **1.1 Willkommen:** jetzt `/start` (angemeldet) statt
  `/settings?newUser=true`. Erwartung umstellen.
- **1.2 Anlage:** über den `/start` → `CreateLibraryWizard` testen (inkl.
  Inhaltstyp-Karte — der Wizard kann sie wieder anbieten, anders als der
  Switcher-Dialog-Workaround dieser Session).
- **Re-Auth-Dialog:** ist dank B nicht mehr global blockierend; der
  `addLocatorHandler`-Workaround wird ggf. überflüssig. Prüfen.
- **Quelle (1.3–1.5):** Pfad über „Quelle ändern…" im Archiv setzen
  (Zusammenfassung → Wizard) — Voraussetzung für 1.6–1.8.
- **Selektor-Fixes** (echte Namen aus den Fehlermeldungen dieser Session):
  - Vorlage: `select` ohne `name` — über die Option `standard-session`
    ansteuern, nicht `select[name=pdfTemplate]`.
  - Chunk-Größe: `getByRole('spinbutton', { name: 'Chunk Größe' }).first()`.
  - Story-Eingabefeld: `getByRole('textbox', { name: 'Platzhalter' }).first()`.
  - Explore-Labels (Dichte/Gruppierung/Graph), „Dateisystem-Optionen",
    Public-Switches + Status-Alert, Invite-Toast: echte Texte per DOM-Inspektion
    bestätigen.
  - S1 (`/api/libraries` Maskierung): in `assertAuthenticated`/`getLibraries`
    expliziten Timeout + Retry setzen (Server gegen Lauf-Ende träge → Flake).

### 3b. Vision: Library-Dashboard mit Quick-Actions (größer, eigenes Modul)

Idee des Owners: die wichtigsten, heute in Modulen vergrabenen Aktionen direkt
anbieten — als Dashboard einer Bibliothek bzw. als Use-Case-Teaser auf `/start`:

- „Mitglieder einladen", „Neue Story erstellen", „Quelle einrichten" usw. als
  Direkt-Einstiege (analog zum extrahierten `CreateLibraryWizard`).
- Konsequenz: den komplexen Settings-Dialog schrittweise in fokussierte
  Use-Case-Flows zerlegen und an mehreren Stellen (Start, Dashboard) anbieten.
- Offen zu entscheiden: eigenes `flows/`-Modul je Use-Case vs. Erweiterung des
  bestehenden Wizard-Musters.

## 4. Merge-Notiz

- Branch `claude/great-curie-efb28y`, 90 Commits vor `master`.
- Uncommittet: Feature A–E (settings-client, library-atom, storage-context,
  storage-reauth-dialog, top-nav, app-layout, `app/start/`, `components/start|flows|spaces/`)
  + E2E-Harness (`e2e/`, `playwright.config.ts`, `package.json`-Scripts,
  `.gitignore`, Deps in `pnpm-lock.yaml`) + dieser Plan + Auto-Bericht.
- Danach zweiter Branch des Owners → `master`, dann neue Session von `master`.
