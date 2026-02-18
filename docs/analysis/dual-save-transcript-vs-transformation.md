# Dual-Save: Transkript (Filesystem) + Transformation (MongoDB)

## Problem

Beim Publizieren aus dem Creation Wizard wurde die **transformierte** Datei (LLM-Output)
als physische Datei im Filesystem gespeichert. Dadurch ging die Möglichkeit verloren,
die Transformation erneut aus den Quelltexten zu starten.

## Gewünschtes Verhalten

| Ziel | Inhalt | Zweck |
|---|---|---|
| Filesystem (physische Datei) | **Transkript** (Quelltexte) | Kann für neue Transformation verwendet werden |
| MongoDB (Shadow-Twin-Artefakt) | **Transformation** (LLM-Output) | Wird für Ingestion/Indizierung verwendet |

## Lösung

### Dual-Save Architektur in `handleSave()` (`creation-wizard.tsx`)

1. **Transkript-Markdown** wird gebaut:
   - Frontmatter: Alle Metadaten OHNE `transformationSource: true`
   - Body: Quelltexte aus `textSources` (mit Separatoren bei mehreren Quellen)
   - Wird als physische Datei im Filesystem gespeichert

2. **Transformation-Markdown** wird gebaut:
   - Frontmatter: Alle Metadaten MIT `transformationSource: true`
   - Body: LLM-generierter Inhalt
   - Wird als Shadow-Twin-Artefakt in MongoDB persistiert (via `/api/library/[libraryId]/shadow-twins/upsert`)

3. **Ingestion** (`ingest-markdown`):
   - Empfängt `fileId` = ID der Transkript-Datei
   - Prüft im Mongo-Mode automatisch auf Shadow-Twin-Artefakte für diese `sourceId`
   - Findet die Transformation in MongoDB und verwendet sie für die Indizierung

### Betroffene Code-Stellen

- `src/components/creation-wizard/creation-wizard.tsx`:
  - `markdownContent` = jetzt Transkript (statt Transformation)
  - Neuer Block nach dem Speichern: Shadow-Twin-Upsert für Transformation
  
### Einschränkungen

- Gilt nur für **neue** Event-Erstellungen (nicht für PDF-Publish oder Resume-Modus)
- Setzt **Mongo-Mode** voraus (Shadow-Twin-Upsert-API prüft dies)
- Wenn kein Mongo-Mode aktiv, wird nur die Transkript-Datei gespeichert (ohne Transformation-Artefakt)

## Testbarkeit

1. Neues Event im Wizard erstellen (Template `event-creation-de`)
2. Quellen eingeben und LLM-Transformation durchlaufen
3. Publizieren
4. **Prüfen**: Physische Datei im Filesystem = Transkript mit Quelltexten als Body
5. **Prüfen**: MongoDB Shadow-Twin hat Transformation mit LLM-Output
6. **Prüfen**: Galerie zeigt korrekte Metadaten (aus Transformation)
7. **Prüfen**: Erneute Transformation aus der Transkript-Datei möglich

## Datum
2026-02-16
