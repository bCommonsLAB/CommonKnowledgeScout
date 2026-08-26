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

## On-Demand-Regeln

Weitere Contract-Dateien unter [docs/contracts/](docs/contracts/) sind bei Bedarf
zu lesen — sie sind in Cursor an Globs/Tasks gebunden und in `AGENTS.md`
referenziert. Beispiele:

- [contracts-story-pipeline.md](docs/contracts/contracts-story-pipeline.md) – Pipeline-Änderungen
- [library-config-field.md](docs/contracts/library-config-field.md) – neues Per-Library-Config-Feld (Checkliste)
- [shadow-twin-architecture.md](docs/contracts/shadow-twin-architecture.md) / [shadow-twin-contracts.md](docs/contracts/shadow-twin-contracts.md)
- [storage-contracts.md](docs/contracts/storage-contracts.md) – Storage-Implementierungen
- [ingestion-contracts.md](docs/contracts/ingestion-contracts.md) / [ingest-mongo-only.md](docs/contracts/ingest-mongo-only.md)
- [refactor-batch-strategy.md](docs/contracts/refactor-batch-strategy.md) / [refactor-naming-konvention.md](docs/contracts/refactor-naming-konvention.md)
- Welle-3-Contracts: [archiv-detail](docs/contracts/welle-3-archiv-detail-contracts.md), [galerie-chat](docs/contracts/welle-3-iii-galerie-chat-contracts.md), [settings](docs/contracts/welle-3-iv-settings-contracts.md), [schale-loader](docs/contracts/welle-3-schale-loader-contracts.md)

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
