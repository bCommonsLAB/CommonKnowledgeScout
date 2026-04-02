## Problem

`/info?type=about` und die anderen Footer-Links laden Markdown über:

- `src/app/info/page.tsx`
- `src/app/api/markdown/[...path]/route.ts`

Diese Kombination erwartet Dateien unter `public/docs/footer/`.
Das Verzeichnis und die referenzierten Dateien fehlen aktuell im Repository.

## Befund

Die Git-Historie zeigt, dass die Dateien in Commit `9b3d59e` vorhanden waren:

- `public/docs/footer/about.md`
- `public/docs/footer/Impressum.md`
- `public/docs/footer/privacy.md`
- `public/docs/footer/legal-notice.md`

Die Route selbst ist daher konsistent.
Das Problem ist kein Routingfehler, sondern fehlender Content.

## Varianten

### Variante 1: Fehlende Dateien unter `public/docs/footer/` wiederherstellen

Vorteile:
- Kleinste Änderung
- Bestehende Architektur bleibt intakt
- Alle `/info?type=...`-Links funktionieren wieder

Nachteile:
- Inhalte müssen gepflegt werden

### Variante 2: `InfoPage` auf andere vorhandene Quellen umbiegen

Vorteile:
- Keine neuen Dateien nötig

Nachteile:
- Größerer Umbau
- Gefahr von inkonsistenten Inhalten

### Variante 3: Links entfernen

Vorteile:
- Keine Inhaltsdateien nötig

Nachteile:
- Funktionalität geht verloren

## Entscheidung

Variante 1 ist die sauberste Minimalreparatur.
Die fehlenden Dateien werden wieder angelegt.
