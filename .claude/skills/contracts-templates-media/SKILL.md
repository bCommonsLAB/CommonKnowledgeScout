---
name: contracts-templates-media
description: Harte Invarianten für Templates (Parser, Transform-by-Template, Template-Syntax), Medien-Lebenszyklus und den Secretary-Dienst. Verwende diesen Skill, BEVOR du an src/lib/templates/**, template-samples/**, src/components/templates/**, src/lib/secretary/** oder src/app/api/secretary/** etwas änderst — also sobald von Templates, Frontmatter-Feldern, Transformationen, Medien-Referenzen, Audio/Video/PDF-Verarbeitung oder Transkription die Rede ist.
---

# Contracts: Templates, Medien & Secretary

Diese Regeln sind **nicht verhandelbar**. Details je Thema in `docs/contracts/`.

## Die vier Invarianten auf einen Blick

1. **Frontmatter ist FLACH** (AGENTS.md, gilt rückwirkend): `snake_case`-Keys auf
   EINER Ebene, keine Dot-Notation (`a.b:`), keine verschachtelten YAML-Objekte.
   Verschachtelte Datenmodelle entstehen erst downstream in MongoDB.
2. **Medien werden referenziert, nicht dupliziert**: Der Lebenszyklus (Anlegen,
   Verschieben, Löschen) folgt dem Multi-Source-Modell; Frontmatter verweist auf
   Medien statt sie einzubetten.
3. **Secretary ist ein HTTP-Wrapper**: Fachlogik gehört nicht in den Wrapper;
   Fehler werden weitergereicht, nicht geschluckt.
4. **Template-Syntax ist Contract**: Änderungen an der Syntax betreffen alle
   bestehenden Templates unter `template-samples/` — Kompatibilität prüfen.

## Zuständige Contract-Dateien

| Datei | Thema |
|---|---|
| [templates-contracts.md](../../../docs/contracts/templates-contracts.md) | Template-Parser, Felder, harte Invarianten |
| [template-structure.md](../../../docs/contracts/template-structure.md) | Struktur und Syntax für Transform-by-Template |
| [media-lifecycle.md](../../../docs/contracts/media-lifecycle.md) | Medien-Lebenszyklus, Frontmatter-Referenzierung, Multi-Source |
| [secretary-contracts.md](../../../docs/contracts/secretary-contracts.md) | HTTP-Wrapper zum externen Dienst |

## Zusätzlich beachten

- **ADR 0003** (vorgeschlagen): Wizard (Flow/UI, generisch) und Schema-Template
  (Datenmodell pro docType) werden getrennt — `docs/adr/0003-wizard-schema-template-trennen.md`.
- **ADR 0004** (vorgeschlagen): Erfassung schreibt nie direkt in den
  Ziel-Provider; Inbox + rechte-gatete Promotion —
  `docs/adr/0004-capture-publish-entkopplung-inbox-modell.md`.
