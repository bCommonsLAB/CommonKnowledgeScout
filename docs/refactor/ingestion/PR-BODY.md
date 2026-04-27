## Welle 3 — Modul `ingestion`

Vierte Anwendung der 8-Schritte-Methodik aus
[`docs/refactor/playbook.md`](docs/refactor/playbook.md). Erstmals
mit dem **IDE-Agent** statt Cloud-Agent durchgeführt
(auf User-Wunsch, interaktiv).

### Was hier drin ist

- ✅ Drei pure Helper aus `image-processor.ts` extrahiert in neue Datei
  `src/lib/ingestion/image-processor-helpers.ts` (`getImageCacheKey`,
  `normalizeImagePath`, `formatImageError`).
- ✅ **Erste Tests des Moduls überhaupt**: 83 Char-Tests in 7 neuen
  Test-Files (`page-split`, `metadata-formatter`,
  `document-text-builder`, `meta-document-builder`, `vector-builder`,
  `image-processor`, `image-processor-helpers`).
- ✅ Modul-spezifische Contract-Rule
  `.cursor/rules/ingestion-contracts.mdc` (7 Sektionen).
- ✅ Welle-3-Doku unter `docs/refactor/ingestion/` (8 Files: Inventur,
  Audit, Contracts, Tests, Altlast-Pass, User-Test-Plan, Dead-Code,
  Acceptance, AGENT-BRIEF).

### Tests & Health

- `pnpm test` → **594 / 594 grün** (+83 vs. master)
- `pnpm lint` → 0 neue Errors
- `pnpm health` für `ingestion`:
  - Files 7 → 8 (+1 Helper-File)
  - Max-Zeilen `image-processor.ts`: 858 → **832** (−26)
  - any 0, leere Catches 0, 'use client' 0

### DoD (aus AGENT-BRIEF.md)

| Kriterium | Ziel | Erreicht | Status |
|---|---|---|:---:|
| Tests | +15-25 | **+83** | ✅ überfüllt |
| `any` | 0 | 0 | ✅ |
| Empty `catch{}` | 0 | 0 | ✅ |
| Max-Zeilen | < 600 | **832** (−26) | 🟡 Soft-Miss |
| Files > 200 | ≤ 1 | 1 | ✅ |

**Soft-Miss-Begründung**: Voller Split von `image-processor.ts` in
`markdown.ts`/`slides.ts`/`cover.ts` braucht eigenen Mock-Setup für
`AzureStorageService` und ist als **Folge-PR** geplant.

### Watchpoints für Folge-PRs

- Doppelter `VectorDocument`-Typ (`vector-builder.ts` ↔
  `vector-repo.ts`) → Cross-Module-Konsolidierung.
- Marker-Regex-Duplikat (`page-split.ts` ↔
  `markdown-page-splitter.ts`) → Markdown-Welle.
- Voller `image-processor.ts`-Split → eigener PR mit Mocks.

Details:
[`docs/refactor/ingestion/06-deadcode.md`](docs/refactor/ingestion/06-deadcode.md),
[`docs/refactor/ingestion/06-acceptance.md`](docs/refactor/ingestion/06-acceptance.md).

### User-Verifikation

Vor diesem PR lokal getestet (Phase A/B/C aus
[`docs/refactor/ingestion/05-user-test-plan.md`](docs/refactor/ingestion/05-user-test-plan.md)),
alles grün laut User-Feedback ("habe alles getestet — scheint alles
grün").

### Workflow-Compliance

- R1 — kein direkter Push auf `master` (Branch `refactor/ingestion-welle-3`)
- R2 — 1 Agent (IDE-Agent), seriell
- R3 — User-Verifikation **bestätigt**
- R4 — `[skip ci]` für Doku-only-Commits (5 von 8)
- R5 — Methodik-DoD + Modul-DoD getrennt dokumentiert in `06-acceptance.md`

### Lessons Learned (Auszug)

- IDE-Agent funktioniert für kompakte Module (≤ 10 Files, ≤ ~3.000 LoC).
- PowerShell `Set-Content -NoNewline` zerstört CRLF auf Windows —
  künftig `StrReplace`-Tool nutzen.
- Health-Skript (`text.split('\n').length`) und `Measure-Object -Line`
  liefern unterschiedliche Zahlen → künftig nur Skript-Methode für
  Welle-Reports.
