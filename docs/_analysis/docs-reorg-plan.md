---
title: Dokumentations-Refactoring Plan (Arbeitsnotiz)
---

Hinweis: Arbeitsnotizen liegen unter `docs/_analysis/` und werden nicht in die Navigation aufgenommen. Ziel ist, produktive Inhalte in strukturierte Ziele zu überführen und die Quell-Dateien danach nach `docs/_archive/` zu verschieben.

### Definition of Done (DoD)
- Unter `docs/` liegen keine losen Alt-Dateien mehr im Root.
- Produktive Inhalte befinden sich ausschließlich in der Ziel-IA (`overview/`, `architecture/`, `guide/`, `concepts/`, `reference/`, `ops/`, `history/`, `presentations/`).
- Ursprungsdokumente (nach Migration) sind nach `docs/_archive/` verschoben.
- Der Status jedes Dokuments ist in `docs/_analysis/docs-inventory.md` nachverfolgt.

### Statuskategorien
- `pending`: noch nicht bewertet
- `planned`: Ziel-Ort/Struktur festgelegt
- `migrated`: Inhalt in Ziel-IA übernommen (neue Datei existiert)
- `archived`: Ursprungsdatei nach `docs/archive/` verschoben
- `dropped`: bewusst verworfen (mit Begründung)

### Prozess
1) Inventur: Alle Dateien unter `docs/` in `docs/_analysis/docs-inventory.md` erfassen (inkl. Unterordner).
2) Klassifizierung: Für jede Datei Ziel-Kategorie und Ziel-Pfad festlegen.
3) Migration: Inhalt in neue Struktur überführen (redaktionell säubern, Links aktualisieren).
4) Archivierung: Ursprungsdatei nach `docs/archive/` verschieben und Status updaten (`archived`).
5) Qualitätssicherung: Build, Link-Check, Navigationsprüfung.

### Zielstruktur unter `docs/`
- `overview/` (Einführung, Überblick)
- `architecture/` (System, Komponenten, Daten)
- `guide/` (How-tos, Schritt-für-Schritt)
- `concepts/` (Kernkonzepte, z. B. Library, Events, RAG)
- `reference/` (API/CLI/Schema; möglichst generiert)
- `ops/` (Deployment, Betrieb, Troubleshooting)
- `history/` (Chronik/Changelogs)
- `presentations/` (Folien, Notizen)
- `_archive/` (Ursprungsdateien nach Migration)
- `_analysis/` (Arbeitsnotizen, Inventar, Checklisten)

### Tooling-Hinweise
- Analyse/Archiv nicht deployen: vorerst nicht in `nav` aufnehmen. Optional später `mkdocs-exclude` einsetzen, um `docs/_analysis/` und `docs/_archive/` vom Build auszuschließen.
- Referenzen automatisieren (nach Phase 1–3): `typedoc` + `typedoc-plugin-markdown` → `docs/reference/api/`.

### Implementierungsstatus in der Doku
- Kennzeichnung pro Seite oben via Admonition:
  - `Implementiert` (✅): API-Routen/Komponenten vorhanden, End-to-End nutzbar
  - `Teilweise umgesetzt` (🟡): Teile vorhanden, Rest geplant
  - `Konzept` (📝): Architektur-/Planungsdokument, keine Implementierung
- Prüf-Kriterien (automatisierbar):
  - Existenz relevanter `src/app/api/*` Routen
  - Komponenten/Services im Code (`src/components/*`, `src/lib/*`)
  - Verlinkung/Usage in App-Seiten


