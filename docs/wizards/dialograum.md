# Wizard: Dialograum-Ergebnis erfassen

- **docType:** `dialograum` · **Renderer:** `blog`
- **Vorlage (Prüfstand):** [`test-library/templates/dialograum.md`](../../test-library/templates/dialograum.md)
- **Status:** 🟢 Entwurf

## Ziel

Das **Ergebnis** eines Dialograums (moderiertes Gespräch) wird als lesbarer
Beitrag festgehalten — aus einer **Datei** (Protokoll, Foto, Audio) oder
**Freitext** — und mit passenden **Testimonials** verknüpft.

## User-Story

- Als **Moderator:in** möchte ich das Gesprächsergebnis hochladen oder
  zusammenfassen, **damit** es nachlesbar wird.
- Als **Moderator:in** möchte ich passende **Testimonials zuordnen**, **damit**
  Stimmen der Teilnehmenden sichtbar werden.

## Wann benutzen — und wann nicht

- **Benutze ihn** für das Ergebnis eines Dialograums/Workshops.
- **Nicht** für ein einzelnes Zitat → „Testimonial erfassen".
- **Nicht** für ein Veranstaltungs-Event → „Event erfassen".

## Die Schritte

### 1 — Willkommen
- **Mensch:** liest kurz. · **System:** zeigt Erklärung. · **Warum:** Orientierung.

### 2 — Quelle wählen
- **Mensch:** lädt eine **Datei** hoch oder tippt/diktiert **Freitext**.
- **System:** übernimmt die Quelle; „Weiter" erst, wenn etwas da ist.
- **Warum:** Rohmaterial liegt oft als Foto/Protokoll vor.

### 3 — Testimonials zuordnen
- **Mensch:** wählt passende Testimonials aus. · **System:** bietet die
  vorhandenen Testimonials an (optionaler Schritt).
- **Warum:** verbindet das Ergebnis mit O-Tönen.
- **Falle:** Pflicht-Zuordnung würde blockieren → bewusst optional.

### 4 — Entwurf erzeugen
- **Mensch:** prüft den Entwurf. · **System:** verdichtet Rohmaterial +
  zugeordnete Testimonials zu einem lesbaren Ergebnis.
- **Warum:** Schreibarbeit abnehmen.
- ⚠️ **Heute-Hinweis:** Der Entwurf-Schritt wird vom Runtime aktuell nur bei
  **Ordner-Start** angezeigt. Für Datei/Text-Quellen ist zu klären, ob das
  gewollt ist (siehe Offene Fragen).

### 5 — Ergebnis prüfen
- **Mensch:** prüft/korrigiert **Titel, Zusammenfassung, Ergebnistext, Dateiname**.
- **System:** zeigt nur diese Inhalts-Felder.
- **Warum:** der Mensch bestätigt das Ergebnis.

### 6 — Veröffentlichen
- **Mensch:** klickt „Veröffentlichen". · **System:** speichert + Suchindex.
- **Warum:** ab hier ist das Ergebnis auffindbar.

## Bewusst NICHT (damit es niemanden überfordert)

- **Keine** Pflicht zur Testimonial-Zuordnung.
- **Keine** technischen Felder.
- **Kein** ungefiltertes Übernehmen langer Protokolle (Verdichtung).

## Erfolgskriterien

> `auto` = heute im Code testbar · `UI` = nur durch Durchklicken.

- [ ] `auto` Quelltypen sind **Datei** und **Text**.
- [ ] `auto` Flow enthält den Schritt **Testimonials zuordnen**
  (`selectRelatedTestimonials`).
- [ ] `auto` „Ergebnis prüfen" zeigt genau `title, summary, result_text, filename`.
- [ ] `auto` Vorschau/Renderer ist `blog`.
- [ ] `UI` Testimonial-Zuordnung ist überspringbar.

## Offene Fragen

- **Entwurf-Schritt bei Datei/Text:** Soll „Entwurf erzeugen" auch ohne
  Ordner-Start erscheinen? (Heutiges Filter-Verhalten blendet ihn dann aus.)
