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

## Ebenfalls hier: vier alte Aufgabenlisten

`prio1-state-caching-navigation.md`, `prio2-logging-errorhandling.md`,
`prio3-init-grundfunktion.md` und `reorganizing-components.md` lagen als Regeln
unter `.cursor/rules/`, sind aber **Backlogs aus einer früheren
Refactoring-Phase** („Zu überarbeiten: …") — keine Contracts. Sie hatten weder
Beschreibung noch Geltungsbereich und haben in keinem Werkzeug je ausgelöst.
