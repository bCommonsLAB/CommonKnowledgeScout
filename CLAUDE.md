# Claude Code – Projektkontext CommonKnowledgeScout

Diese Datei ist die Einstiegspunkt-Memory für Claude Code. Sie importiert die
bestehenden Cursor-Konventionen, damit beide Tools dieselbe Quelle nutzen.

## Universelle Agent-Regeln (Cursor + Claude Code)

@AGENTS.md

## Generelle Coding-Konventionen (Cursor-Legacy)

@.cursorrules

## Architektur-Contracts (alwaysApply)

@.cursor/rules/no-silent-fallbacks.mdc
@.cursor/rules/storage-abstraction.mdc

## On-Demand-Regeln

Weitere `.mdc`-Dateien unter [.cursor/rules/](.cursor/rules/) sind bei Bedarf
zu lesen — sie sind in Cursor an Globs/Tasks gebunden und in `AGENTS.md`
referenziert. Beispiele:

- [contracts-story-pipeline.mdc](.cursor/rules/contracts-story-pipeline.mdc) – Pipeline-Änderungen
- [library-config-field.mdc](.cursor/rules/library-config-field.mdc) – neues Per-Library-Config-Feld (Checkliste)
- [shadow-twin-architecture.mdc](.cursor/rules/shadow-twin-architecture.mdc) / [shadow-twin-contracts.mdc](.cursor/rules/shadow-twin-contracts.mdc)
- [storage-contracts.mdc](.cursor/rules/storage-contracts.mdc) – Storage-Implementierungen
- [ingestion-contracts.mdc](.cursor/rules/ingestion-contracts.mdc) / [ingest-mongo-only.mdc](.cursor/rules/ingest-mongo-only.mdc)
- [refactor-batch-strategy.mdc](.cursor/rules/refactor-batch-strategy.mdc) / [refactor-naming-konvention.mdc](.cursor/rules/refactor-naming-konvention.mdc)
- Welle-3-Contracts: [archiv-detail](.cursor/rules/welle-3-archiv-detail-contracts.mdc), [galerie-chat](.cursor/rules/welle-3-iii-galerie-chat-contracts.mdc), [settings](.cursor/rules/welle-3-iv-settings-contracts.mdc), [schale-loader](.cursor/rules/welle-3-schale-loader-contracts.mdc)

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
