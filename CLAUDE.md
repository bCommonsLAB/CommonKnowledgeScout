# Claude Code – Projektkontext CommonKnowledgeScout

Diese Datei ist die Einstiegspunkt-Memory für Claude Code. Sie importiert die
bestehenden Cursor-Konventionen, damit beide Tools dieselbe Quelle nutzen.

## Universelle Agent-Regeln (Cursor + Claude Code)

@AGENTS.md

## Generelle Coding-Konventionen (Cursor-Legacy)

@.cursorrules

## Architektur-Contracts (alwaysApply)

@docs/contracts/no-silent-fallbacks.md
@docs/contracts/storage-abstraction.md

## Routing-Index: welcher Pfad, welche Regel

**Verbindlich.** Wer eine Datei aus der linken Spalte ändert, liest vorher die
zugehörigen Contracts unter [docs/contracts/](docs/contracts/) — der genannte
Skill fasst sie zusammen. Die ADR-Spalte nennt Entscheidungen, die für diesen
Bereich bereits getroffen sind (`docs/adr/`); Status **Aktiv** heißt bindend,
**Vorgeschlagen** heißt Richtung, aber noch nicht in Kraft.

| Pfad-Muster | Contracts (`docs/contracts/`) | Skill | ADR |
|---|---|---|---|
| `src/lib/external-jobs/**`, `src/app/api/external/jobs/**`, `src/app/api/pipeline/**`, `src/lib/transform/**`, `src/lib/markdown/**` | contracts-story-pipeline, external-jobs-integration-tests, ingest-mongo-only, no-error-as-artifact, frontmatter-single-serializer | `contracts-pipeline` | 0001 |
| `src/lib/storage/**`, `src/app/api/storage/**` | storage-abstraction, storage-contracts | `contracts-storage-twin` | 0005 |
| `src/lib/shadow-twin/**`, `src/hooks/use-shadow-twin*` | shadow-twin-architecture, shadow-twin-contracts | `contracts-storage-twin` | — |
| `src/lib/ingestion/**` | ingestion-contracts | `contracts-ingestion-chat` | — |
| `src/lib/chat/**`, `src/app/api/chat/**` | chat-contracts, contracts-story-pipeline | `contracts-ingestion-chat` | 0009 |
| `src/lib/pipeline/**` | contracts-story-pipeline | `contracts-pipeline` | 0009 |
| `src/lib/templates/**`, `template-samples/**`, `src/components/templates/**` | templates-contracts, template-structure, media-lifecycle | `contracts-templates-media` | 0003 |
| `src/lib/secretary/**`, `src/app/api/secretary/**` | secretary-contracts, media-lifecycle | `contracts-templates-media` | — |
| `src/components/creation-wizard/**`, `src/components/submissions/**`, `src/lib/submissions/**`, `src/app/api/submissions/**` | ingest-mongo-only, media-lifecycle | `contracts-templates-media` | 0003, 0004 |
| `src/components/library/**` | welle-3-schale-loader-contracts, welle-3-archiv-detail-contracts, welle-3-iii-galerie-chat-contracts, shadow-twin-architecture | `contracts-ui` | 0002 |
| `src/components/settings/**` | welle-3-iv-settings-contracts | `contracts-ui` | — |
| `src/app/page.tsx`, `src/app/layout.tsx`, `src/lib/root-landing.ts` | website-landingpage | `contracts-ui` | 0007 |
| `src/types/library.ts`, `src/lib/services/library-service.ts`, `src/components/settings/library/**` | library-config-field | `checklisten-erweiterung` | — |
| `**/detail-view*.tsx`, `**/registry.ts`, `**/doc-meta-mappers.ts`, `**/validation.ts` | detail-view-type-checklist | `checklisten-erweiterung` | 0009 |
| `src/lib/events/**`, `src/app/api/event-job/**`, `src/components/event-monitor/**` | — | — | **0001 (Aktiv)** |
| `src/lib/gallery/**`, `src/app/api/library/*/favorites/**` | welle-3-iii-galerie-chat-contracts | `contracts-ui` | **0002 (Aktiv)** |
| `src/lib/library-access/**`, `src/app/api/libraries/*/members/**`, `.../invites/**` | — | — | 0005 |
| `src/lib/graph/**`, `src/app/api/library/*/doc-relations/**` | — | — | 0008 |
| `pnpm-workspace.yaml`, `packages/**`, `apps/**`, `next.config.js` | — | — | 0006, 0007 |
| `docs/refactor/**`, `docs/plans/**`, `scripts/welle-pre-merge-check.sh` | refactor-batch-strategy, refactor-naming-konvention, cloud-agent-cost-strategy | — | — |

Steht ein Bereich nicht in der Tabelle, gelten weiterhin die beiden immer
aktiven Contracts oben (`no-silent-fallbacks`, `storage-abstraction`) sowie die
Repo-Konventionen in `AGENTS.md`.

**Pflege:** Neuer Contract oder neues ADR ⇒ Zeile hier ergänzen (und das ADR
zusätzlich in der ADR-Liste in `AGENTS.md` eintragen).

## Querschnitt-Konventionen (Docs)

Wiederkehrende Muster — lesen, statt Referenz-Code komplett zu reverse-engineeren:

- [mongodb-repository-pattern.md](docs/architecture/mongodb-repository-pattern.md) – Repos unter `src/lib/repositories/`
- [api-route-conventions.md](docs/architecture/api-route-conventions.md) – Handler unter `src/app/api/**`
- [file-preview-tab-architecture.md](docs/architecture/file-preview-tab-architecture.md) – Tabs der Datei-Vorschau

## Skills

Skills liegen unter [.claude/skills/](.claude/skills/). Cursor erreicht sie
über eine Windows-Junction `.cursor/skills/` → `.claude/skills/` (lokal,
nicht in Git — siehe `.gitignore`). Wenn die Junction fehlt, kann sie neu
erzeugt werden:

```powershell
New-Item -ItemType Junction -Path ".cursor\skills" -Target "$PWD\.claude\skills"
```

## Pläne

Aktive Cursor-Pläne liegen unter [.cursor/plans/](.cursor/plans/). Aktiver
Plan ist in `AGENTS.md` referenziert.
