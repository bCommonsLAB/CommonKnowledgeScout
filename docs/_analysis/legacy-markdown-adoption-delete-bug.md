# Analyse: Legacy-Markdown wird fälschlich gelöscht (Shadow‑Twin)

## Beobachtung (aus Trace/Logs)

Im Job-Trace taucht ein DELETE auf eine Markdown-Datei im Shadow‑Twin-Verzeichnis auf:

- Event: `legacy_markdown_removed_duplicate_in_shadow_twin`
- Attribute: `legacyMarkdownId` und `existingTransformedId` sind **identisch**
- Direkt danach: `ENOENT` beim Lesen derselben Datei und Step 3 (`ingest_rag`) scheitert mit **„Shadow‑Twin nicht gefunden“**.

Damit ist die Kausalität plausibel: die „richtige“ transformierte Datei (mit Frontmatter) wird gelöscht, anschließend kann der Loader sie nicht mehr laden.

## Ursache (Code)

In `src/lib/external-jobs/legacy-markdown-adoption.ts` wird im Duplikat-Fall immer gelöscht:

- Es wird im Shadow‑Twin nach `transformedName` gesucht.
- Wenn gefunden, wird `provider.deleteItem(legacyMarkdownId)` ausgeführt.

Wenn aber `legacyMarkdownId` bereits **genau diese** gefundene Datei ist (also `legacyMarkdownId === existingTransformed.id`), wird die korrekte Datei gelöscht.

## Fix-Entscheidung

Minimal-invasiver Guard:

- **Nur löschen, wenn** `legacyMarkdownId !== existingTransformed.id`.
- Wenn gleich, wird **nicht** gelöscht und ein eigenes Trace-Event `legacy_markdown_skip_delete_same_id` geschrieben.

Das verhindert Datenverlust (Frontmatter/Markdown) und lässt die Ingest-Phase die Datei weiterhin laden.

## Testplan

- Unit-Test: `legacyMarkdownId === existingTransformed.id` ⇒ `deleteItem` wird **nicht** aufgerufen.
- Manuell: Job mit bestehender Shadow‑Twin-Markdown + Frontmatter + Ingest starten ⇒ kein DELETE mehr auf die `.de.md` im Shadow‑Twin; Step 3 läuft weiter.


