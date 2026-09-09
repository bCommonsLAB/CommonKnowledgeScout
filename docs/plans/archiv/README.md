# Archivierte Pläne

Pläne, deren Inhalt im Code umgesetzt ist oder die gegenstandslos geworden sind.
**Nicht gelöscht, sondern aufbewahrt** — sie dokumentieren, warum etwas so gebaut
wurde, und mehrere Zielbilder unter `docs/architecture/` verweisen auf sie.

Aktive Pläne liegen eine Ebene höher in [`docs/plans/`](../).

## Warum diese Pläne als erledigt gelten

Die `status:`-Marker in den Plan-Dateien wurden nicht gepflegt und sind
**unzuverlässig** — viele stehen auf `pending`, obwohl der Code existiert.
Maßgeblich war deshalb die Code-Evidenz (Stand 2026-08-26):

| Plan | Beleg im Code |
|---|---|
| `artefakt-pipeline_v3` | alle 6 Todos auf `completed`; Secretary ist Extract/Transform-Backend |
| `composite-multi-image` | `src/lib/creation/composite-multi.ts`, `api/library/[libraryId]/composite-multi` |
| `composite-transformations_sammeldatei` | `api/library/[libraryId]/composite-transformations` |
| `diva-texture-liefersystem-integration` | `src/lib/diva-texture/preprocess-folder.ts`, `api/diva-texture/supplier-data` |
| `massnahmen-bewertung-und-graph` | `src/lib/graph/` (doc-neighbors, similarity-persist), `api/.../doc-relations` |
| `p-32874b76` (Pinecone-Doc-Status-Cache) | **gegenstandslos** — Pinecone kommt im Code nicht mehr vor (MongoDB Atlas Vector Search) |
| `pdf-split-pages-images` | `api/library/[libraryId]/pdf/split-pages-to-images` |
| `quell-favoriten_und_kommentare` | 14/15 Todos `completed`; `api/library/[libraryId]/source-comments` |
| `saveditemid_contract_&_tests` | `savedItemId` in `src/types/external-job.ts` u. a. |
| `shadowtwin_zentralisierung+ids` | `api/library/[libraryId]/shadow-twin-mode` |
| `v2-only_shadow-twin_(mit_dry-run)` | Rumpf-Datei (10 Zeilen); v2-Modus ist umgesetzt |
| `summen-und-synergie-aggregation` (archiviert 2026-09-09) | Stufen 1–3 gebaut: `src/lib/gallery/synergy-sum.ts` (Plan schrieb `lib/graph/`), `table-sums-footer.tsx`, `graph-sums-panel.tsx`, `overlap-report-dialog.tsx`, `external-jobs/overlap-report-*`. **Rest** (Stufe 3d, LLM-bereinigte Summe als dritte Zahl in Fußzeile und Panel) steht im Vorrat von `docs/STAND.md` |
| `refactor-strategie-drift-eliminieren` (archiviert 2026-09-09) | 13 von 16 im Code: `AGENTS.md`, Playbook, `scripts/module-health.mjs`, Wellen 1–3-IV durch. **Rest**: Backend-Cleanup-Folgewelle (2026-04-28 bewusst übersprungen), Welle 3-VI (reserviert für Vorhaben SHF); beides im Vorrat von `docs/STAND.md` |
| `mcp-storage-abstraktion` (archiviert 2026-09-09) | ST1–ST4 gebaut: `packages/contracts/src/storage-versioning.ts`, `src/lib/mcp/storage/**` (19 Dateien), Schreibschutz auf `_INDEX.md`/Twin-Ordnern. **Rest**: Coverage-Nachführung nach Ordner-Umzug, Job-Modus für lange Scans (Q7); im Vorrat von `docs/STAND.md` |

## Ebenfalls hier: vier alte Aufgabenlisten

`prio1-state-caching-navigation.md`, `prio2-logging-errorhandling.md`,
`prio3-init-grundfunktion.md` und `reorganizing-components.md` lagen als Regeln
unter `.cursor/rules/`, sind aber **Backlogs aus einer früheren
Refactoring-Phase** („Zu überarbeiten: …") — keine Contracts. Sie hatten weder
Beschreibung noch Geltungsbereich und haben in keinem Werkzeug je ausgelöst.
