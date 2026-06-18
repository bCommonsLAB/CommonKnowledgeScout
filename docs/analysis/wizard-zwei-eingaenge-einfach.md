# Datei-Import vs. Ziel-Wizard — einfach erklärt

Status: Notiz (einfache Sprache). Datum: 2026-06-18.
Hintergrund/Detail: `docs/adr/0003-wizard-schema-template-trennen.md`,
`docs/roadmap-formatunabhaengige-library-und-onboarding.md` (Plan 2).

## Worum geht es

Es gibt zwei **Eingänge** zum gleichen Ziel: aus etwas (Datei, Text, Webseite,
Diktat) wird ein fertiges Dokument im Archiv.

- **Eingang A — „Ich habe eine Datei":** hochladen, danach sagen *was es ist*, fertig.
- **Eingang B — „Ich will etwas Bestimmtes machen":** erst das Ziel wählen
  (z. B. Testimonial, Event), dann sagen *woher* der Inhalt kommt (Webseite,
  Freitext, Diktat, PDF).

Der Unterschied ist eigentlich nur die **Reihenfolge** (erst Inhalt / erst Ziel).
Dahinter passiert das Gleiche.

## Das Bild: eine Maschine, mehrere Türen

Es sind **nicht zwei Maschinen**, sondern **eine Maschine mit mehreren Türen**.
Beide Türen führen in denselben Raum. „Im Explorer einbetten" wäre auch keine
neue Maschine — nur **eine weitere Tür**.

## Ist der Datei-Import jetzt eine eigene Maschine? — Nein

Im Code nachgesehen (Stand 2026-06-18):

- Es gibt **einen** Wizard: `CreationWizard` (`src/components/creation-wizard/
  creation-wizard.tsx`), gestartet aus `src/app/library/create/[typeId]/page.tsx`.
  Die Schritte kommen aus **einer** geteilten Engine (`src/lib/creation/
  wizard-flow.ts`, Step-Registry, Renderer).
- „Nur importieren und transkribieren" ist **kein eigener Wizard**, sondern eine
  **Option im Schritt „Inhaltstyp wählen"** (`select-schema-type-step.tsx`):
  man wählt entweder einen Inhaltstyp **oder** „nur importieren/transkribieren"
  (`captureTranscriptOnly`).
- Danach ist es nur ein **Schalter** (`if (transcriptOnly) …`) im selben
  Speichern-/Promote-Ablauf — andere Beschriftungen, keine Transformation,
  „im Archiv speichern" statt „publizieren".

→ Also: **dieselbe Maschine, eine Option drin** — kein drittes, getrenntes Ding.

## Die ehrliche Einschränkung (der eigentliche Aufräumpunkt)

Dieser Schalter ist als **viele verstreute `if (transcriptOnly)`-Stellen** im
großen `creation-wizard.tsx` verdrahtet (~15 Stellen: Labels, Zähler, Speichern-
Logik). Es ist *eine* Maschine, aber der Import-Modus ist als **Sonderfall
eingestreut**, nicht als saubere eigene Betriebsart. Solche Streuung neigt mit
der Zeit dazu, sich „wie ein eigenes Ding" anzufühlen und auseinanderzulaufen
(genau das haben wir bei den Bild-/Zähler-Befunden gesehen).

## Die Gefahr, wenn man es schleifen lässt

- alles **doppelt** pflegen,
- die Wege laufen **auseinander**,
- Nutzer fragen: „Warum gibt es zwei Wege?"

## Empfehlung

1. **Langfristig:** eine Maschine, mehrere Türen — der „eine Assistent". Das ist
   ohnehin der geplante Weg (Fahrplan Plan 2, ADR-0003).
2. **Jetzt:** den Import-Modus **nicht** zum eigenen Ding werden lassen — die
   verstreuten `if (transcriptOnly)` zu einer **sauberen Betriebsart**
   zusammenfassen (im Sinne von „ein Inhaltstyp ohne Transformation").
3. **Großen Umbau aber nicht jetzt starten:** der Fahrplan sagt *erst Plan 1
   fertig, dann der Assistent (Plan 2)*. Sonst kollidiert es mit der schon
   geplanten Aufräumarbeit (Templates entflechten, 2a).

## Kurz gesagt

> Es sind nicht zwei Logiken, sondern **ein Ablauf mit mehreren Einstiegen** —
> und der Datei-Import ist schon **drin** (als Option), nur etwas unsauber
> verteilt. Aufräumen ja, aber geordnet zum geplanten Zeitpunkt.
</content>
