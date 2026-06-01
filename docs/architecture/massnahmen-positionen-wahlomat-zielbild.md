# Zielbild: Positionen der Interessengruppen & Wahl-O-Mat (Maßnahmen-Detail)

> Konzept für den Umbau der Maßnahmen-Detailansicht: kompakte, aufklappbare
> Gliederung (Accordion) + ein Vergleich der Positionen verschiedener
> Interessengruppen, der perspektivisch wie ein Wahl-O-Mat mit Bürger-Diskussion
> funktioniert.
>
> Status: **Zielbild / Designvorschlag** — phasenweise Umsetzung. Schließt an
> [`perspektiven-bruecken-zielbild.md`](perspektiven-bruecken-zielbild.md),
> [`massnahmen-bewertung-und-graph-zielbild.md`](massnahmen-bewertung-und-graph-zielbild.md)
> sowie das SDG-Profil-Feature an.

## Kontext / Problem

Die Detailansicht einer Maßnahme wird inhaltlich dichter: Volltext,
**KI-Einschätzung** (`climate-action-rating`), **SDG-Profil** (Rad) und künftig
die **Positionen mehrerer Interessengruppen**. Heute ist der Body ein langer,
durchgehender Fluss — das wird unübersichtlich.

Zwei Ziele:
1. Body **kompakt** und in **aufklappbare Abschnitte** gliedern.
2. Die Positionen vieler Gruppen so darstellen, dass der Anwender sie **direkt
   vergleichen** kann — und am Ende wie bei einem **Wahl-O-Mat** eine eigene
   Haltung einnehmen und darunter diskutieren kann.

SDG-Profil, KI-Einschätzung und Positionen sind **unterschiedliche** Informationen
für die Bewusstseinsbildung und bleiben getrennte Abschnitte.

## Zielbild der Detailansicht (Accordion)

Body über das vorhandene `src/components/ui/accordion.tsx` in Abschnitte gliedern
(erster offen, Rest eingeklappt):

1. **Zusammenfassung** (offen)
2. **KI-Einschätzung** — bestehende `climate-action-rating`
3. **SDG-Profil** — das SDG-Rad
4. **Positionen der Interessengruppen** — neu (s. u.)
5. **Volltext**
6. **Diskussion / Kommentare** — Wahl-O-Mat-Bereich

## Stakeholder-Taxonomie

Feste, generische Liste (analog zu `SDG_LIST` in `src/lib/gallery/sdg-meta.ts`),
je Eintrag: Schlüssel, i18n-Label, **Farbton** (mentale Zuordnung) und
**Icon** (Lucide). Vorschlag:

| Schlüssel          | Label              | Farbton (Tailwind) | Icon (Lucide)   |
| ------------------ | ------------------ | ------------------ | --------------- |
| `landesverwaltung` | Landesverwaltung   | slate              | `Landmark`      |
| `politik`          | Politik            | indigo             | `Vote`          |
| `gemeinden`        | Gemeinden          | teal               | `Building2`     |
| `wirtschaft`       | Wirtschaft         | amber              | `Briefcase`     |
| `landwirtschaft`   | Landwirtschaft     | green              | `Wheat`         |
| `tourismus`        | Tourismus          | cyan               | `Mountain`      |
| `umweltverbaende`  | Umweltverbände     | emerald            | `Leaf`          |
| `sozial`           | Sozialbereich      | rose               | `HeartHandshake`|
| `wissenschaft`     | Wissenschaft       | violet             | `GraduationCap` |
| `buerger`          | Bürger             | orange             | `Users`         |

Neue Datei: `src/lib/gallery/stakeholder-meta.ts` (Taxonomie + Extraktion +
Helfer, reine Daten/Logik wie `sdg-meta.ts`).

## Datenmodell (flaches Frontmatter, Obsidian-konform)

Pro Gruppe **zwei flache** `snake_case`-Felder (keine verschachtelten Objekte,
keine Dot-Notation — AGENTS-Regel):

- `position_<key>` — die Position in **1–2 Sätzen** (Text)
- `position_<key>_haltung` — **Haltung**: `dafuer | dagegen | neutral | gemischt`

Beispiel: `position_wirtschaft`, `position_wirtschaft_haltung`,
`position_umweltverbaende`, `position_umweltverbaende_haltung`, …

Die bestehende „Position der Landesverwaltung" (`lv_bewertung`,
`lv_zustaendigkeit`, `arbeitsgruppe`) wird als Gruppe `landesverwaltung`
eingeordnet bzw. dorthin überführt.

Wie beim SDG-Profil fließen die flachen Felder automatisch nach `docMetaJson`
(kein Pipeline-Schreibpfad-Eingriff). Erzeugt werden sie über das Template
(systemprompt + Antwortschema), nicht hartkodiert.

## Positionen-Kacheln (Vergleich „Schachbrett")

Ein gleichförmiges, responsives Raster (2–3 Spalten). Jede Kachel:

- **Kopf:** Icon + Gruppenname, linker **Akzentbalken** im Gruppen-Farbton
- **Haltungs-Badge:** Dafür / Dagegen / Neutral / Gemischt, farbcodiert
  (grün / rot / grau / amber)
- **Positionstext** (1–2 Sätze)

Der Vergleich entsteht durch das einheitliche Raster — alle Positionen
nebeneinander, gleiche Struktur, schnell scanbar. Optionaler späterer
„Vergleichsmodus": 2–3 Gruppen hervorheben/nebeneinander pinnen.

Neue Komponenten:
- `src/components/library/gallery/stakeholder-positions.tsx` (Raster)
- `src/components/library/gallery/stakeholder-tile.tsx` (Einzelkachel)

Generisch + flag-gesteuert denkbar wie das SDG-Profil
(`config.chat.gallery.showStakeholderPositions`), damit es library-übergreifend
nutzbar ist.

## Haltungs-Dimension

`position_<key>_haltung` ∈ `{ dafuer, dagegen, neutral, gemischt }`.
- Steuert Badge-Farbe und Sortier-/Filtermöglichkeiten.
- Ist die Grundlage für den späteren **Wahl-O-Mat-Match** (Bürger-Haltung vs.
  Gruppen-Haltung).
- Fehlt die Haltung, wird nur der Positionstext gezeigt (kein Silent Default).

## Wahl-O-Mat (Phasen)

- **Phase 1 (jetzt):** Positionen-Raster + darunter die **bestehende
  Kommentar-/Diskussions-Sektion**. Bürger diskutieren je Maßnahme.
- **Phase 2 (später):** Bürger gibt je Maßnahme/These eine eigene **Haltung** ab
  (Dafür/Dagegen/Neutral). Anzeige des **Matches** zu den Interessengruppen (wer
  liegt am nächsten). Persistenz + Aggregation über das vorhandene
  Voting-/Kommentar-System in MongoDB (getrennt von Clerk gemäß
  [`ADR 0002`](../adr/0002-galerie-sterne-ohne-clerk-read.md)), analog zu den
  Galerie-Sternen.

## Abgrenzung: SDG vs. KI-Einschätzung vs. Positionen

- **SDG-Profil:** Beitrag zu den 17 Nachhaltigkeitszielen (0..1, neutral/global).
- **KI-Einschätzung:** generierte Bewertung/Einordnung der Maßnahme.
- **Positionen:** Sicht **verschiedener Interessengruppen** (subjektiv, mit
  Haltung) — Basis für Vergleich und Wahl-O-Mat.

Drei getrennte Accordion-Abschnitte, drei getrennte Datenquellen.

## Architektur-Touchpoints

- **Anzeige generisch:** Einhängepunkt wie beim SDG-Profil
  (`detail-overlay.tsx`) bzw. Accordion-Umbau in `climate-action-detail.tsx`.
- **Taxonomie/Logik:** neue `stakeholder-meta.ts` (+ Extraktion aus `docMetaJson`).
- **UI:** `stakeholder-positions.tsx`, `stakeholder-tile.tsx`, Accordion-Wrapper.
- **Template:** Felder `position_<key>` + `position_<key>_haltung` in
  systemprompt + Antwortschema (Klima-Template als erste Instanz).
- **i18n:** Gruppen-Labels + Haltungs-Labels in `de/en/es/fr/it`.
- **Facetten:** `position_<key>_haltung` ist als indiziertes Feld direkt
  facettierbar (config-basiert, wie beim SDG-Profil).
- **Kommentare/Voting:** bestehendes System (MongoDB), ADR 0002.

## Phasenplan

1. **Accordion-Aufräumen** der Detailansicht (klein, in sich abgeschlossen).
2. **Positionen-Kacheln** inkl. Taxonomie, flache Felder, Haltungs-Badge,
   Template-Felder, i18n.
3. **Wahl-O-Mat Phase 2**: Bürger-Haltung + Match + Aggregation.

## Offene Punkte

- Endgültige Gruppen-Liste & Farbzuordnung bestätigen (obige 10 sind Vorschlag).
- Genaue Haltungs-Werte (`gemischt` vs. eigene Skala?).
- Wahl-O-Mat: pro Maßnahme eine Gesamt-Haltung oder mehrere Thesen je Maßnahme?
- Generisches Flag vs. climate-spezifisch (Empfehlung: generisch wie SDG).
