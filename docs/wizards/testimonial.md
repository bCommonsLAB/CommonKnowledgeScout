# Wizard: Testimonial erfassen

- **docType:** `testimonial` · **Renderer:** `testimonial`
- **Vorlage (Prüfstand):** [`test-library/templates/testimonial.md`](../../test-library/templates/testimonial.md)
- **Status:** 🟢 Entwurf

## Ziel

Aus einer **gesprochenen** Aussage entsteht ein kurzes, **zitierfähiges
Testimonial** (Zitat + Name + optional Porträt). Für Menschen, die spontan
festhalten wollen, was sie bewegt hat — ohne zu tippen.

## User-Story

- Als **Teilnehmer:in** möchte ich mein Statement **einsprechen**, **damit** es
  als sauberes Zitat gespeichert wird, das ich vorher noch prüfen kann.

## Wann benutzen — und wann nicht

- **Benutze ihn** für ein **einzelnes** O-Ton-Zitat einer Person.
- **Nicht** für ganze Berichte/Events → „Event erfassen".
- Testimonials **gehören** thematisch zu einem Event (Bezug ist vorgesehen).

## Die Schritte

### 1 — Willkommen
- **Mensch:** liest kurz. · **System:** zeigt Erklärung. · **Warum:** Orientierung.

### 2 — Diktieren
- **Mensch:** spricht das Statement ein. · **System:** transkribiert; „Weiter"
  erst, wenn Text da ist.
- **Warum:** Sprechen ist niederschwelliger als Tippen.
- **Falle:** Roh-Transkript ist holprig → im nächsten Schritt korrigierbar.

### 3 — Aussage prüfen
- **Mensch:** prüft/korrigiert **Titel, Aussage, Name** und lädt optional ein
  **Porträtbild** hoch. · **System:** glättet den Stil, **ohne** den Inhalt zu
  verändern; zeigt nur diese Felder.
- **Warum:** die Person bestätigt ihr eigenes Zitat (Authentizität).
- **Falle:** Inhalt umschreiben wäre Vertrauensbruch → nur glätten.

### 4 — Speichern
- **Mensch:** klickt „Speichern". · **System:** legt das Testimonial ab
  (bewusst **ohne** sofortige Suchindex-Aufnahme).
- **Warum:** ein Zitat ist Bauteil, nicht eigenständige Such-Story.

## Bewusst NICHT (damit es niemanden überfordert)

- **Kein** langes Formular — nur Zitat, Name, optional Bild.
- **Keine** inhaltliche Umformulierung durch das System.
- **Keine** technischen Felder.

## Erfolgskriterien

> `auto` = heute im Code testbar · `UI` = nur durch Durchklicken.

- [ ] `auto` Einzige Quelle ist **Diktat** (`spoken`).
- [ ] `auto` „Aussage prüfen" zeigt genau `title, statement, author_name,
  author_image_url, filename`; `author_image_url` ist ein **Bild-Feld**.
- [ ] `auto` Vorschau/Renderer ist `testimonial`.
- [ ] `auto` Speichern nimmt **nicht** automatisch in den Suchindex auf.
- [ ] `UI` Diktat transkribiert und ist vor dem Speichern editierbar.
- [ ] `UI` Porträtbild lässt sich hochladen.

## Offene Fragen

- Soll der Bezug zum Event hier aktiv ausgewählt werden, oder erst beim
  Finalisieren des Events?
