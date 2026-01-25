# Shadow‑Twin Migration: Zentrales Logging

## Einordnung
Der Dry‑Run liefert bereits einen Report, aber er geht nach dem Dialog verloren. Fuer Debugging und Nachvollziehbarkeit brauchen wir einen zentralen Verlauf der letzten Migrationen (Dry‑Run und echte Runs).

## Varianten
### Variante A: MongoDB‑Collection `shadow_twin_migrations` (empfohlen)
**Beschreibung:** Jeder Run wird als Dokument gespeichert (Start, Ende, Status, Report).  
**Vorteile:** Zentral, langlebig, leicht filterbar pro Library.  
**Risiken:** Zusaetzliche Collection, muss gepflegt werden.

### Variante B: FileLogger‑Only
**Beschreibung:** Nur Logs in Datei/Console.  
**Vorteile:** Keine DB‑Aenderung.  
**Risiken:** Nicht strukturiert, schwer auszuwerten, nicht zentral abrufbar.

### Variante C: Events im Job‑System
**Beschreibung:** Migration als Job modellieren und Events im Job‑Repo speichern.  
**Vorteile:** Einheitlicher Flow.  
**Risiken:** Mehr Aufwand, zusaetzliche Architektur.

## Entscheidung
Variante A. Sie ist minimalinvasiv, zentral und strukturiert.

## Scope (Minimal)
- Repository: `shadow_twin_migrations` mit Start/Finish.
- Migration‑Route schreibt Run‑Dokument.
- Optionaler API‑Read fuer „letzte Runs“.
