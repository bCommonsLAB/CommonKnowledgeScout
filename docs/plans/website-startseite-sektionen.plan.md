---
name: website-startseite-sektionen
overview: "Die Website-Landingpage (detailViewType website) kann Text-Bild-Sektionen, Video, Kontaktformular und zeigt unter jeder Seite ein festes Raster mit den sechs höchstbewerteten Galerie-Einträgen. Eine Kampagnen-Startseite nach dem Muster der Library „Klimamaßnahmen“ (Steckbrief 5) braucht wenig mehr: das Raster an einer wählbaren Stelle mit einem Fokus-Filter, einen Hero mit Kennzeile und zweitem Handlungsaufruf, gelayoutete Kennzahl-Kacheln mit von Hand gesetzten Zahlen. Owner-Entscheidung 27.09.: das bestehende Banner erweitern statt ein neues Raster bauen; Ampel-Skala und dynamische Kennzahlen kommen später. Vorhaben 2 in docs/STAND.md."
vorhaben: [Klimamaßnahmen Südtirol, Vortrag 30.09.]
status: entwurf
todos:
  - id: s0-inhalt
    content: "S0 Inhalt ohne Code: Startseite, Kontakt, Impressum und Footer als website-Docs anlegen; siteEnabled setzen; Bilder in den Blob spiegeln; Tag `fokus` an den Fokus-Maßnahmen setzen. Ergebnis: eine sichtbare Seite mit den bestehenden Layouts und dem Banner unten."
    status: pending
  - id: s1-banner
    content: "S1 Banner erweitern: Frontmatter `banner_tag`, `banner_title`, `banner_limit` am Startseiten-Doc filtern und betiteln das bestehende Raster; Sektions-Marker `layout=banner` setzt es an eine Stelle im Seitentext; ohne Marker bleibt es unten. Docs-API unverändert (`tags=` ist schon Facette)."
    status: pending
  - id: s2-hero
    content: "S2 Hero-Variante `hero_layout: campaign` mit Kennzeile im Bild (`hero_kicker`), Unterzeile, primärem und sekundärem Handlungsaufruf (`cta2_label`, `cta2_url`); Sektions-Attribut `kicker=` für die Versalzeile über der Überschrift."
    status: pending
  - id: s3-kacheln
    content: "S3 Layout `stats`: eine Markdown-Liste `- **600+** Maßnahmen` wird zu Kennzahl-Kacheln, Zahlen stehen im Markdown; Zitatkasten mit Randstreifen; Hintergründe `stone`, `petrol`, `forest`, `greige`."
    status: pending
  - id: s4-footer
    content: "S4 Fußzeile mehrspaltig: `footer_columns: 3` am Footer-Doc legt dessen Sektionen nebeneinander; Link-Zeile für menu_area=footer bleibt."
    status: pending
  - id: s5-sprache
    content: "S5 Sprachumschalter DE/IT in der TopNav im Site-Kontext; Übersetzungslauf der website-Docs nach dem bestehenden Pfad."
    status: pending
---

# Website-Startseite: Banner erweitern, Hero und Kacheln

> Vorhaben 2 in [`../STAND.md`](../STAND.md). Vorlage des Musters:
> die Startseite der Library „Oldies for Future“ (Steckbrief 10). Zielbild:
> die Startseite der Library „Klimamaßnahmen“ (Steckbrief 5) nach einer
> Figma-Vorlage mit sieben Sektionen; Vorlage, Texte und Abstimmung mit dem
> fachlichen Partner liegen im Archiv, Vorhabensordner
> `26.01 Klimamassnahmen Südtirol`. Nachbar:
> [`mcp-bruecke-website-publizieren.plan.md`](mcp-bruecke-website-publizieren.plan.md).

## 1. Was heute geht (Bestand, geprüft am 27.09.2026)

Contract: [`../contracts/website-landingpage.md`](../contracts/website-landingpage.md).

- Eine Seite ist ein Dokument mit `detailViewType: website`. Hero aus dem
  Frontmatter (`title`, `hero_subtitle`, `hero_image`, `hero_layout`
  `overlay|cover`, `cta_label`, `cta_url`), Body als Sektionen mit
  HTML-Kommentar-Markern (`src/lib/website/parse-website-sections.ts`).
- Layouts: `image-left`, `image-right`, `full-image`, `text-only`, `video`,
  `contact-form`. Hintergründe: `default`, `light`, `dark`, `brand`, `linen`,
  `mint`, `dark-green`, `neutral` (`website-landing-blocks.tsx`).
- Navigation dokumentgetrieben: `menu_order`, `menu_area`
  (`main|footer|hidden`), `site_role` (`page|footer-content`); Deep-Link
  `?site=<slug>` (`src/lib/website/site-navigation.ts`).
- **Das Banner.** Unter jeder Seite ein Raster „Mehr aus dieser Bibliothek“
  (`website-landing-live.tsx`): ein Aufruf der öffentlichen Docs-API mit
  `sort=rating&limit=11`, Website-Docs werden clientseitig entfernt, sechs
  Karten bleiben (`BANNER_LIMIT`). Die Karte ist die `DocumentCard` des
  Explorer-Pakets, die je Typ die passende Karte wählt; für Steckbrief 5
  die `ClimateActionCard` mit Bild, Handlungsfeld, Titel, Nummer,
  Prioritäts-Indikator und Sternen. Der Galerie-Link trägt den Text aus
  `publicPublishing.gallery.moreLinkLabel`. Überschrift und Position sind
  fest im Code.
- **Tag-Filter existiert.** `tags` ist eine Pflicht-Facette aller Typen
  (`src/lib/detail-view-types/base-fields.ts`, Typ `string[]`), und die
  Docs-API übernimmt jede Facette als Query-Parameter
  (`buildFilterFromQuery`): `docs?tags=fokus&sort=rating` liefert anonym
  die markierten Einträge, absteigend nach Prioritäts-Index. Kein
  Server-Code nötig.
- `sort=rating` sortiert nach `prioritaets_index`. Für Steckbrief 5 rechnet
  die Transform-Phase diesen Wert aus CO₂, Kosten und Durchsetzbarkeit
  (`phase-template.ts`) und überschreibt ihn bei jedem Lauf; er ist die
  Reihenfolge innerhalb einer Auswahl, nicht die Auswahl.
- Die Galerie liest heute keine Facetten aus der URL (nur `doc` und den
  Modus). Ein Link „alle Fokus-Maßnahmen“ mit vorgewähltem Filter ist
  damit noch nicht möglich; der Link führt in die Galerie ohne Filter.

## 2. Was die Vorlage braucht, und was davon jetzt kommt

| Sektion der Vorlage | Bestand | Entscheidung 27.09. |
|---|---|---|
| Hero: Bild mit Kennzeile, Titel, Unterzeile, zwei Buttons | `cover` hat einen Button, keine Kennzeile | S2, kleiner Code |
| „Wer wir sind“, „Warum“, „Lösung“: Text-Bild-Blöcke, Zitat | `image-left/right`, Blockquote | ohne Code; Kennzeile als Attribut in S2 |
| Kennzahl-Kacheln in „Lösung“ | fehlt | S3, nur Layout; Zahlen stehen im Markdown |
| „Maßnahmen im Fokus“: Kartenraster aus der Library | Banner, fest unten, ohne Filter | **S1: Banner erweitern** (Filter, Titel, Position) |
| „Wo stehen wir“: Ampel-Skala, Kachel, Infobox | fehlt | **später**, als Text-Bild-Sektion; Vorrat |
| „Gemeinsam weiterdenken“: zentrierter Text, Button, Termin | `text-only` | ohne Code |
| Fußzeile dreispaltig | eine Spalte | S4, nach dem Termin |
| Sprachumschalter DE/IT | fehlt | S5, nach dem Termin |

## 3. Regeln

- **Dokumentgetrieben, flach.** Neues sind Frontmatter-Felder oder
  Marker-Attribute; keine neuen Library-Settings, keine verschachtelten
  YAML-Objekte (AGENTS.md, Frontmatter-Format).
- **Kein stiller Fallback.** Unbekannte `layout`-, `bg`- oder
  `hero_layout`-Werte werfen im Parser wie heute einen Fehler
  (`no-silent-fallbacks.md`). Ein `banner_tag`, der keine Treffer liefert,
  zeigt das Banner leer mit Konsolen-Warnung, nicht das ungefilterte Raster.
- **Anonym lesbar.** Alles läuft über die öffentliche Docs-API; keine
  Member-Sortierung (`sort=stars` bleibt Member-only).
- **Bilder aus dem Blob.** Absolute, anonym lesbare URLs (Skill
  `website-publishing`, Contract §5).
- **Kein Library-Inhalt im Repo.** Tests mit erfundenen Fixtures.
- Dateien höchstens 200 Zeilen: `website-landing-live.tsx` hat 219 und
  wird beim Umbau geteilt (Banner in eine eigene Datei), nicht erweitert.

## 4. Wellen

### S0 · Inhalt ohne Code (Owner, Cowork über die Brücke)

1. Vier website-Docs anlegen: Startseite (`menu_order: 1`), Kontakt
   (`contact_email`, `layout=contact-form`), Impressum (`menu_area:
   footer`), Fußzeile (`site_role: footer-content`). Muster: die vier Docs
   von Steckbrief 10 im Ordner `Webseite/Seiten/`.
2. Startseite mit den heutigen Layouts füllen. Kennzahlen und „Wo stehen
   wir“ vorerst als Text.
3. Tag `fokus` an den Fokus-Maßnahmen setzen (Liste des Partners im Archiv,
   rund 30 Einträge). Bis Welle S1 zeigt das Banner die sechs nach Index
   höchstbewerteten Maßnahmen, danach die markierten.
4. `siteEnabled` setzen, Bilder in den Blob spiegeln, Logo-URL eintragen.
5. Publizieren (heute: Story-Tab der Datei-Vorschau; künftig
   `dokument_publizieren` aus dem Brücken-Plan).

### S1 · Banner erweitern

Frontmatter am Startseiten-Doc, alle optional:

| Feld | Wirkung | ohne Feld |
|---|---|---|
| `banner_tag` | zusätzlicher Query-Parameter `tags=<wert>` | wie heute, ungefiltert |
| `banner_title` | Überschrift des Rasters | „Mehr aus dieser Bibliothek“ |
| `banner_limit` | Kartenzahl, 3 bis 12 | 6 |

Position: ein Marker `<!-- section layout=banner -->` (leer oder mit
Kennzeile und Unterzeile im Markdown) setzt das Raster an diese Stelle im
Seitentext. Ohne Marker bleibt es unter der Seite. Mit Marker entfällt das
untere Raster; eine Seite zeigt es einmal.

Umbau: das Raster aus `website-landing-live.tsx` in
`website/website-banner-grid.tsx` ziehen (Fetch, Karten, Galerie-Link,
unverändert); `WebsiteDetail` bekommt das Raster als Element für die
`banner`-Sektion; `use-website-landing-data.ts` liest die drei Felder;
Mapper `doc-meta-mappers.ts` und Registry `website` (optionalFields)
ergänzen; Parser kennt `banner`. Der Galerie-Link bleibt
`?view=gallery`, bis die Galerie Facetten aus der URL liest (eigener
kleiner Punkt, Vorrat).

Tests: Parser (`banner` mit und ohne Text), Query-Bau mit und ohne Tag,
Banner einmal je Seite.

### S2 · Hero `campaign` und Kennzeile

- Frontmatter: `hero_layout: campaign`, `hero_kicker`, `cta2_label`,
  `cta2_url`. Gestaltung: Bild oben abgerundet mit Kennzeile im Bild,
  darunter Titel, Unterzeile, rechts zwei Buttons.
- Marker-Attribut `kicker="…"`: kleine Versalzeile über der H2.
- Dateien: `website/hero-campaign.tsx` (neu), `website-detail.tsx` wählt
  die Variante; Mapper und Registry ergänzen; Parser liest `kicker`.
- Tests: Parser (Attribut mit und ohne Anführungszeichen, Fehler bei
  Unbekanntem), Mapper.

### S3 · Kacheln, Zitat, Farben

- Layout `stats`: Markdown-Liste `- **600+** Maßnahmen` wird zu Kacheln,
  zwei Spalten mit optionalem Bild wie `image-right`. Die Zahlen stehen im
  Markdown; woher sie kommen, ist Inhaltsarbeit.
- Blockquote mit Randstreifen in Akzentfarbe je Hintergrund.
- Neue `bg`-Werte `stone`, `petrol`, `forest`, `greige`; `SECTION_STYLE`
  in `website/section-style.ts` ausgliedern. Bestehende Werte bleiben.
- Tests: Parser für `stats`, Kachel-Liste.

### S4 · Fußzeile mehrspaltig (nach dem Termin)

- `footer_columns: 3` am Footer-Doc legt dessen Sektionen nebeneinander;
  letzte Sektion über die volle Breite (Copyright, Technik).
- Raster in `website/footer-columns.tsx`.

### S5 · Sprachumschalter (nach dem Termin)

- TopNav im Site-Kontext (`use-site-menu-items.ts`, `top-nav.tsx`) über die
  Locales aus `library.config.translations`; Übersetzungslauf nach dem
  bestehenden Pfad. Nur mit vorliegender italienischer Fassung.

## 5. Reihenfolge und Aufwand

| Welle | Aufwand | Vor dem Termin 30.09.? |
|---|---|---|
| S0 | ein halber Tag Inhaltsarbeit | ja, zuerst |
| S1 | ein halber Tag | ja |
| S2 | ein halber Tag | ja |
| S3 | ein halber Tag | ja, wenn S1 und S2 stehen |
| S4 | ein halber Tag | nein, Vorstellung Ende Oktober |
| S5 | ein Tag plus Übersetzung | nein |

S1 bis S3 je eine PR (Diff-Limits aus AGENTS.md). Jede PR: `pnpm test`,
`pnpm lint`, `npx tsc --noEmit -p tsconfig.json` mit Vorher/Nachher-
Vergleich; kein `pnpm build` im Cloud-Agent.

## 6. Nicht in diesem Plan (Vorrat)

- Ampel-Skala mit Marker aus der Summe der Fokus-Maßnahmen
  (`aggregate=sums`); bis dahin Text und Bild.
- Dynamische Kennzahlen (Anzahl Maßnahmen, Handlungsfelder aus den
  Facetten).
- Galerie liest Facetten aus der URL (`?view=gallery&tags=fokus`).
- Kennzahl Kosten je Tonne und Sortierschalter (Summen-Plan Stufe 3d).
- Kommentar neben jeder Aussage (Bewertungsmodus-Ausbau).
- „Aus der Praxis“: Best-Praxis-Beispiele als eigene Library (ADR 0009).
- OneDrive-Anmeldung stabil neu aufsetzen: Punkt 1 von Vorhaben 2.

## 7. Offene Entscheidungen (Owner)

1. Domain der Site (`PUBLIC_DOMAIN_LIBRARY_MAP`) oder vorerst nur
   `/explore/<slug>`.
2. Banner-Position: mit Marker in der Mitte (wie Figma) oder unten wie bei
   Steckbrief 10. Beides geht nach S1; der Inhalt entscheidet.
