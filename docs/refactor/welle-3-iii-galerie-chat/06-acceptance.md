# Acceptance: Welle 3-III — Vorbereitung

**Branch**: `cursor/refactor-welle-3-iii-vorbereitung-a03a`
**Stand**: 2026-05-02
**PR**: (folgt nach Push)

## Inhalt der Vorbereitungs-PR

Reine Doku/Char-Tests/Contracts. **Kein Production-Code wird angefasst.**

| Schritt | Inhalt | Neuer File / Aenderung | Brutto-Diff |
|---|---|---|---:|
| 0 | Bestands-Audit | `00-audit.md` | ~250 |
| 1 | Inventur (Stats-Skript + Tabelle) | `01-inventory.md` + `scripts/ui-welle-3iii-stats.mjs` | ~400 |
| 2 | Contracts neu | `.cursor/rules/welle-3-iii-galerie-chat-contracts.mdc` + `02-contracts.md` | ~300 |
| 3 | Char-Tests (6 Files, 48 Test-Cases) | `tests/unit/components/library/chat/*.{ts,tsx}` (3 Files) + `tests/unit/components/library/gallery/*.tsx` (2 Files) + `tests/unit/components/library/file-category-filter.test.tsx` | ~580 |
| 4 | Altlast-Pass-Backlog | `04-altlast-pass.md` | ~150 |
| 5 | User-Test-Plan | `05-user-test-plan.md` | ~150 |
| 6 | AGENT-BRIEF + README | `AGENT-BRIEF.md` + `README.md` | ~400 |
| 7 | Acceptance-Doc + Naming-Konvention update | `06-acceptance.md` (folgt) + `.cursor/rules/refactor-naming-konvention.mdc` (Update Welle 3-III auf "in Arbeit") | ~150 |

**Brutto-Diff Gesamt**: ~2.380 Zeilen — gut unter 5.000-Limit, da
**KEIN Code-Refactor** in dieser PR.

## Volumen-Statistik (Verifikation der Welle)

| Metrik | Wert |
|---|---:|
| Files in Welle 3-III | 65 |
| Gesamt-Zeilen | 15.055 |
| Files > 200 Zeilen | 27 (42%) |
| Max-Zeilen | 1.268 (`chat-panel.tsx`) |
| Hooks gesamt | 286 |
| Max-Hooks | 49 (`gallery-root.tsx`) |
| Leere Catches | **0** |
| Storage-Branches | **0** |
| `any` | **0** |
| Existierende Tests | 0 (vor dieser PR) |
| Neue Char-Tests | 6 Files / **48 Test-Cases** |

## Methodik-DoD (Vorbereitungs-PR)

| Kriterium | Status |
|---|---|
| Schritt 0 (Audit) durchgefuehrt mit 3 Tabellen (Rules, Tests, Docs) | OK |
| Schritt 1 (Inventur) mit verifizierten Stats | OK (`scripts/ui-welle-3iii-stats.mjs` neu) |
| Schritt 2 (Contracts) Modul-spezifische Rule angelegt | OK (`welle-3-iii-galerie-chat-contracts.mdc`) |
| Schritt 3 (Char-Tests) >= 6 Test-Files, 30+ Test-Cases | OK (6 Files, 48 Cases) |
| Schritt 4 (Altlast-Pass) Backlog dokumentiert | OK (Backlog in `04-altlast-pass.md`) |
| Schritt 5 (Strangler-Fig) — entfaellt in Vorbereitung | n/a |
| Schritt 6 (Dead-Code) — entfaellt in Vorbereitung | n/a |
| Schritt 7 (Abnahme) — diese Doku | OK |
| AGENT-BRIEF fuer Sub-Wellen 3-III-a/b/c | OK |
| User-Test-Plan dokumentiert | OK (`05-user-test-plan.md`) |
| `pnpm test` gruen | (vor Push verifizieren) |
| `pnpm lint` gruen | (vor Push verifizieren) |
| `pnpm build` gruen | (vor Push verifizieren) |

## Modul-DoD (Vorbereitungs-PR)

| Kriterium | Status | Belege |
|---|---|---|
| 0 NEUE leere Catches | OK | kein Code-Refactor |
| 0 NEUE Storage-Branches | OK | kein Code-Refactor |
| Welle bleibt sauber bei `any` | OK | kein Code-Refactor |
| Char-Tests fixieren Verhalten kleiner Komponenten | OK | 48 Test-Cases ueber 6 Pure-Helpers + Render-Smokes |
| Sub-Wellen-Roadmap dokumentiert | OK | siehe AGENT-BRIEF |

## Naechste Schritte (Sub-Wellen)

| Sub-Welle | Branch (geplant) | Kern-Aufgabe |
|---|---|---|
| **3-III-a** Gallery | `cursor/refactor-welle-3-iii-a-gallery-...` | `gallery-root.tsx` (994z, 49 Hooks!) Modul-Split + `document-card.tsx` (639z) Render-Refactor + `virtualized-items-view.tsx` (470z) Hook-Extraktion + 3 Comment-only-Catches fixen |
| **3-III-b** Chat | `cursor/refactor-welle-3-iii-b-chat-...` | `chat-panel.tsx` (1.268z, 36 Hooks!) Modul-Split + `chat-reference-list.tsx` (527z) + `use-chat-stream.ts` (492z) Reducer extrahieren + `debug-panel.tsx` (440z) Tab-Aufsplit + ~12 Comment-only-Catches fixen |
| **3-III-c** Story+Perspective | `cursor/refactor-welle-3-iii-c-story-perspective-...` | `perspective-page-content.tsx` (926z, 13 Hooks) Modul-Split + `story-topics.tsx` (394z) Modul-Split |

R2 (1 Cloud-Agent seriell): erst 3-III-a mergen, dann 3-III-b, dann 3-III-c.

## Smoke-Test fuer User (DIESE PR)

Reine Doku/Char-Tests-Aenderung — **KEIN UI-Smoke-Test noetig**.

Verifikation:

1. `git log --oneline master..HEAD` — Commits sichtbar
2. `node scripts/ui-welle-3iii-stats.mjs` — Stats-Output
3. `pnpm test --run tests/unit/components/library/{chat,gallery}/ tests/unit/components/library/file-category-filter.test.tsx` — alle 48 neuen Tests gruen

Wenn OK: PR mergen, dann starte ich Welle 3-III-a (Gallery).

## Verweise

- Welle 3-III README: `README.md`
- AGENT-BRIEF fuer Sub-Wellen: `AGENT-BRIEF.md`
- Vorbild-Welle: `../welle-3-archiv-detail/06-acceptance.md` (Welle 3-II Vorbereitung)
- Naming-Konvention: `../../../.cursor/rules/refactor-naming-konvention.mdc`
- Methodik: `../../../.cursor/rules/refactor-batch-strategy.mdc`
