---
name: contracts-ui
description: Harte Invarianten der UI-Container-Schicht — App-Schale, Library-Loader, Archiv-Detail, Galerie/Story/Chat, Settings und die Website-Landingpage. Verwende diesen Skill, BEVOR du an src/components/library/**, src/components/settings/**, src/app/page.tsx, src/app/layout.tsx oder src/lib/root-landing.ts etwas änderst — also sobald von Datei-Liste, Datei-Vorschau, Galerie, Story-Modus, Einstellungen oder der öffentlichen Landingpage die Rede ist.
---

# Contracts: UI-Container (Welle-3-Invarianten)

Diese Regeln sind **nicht verhandelbar**. Details je Bereich in `docs/contracts/`.

## Die vier Invarianten auf einen Blick

1. **UI-Container enthalten keine Business-Logik.** Verboten in diesen
   Komponenten: Datenbank-Queries (gehören in `src/lib/services/`),
   Storage-Operationen außer über `useStorage()`/`useStorageProvider()`,
   Frontmatter-Parsing oder -Schreiben (gehört in `src/lib/templates/` bzw. die
   Server-API).
2. **Erlaubt sind**: Lesen aus Jotai-Atoms, Hooks aus `src/hooks/`, Helper aus
   `src/lib/storage/`, `fetch` auf `/api/library/...`.
3. **Die UI kennt das Storage-Backend nicht** (siehe `contracts-storage-twin`).
4. **Keine stillen Fallbacks** — auch nicht als leerer Zustand, der einen Fehler
   verdeckt.

## Zuständige Contract-Dateien

| Datei | Bereich |
|---|---|
| [welle-3-schale-loader-contracts.md](../../../docs/contracts/welle-3-schale-loader-contracts.md) | App-Schale + Library-Loader (`library.tsx`, `file-list`, `file-tree`, Upload) |
| [welle-3-archiv-detail-contracts.md](../../../docs/contracts/welle-3-archiv-detail-contracts.md) | Archiv-Detail (`file-preview` und Tabs) |
| [welle-3-iii-galerie-chat-contracts.md](../../../docs/contracts/welle-3-iii-galerie-chat-contracts.md) | Galerie, Story-Modus, Chat |
| [welle-3-iv-settings-contracts.md](../../../docs/contracts/welle-3-iv-settings-contracts.md) | Settings — erlaubte Client-Direktiven, Fehler-Semantik |
| [website-landingpage.md](../../../docs/contracts/website-landingpage.md) | Landingpage am Library-Slug (`detailViewType: website`) |

## Zusätzlich beachten

- **ADR 0002**: Galerie-Sterne und Voter-Namen kommen aus MongoDB + `GET docs`,
  nicht aus Clerk-Routen (`docs/adr/0002-galerie-sterne-ohne-clerk-read.md`).
- **ADR 0008** (vorgeschlagen): Module sollen künftig montierbare
  React-Wurzelkomponenten exportieren und sich nicht auf Next.js-Datei-Routing
  verlassen (`docs/adr/0008-deployment-ziele.md`).
- Tab-Architektur der Datei-Vorschau: `docs/architecture/file-preview-tab-architecture.md`.
