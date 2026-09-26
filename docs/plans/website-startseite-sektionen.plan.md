---
name: website-startseite-sektionen
overview: "Die Website-Landingpage (detailViewType website) kann heute Text-Bild-Sektionen, Video und Kontaktformular. Eine Kampagnen-Startseite nach dem Muster der Library „Klimamaßnahmen“ (Steckbrief 5) braucht zusätzlich: einen Hero mit Kennzeile und zwei Handlungsaufrufen, Kennzahl-Kacheln, ein Dokument-Raster aus der Library (die wichtigsten Maßnahmen), eine Skala-Grafik (Ampel) und eine mehrspaltige Fußzeile. Alles bleibt dokumentgetrieben: Sektions-Marker im Markdown-Body, flaches Frontmatter, keine neuen Settings. Vorhaben 2 in docs/STAND.md."
vorhaben: [Klimamaßnahmen Südtirol, Vortrag 30.09.]
status: entwurf
todos:
  - id: s0-inhalt
    content: "S0 Inhalt ohne Code: Startseite, Kontakt, Impressum und Footer als website-Docs anlegen; siteEnabled setzen; Bilder in den Blob spiegeln; prioritaets_index an den Fokus-Maßnahmen setzen. Ergebnis: eine sichtbare Seite mit den bestehenden Layouts."
    status: pending
  - id: s1-hero-kicker
    content: "S1 Hero-Variante `hero_layout: campaign` (Bild oben, Kennzeile im Bild, gestapelter Titel, Unterzeile, primärer + sekundärer Handlungsaufruf) und Sektions-Attribut `kicker=` für die Kennzeile über der Überschrift."
    status: pending
  - id: s2-kacheln-und-zitat
    content: "S2 Sektions-Layout `stats` (Kennzahl-Kacheln aus einer Markdown-Liste) und Zitatkasten mit Randstreifen (Blockquote-Styling je Hintergrund); Hintergründe `stone`, `petrol`, `forest` als Farbtöne der zweiten Vorlage."
    status: pending
  - id: s3-doc-grid
    content: "S3 Sektions-Layout `doc-grid` mit Attributen `type=`, `sort=`, `limit=`: rendert DocumentCards aus der Docs-API (anonym), Fußzeile mit zwei Links (Galerie-Filter, Galerie gesamt)."
    status: pending
  - id: s4-skala
    content: "S4 Sektions-Layout `scale`: senkrechte Ampel-Skala mit Zonen und Marker aus einer Markdown-Tabelle; Marker-Wert optional aus der Summen-API (aggregate=sums) der Fokus-Maßnahmen."
    status: pending
  - id: s5-footer
    content: "S5 Fußzeile mehrspaltig: Footer-Content-Doc mit bis zu drei `text-only`-Sektionen nebeneinander (Attribut `columns=3`), Link-Zeile für menu_area=footer bleibt."
    status: pending
  - id: s6-sprache
    content: "S6 Sprachumschalter DE/IT in der TopNav im Site-Kontext; Übersetzungslauf der website-Docs nach dem bestehenden Pfad (translation guard)."
    status: pending
---

# Website-Startseite: Sektionstypen für Kampagnen-Seiten

> Vorhaben 2 in [`../STAND.md`](../STAND.md). Vorlage des Musters:
> die Startseite der Library „Oldies for Future“ (Steckbrief 10, Site-Modus
> mit eigener Domain). Zielbild: die Startseite der Library „Klimamaßnahmen“
> (Steckbrief 5) nach einer Figma-Vorlage mit sieben Sektionen; die Vorlage,
> die Texte und die Abstimmung mit dem fachlichen Partner liegen im Archiv,
> Vorhabensordner `26.01 Klimamassnahmen Südtirol`.

## 1. Was heute geht (Bestand, geprüft am 26.09.2026)

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
- Unter jeder Seite ein festes Raster „Mehr aus dieser Bibliothek“ mit den
  sechs höchstbewerteten Nicht-Website-Docs (`sort=rating`, also
  `prioritaets_index` absteigend) und einem Galerie-Link
  (`website-landing-live.tsx`, `BANNER_LIMIT`).
- Fußzeile: Doc mit `site_role: footer-content`, eine Spalte
  (`website-site-footer.tsx`). Kontaktformular über `contact_email` und die
  öffentliche Contact-API.
- Site-Modus: `publicPublishing.siteEnabled`, Domain über
  `PUBLIC_DOMAIN_LIBRARY_MAP` (`src/lib/root-landing.ts`), Logo und
  Hintergrund über `publicPublishing.logoUrl` / `backgroundImageUrl`.
- Für Steckbrief 5: `detailViewType: climateAction` mit `co2_einsparung_kt`,
  `kosten_eur`, `durchsetzbarkeit`, `lv_bewertung`, `category`; Summen über
  `aggregate=sums` (`packages/contracts/src/detail-view-type-registry.ts`).

## 2. Was die Vorlage zusätzlich braucht

Sieben Sektionen der Figma-Vorlage gegen den Bestand:

| Sektion der Vorlage | Bestand reicht? | Fehlt |
|---|---|---|
| Hero: Bild mit Kennzeile, gestapelter Titel, Unterzeile, zwei Buttons | teils (`cover` hat einen Button, kein Kennzeilen-Badge) | Hero-Variante `campaign`, zweiter Handlungsaufruf |
| „Wer wir sind“: Kennzeile, Text, Etiketten der Träger, Bild rechts | fast (`image-right`) | Kennzeile über der Überschrift, Etiketten-Liste als Chips |
| „Warum machen wir das“: Bild links, Text, Zitatkasten mit Randstreifen | fast (`image-left`, Blockquote) | Zitat-Styling mit Randstreifen |
| „Was ist die Lösung“: Text, drei Kennzahl-Kacheln, Bild rechts | nein | Layout `stats` |
| „Maßnahmen im Fokus“: Sortierschalter, Kartenraster aus der Library, zwei Links | nein (Banner ist fest, nicht platzierbar, nicht filterbar) | Layout `doc-grid` mit `type=`, `sort=`, `limit=` |
| „Wo stehen wir“: Ampel-Skala mit Marker, Kennzahl-Kacheln, Infobox, Quellenzeile | nein | Layout `scale`; `stats` wiederverwendet |
| „Gemeinsam weiterdenken“: zentrierter Text, Button, Ausblick-Karte, Terminhinweis | fast (`text-only`) | zentrierte Variante `align=center`, Button aus Markdown-Link |
| Fußzeile: drei Spalten, Copyright-Zeile | nein (eine Spalte) | `columns=3` am Footer-Doc |
| Kopf: Sprachumschalter DE/IT | nein | TopNav im Site-Kontext |

Farben der Vorlage (Tiefgrün, Petrol, Stein, warmes Greige, Terrakotta als
Akzent) sind neue Hintergrund-Werte; die bestehenden Werte bleiben, damit
Steckbrief 10 unverändert rendert.

## 3. Regeln, die gelten

- **Dokumentgetrieben, flach.** Alles Neue ist ein Sektions-Attribut im
  Marker oder ein flaches Frontmatter-Feld. Keine neuen Library-Settings,
  keine verschachtelten YAML-Objekte (AGENTS.md, Frontmatter-Format).
- **Kein stiller Fallback.** Unbekannte `layout`-, `bg`-, `sort`- oder
  `type`-Werte werfen im Parser wie heute einen Fehler
  (`no-silent-fallbacks.md`).
- **Anonym lesbar.** `doc-grid` und `scale` lesen nur die öffentliche
  Docs-API (`/api/chat/<id>/docs`), keine Member-Sortierung (`sort=stars`
  bleibt Member-only, `sort=rating` ist der öffentliche Weg).
- **Bilder aus dem Blob.** Absolute, anonym lesbare URLs
  (Skill `website-publishing`, Contract §5).
- **Kein Library-Inhalt im Repo.** Texte, Bild-URLs, IDs und die
  Abstimmung mit dem Partner bleiben im Archiv. Tests arbeiten mit
  erfundenen Fixtures.
- Dateien höchstens 200 Zeilen: `website-landing-blocks.tsx` (152) und
  `website-detail.tsx` (165) werden nicht erweitert, sondern je Layout eine
  eigene Datei unter `src/components/library/website/sections/`.

## 4. Wellen

Reihenfolge nach Nutzen für den Termin: erst Inhalt sichtbar machen, dann
die Sektionen, die ohne Code nicht gehen, zuletzt Kür.

### S0 · Inhalt ohne Code (Owner, Cowork über die MCP-Brücke)

1. Vier website-Docs in der Library anlegen: Startseite (`menu_order: 1`),
   Kontakt (`contact_email`, `layout=contact-form`), Impressum
   (`menu_area: footer`), Fußzeile (`site_role: footer-content`). Muster: die
   vier Docs der Library Steckbrief 10.
2. Startseite mit den heutigen Layouts füllen: Wer wir sind (`image-right`),
   Warum (`image-left`, Zitat als Blockquote), Lösung (`image-right`),
   Weiterdenken (`text-only`). Die Kennzahlen und die Ampel vorerst als
   Text.
3. `prioritaets_index` an den Fokus-Maßnahmen setzen (Liste des Partners im
   Archiv, rund 30 Einträge). Damit zeigt das bestehende Banner „Mehr aus
   dieser Bibliothek“ schon die sechs wichtigsten Maßnahmen, und
   `?view=gallery&sort=rating` die ganze Reihung.
4. `siteEnabled` setzen, Bilder nach `web/images/` und mit
   `scripts/mirror-website-images-to-blob.ts` spiegeln, Logo-URL eintragen.
5. Ergebnis: `/explore/<slug>` zeigt die Startseite. Reicht als Rückfallebene
   für den Vortrag.

### S1 · Hero `campaign` und Kennzeile

- Frontmatter: `hero_layout: campaign`, `hero_kicker` (Kennzeile im Bild),
  `cta2_label`, `cta2_url` (sekundärer Handlungsaufruf).
- Marker-Attribut `kicker="…"` für jede Sektion; Renderer setzt es als
  kleine Versalzeile über die H2.
- Dateien: `sections/hero-campaign.tsx` (neu), `website-detail.tsx` wählt
  die Variante; Mapper `doc-meta-mappers.ts` und Registry `website`
  (optionalFields) ergänzen; `parse-website-sections.ts` liest `kicker`.
- Tests: Parser (Attribut mit und ohne Anführungszeichen, Fehler bei
  Unbekanntem), Mapper.

### S2 · Kacheln, Zitat, Farben

- Layout `stats`: Markdown-Liste `- **600+** Maßnahmen` wird zu Kacheln;
  zwei Spalten mit optionalem Bild wie `image-right`.
- Blockquote je Hintergrund mit Randstreifen (Akzentfarbe), erster Absatz
  als Leitsatz bleibt wie heute.
- Neue `bg`-Werte `stone`, `petrol`, `forest`, `greige`; `SECTION_STYLE`
  in eine eigene Datei `sections/section-style.ts` ausgliedern.
- Tests: Parser für `stats`, Snapshot der Kachel-Liste.

### S3 · `doc-grid` (Kartenraster aus der Library)

- Marker: `<!-- section layout=doc-grid type=climateAction sort=rating limit=6 bg=greige -->`
  mit Überschrift, Unterzeile und zwei Links im Markdown
  (`[Alle ansehen](?view=gallery&sort=rating)`,
  `[Alle durchsuchen](?view=gallery)`).
- Erlaubte `sort`-Werte: `rating`, `date`; erlaubte `type`-Werte: die
  Registry-Typen. Sonst Parser-Fehler.
- Renderer: Client-Komponente `sections/doc-grid-section.tsx`, holt über
  `fetchDocs` aus `use-website-landing-data.ts`, zeigt `DocumentCard` aus
  `@ks/module-explorer` (im Root-Modus mit `?view=gallery&doc=<slug>`, im
  Site-Modus lokal, wie das heutige Banner).
- Das feste Banner „Mehr aus dieser Bibliothek“ bleibt für Libraries ohne
  `doc-grid`; hat die Startseite eine `doc-grid`-Sektion, wird das Banner
  nicht mehr angehängt (Frontmatter `banner: false` als expliziter
  Schalter, kein Raten).
- Sortierschalter „Günstigste pro Tonne“ aus der Vorlage braucht eine
  Kennzahl Kosten je Tonne, die es noch nicht gibt (Vorrat, siehe §6);
  in S3 nur `sort=rating`.
- Tests: Parser, Query-Bau, Karten-Anzahl.

### S4 · `scale` (Ampel-Skala)

- Marker `<!-- section layout=scale bg=forest -->` mit einer
  Markdown-Tabelle `| Zone | Titel | Schwelle | Erläuterung |` und einer
  Zeile `Marker | <Label> | <Wert> |`. Der Renderer zeichnet die senkrechte
  Skala mit drei Zonen und setzt den Marker.
- Optional `marker=sum:co2_einsparung_kt` liest die Summe der Docs aus der
  gleichen Abfrage wie `doc-grid` (`aggregate=sums`), sonst steht der
  Wert im Markdown. Welche Richtung „grün“ ist, entscheidet die Tabelle,
  nicht der Code (die Schwellen sind fachlich noch offen, Archiv).
- Tests: Tabellen-Parser, Marker-Position bei Unter-, Zwischen- und
  Überschreitung, Fehler bei fehlender Zone.

### S5 · Fußzeile mehrspaltig

- Footer-Doc mit drei `text-only`-Sektionen; Frontmatter
  `footer_columns: 3` legt die Sektionen nebeneinander; letzte Zeile
  (Copyright, Technik) als vierte Sektion über die volle Breite.
- `website-site-footer.tsx` bleibt unter 200 Zeilen; das Raster in
  `sections/footer-columns.tsx`.

### S6 · Sprachumschalter (Kür, nach dem Termin)

- TopNav im Site-Kontext (`use-site-menu-items.ts`, `top-nav.tsx`): Umschalter
  über die Locales aus `library.config.translations`; Übersetzungslauf für
  website-Docs nach dem bestehenden Pfad (`website-translation-guard.ts`).
- Nur, wenn die italienische Fassung der Texte vorliegt.

## 5. Reihenfolge und Aufwand

| Welle | Aufwand | Vor dem Termin 30.09.? |
|---|---|---|
| S0 | ein halber Tag Inhaltsarbeit | ja, zuerst |
| S1 | ein halber Tag | ja |
| S2 | ein halber Tag | ja |
| S3 | ein Tag | ja, wenn S0 bis S2 stehen |
| S4 | ein Tag | wenn die Schwellen fachlich geklärt sind, sonst Text |
| S5 | ein halber Tag | nein, Vorstellung Ende Oktober |
| S6 | ein Tag plus Übersetzung | nein |

S1 bis S3 sind je eine PR (Diff-Limits aus AGENTS.md), S4 und S5 je eine
PR. Jede PR: `pnpm test`, `pnpm lint`, `npx tsc --noEmit -p tsconfig.json`
mit Vorher/Nachher-Vergleich; kein `pnpm build` im Cloud-Agent.

## 6. Nicht in diesem Plan (Vorrat)

- Kennzahl Kosten je Tonne und Sortierschalter (Summen-Plan Stufe 3d im
  Vorrat von `STAND.md`; Kosten werden seit 15.09. nicht mehr summiert).
- Kommentar neben jeder Aussage (Bewertungsmodus-Ausbau, Vorhaben 3 nutzt
  denselben Composer).
- „Aus der Praxis“: Best-Praxis-Beispiele als eigene Library (ADR 0009,
  Föderation, M8).
- Eigene Maßnahmen-Karte mit Balkenbewertung statt `DocumentCard`: erst
  wenn die Kennzahlen belastbar sind.
- OneDrive-Anmeldung stabil neu aufsetzen: eigener Punkt 1 von Vorhaben 2,
  nicht Teil der Website-Wellen.

## 7. Offene Entscheidungen (Owner)

1. Domain der Site (Eintrag in `PUBLIC_DOMAIN_LIBRARY_MAP`) oder vorerst nur
   `/explore/<slug>`.
2. Ob die Fokus-Maßnahmen über `prioritaets_index` (öffentlich, sortierbar)
   oder über Favoriten (Member-only) markiert werden. Empfehlung:
   `prioritaets_index`, weil anonym lesbar.
3. Ob das feste Banner unter der Startseite bleibt oder das `doc-grid` es
   ersetzt (Empfehlung: ersetzen, Schalter `banner: false`).
