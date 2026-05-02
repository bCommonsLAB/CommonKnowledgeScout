# Cloud-Agent-Kostenoptimierung — Strategie und Hand-off-Templates

**Stand**: 2026-05-02
**Verbindliche Rule**: `.cursor/rules/cloud-agent-cost-strategy.mdc`

## Hintergrund

Eine einzige Refactoring-Session ueber 5 Wellen (3-II + 3-II-Hooks +
3-III-Vorbereitung + 3-III-a + Naming-PR) im Cursor-Cloud-Dashboard
hat **Hunderte USD** gekostet. Diese Doku haelt die Massnahmen zur
Kostenreduktion auf **~1/4** fest und liefert direkt anwendbare
Hand-off-Templates.

## Vier-Hebel-Strategie

| # | Massnahme | Ersparnis | Wer macht es |
|---|---|---:|---|
| 1 | Sonnet statt Opus fuer mechanische Tasks | -50% | User waehlt Modell beim Cloud-Start |
| 2 | Neuer Agent pro Sub-Welle (kein Resume) | -40% | User startet neuen Agent mit Hand-off-Prompt |
| 3 | `pnpm test/lint/build` lokal vor Merge | -15% | User fuehrt `welle-pre-merge-check.sh` aus |
| 4 | Tool-Call-Disziplin (Grep, Read+offset/limit) | -10% | Agent (in Rule kodifiziert) |

**Kombiniert**: Verbleibend ca. **22% der Originalkosten** = 1/4.

## Hebel 1: Modellwahl

| Welle-Typ | Modell | Thinking |
|---|---|---|
| Audit + Inventur (Doku) | claude-sonnet | medium |
| Char-Tests schreiben (Pattern-Replikation) | claude-sonnet | medium |
| Pure-Helper / Hook-Extract | claude-sonnet | medium |
| Kleinerer Modul-Split (1 Hauptdatei, klares Vorbild) | claude-sonnet | medium |
| Grosser Modul-Split (>1 Hauptdatei, Cross-File-Edits) | claude-opus | medium |
| Architektur-Entscheidung mit Trade-offs | claude-opus | high |
| Latenter-Bug-Analyse / Hypothesen | claude-opus | high |
| **Verboten ohne Begruendung** | thinking-xhigh | – |
| **Verboten** | opus fuer reine Doku-Tasks | – |

## Hebel 2: Neuer Agent pro Sub-Welle

### Default

Pro Sub-Welle einen **neuen Cloud-Agent** im Cursor-Dashboard starten.

### Hand-off-Prompt-Template (kopieren in den neuen Cloud-Agent)

```
Lies VOR dem Start (in dieser Reihenfolge):

1. AGENTS.md
2. .cursor/rules/cloud-agent-cost-strategy.mdc
3. .cursor/rules/refactor-batch-strategy.mdc
4. .cursor/rules/refactor-naming-konvention.mdc
5. .cursor/rules/welle-<MODUL>-contracts.mdc
6. docs/refactor/<MODUL>/AGENT-BRIEF.md (Sektion "<SUB-WELLE>")
7. docs/refactor/<MODUL>/04-altlast-pass.md (Hot-Spot-Liste)
8. docs/refactor/<MODUL>/06-acceptance-<VOR-WELLE>.md (Vorgaenger-Bilanz)

Aufgabe: <KONKRETE SUB-WELLE IN EINEM SATZ>

Branch: cursor/refactor-welle-<SUB>-<SUFFIX>

Strategie:
- 1 PR pro Sub-Welle (siehe refactor-batch-strategy.mdc)
- max 1.000 Zeilen Diff pro Commit (hart)
- max 5.000 Zeilen Brutto-Diff pro PR (weich)
- max 15 Commits pro PR (weich)

Verifikation:
- Pro Commit: pnpm test --run <relevante-paths>
- Vor Push: pnpm test + pnpm lint (lokal im Agent)
- pnpm build NICHT im Agent — User macht das LOKAL via
  `bash scripts/welle-pre-merge-check.sh` vor dem Merge

PR als Draft mit Smoke-Test-Plan (max 10 Klicks).
Antworte auf Deutsch.

Am Ende der Welle: liefere im PR-Body und in der Antwort den
Hand-off-Block fuer die naechste Welle (Format siehe
.cursor/rules/cloud-agent-cost-strategy.mdc R1).
```

### Wann Resume statt neuer Agent

Resume ist erlaubt bei:
- **Hotfix derselben Welle** (z.B. Build-Fehler nach Push)
- **Sub-Welle 2 baut auf In-Memory-Erkenntnis** der Sub-Welle 1
- **Sehr kurze Welle** (<500z Brutto-Diff erwartet)

Sonst: NEUER Agent.

## Hebel 3: Lokale Verifikation

Statt im Cloud-Agent `pnpm test/lint/build` zu machen (~3-5 USD pro
Lauf), faehrt der User lokal:

```bash
bash scripts/welle-pre-merge-check.sh
```

Das Script:
1. `pnpm test --run` (Vitest)
2. `pnpm lint` (next lint)
3. `pnpm build` (next build, ~75s)

Optionen:
```bash
# Build ueberspringen (nur test+lint)
bash scripts/welle-pre-merge-check.sh --skip-build

# Nur einen Schritt
bash scripts/welle-pre-merge-check.sh --only=test
bash scripts/welle-pre-merge-check.sh --only=lint
bash scripts/welle-pre-merge-check.sh --only=build
```

### Workflow

1. Cloud-Agent macht die Welle, pusht den Branch und oeffnet PR (Draft).
2. **User** clont/pullt lokal.
3. **User** fuehrt `bash scripts/welle-pre-merge-check.sh` aus.
4. Bei rot: User postet Befund in PR-Comment, startet neuen Agent oder
   resumed.
5. Bei gruen: User mergt PR.
6. **User** startet **neuen** Cloud-Agent mit dem Hand-off-Prompt-
   Block aus dem PR-Body.

## Hebel 4: Tool-Call-Disziplin

Diese Regeln stehen in `cloud-agent-cost-strategy.mdc` R5 und werden
dort vom Agent eingehalten:

- `Grep` statt `Read` fuer Suche
- `Read` mit `offset`/`limit` bei Files > 500z
- Mehrere unabhaengige Tool-Calls in einem Message-Batch
- Keine `Read`-Wiederholungen ohne Code-Aenderung

## Hand-off-Block-Template (am Ende jeder Welle-PR)

Jede Welle-PR endet mit diesem Block. Der Agent fuellt die Platzhalter
(<...>) aus dem aktuellen Kontext:

```markdown
## Hand-off fuer die naechste Welle

### Lokale Verifikation (DURCH USER, vor Merge)

```bash
bash scripts/welle-pre-merge-check.sh
```

Erwartung: alles gruen. Falls rot: Befund im PR-Comment, Agent
fixed nach (eigener Hotfix-Resume erlaubt).

### Naechste Welle: <NAME>

- **Branch (geplant)**: cursor/refactor-welle-<NAME>-a03a
- **Empfohlenes Modell**: claude-sonnet, thinking-medium
  (Begruendung: <z.B. "Pattern-Replikation aus Welle 3-III-a, kein
  Architektur-Risiko">)
- **Empfohlener Agent-Typ**: NEUER Agent (kein Resume) — siehe
  cloud-agent-cost-strategy.mdc R3
- **AGENT-BRIEF lesen**: docs/refactor/<MODUL>/AGENT-BRIEF.md
  Sektion "<SUB-WELLE>"
- **Erwartete Bilanz**: ca. -<N>z Hauptdatei, +<M> Sub-Module
- **Erwarteter Brutto-Diff**: ~<X>z

### Konkreter Start-Prompt fuer den naechsten Agent

```
<DER PROMPT AUS DEM TEMPLATE OBEN, MIT KONKRETEN <MODUL>/<SUB-WELLE>
WERTEN AUSGEFUELLT>
```

### Geschaetzte Kosten der naechsten Welle

- Mit DIESEN Empfehlungen (Sonnet + neuer Agent + lokal bauen):
  ca. <X> USD
- Mit Status-quo-Pattern (Opus + Cloud-Build + Resume):
  ca. <Y> USD
- Spar-Faktor: <Z>x
```

## Beispiel: Hand-off fuer Welle 3-III-b (Chat) nach Merge von 3-III-a

```markdown
## Hand-off fuer die naechste Welle

### Lokale Verifikation (DURCH USER, vor Merge)

```bash
bash scripts/welle-pre-merge-check.sh
```

### Naechste Welle: 3-III-b (Chat)

- **Branch (geplant)**: cursor/refactor-welle-3-iii-b-chat-a03a
- **Empfohlenes Modell**: claude-sonnet, thinking-medium
  (Begruendung: Pattern-Replikation aus 3-III-a — chat-panel Modul-Split
  analog zu document-card; chat-Service-Layer ist bereits gut
  abstrahiert via chat-contracts.mdc; keine offenen Architektur-Fragen)
- **Empfohlener Agent-Typ**: NEUER Agent
- **AGENT-BRIEF lesen**: docs/refactor/welle-3-iii-galerie-chat/AGENT-BRIEF.md
  Sektion "3-III-b"
- **Erwartete Bilanz**:
  - chat-panel.tsx: 1.268 → ~250z (-80%)
  - chat-reference-list.tsx: 527 → ~200z
  - use-chat-stream.ts: 492z (Reducer extrahiert)
  - 12 Comment-only-Catches gefixt
- **Erwarteter Brutto-Diff**: ~3.500-4.500z

### Konkreter Start-Prompt fuer den naechsten Agent

```
Lies VOR dem Start (in dieser Reihenfolge):
1. AGENTS.md
2. .cursor/rules/cloud-agent-cost-strategy.mdc
3. .cursor/rules/refactor-batch-strategy.mdc
4. .cursor/rules/welle-3-iii-galerie-chat-contracts.mdc
5. .cursor/rules/chat-contracts.mdc (Backend-Contracts, UI ist Konsument)
6. docs/refactor/welle-3-iii-galerie-chat/AGENT-BRIEF.md (Sektion "3-III-b")
7. docs/refactor/welle-3-iii-galerie-chat/04-altlast-pass.md (Hot-Spot-Liste)
8. docs/refactor/welle-3-iii-galerie-chat/06-acceptance-3-iii-a.md
   (Vorgaenger-Bilanz, Pattern-Vorbild)

Aufgabe: chat-panel.tsx (1.268z, 36 Hooks!) Modul-Split + chat-reference-list
+ use-chat-stream Reducer-Extraktion + 12 Comment-only-Catches fixen.

Branch: cursor/refactor-welle-3-iii-b-chat-a03a

Strategie: 1 PR mit ~10-14 kohaerenten Commits.

Vor jedem Push: pnpm test + pnpm lint.
pnpm build wird NICHT im Agent ausgefuehrt — User macht das lokal.

PR als Draft mit Smoke-Test-Plan.
Antworte auf Deutsch.

Am Ende: Hand-off-Block fuer Welle 3-III-c liefern.
```

### Geschaetzte Kosten

- Mit DIESEN Empfehlungen: ca. 6-10 USD
- Mit Status-quo (Opus + Cloud-Build + Resume): ca. 30-50 USD
- Spar-Faktor: ca. 4-5x
```

## Verweise

- Verbindliche Rule: `.cursor/rules/cloud-agent-cost-strategy.mdc`
- Pre-Merge-Script: `scripts/welle-pre-merge-check.sh`
- Methodik: `.cursor/rules/refactor-batch-strategy.mdc`
- Naming-Konvention: `.cursor/rules/refactor-naming-konvention.mdc`
- AGENTS.md (Pflicht-Block am Welle-Ende)
