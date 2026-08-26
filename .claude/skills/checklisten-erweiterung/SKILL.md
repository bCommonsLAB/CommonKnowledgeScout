---
name: checklisten-erweiterung
description: Schritt-für-Schritt-Checklisten für zwei wiederkehrende Erweiterungen — ein neues Per-Library-Config-Feld und ein neuer DetailViewType. Verwende diesen Skill, sobald ein neues Feld in der Library-Konfiguration, eine neue Einstellung pro Library oder eine neue Detailansicht (detailViewType) angelegt werden soll — also bei Änderungen an src/types/library.ts, src/lib/services/library-service.ts, src/components/settings/library/**, Detail-View-Renderern oder der Registry.
---

# Checklisten: Library-Config-Feld & DetailViewType

Beide Erweiterungen berühren jeweils mehrere Schichten. Wird eine Station
vergessen, erscheint das Feld nicht oder die Ansicht bleibt leer — deshalb die
Checklisten vollständig abarbeiten.

## Neues Per-Library-Config-Feld

Kette: Typ (`src/types/library.ts`) → `ClientLibrary`-Mapping →
`library-service.ts` → Settings-Formular (`src/components/settings/library/`).
Vollständige Schrittfolge inklusive Fallstricke:
[library-config-field.md](../../../docs/contracts/library-config-field.md)

## Neuer DetailViewType

Kette: Registry (`src/lib/detail-view-types/registry.ts`) → Feld-Definitionen →
Validierung → Renderer-Komponente → Doc-Meta-Mapper. Architektur und Checkliste:
[detail-view-type-checklist.md](../../../docs/contracts/detail-view-type-checklist.md)

## Zusätzlich beachten

- **Frontmatter-Format** (AGENTS.md): flach, `snake_case`, keine Dot-Notation,
  keine verschachtelten YAML-Objekte.
- **ADR 0009** (vorgeschlagen): Detail-View-Registry soll pro Site erweiterbar
  werden, ohne dass jede Site alle Renderer lädt — bei neuen Spezialansichten
  mitdenken (`docs/adr/0009-retrieval-profile.md`,
  `docs/architecture/modul-landkarte.md` §6).
