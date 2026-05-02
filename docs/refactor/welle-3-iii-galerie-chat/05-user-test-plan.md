# User-Test-Plan: Welle 3-III — Galerie + Story-Mode + Chat

Stand: 2026-05-02. Smoke-Test, der nach jeder Sub-Welle durchgefuehrt
wird (lokal mit `pnpm dev` im Browser).

## Voraussetzungen

- Lokaler Entwicklungsserver: `pnpm dev`
- Eine Library mit ingestierten Inhalten (mind. 5 Dokumente)
- Browser: aktueller Chrome/Firefox
- Aufloesung: Desktop + (optional) Mobile-Viewport

## Vorbereitungs-PR (DIESE PR)

**Reine Doku/Char-Tests, KEIN UI-Smoke-Test noetig.** Die Vorbereitungs-PR
aendert keinen Production-Code.

Optionale Verifikation:

1. `git diff master --stat docs/` — alle neuen Doku-Files sichtbar
2. `node scripts/ui-welle-3iii-stats.mjs` — Stats-Output erscheint
3. `pnpm test --run tests/unit/components/library/{chat,gallery}/` — neue Char-Tests grün
4. `pnpm lint .cursor/rules/welle-3-iii-galerie-chat-contracts.mdc` — Rule wird vom Linter akzeptiert

## Sub-Welle 3-III-a (Gallery, folgt)

Galerie-Funktionen pruefen — alle View-Modi + Filter + Bulk-Actions.

### Galerie oeffnen

1. **Library-Galerie aufrufen**: `/library/{id}/gallery`
   - Erwartung: Galerie laedt, zeigt Documents in Default-View-Modus

### View-Modi

2. **View-Modus wechseln**: Klick auf Grid/Table/Virtualized-Toggle
   - Erwartung: Layout wechselt sichtbar, URL-Parameter `?view=...` aendert sich
3. **Gruppierung**: Gruppieren nach Author/Tag/Type
   - Erwartung: Gruppen-Header sichtbar, Items nach Gruppen sortiert
4. **Sticky Header bleibt sichtbar** beim Scrollen

### Filter

5. **Facet-Filter setzen**: Klick auf eine Facette in `filters-panel`
   - Erwartung: Liste filtert, URL-Parameter `?filter=...` aendert sich
6. **Mobile Filters**: Mobile-Viewport oeffnen, Burger-Menu klicken
   - Erwartung: Sheet oeffnet sich, Filter sind dieselben
7. **Filter-Reset**: Reset-Button klicken
   - Erwartung: alle Filter zurueck, Liste zeigt alles

### Document-Card-Interaktion

8. **Document-Card klicken**: ein Dokument anklicken
   - Erwartung: Detail-Overlay oeffnet sich, zeigt Volltext-Card
9. **Document-Share-Button**: Share-Button klicken
   - Erwartung: Native Share-Dialog (mobil) oder Copy-Link-Toast (Desktop)
10. **Bulk-Auswahl**: 2 Dokumente per Checkbox auswaehlen, Bulk-Publish/Delete
    - Erwartung: Action wird aufgerufen, Liste aktualisiert sich

## Sub-Welle 3-III-b (Chat, folgt)

Chat-Panel pruefen — Streaming + Konfiguration + Debug.

### Chat oeffnen

1. **Chat-Panel oeffnen**: `/library/{id}/chat`
   - Erwartung: Welcome-Assistant rendert (kein leeres Panel)
2. **Suggested Questions**: vorgeschlagene Fragen sichtbar
3. **Frage stellen**: Frage eingeben, Submit
   - Erwartung: Frage erscheint in MessagesList, Streaming-Antwort laeuft

### Streaming + References

4. **Streaming-Output**: Antwort tippt sich Wort-fuer-Wort auf
   - Erwartung: kein Hangup, Source-References erscheinen am Ende
5. **Reference-List**: Klick auf einen Reference-Eintrag
   - Erwartung: Reference-Details oeffnen sich, Original-Dokument verlinkt

### Konfiguration

6. **Chat-Config aendern**: Persoenlichkeit/Sprache/Retriever-Modus
   - Erwartung: naechste Antwort verwendet die neue Config, LocalStorage updated
7. **Conversation-Selector**: zweite Conversation auswaehlen
   - Erwartung: Messages laden, History sichtbar

### Debug

8. **Debug-Panel oeffnen**: Debug-Toggle klicken
   - Erwartung: Tabs sichtbar (Trace/Timeline/Steps/Logs)
9. **Query-Details**: Auf eine Query klicken → Details-Dialog
   - Erwartung: Token-Counts, Embeddings, Retriever-Output sichtbar

### Edge-Cases

10. **Stream-Abbruch**: Antwort generieren, dann Cancel-Button
    - Erwartung: Streaming stoppt, "Abgebrochen"-Indikator sichtbar

## Sub-Welle 3-III-c (Story + Perspective, folgt)

Story-Mode + Perspective-Page-Content pruefen.

### Story-Mode

1. **Story-Mode-Toggle**: in der Galerie, Klick auf Story-Mode-Button
   - Erwartung: Wechsel zu Story-View
2. **Story-Header rendert** mit Topic-Auswahl
3. **Topic auswaehlen** → Topic-Details laden
4. **Story-Topics**: Topic-Liste navigierbar

### Perspective-Page

5. **Perspective oeffnen**: `?perspective=<id>` in der URL
   - Erwartung: PerspectivePageContent laedt
6. **Perspective-Tabs wechseln**
7. **Filter anwenden** in PerspectivePage
8. **Empty-State**: Perspective ohne Daten → Empty-Indicator sichtbar

## Stop-Bedingungen (User meldet)

- Liste laedt nicht / Ladeindikator dreht ewig
- Layout zerschossen (Items ueberlappen, Cards halb sichtbar)
- Filter wirken nicht (Liste aendert sich nicht)
- Stream haengt
- React-Error-Boundary aktiviert sich
- URL-Parameter werden nicht geschrieben/gelesen

## Verfahren

1. User testet die Sub-Welle nach Push der PR.
2. Tests in dieser Reihenfolge: Galerie → Chat → Story.
3. Pro Test einen kurzen Befund (PASS/FAIL + Notiz) im PR-Comment.
4. Bei FAIL: Branch zurueckhalten, mit Agent klaeren.
5. Bei PASS: PR mergen, naechste Sub-Welle wird gestartet.
