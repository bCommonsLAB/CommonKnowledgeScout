# Wizard: Event finalisieren

- **docType:** `event` (erweitert `event`) · **Renderer:** `session`
- **Vorlage (Prüfstand):** [`test-library/templates/event-final.md`](../../test-library/templates/event-final.md)
- **Status:** 🟢 Entwurf · nutzt **Ziel-Mechanik** (`extends`), die heute noch
  nicht wirkt

## Ziel

Aus einem **bestehenden Event** plus ausgewählten **Testimonials** entsteht ein
**finaler, publikationsreifer Bericht** — die Stimmen der Teilnehmenden werden zu
einer runden Story verdichtet.

## User-Story

- Als **Organisator:in** möchte ich nach dem Event die besten Testimonials
  auswählen und zu einem finalen Bericht zusammenführen, **damit** eine
  abschließende, teilbare Story entsteht.

## Wann benutzen — und wann nicht

- **Benutze ihn**, wenn ein Event bereits existiert und Testimonials vorliegen.
- **Nicht** zum **Neuanlegen** eines Events → „Event erfassen".
- **Nicht** für ein einzelnes Zitat → „Testimonial erfassen".

## Die Schritte

### 1 — Willkommen
- **Mensch:** liest kurz. · **System:** erklärt den Finalisierungs-Zweck.

### 2 — Testimonials auswählen
- **Mensch:** wählt die Testimonials, die einfließen sollen.
- **System:** bietet die zum Event gehörenden Testimonials an.
- **Warum:** der Mensch kuratiert die Auswahl.

### 3 — Finalen Entwurf erzeugen
- **Mensch:** prüft den Entwurf. · **System:** verdichtet Event + gewählte
  Testimonials (Mehr-Quellen-Zusammenführung) zu **einer** finalen Seite.
- **Warum:** aus vielen Teilen wird eine runde Story.

### 4 — Bericht prüfen
- **Mensch:** prüft/korrigiert **Titel, Zusammenfassung, Fließtext, Eindruck der
  Teilnehmenden, eingebundene Testimonials**.
- **System:** zeigt **nur Inhalts-Felder**. **System-Felder** (`slug`,
  `originalFileId`, `finalRunId`, `eventStatus`) sind **automatisch gesetzt** und
  nicht editierbar (R3).
- **Warum:** Status/Verknüpfungen sind Maschinensache, nicht Nutzersache.
- **Falle:** würde man Status-Felder zeigen, entstünde Verwirrung/Fehlbedienung.

### 5 — Vorschau
- **Mensch:** sieht den finalen Bericht. · **System:** rendert `session`.

### 6 — Veröffentlichen (Index-Swap)
- **Mensch:** klickt „Veröffentlichen". · **System:** speichert den finalen
  Bericht + Suchindex.
- **Warum:** der finale Bericht ersetzt/ergänzt die ursprüngliche Story.

## Bewusst NICHT (damit es niemanden überfordert)

- **Keine** Bearbeitung von Status-/System-Feldern (R3).
- **Kein** Neuanlegen von Event-Stammdaten hier.
- **Keine** freie Quellwahl — Quellen sind das Event + seine Testimonials.

## Erfolgskriterien

> `auto` = heute im Code testbar · `auto-🎯` = sobald `extends` wirkt · `UI`.

- [ ] `auto` Flow enthält **Testimonials auswählen** (`selectRelatedTestimonials`).
- [ ] `auto` „Bericht prüfen" zeigt genau `title, summary, bodyInText,
  eindruckDerTeilnehmer, testimonials`.
- [ ] `auto` „Bericht prüfen" zeigt **keine** System-Felder (`slug`,
  `originalFileId`, `finalRunId`, `eventStatus`).
- [ ] `auto` Vorschau/Renderer ist `session`.
- [ ] `auto-🎯` `extends: event` zieht die Basis-Event-Felder hinzu (heute inert).
- [ ] `UI` Testimonial-Auswahl zeigt die zum Event gehörenden Testimonials.

## Offene Fragen

- „Index-Swap": ersetzt der finale Bericht die ursprüngliche Story sichtbar, oder
  bleiben beide?
- Wie wird die Basis (`extends: event`) zur Laufzeit gemerged (Phase 3a)?
