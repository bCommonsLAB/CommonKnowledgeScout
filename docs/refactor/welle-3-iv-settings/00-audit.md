# Bestands-Audit: Welle 3-IV — Settings

Stand: 2026-05-02 (Cloud-Agent, Vorbereitungs-PR, Schritt 0).

**Scope-Hinweis**: Welle 3-IV deckt die Settings-UX ab:
- `src/components/settings/` (18 Files, ~9.657 Zeilen)
- `src/app/settings/` (App-Router-Routen, ~481 Zeilen, 12 Dateien)

Verwandte Wellen: Welle 3-I (App-Schale), 3-II (Archiv-Detail), 3-II-Hooks,
3-III (Galerie + Chat) sind bereits abgeschlossen oder laufen noch (3-III offen).
Settings-UX profitiert von sauberer Schale (Welle 3-I), interagiert aber
sonst kaum mit den anderen 3-x-Wellen.

## Zusammenfassung

| Bereich       | Eintraege | keep | update | merge | migrate | delete | archive |
|---|---:|---:|---:|---:|---:|---:|---:|
| Cursor Rules  | 14        | 12   | 2      | 0     | –       | 0      | –       |
| Tests         | 0         | –    | –      | –     | –       | –      | –       |
| Docs          | 3         | 1    | 1      | –     | –       | 0      | 1       |
| **Summe**     | **17**    | **13** | **3** | **0** | **0** | **0** | **1**  |

**Kritische Findings**:

- **F1 — 0 direkte Unit-Tests für alle 18 Settings-Komponenten**. Die Forms
  sind rein UI-seitig (React Hook Form + API-Calls), klassische E2E-Tests
  wären ideal, aber kein Vitest-Sicherheitsnetz vorhanden. Char-Tests für
  reine Helper-Funktionen (z.B. `useSafeUser`, Shadow-Twin-Config-Parser)
  sollten in Sub-Welle 3-IV-a angelegt werden.

- **F2 — 9 leere/stille Catches in 5 Dateien** (verifiziert via `grep`).
  Darunter 1 echter "silent"-Kommentar-Catch (`library-form.tsx:1530`) und
  mehrere Fehler-Suppressionen ohne Logging:
  - `library-form.tsx`: Z. 17, Z. 601, Z. 1530
  - `public-form.tsx`: Z. 42, Z. 192, Z. 363
  - `chat-form.tsx`: Z. 474, Z. 539
  - `secretary-service-form.tsx`: Z. 155
  → Verletzt `no-silent-fallbacks.mdc`. Fix in Sub-Welle 3-IV-a (Altlast-Pass).

- **F3 — `library-form.tsx` mit 52 Hooks und 2.233 Zeilen** ist der mit
  Abstand größte Hot-Spot der Welle. Monolithische Datei mit Shadow-Twin-
  Konfig, Migrations-Wizards, Trockenläufen, Language-Cleanup, Import/Export —
  alles inline. Braucht eigenen Modul-Split (mindestens 4 Sub-Module).

- **F4 — `chat-form.tsx` (34 Hooks, 1.518 Zeilen) und `storage-form.tsx`
  (26 Hooks, 1.411 Zeilen)** sind die nächst-größten Hot-Spots. Beide über
  DoD-Grenze (>200 Zeilen). Modul-Split in Sub-Welle 3-IV-a.

- **F5 — Storage-Branches in `storage-form.tsx` sind ERLAUBT** laut
  `storage-abstraction.mdc` ("Settings-Formulare dürfen `library.type` lesen").
  Alle `library.type === 'onedrive'` usw.-Branches in `storage-form.tsx`
  sind konform. Kein Handlungsbedarf.

- **F6 — `library-form.tsx` enthält `primaryStore`-Checks** (Shadow-Twin-
  Konfig), die intern zu `library-form.tsx` gehören und NICHT UI/Storage-
  Abstractions-Verletzungen sind (kein direkter Storage-Provider-Zugriff).
  Konform, aber komplex — muss beim Modul-Split klar separiert werden.

- **F7 — Keine `'use client'`-Direktive** in den Forms (server-component-
  freundlich), außer 4 kleinere Dialog-Files (`index-definition-dialog.tsx`,
  `search-index-dialog.tsx`, `teams-stream-relay-panel.tsx`, `translations-form.tsx`).
  Die Client-Direktive ist dort sachlich begründet (Event-Handler,
  Browser-APIs). Kein Handlungsbedarf.

- **F8 — `FacetDefsEditor.tsx` (471 Zeilen)** ist über DoD-Grenze, aber
  selbst-contained (JSON-Import/-Export-Editor). Kann isoliert als eigener
  Helper betrachtet werden; Modul-Split in Sub-Welle 3-IV-b möglich.

---

## A. Cursor Rules

| Rule-Datei | Bezug zum Modul | Status | Aktion |
|---|---|---|---|
| `.cursor/rules/storage-abstraction.mdc` | Direkt: Settings-Forms lesen `library.type` — explizit erlaubt | aktuell | **keep** |
| `.cursor/rules/no-silent-fallbacks.mdc` | Direkt: 9 leere/stille Catches in 5 Settings-Dateien | aktuell | **keep** (Catches fixen in Schritt 4) |
| `.cursor/rules/shadow-twin-architecture.mdc` | Direkt: `library-form.tsx` verwaltet Shadow-Twin-Konfig | aktuell | **keep** |
| `.cursor/rules/shadow-twin-contracts.mdc` | Indirekt: Shadow-Twin-Config-API wird in `library-form.tsx` aufgerufen | aktuell | **keep** |
| `.cursor/rules/storage-contracts.mdc` | Indirekt: Storage-Konfig via `storage-form.tsx` | aktuell | **keep** |
| `.cursor/rules/chat-contracts.mdc` | Indirekt: `chat-form.tsx` konfiguriert Chat-Backend | aktuell | **keep** |
| `.cursor/rules/contracts-story-pipeline.mdc` | Indirekt: Secretary-Service-Form tangiert Pipeline | aktuell | **keep** |
| `.cursor/rules/secretary-contracts.mdc` | Direkt: `secretary-service-form.tsx` | aktuell | **keep** |
| `.cursor/rules/media-lifecycle.mdc` | Indirekt (über Upload-Pfade in `library-form.tsx`) | aktuell | **keep** |
| `.cursor/rules/refactor-batch-strategy.mdc` | Global: Prozess-Rule für diese Welle | aktuell | **keep** |
| `.cursor/rules/refactor-naming-konvention.mdc` | Global: Wellen-Naming | aktuell | **keep** |
| `.cursor/rules/cloud-agent-cost-strategy.mdc` | Global: Kosten-Strategie | aktuell | **keep** |
| `.cursor/rules/welle-3-archiv-detail-contracts.mdc` | Keinen direkten Bezug zu Settings | aktuell | **keep** (unveraendert) |
| `.cursor/rules/reorganizing-components.mdc` | Direkt: Component-Reorganisation in Settings-Splits | aktuell | **update** (Welle-3-IV-Scope erwaehnen) |
| `.cursor/rules/welle-3-schale-loader-contracts.mdc` | Indirekt: App-Schale ist Wrapper um Settings-Routen | aktuell | **keep** |

**Neue Rule nötig**: `.cursor/rules/welle-3-iv-settings-contracts.mdc` — muss
in Schritt 2 angelegt werden. Hält Invarianten für Settings-Modul-Splits fest
(§1 Forms sind Client-Komponenten, §2 Fehler-Semantik, §3 erlaubte API-
Pfade, §4 Storage-Branch-Erlaubnis explizit festhalten).

---

## B. Tests

| Test-Datei | Testet welchen Code | Code existiert? | Vertrag korrekt? | Aktion |
|---|---|---|---|---|
| *(keine)* | — | — | — | — |

**Befund**: Es existieren **keine Unit-Tests** für `src/components/settings/`.
Das `tests/unit/`-Verzeichnis enthält kein `settings/`-Unterverzeichnis.
E2E-Tests (Playwright) sind nicht im Scope dieses Audits.

**Konsequenz**: Char-Tests für isolierbare Helper (z.B. `useSafeUser`-Fallback,
Shadow-Twin-Config-Parser, JSON-Import-Validator in FacetDefsEditor) müssen
in Schritt 3 angelegt werden. Render-Tests für die großen Forms sind komplex
(viele Mock-Abhängigkeiten) — Prio auf Helper-Funktionen, nicht auf
vollständige Render-Tests.

---

## C. Docs

| Doc-Datei | Beschreibt was | Status | Aktion |
|---|---|---|---|
| `docs/analysis/shadow-twin-settings-ui.md` | Varianten-Analyse für Shadow-Twin-Flags in `library-form.tsx` (Variante A vs B vs C). Entscheidung: Variante A (Inline in LibraryForm). | aktuell (Entscheidung bereits umgesetzt) | **archive** (in `docs/archive/` verschieben nach Welle, da Entscheidung umgesetzt) |
| `docs/analysis/shadow-twin-v2-only.md` | Shadow-Twin-V2-Migration-Strategie — tangiert `library-form.tsx` (ShadowTwin-Mode-Upgrade-Wizard) | aktuell | **keep** (weiterhin relevant als Referenz) |
| `docs/use-cases/library-setup.md` | Library-Setup-Use-Case (mentions Settings-Flow) | unklar (nicht vollständig gelesen) | **update** (nach Welle-3-IV-Refactor prüfen ob Pfade/Screenshots noch stimmen) |
