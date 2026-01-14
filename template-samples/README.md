# Templates im Repo (`/template-samples`)

Dieser Ordner enthält **Beispiel-/Snapshot-Templates** als Markdown-Dateien.

## Wichtig (Source of Truth)

In der laufenden Anwendung ist die **primäre Quelle** für Templates:

- **MongoDB** (`TemplateDocument`)

Das Template wird im UI unter `/templates` (Template-Management) bearbeitet und in MongoDB gespeichert.

## Wofür ist dieser Ordner dann da?

- **Referenz/Versionierung**: Snapshot eines Templates, um Änderungen nachvollziehen zu können.
- **Manueller Import**: Optional kann ein Template als Datei in den **Library-Storage** unter `root/templates/*.md` gelegt und anschließend per `/api/templates/import` nach MongoDB importiert werden.

## Was NICHT passiert

- Der Server lädt **nicht automatisch** Templates aus diesem Repo-Ordner zur Laufzeit.


