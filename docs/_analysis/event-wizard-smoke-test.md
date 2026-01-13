# Smoke-Test Checkliste: Event → Testimonials → Finalize/Publish

Datum: 2026-01-11  
Ziel: Manuelle Verifikation der drei Flows (A/B/C) im laufenden System.

## Voraussetzungen

- Du bist als **Owner/Moderator** der Library angemeldet.
- Du hast das Template aus `template-samples/event-creation-de.md` in deine Template-Library importiert (oder äquivalent erstellt).
- Deine Library ist öffentlich (für den anon Recorder) oder du testest im internen `/library` Bereich.

## Flow A: Event erstellen (Wizard)

1. Öffne den Creation-Wizard für `event-creation-de` (oder deinen Event-Type).
2. Erstelle einen Event und speichere.
3. Erwartung:
   - Im Storage gibt es einen neuen Ordner `<slug>/` mit Datei `<slug>.md`.
   - Der Event erscheint in der Gallery/Explore-Ansicht (Ingestion wurde beim Speichern getriggert).

## Flow B: Testimonial aufnehmen (anonym)

1. Öffne den Event in der Detailansicht.
2. Erwartung:
   - Als Owner/Moderator siehst du einen **QR-Code** (und einen Link).
3. Öffne den Link in einem privaten Fenster (oder kopiere ihn aufs Handy).
   - URL-Form: `/public/testimonial?libraryId=...&eventFileId=...&writeKey=...`
4. Nimm ein kurzes Testimonial auf („Stop & senden“).
5. Erwartung:
   - Im Storage entsteht unter `<slug>/testimonials/<testimonialId>/` mindestens:
     - `audio.*`
     - `meta.json`
   - In der Event-Detailseite wird das Testimonial in der Liste angezeigt (Audio abspielbar).

## Flow C: Final Draft erzeugen (filesystem-only)

1. In der Event-Detailseite (als Owner/Moderator) klicke **„Final-Draft erzeugen“**.
2. Erwartung:
   - Im Storage entsteht `<slug>/finals/run-<timestamp>/event-final.md`.
   - Es wird **noch nichts** im Explorer ersetzt (keine Ingestion, kein Delete).

## Flow C: Final veröffentlichen (Index-Swap)

1. Klicke **„Final veröffentlichen“**.
2. Erwartung:
   - Final wird ingestiert (neuer Index-Eintrag).
   - Original wird aus dem Index gelöscht (Datei bleibt im Storage).
   - In der Gallery/Explore-Ansicht siehst du den Event weiterhin „am selben Platz“ (gleicher slug), aber inhaltlich den Final.

## Hinweise bei Problemen

- Wenn Final „publiziert“ wird, aber du siehst Duplikate: prüfen, ob der Index slug-eindeutig ist; ggf. Cleanup über `/api/chat/[libraryId]/docs/delete`.
- Wenn Upload im anon Recorder fehlschlägt: prüfen, ob der Event im Frontmatter `testimonialWriteKey` hat und ob der Link diesen Key enthält.

