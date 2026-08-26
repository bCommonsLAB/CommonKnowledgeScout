# Cloud-Agent-Brief: Welle 3-IV — Settings

Stand: 2026-05-02. Erstellt vom Cloud-Agent (Vorbereitungs-PR).

---

## Kontext (lies das ZUERST)

1. **Methodik & Workflow-Regeln**: [`docs/refactor/playbook.md`](../playbook.md)
2. **Vorbild-Welle**: [`docs/refactor/welle-3-archiv-detail/`](../welle-3-archiv-detail/) —
   komplette Doku-Serie + Modul-Split-Pattern (insb. Welle 3-II-a für große Forms)
3. **Plan-Bezug**: [`docs/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md`](../../plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md)
   Sektion 5 (Welle 3-IV)
4. **Architektur-Rules** (alle relevant):
   - [`storage-abstraction.mdc`](../../contracts/storage-abstraction.md) — `library.type`-Branches in Settings **erlaubt**
   - [`no-silent-fallbacks.mdc`](../../contracts/no-silent-fallbacks.md) — 9 leere Catches fixen
   - [`shadow-twin-architecture.mdc`](../../contracts/shadow-twin-architecture.md) — relevant für `library-form.tsx`
   - [`chat-contracts.mdc`](../../contracts/chat-contracts.md) — relevant für `chat-form.tsx`
   - [`refactor-batch-strategy.mdc`](../../contracts/refactor-batch-strategy.md) — 1 PR pro Sub-Welle
   - [`refactor-naming-konvention.mdc`](../../contracts/refactor-naming-konvention.md) — Wellen-Naming
   - [`cloud-agent-cost-strategy.mdc`](../../contracts/cloud-agent-cost-strategy.md) — Kosten-Regeln
5. **Audit + Inventur**: [`00-audit.md`](./00-audit.md), [`01-inventory.md`](./01-inventory.md)
6. **Hot-Spots**: [`04-altlast-pass.md`](./04-altlast-pass.md) — alle 9 Catches + 3 Modul-Split-Pläne
7. **AGENTS.md** im Repo-Root

---

## Welle-Struktur

| Sub-Welle | Branch (geplant) | Inhalt | Status |
|---|---|---|---|
| **Vorbereitung** | `cursor/refactor-welle-3-iv-vorbereitung-1b06` | Audit + Inventur + Hot-Spots + AGENT-BRIEF | DIESE PR |
| **3-IV-a** Große Forms | `cursor/refactor-welle-3-iv-a-big-forms-...` | `library-form`, `chat-form`, `storage-form` Splits + Altlast-Pass | Cloud-Lauf NACH Vorbereitung-Merge |
| **3-IV-b** Mittlere Forms | `cursor/refactor-welle-3-iv-b-mid-forms-...` | `public-form`, `secretary-service-form`, `FacetDefsEditor`, `search-index-dialog` | Cloud-Lauf NACH 3-IV-a |
| **3-IV-c** Listen + Cleanup | `cursor/refactor-welle-3-iv-c-lists-cleanup-...` | `members-list`, `access-requests-list`, `translations-form` | Cloud-Lauf NACH 3-IV-b |

Sequentiell: erst Vorbereitung mergen, dann 3-IV-a, dann 3-IV-b, dann 3-IV-c.

---

## Aufgabe DIESES Cloud-Laufs (Vorbereitung)

Nur Doku-Dateien, **keine Code-Änderungen**:
- [x] `00-audit.md` — Bestands-Audit (Rules, Tests, Docs)
- [x] `01-inventory.md` — Inventur (Datei-Tabelle mit Health-Zahlen)
- [x] `04-altlast-pass.md` — Hot-Spot-Liste (9 Catches, 10 Modul-Split-Pläne)
- [x] `AGENT-BRIEF.md` — diese Datei

Schritt 2 (Contracts-Rule) und Schritt 3 (Char-Tests) werden in Sub-Welle
3-IV-a erledigt (zusammen mit den Modul-Splits).

---

## Sub-Welle 3-IV-a — Große Forms (Start-Prompt für neuen Agent)

### Aufgabe

Modul-Splits für `library-form.tsx`, `chat-form.tsx`, `storage-form.tsx`
plus Altlast-Pass (9 Catches, `useSafeUser`-Extraktion).

### Commit-Reihenfolge (verbindlich)

1. **Contracts-Rule** anlegen: `../../contracts/welle-3-iv-settings-contracts.md`
   (~50z, enthält §1 Client-Direktive, §2 Fehler-Semantik, §3 erlaubte
   API-Pfade, §4 Storage-Branch-Erlaubnis)
2. **Char-Tests** für `useSafeUser`-Hook + Shadow-Twin-Config-Parser
   (~80z, in `tests/unit/settings/`)
3. **`useSafeUser` extrahieren**: `src/hooks/use-safe-user.ts` anlegen,
   Duplikate in `library-form.tsx` + `public-form.tsx` ersetzen (~50z diff)
4. **`library-form.tsx` Modul-Split**: Ziel `src/components/settings/library/`
   mit 6+ Sub-Modulen (max 1.000z Diff pro Commit — mehrere Commits nötig!)
   - Commit 4a: Shadow-Twin-Config-Section + Hook `use-shadow-twin-migration.ts`
   - Commit 4b: Migration-Wizard-Section + Hook `use-shadow-twin-analysis.ts`
   - Commit 4c: Import/Export-Section + Lang-Cleanup-Section
   - Commit 4d: Haupt-Form + `use-library-form.ts` + Cleanup
5. **`chat-form.tsx` Modul-Split**: Ziel `src/components/settings/chat/`
   (max 1.000z Diff, ggf. 2 Commits)
6. **`storage-form.tsx` Modul-Split**: Ziel `src/components/settings/storage/`
   (max 1.000z Diff)
7. **H2, H3, H7, H8, H9 Catches fixen** (kann in Cleanup-Commit)
8. **Acceptance-Doc**: `06-acceptance-3-iv-a.md`

### Stop-Gates Sub-Welle 3-IV-a

- Einzelner Commit > 1.000z diff → STOP, splitten
- `pnpm test --run` wird rot → nach 3 Versuchen stoppen + User melden
- `pnpm lint` meldet neue Errors → vor Push fixen
- `pnpm build` NICHT im Cloud-Agent (User lokal via `bash scripts/welle-pre-merge-check.sh`)

---

## Sub-Welle 3-IV-b — Mittlere Forms (Start-Prompt für neuen Agent)

### Aufgabe

Modul-Splits für `public-form.tsx`, `secretary-service-form.tsx`,
`FacetDefsEditor.tsx`, `search-index-dialog.tsx` plus verbleibende
Catches (H5, H9).

### Commit-Reihenfolge

1. **Char-Tests** für `public-form`-Helper, `FacetDefsEditor`-JSON-Validator
2. **`public-form.tsx` Modul-Split** (H5-Catch fixen)
3. **`secretary-service-form.tsx` Modul-Split** (H9-Catch fixen)
4. **`FacetDefsEditor.tsx` Hook-Extraktion**
5. **`search-index-dialog.tsx` Action-Split**
6. **Acceptance-Doc**: `06-acceptance-3-iv-b.md`

---

## Sub-Welle 3-IV-c — Listen + Cleanup (Start-Prompt für neuen Agent)

### Aufgabe

Hook-Extraktion für `members-list.tsx`, `access-requests-list.tsx`,
`translations-form.tsx` + knip-Lauf (Dead Code).

### Commit-Reihenfolge

1. **Char-Tests** für List-Action-Hooks
2. **`members-list.tsx` Hook-Extraktion**
3. **`access-requests-list.tsx` Hook-Extraktion**
4. **`translations-form.tsx` Hook-Extraktion**
5. **knip-Lauf** über `src/components/settings/` — ungenutzten Code entfernen
6. **Acceptance-Doc**: `06-acceptance-3-iv-c.md` + Gesamt `06-acceptance-3-iv-GESAMT.md`

---

## Health-Ziele (DoD für Welle 3-IV)

| Metrik | Ist (2026-05-02) | Ziel nach Welle 3-IV |
|---|---:|---:|
| Files > 200z | 9 | 0 (oder dokumentierte Ausnahme) |
| Leere Catches | 9 | 0 |
| `any`-Count | 0 | 0 |
| Unit-Tests | 0 | ≥ 5 (Helper-Tests) |
| `pnpm lint` Errors | 0 | 0 |

---

## Start-Prompt für Sub-Welle 3-IV-a (kopierbar)

```
Lies VOR dem Start (in dieser Reihenfolge):
1. AGENTS.md
2. ../../contracts/cloud-agent-cost-strategy.md
3. ../../contracts/refactor-batch-strategy.md
4. ../../contracts/storage-abstraction.md (storage-branch in Settings erlaubt!)
5. docs/refactor/welle-3-iv-settings/AGENT-BRIEF.md (Sektion "Sub-Welle 3-IV-a")
6. docs/refactor/welle-3-iv-settings/04-altlast-pass.md (Hot-Spots H1-H9, M1-M3)
7. docs/refactor/welle-3-iv-settings/01-inventory.md (Health-Zahlen)

Aufgabe: Sub-Welle 3-IV-a — Modul-Splits für library-form.tsx, chat-form.tsx,
storage-form.tsx + useSafeUser-Extraktion + Catches H1-H3, H7-H8 fixen.

Branch: cursor/refactor-welle-3-iv-a-big-forms-<suffix>

Vor dem Start: pnpm install --frozen-lockfile
Vor jedem Push: pnpm test --run tests/unit/settings/ && pnpm lint
Build/Test-Verifikation: User macht das LOKAL via
bash scripts/welle-pre-merge-check.sh — Agent ruft pnpm build
nur dann auf, wenn ein konkreter Verdacht vorliegt.

PR als Draft. Smoke-Test-Plan im PR-Body (max 10 Klicks).
1 PR fuer die gesamte Sub-Welle (mehrere Commits, max 1.000z diff pro Commit).
Antworte auf Deutsch.
```

---

## Kosten-Schätzung

| Szenario | Geschätzte Kosten |
|---|---|
| Mit Empfehlungen (Sonnet, neuer Agent pro Sub-Welle, lokal bauen) | ~5–8 USD pro Sub-Welle |
| Status-quo (Opus + Cloud-Build + Resume) | ~25–40 USD pro Sub-Welle |
| Spar-Faktor | ~4–5x |

Empfehlung: **claude-sonnet, thinking-medium** für 3-IV-a und 3-IV-b
(Modul-Splits mit klarem Vorbild aus Welle 3-II-a). Für Architektur-
Entscheidungen (falls unerwartete Konflikte) auf **claude-opus** eskalieren.
