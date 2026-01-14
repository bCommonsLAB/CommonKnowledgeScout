## Frage

Der Nutzer möchte **nur einen Testimonial-Flow**: den Wizard-Flow. Zusätzlich ist ein „leichter“ Wizard denkbar, der UX-mäßig so schnell ist wie der bisherige anonyme Flow.

## Ist-Zustand (beobachtbar im Code)

- **Public Flow** (öffentlich, ohne Login):
  - Seite: `/public/testimonial` → `src/app/public/testimonial/page.tsx` → `PublicTestimonialRecorder`
  - API: `/api/public/testimonials` → `src/app/api/public/testimonials/route.ts`
  - Zweck: Aufnahme/Erfassung via QR-Link (mit `libraryId`, `eventFileId`, optional `writeKey`)
  - Speicherung: in `<eventFolder>/testimonials/<id>/...` (Audio + `meta.json`, inzwischen optional `text`).

- **Wizard Flow** (authentifiziert, innerhalb der Library):
  - Route: `/library/create/<templateId>?seedFileId=...&targetFolderId=...`
  - Zweck: Template-basiertes Erstellen von Markdown-Dateien (z.B. `testimonial-*.md`) inkl. Bearbeitungsschritten.

## Warum gibt es den Public Flow überhaupt?

Er erfüllt eine reale UX-Anforderung: **Teilnehmende sollen ohne Login** (per QR) ein Testimonial abgeben können.
Das ist nicht „Wizard“, weil der Wizard aktuell im authentifizierten Bereich lebt und mehr UI/State/Steps hat.

## Problem

Zwei Flows erzeugen zwei Datenformen:
- Wizard → Markdown-Dokument(e)
- Public → RAW-Audio + `meta.json` (ggf. Text)

Dadurch entstehen Inkonsistenzen im späteren „Finalize“-Schritt, wenn der Wizard ausschließlich Markdown-Quellen erwartet.

## Zielbild

Einheitlicher Prozess:
- **Ein Entry-Flow** (Wizard) für Owner/Moderator.
- Für Externe: entweder
  - ein „Light-Wizard“ (öffentlich, minimal), oder
  - weiterhin ein Public-Recorder, der aber **immer** ein Markdown-Dokument erzeugt (damit Downstream identisch ist).

## Lösungsvarianten (3 Optionen)

### Variante 1: Public Flow komplett entfernen
- **Pro**: Nur ein Flow, weniger Wartung, weniger Security-Oberfläche.
- **Contra**: Externe/Anonyme Teilnahme ohne Login fällt weg oder braucht neuen „Guest Auth“-Mechanismus.

### Variante 2: Public Flow wird zum „Public Light-Wizard“
- **Idee**: Öffentliche Wizard-Route (sehr wenige Steps) mit denselben Speicherkonventionen wie Wizard (Markdown als Ergebnis).
- **Pro**: Einheitliche Datenform, gleiche Komponenten/UX-Paradigmen.
- **Contra**: Wizard-Framework muss public-tauglich gemacht werden (Security, State, weniger Datenzugriff).

### Variante 3: Public Flow bleibt, erzeugt aber immer Markdown (SSOT)
- **Idee**: `/api/public/testimonials` erzeugt zusätzlich `testimonial.md` (mit Frontmatter für Discovery), sodass Downstream nur noch Markdown verarbeitet.
- **Pro**: Minimalinvasiv, keine neue Orchestrierung, Public-UX bleibt.
- **Contra**: Weiterhin zwei UI-Flows (auch wenn Datenform harmonisiert ist).

## Empfehlung (hypothesenbasiert, nicht getestet)

Kurzfristig: Variante 3 ist der kleinste Schritt, um Datenkonsistenz zu erreichen.
Mittelfristig: Variante 2, wenn wirklich „ein Flow“ als Produktziel gilt.

