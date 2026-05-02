# Acceptance: Welle 3-III-c — Story + Perspective (Modul-Split)

**Branch**: `cursor/refactor-welle-3-iii-c-story-perspective-1b06`
**Stand**: 2026-05-02
**PR**: [folgt nach Push]

## Inhalt

Dritte und letzte Sub-Welle von Welle 3-III. Fokus: Modul-Split von
`shared/perspective-page-content.tsx` (926z, 13 Hooks) und
`story/story-topics.tsx` (394z). Die kleinen Dateien `story-header.tsx`
(94z) und `story-mode-header.tsx` (83z) wurden bewusst NICHT gesplittet —
sie sind bereits unter 200 Zeilen und wuerden durch einen Split nicht
profitieren.

## Volumen-Statistik

| Datei/Modul | Vorher | Nachher | Differenz |
|---|---:|---:|---:|
| `perspective-page-content.tsx` | 926 | 19 (Shim) | -907 |
| `story-topics.tsx` | 394 | 17 (Shim) | -377 |
| Neue Sub-Module | 0 | **8** | +8 neue Files |
| Neue Test-Files | 0 | **3** | +3 |
| Neue Test-Cases | 0 | **16** | +16 |

**Brutto-Diff**: ~1108 Zeilen Additions + ~1308 Deletions = gesamt ca. 2416 Zeilen — unter 5.000-Limit.

## Commits (5)

| # | Commit | Inhalt | Brutto-Diff |
|---|---|---|---:|
| 1 | Char-Tests | perspective-page-content, perspective-display, story-topics | ~180 |
| 2 | Helper + Hook | `helpers.ts` + `hooks/use-perspective-data.ts` | ~417 |
| 3 | Sub-Komponenten | `header.tsx` + `body.tsx` + `index.tsx` | ~691 |
| 4 | Shims + story-topics/ | Shim-Dateien + story-topics-Modul-Split | ~461 (+/-1308) |
| 5 | Cleanup | Überflüssige Props + Größen-Kommentar | ~9 |

## Neue Modul-Struktur

```
src/components/library/shared/
  perspective-page-content.tsx            # Shim (Re-Export) — 19z
  perspective-page-content/
    index.tsx                             # Composer (148z)
    header.tsx                            # Sticky-Nav + Page-Header + Info-Banner (128z)
    body.tsx                              # 5 Auswahl-Cards + CTA (415z, begründet > 350)
    helpers.ts                            # Pure-Helper: localeToTargetLanguage, mapLlmModels, filterModelsByLanguage (111z)
    hooks/
      use-perspective-data.ts             # Zentraler Daten-Hook (State, LLM-Laden, Handler) (306z)

src/components/library/story/
  story-topics.tsx                        # Shim (Re-Export) — 17z
  story-topics/
    index.tsx                             # Composer (345z)
    topic-list.tsx                        # Accordion-Liste aller Topics (41z)
    topic-card.tsx                        # Einzelnes Topic mit Fragen-Buttons (49z)
```

## Abweichungen vom AGENT-BRIEF

- `story-header.tsx` (94z) und `story-mode-header.tsx` (83z) wurden
  **NICHT gesplittet**: beide Dateien sind weit unter 200 Zeilen und
  haben 2 bzw. 3 Hooks. Ein Split würde keinen Mehrwert bringen.
- `perspective-display.tsx` (275z) wurde **NICHT gesplittet**: die Datei
  enthält nur 2 Hooks und ist ein einfacher Render-Helper. Keine
  Massnahme nötig.

## Methodik-DoD

| Kriterium | Status |
|---|---|
| 1 PR pro Welle | OK |
| Char-Tests VOR Code-Aenderungen | OK (Commit 1) |
| `pnpm test` gruen | OK (1271/1271) |
| `pnpm lint` gruen | OK (keine neuen Warnings/Errors) |
| < 1.000 Zeilen Diff pro Commit | OK (max ~691z fuer Commit 3) |
| < 5.000 Zeilen Brutto pro PR | OK (~2416z) |
| Cleanup im selben PR | OK (Commit 5) |
| Keine neuen `any`, keine neuen `catch{}` | OK |
| Composer-Fassade vorhanden | OK (index.tsx + Shim-Dateien) |
| Storage-Branches-Verifikation | OK (0 Verstoesse) |
| Konsumenten-Imports unveraendert | OK (alle Shims vorhanden) |

## Modul-DoD

| Kriterium | Status |
|---|---|
| perspective-page-content.tsx Shim vorhanden | OK |
| perspective-page-content/index.tsx Composer | OK |
| perspective-page-content/helpers.ts Pure-Helper | OK |
| perspective-page-content/hooks/use-perspective-data.ts | OK |
| story-topics.tsx Shim vorhanden | OK |
| story-topics/index.tsx Composer | OK |
| story-topics/topic-list.tsx Sub-Komponente | OK |
| story-topics/topic-card.tsx Sub-Komponente | OK |
| Alle Comment-only-Catches in perspective-page-content bereinigt | OK (kein Catch vorhanden) |

## Altlast-Pass (Sub-Welle 3-III-c)

Keine Comment-only-Catches oder Silent-Fallbacks in `perspective-page-content.tsx`,
`story-topics.tsx`, `story-header.tsx` oder `story-mode-header.tsx` vorhanden.

Einziger Catch in `usePerspectiveData`: explizites `console.warn` mit Begruendung
(Netzwerk-/Parse-Fehler beim Laden der LLM-Modelle).

## Smoke-Test fuer User

5 Klicks zur Verifikation:

1. **Perspective-Seite öffnen** — `/library/gallery/perspective?libraryId=...` oder `/explore/[slug]/perspective`
   - Erwartung: Seite laedt, Sprach-/Modell-/Character-Auswahl sichtbar
2. **Sprache aendern** — Eine andere Sprache im ersten Select waehlen
   - Erwartung: Warnhinweis bei eingeschraenkter Sprachunterstuetzung erscheint, Modell wird ggf. automatisch umgeschaltet
3. **Interessenprofil waehlen** — Bis zu 5 Badges auswaehlen
   - Erwartung: Zaehler "X von 5 ausgewaehlt" erscheint, 6. Badge ist deaktiviert
4. **"Mit dieser Perspektive starten" klicken** — nachdem alle Pflichtfelder ausgefuellt sind
   - Erwartung: Navigation zurueck (onSave-Callback ausgeloest), Perspektive gespeichert
5. **Story-Mode TOC** — Story-Mode oeffnen, TOC laedt
   - Erwartung: StoryTopics-Accordion erscheint mit Topics und klickbaren Fragen

Wenn OK: PR mergen. Welle 3-III ist abgeschlossen.

## Verweise

- Welle 3-III Vorbereitung: `06-acceptance.md`
- Welle 3-III-a Acceptance: `06-acceptance-3-iii-a.md`
- Welle 3-III-b Acceptance: `06-acceptance-3-iii-b.md`
- AGENT-BRIEF Sub-Welle 3-III-c: `AGENT-BRIEF.md` Sektion "3-III-c"
- Methodik: `.cursor/rules/refactor-batch-strategy.mdc`
- Welle 3-III Contracts: `.cursor/rules/welle-3-iii-galerie-chat-contracts.mdc`

## Hand-off fuer die naechste Welle

### Lokale Verifikation (DURCH USER ausfuehren, vor Merge)

```bash
bash scripts/welle-pre-merge-check.sh
```

Erwartung: alles gruen. Falls rot: Befund im PR-Comment, Agent fixed nach.

### Naechste Welle: 3-IV (Settings)

- **Status**: offen (Plan, noch nicht begonnen)
- **Empfohlenes Modell**: claude-sonnet, thinking-medium
  (Begruendung: Settings-Refactoring ist strukturell aehnlich zu 3-III,
  kein Cross-File-Architektur-Problem erwartet)
- **Empfohlener Agent-Typ**: NEUER Agent (Cache-Kosten-Strategie R3)
- **AGENT-BRIEF**: noch nicht erstellt — Audit-Phase (Schritt 0) muss
  zuerst durch einen Vorbereitungs-Cloud-Lauf abgearbeitet werden.

### Konkreter Start-Prompt fuer den naechsten Agent (Welle 3-IV Vorbereitung)

```
Lies VOR dem Start (in dieser Reihenfolge):
1. AGENTS.md
2. .cursor/rules/cloud-agent-cost-strategy.mdc
3. .cursor/rules/refactor-batch-strategy.mdc
4. .cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md (Sektion "Welle 3-IV")

Aufgabe: Vorbereitung fuer Welle 3-IV (Settings).
- Audit-File anlegen: docs/refactor/welle-3-iv-settings/00-audit.md
- Inventur-File anlegen: docs/refactor/welle-3-iv-settings/01-inventory.md
- Hot-Spot-Liste: docs/refactor/welle-3-iv-settings/04-altlast-pass.md
- AGENT-BRIEF anlegen: docs/refactor/welle-3-iv-settings/AGENT-BRIEF.md

Branch: cursor/refactor-welle-3-iv-vorbereitung-1b06

Vor dem Start: pnpm install --frozen-lockfile
Vor jedem Push: pnpm test + pnpm lint
pnpm build wird NICHT im Agent ausgefuehrt.

PR als Draft. Smoke-Test-Plan im PR-Body.
Antworte auf Deutsch.
```

### Geschaetzte Kosten der naechsten Welle (Vorbereitung)

- Mit diesen Empfehlungen (Sonnet + neuer Agent): ca. 2-5 USD
- Mit Status-quo-Pattern (Opus + Resume + Cloud-Build): ca. 15-30 USD
- Spar-Faktor: ~5x
