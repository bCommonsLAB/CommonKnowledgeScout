---
name: contracts-storage-twin
description: Harte Invarianten für Storage-Provider und Shadow-Twin-System (Provider-Interface, Factory, ArtifactKey-Determinismus, Storage-Abstraktion der UI). Verwende diesen Skill, BEVOR du an src/lib/storage/**, src/app/api/storage/**, src/lib/shadow-twin/** oder Shadow-Twin-Hooks etwas änderst — also sobald von Storage-Provider, OneDrive/Nextcloud/Filesystem, Shadow Twins, ArtifactKey oder Twin-Reparatur die Rede ist.
---

# Contracts: Storage & Shadow Twin

Diese Regeln sind **nicht verhandelbar**. Details je Thema in `docs/contracts/`.

## Die vier Invarianten auf einen Blick

1. **Die UI kennt das Storage-Backend NICHT.** Zugriff ausschließlich über
   `useStorage()` / `useStorageProvider()` bzw. den Service-Layer — nie direkte
   `library.type`-Checks in Komponenten, sondern Helper-Funktionen.
2. **ArtifactKey-Determinismus**: Gleiche Quelle + gleiches Template ⇒ gleicher
   Schlüssel. `templateName` ist Pflicht.
3. **Fehler-Semantik**: Keine stillen Fallbacks, keine Default-Werte, die einen
   fehlenden Zustand kaschieren. Skip nur explizit und begründet.
4. **Abhängigkeitsrichtung**: `src/lib/storage/` importiert keine UI; UI
   importiert keine Provider-Implementierungen.

## Zuständige Contract-Dateien

| Datei | Thema |
|---|---|
| [storage-abstraction.md](../../../docs/contracts/storage-abstraction.md) | Zentrale Architektur-Regel (gilt IMMER, via CLAUDE.md geladen) |
| [storage-contracts.md](../../../docs/contracts/storage-contracts.md) | Provider-Interface, Factory, Fehler-Semantik, erlaubte Abhängigkeiten |
| [shadow-twin-architecture.md](../../../docs/contracts/shadow-twin-architecture.md) | Was ein Shadow-Twin ist, Determinismus, Abstraktionsebenen |
| [shadow-twin-contracts.md](../../../docs/contracts/shadow-twin-contracts.md) | Service, Store, Artifacts — harte Invarianten |

## Zusätzlich beachten

- **ADR 0005** (deponiert): Co-Creator sollen künftig eigene Storage-Auth nutzen
  statt der Owner-Credentials (`docs/adr/0005-co-creator-eigene-storage-auth.md`).
- Für die Verifikation existiert der Skill `shadow-twin-verify`.
