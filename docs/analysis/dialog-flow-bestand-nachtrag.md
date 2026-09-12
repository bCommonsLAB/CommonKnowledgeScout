# Dialog-Flow Bestand — Nachtrag der zweiten Prüfung (12.09.)

**Bezug:** `docs/analysis/dialog-flow-bestand.md` (Branch
`claude/dialog-flow-bestand`, mit Zugriff auf die Prod-Datenbank und einem
Live-Test; Archivkopie „2026-09-12 Analyse Dialog-Flow Bestand.md"). Diese
Datei ergänzt sie aus einer zweiten, unabhängigen Prüfung am Code (Branch
`claude/clever-hypatia-8ar4yd`, ohne Datenbank, ohne Live-Test) und liefert
das, was dort fehlt: die Zeile je Screen der Dialog-Zeile des Klickmodells.
Sie ersetzt nichts.

## 1. Was die zweite Prüfung bestätigt

Am Code nachvollzogen, Datei und Zeile stimmen:

- Gast-Seite `/public/testimonial` fehlt in `isPublicRoute`
  (`src/middleware.ts:39-52`), `auth.protect()` greift; die API-Routen unter
  `/api/public/*` laufen ohne Konto. Der QR-Code zeigt bevorzugt auf den
  Login-Wizard (`session-detail.tsx:250-260`, `:663`).
- `author_is_named` wird gelesen, aber nirgends ausgewertet
  (`testimonial-detail.tsx:56`, `:63-65`); Registry kennt nur `author_name`,
  `author_role`, `author_image_url` (`detail-view-type-registry.ts:270-287`);
  Discovery liest nur `speakerName`, sonst „Anonym"
  (`testimonial-discovery.ts:101`, `:171`; `event-testimonial-discovery.ts:31`).
- Nennungsstufen und `spoken`-Diktat liegen in zwei verschiedenen Vorlagen
  (`testimonial-creation-de` bzw. `event-testimonial-creation-de`); keine hat
  beides.
- Elf Presets in der Registry, `publish` im Legacy-Switch
  (`step-registry.tsx:34-46`, `creation-wizard.tsx:2454`); Verzweigungen an
  Template-Namen in `editDraft` (`edit-draft-step.tsx:325-326`), `generateDraft`
  (`draft-step-renderers.tsx:56`, `:112`), `previewDetail`
  (`preview-detail-renderer.tsx:16`, `:33`), Finalize-Default hartkodiert
  (`creation-wizard.tsx:1571`), Seed-Weiche (`:486-496`).
- Datei-Input ohne `multiple`, eine `pendingFileSource`
  (`collect-source-step.tsx:455`); `review-step.tsx` und
  `review-fields-step.tsx` ohne Referenz; `chooseSource` in keiner Vorlage.
- `event-finalize-de` ohne Bildfeld; Bildupload des Wizards läuft über
  `/api/creation/upload-image` (`upload-images-step.tsx:75`); Stimmen-Liste
  ohne Bild (`testimonial-list.tsx`).
- `events/finalize` ohne Aufrufer; Testimonials „filesystem-only", nicht im
  Index (`creation-wizard.tsx:2255-2262`).

Nicht prüfbar aus dem Cloud-Agenten und deshalb unbesehen übernommen: der
Mongo-Stand der Vorlagen (1.1 der Hauptanalyse), der Live-Befund „anonym 404",
die Git-Daten `6e5c9c0e`, `630ea0f9`, `6f3b697f`, `0a468d67` (im verdichteten
Klon nicht vorhanden).

## 2. Zwei Präzisierungen

1. **Der Gast-Recorder zeigt weder Leitfragen noch Vorschau.**
   `testimonial-recorder.tsx` (157 Z.) hat Name, Einwilligungs-Checkbox,
   Live-Diktat, Senden — keine `q1`–`q3`, keine Vorschau der formulierten
   Stimme, kein `generateDraft`; die Route schreibt das Transkript
   (`public/testimonials/route.ts:266-287`), transformiert wird erst im
   Finalize. Die drei Fragen und die Vorschau gibt es nur im **angemeldeten**
   Wizard (`event-testimonial-creation-de`: collectSource → generateDraft →
   editDraft → previewDetail). Für den Ernte-Screen „drei Fragen, Diktat,
   Vorschau der eigenen Stimme, bestätigen — in einem Zug" heißt das: Leitfragen
   aus der Vorlage in den Recorder, Nennungszeile, ein LLM-Aufruf je Stimme im
   Public-Pfad mit Vorschau. **S4 ist nicht 0 PT, sondern 2–3 PT.** Die Summe
   der Dialog-Welle liegt damit bei **10 bis 16 PT** statt 8 bis 13; Pflicht
   für einen ersten Abend unverändert klein (Route + QR, Nennungsfelder,
   Abschluss), der Ernte-Screen kann nach dem ersten Abend kommen, wenn die
   Gruppe mit dem Login-Wizard am Tablet der Moderatorin erfasst.
2. **„Nicht der halbe Composer" gilt für das Anlagen-Modell, nicht für das
   Sammeln.** `collectSource` führt eine Quellenliste gemischter Art (Text,
   eine Datei, URL) mit Zusammenfassung je Quelle und das Live-Diktat
   (`DictationTextarea mode="live"`, `:1067-1071`). Kein Zustand je Anlage,
   keine Wiederaufnahme, ein Job für alles — das bleibt Neubau. Für die
   Composer-Scheiben C3/C4 sind Diktatfeld und Quellenliste der Startpunkt
   (Abzug 2–3 PT von 14–20); C1, C2, C5–C10 unverändert.

## 3. Eine Zeile je Screen der Dialog-Zeile im Klickmodell

Die Hauptanalyse urteilt über die sechs D-Screens der Landkarte. Das
Klickmodell (Figma `node-id=60-2`, Zeile Dialogformate, Stand 12.09.) hat
fünfzehn Screens, acht davon Kopien vom 11.09. abends. Zeile je Screen:

| Screen | Herkunft | Urteil | Begründung |
|---|---|---|---|
| D-S0.1 Gespräche anlegen & einladen | Kopie M-S0.2 | **existiert** | Event-Container-Wizard + QR; umbenennen „Runde anlegen, QR zeigen"; Stimmungs-Felder neu (klein) |
| D-S1.1 Einladung zum Gespräch | Kopie A-S1.1 | **existiert**, Zugang **neu (eine Zeile)** | Recorder-Kopf; Public-Route nach Entscheidung |
| D-S2.2 Einwilligung zum Zitat | Landkarte | **streichen** | Einwilligung fällt einmal im Ernte-Screen, mit Nennungszeile (konfigurierbar) |
| D-S3.1 Dein Gespräch | Kopie T-S3.1 | **streichen** | kein Orientieren vor dem Sprechen |
| D-S4.4 Langes Testimonial läuft | Landkarte | **existiert** → Ernte-Screen | Recorder; Leitfragen konfigurierbar, Nennungszeile konfigurierbar, Vorschau neu (klein) |
| D-S4.4b Anhören & Stellen streichen | Landkarte | **streichen** | Transformation ist Aufwertung (Befund §6) |
| D-S4.5 Gespräch führen | Landkarte, nie gebaut | **streichen** | widerspricht der Verabredung (Befund §1) |
| T-S5.1 (Dialog) Prüfen & Einwilligen | Landkarte | **streichen** | ersetzt durch „Vorschau meiner Stimme · bestätigen" im Ernte-Screen |
| D-S5.2 Freigegeben | Kopie T-S5.2 | **existiert** | Erfolgsmeldung des Recorders; Text: „Deine Stimme ist da — wir sehen sie gleich gemeinsam" |
| D-S6.1 Mein Zitat freigeben | Landkarte | **streichen** | keine Freigabe je Stelle |
| D-S8.1 Eingang Gespräche | Kopie M-S8.1 | **streichen** | kein S8; Löschen durch Moderation als Notbremse existiert |
| D-S8b.3 Quellen für den Artikel wählen | Landkarte | **existiert**, ausblenden | `selectRelatedTestimonials` wählt alle; Schritt aus der Vorlage nehmen |
| D-S8b.2 Artikel-Fassung freigeben | Kopie M-S8b.2 | **streichen** → **existiert** als Abschluss | Vorschau (Beamer) + Feinschliff + Publish sind da; Köpfe und Gruppenbild neu (klein) |
| D-S9.1 Was liegt zu Rosa vor? | Kopie T-S9.1 | **konfigurierbar** | Chat auf dem finalen Dokument; „zu dieser Runde", nicht „zu Rosa" |
| D-S10.1 Artikel veröffentlichen | Landkarte | **existiert** (Publish-Step), Inhalt ändern | kein Kanal, kein Artikel: die Dialog-Seite, erst geschützt; Galerie der Köpfe erweitern |
| D-S11.1 Meine Zitate | Kopie T-S11.1 | **neu (klein)** | Rückkehr-Link mit Widerruf (Claim-Token) |

Ergebnis: die Dialog-Zeile schrumpft von fünfzehn auf **sieben** Screens —
Runde anlegen + QR · Einladung/Recorder-Kopf · Ernte-Screen · „Deine Stimme
ist da" · gemeinsamer Abschluss (Vorschau am Beamer, Feinschliff, ein
Speichern) · Dialog-Seite mit Köpfen · Meine Stimme (Widerruf). Das deckt sich
mit der Hauptanalyse („zwei eigene Screens, der Rest existiert"). Umbau des
Klickmodells nach Peters Entscheidungen (Hauptanalyse, Abschnitt 5).

## 4. Folgen für die drei Konzepte (Ergänzung zu Teil 3)

- **Wiederverwendung je Station:** Widerspruch 15 — S4 wurde am Composer
  gemessen; für den Ein-Quellen-Fall trägt der Recorder den Pfad Diktat →
  Transkript → Speichern seit Januar. „Neu" bleibt für Anlagen mit Zustand.
- **Composer-Konzept:** Punkt 3 unter „Offen" (Testimonials auf den Composer
  ziehen) wird umgekehrt: der Recorder ist der Prototyp des Ernte-Screens und
  der erste Bewohner der mobilen Schale (C7), nicht Altlast.
- **Architektur-Konzept:** Welle D0 „Dialog auf Bestand" neben E0/E1, nicht
  davor. Regelsatz `capture.*` braucht `zugang: konto | qr` je Library und
  `kuratierung: keine` als gültigen Wert; E2 (`consents`) migriert den
  Testimonial-Bool `consent`.

## Verweise

- Hauptanalyse: `docs/analysis/dialog-flow-bestand.md` (Branch
  `claude/dialog-flow-bestand`) bzw. Archiv „2026-09-12 Analyse Dialog-Flow
  Bestand.md"
- Handover und Befund vom 12.09. im Archivordner
- Klickmodell: https://www.figma.com/design/2Eb9gkeKcHzhY7kR1kPyKs?node-id=60-2
