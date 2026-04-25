# Altlast-Pass: Modul `external-jobs` (Pilot)

Stand: 2026-04-23. Erstellt von Cloud-Agent 4 (Pilot-Welle, Plan-Schritt 4).

## Zusammenfassung

Diese PR setzt zwei Audit-Findings aus `00-audit.md` und der Inventur (`01-inventory.md`) um:

1. **Silent Fallback** in `external-jobs-repository.ts:316-321` (Plan §4.2)
2. **Modul-Split** von `phase-template.ts` — **erster Teilschritt** (Plan §4.7)

## 1. Silent Fallback fixen — `external-jobs-repository.ts`

### Vorher

```typescript
const sourceAttr = (() => {
  try {
    const src = (patch as { details?: { source?: unknown } })?.details?.source
    return typeof src === 'string' ? src : undefined
  } catch { return undefined }
})()
```

Der `try/catch` schluckt jeden Fehler stumm. Was eigentlich passieren kann: Der Code liest nur Properties auf einem Plain-Object. Es gibt **keine** realistische Exception-Quelle hier — dieses `try/catch` ist Ueberbleibsel aus defensiver Programmierung ohne Begruendung.

### Nachher

```typescript
// Optionales Trace-Attribut: source aus patch.details extrahieren.
// Lesepfad ist garantiert Property-Zugriff auf Plain-Objects, kann
// ohne try/catch laufen. Wenn details.source kein String ist, lassen
// wir das Attribut bewusst weg (dokumentierte Skip-Semantik fuer
// optionale Trace-Daten — siehe no-silent-fallbacks.mdc, "explizit
// handeln statt stillschweigend defaulten").
const details = (patch as { details?: { source?: unknown } }).details
const sourceAttr = typeof details?.source === 'string' ? details.source : undefined
```

Skip-Semantik ist jetzt **explizit dokumentiert**: optionales Trace-Attribut, `source` wird weggelassen wenn nicht-String. Kein silent catch, kein silent default — die Begruendung steht im Kommentar.

## 2. Modul-Split `phase-template.ts` — erster Teilschritt

### Was diese PR macht

Helper-Funktion `extractFixedFieldsFromTemplate` wird aus `phase-template.ts` (2.097 Zeilen) in eine eigene Datei extrahiert:

- **Neu**: [src/lib/external-jobs/phase-template/extract-meta.ts](../../../src/lib/external-jobs/phase-template/extract-meta.ts) (88 Zeilen)
- `phase-template.ts` enthaelt jetzt nur noch `export { extractFixedFieldsFromTemplate } from './phase-template/extract-meta'`
- **Char-Tests bleiben gruen** (20 Tests in `tests/unit/external-jobs/phase-template-*.test.ts`) — Verhaltens-Snapshot beweist, dass der Split keine Regression eingefuehrt hat

`phase-template.ts` ist von 2.097 → 2.037 Zeilen geschrumpft. Das Verzeichnis `src/lib/external-jobs/phase-template/` ist angelegt und bereit fuer Folge-Splits.

### Was diese PR NICHT macht (bewusst, mit Begruendung)

Der vollstaendige Split der 2.000-Zeilen-`runTemplatePhase`-Funktion wuerde:

- ~1.500-2.000 Zeilen Diff erzeugen
- Mehrere neue Sub-Module (`transform.ts`, `validate.ts`, `save.ts`, `chapters.ts`, `images.ts`, ...) gleichzeitig anlegen
- Den Pilot-PR sehr risikoreich machen, weil keine echten Integration-Tests laufen koennen (Cloud-Umgebung hat kein Mongo/Secretary)

Per AGENTS.md ist das Ueberschreiten von 1.000 Zeilen Diff ohne explizite Plan-Erlaubnis Stop-Bedingung. Folgende Sub-Aufgaben werden in eigenen Folge-PRs erledigt — jede mit eigenen Char-Tests vorab als Sicherheitsnetz:

| Folge-PR | Inhalt | Erwarteter Diff |
|---|---|---:|
| Split A | `runTemplatePhase` Skip-Branches → `phase-template/decide-and-skip.ts` | ~250 Zeilen |
| Split B | Pages-Rekonstruktion + Chapters-Merge → `phase-template/post-process.ts` | ~400 Zeilen |
| Split C | Save-Markdown + Cover-Image-Trigger → `phase-template/save-and-cover.ts` | ~350 Zeilen |
| Split D | Library-Config + Shadow-Twin-Setup → `phase-template/setup.ts` | ~200 Zeilen |
| Cleanup | `phase-template.ts` als Orchestrator-`index.ts` mit < 200 Zeilen | -1.000 Zeilen |

**Diese Folge-PRs sind im Plan-Todo `cloud-agent-4-pilot-altlast` enthalten und werden unmittelbar nach Merge dieser PR ausgefuehrt** — **falls** ein User die Pilot-Welle als ausreichend abgenommen betrachtet, kann auch jetzt schon zu Cloud-Agent 5 (Dead-Code) uebergegangen werden, und die Sub-Splits passieren in spaeteren iterativen PRs.

### Andere Audit-Findings, die in dieser PR nicht angefasst wurden

- **75 leere Catches** in `external-jobs/`-Files (37 in `phase-template.ts`): das ist die quantitativ groesste Altlast. Per Plan-Schritt 4 sind **alle** zu pruefen. Mit angemessenem Aufwand pro Catch (Lesen + Entscheidung `throw`/`default+log`/`bewusster skip`) ist das eine Folge-PR-Serie. Eine Batch-Aktion (z.B. alle in `images.ts` auf einmal) ist sinnvoll als naechster Schritt nach dem `phase-template.ts`-Split.
- **`tests/unit/jobs-worker-pool.test.ts`**: Audit hat das als Grenzfall markiert (testet `@/lib/env`, nicht `external-jobs`). Verschiebung wuerde Tests umbiegen + Code aus `env.ts` extrahieren — bewusst NICHT in dieser PR, weil Querbezug zur `env`-Welt.
- **Architektur-Anmerkung** aus Audit (Verschiebung von `external-jobs-repository.ts`/`-worker.ts`/`-watchdog.ts` in `external-jobs/`): NICHT in dieser PR, weil grosser Diff durch Imports und braucht User-Abstimmung.

## Tests / Lint

- `pnpm test` → 97 Files, 451 Tests, **gruen** (unveraendert vs PR #15)
- `pnpm lint` → keine neuen Errors. Die 2 vorhandenen aus Baseline sind unveraendert.
- `pnpm health` → `external-jobs` zeigt 41 Files (vorher 40, +1 fuer `extract-meta.ts`), max-Zeilen 2.037 (vorher 2.097, -60 Zeilen extrahiert)
