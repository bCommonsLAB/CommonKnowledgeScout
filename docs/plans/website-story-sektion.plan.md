---
name: website-story-sektion
overview: "Die Website-Landingpage bekommt eine Sektion `story`: ein Chat mit vorgegebenen Beispielfragen, der direkt auf der Startseite steht — zwischen Hero und den weiteren Sektionen. Die Beispielfragen sind Teil der Seitendefinition (Markdown), nicht der Library-Konfiguration. Belege und Perspektive fliegen als Blatt von rechts herein wie im Story-Modus. Dazu ein Kachel-Block für die drei Wege: Archiv (Galerie), Inhaltsverzeichnis (Story-Modus mit Themen), „Wie funktioniert der KnowledgeScout?“. Anlass: die Vorlage des Museumsdirektors (Naturmuseum, 29.10.2026); Zielbild für weitere Libraries (Dachverband für Soziales, start.klar)."
vorhaben: [Naturmuseum Südtirol]
status: entwurf
todos:
  - id: n1-sektion-story
    content: "N1 Sektion `story`: Marker `layout=story` (+ `placeholder`), Block `<!-- questions -->` mit Liste, Client-Baustein `WebsiteStorySektion` (Fragen-Kacheln, sichtbare Eingabe, wachsende Konversation, Belege als Blatt von rechts, Knopf „Antworten anpassen“ öffnet den Perspektiv-Dialog), Slot in `WebsiteDetail`/`WebsiteLandingLive`, Prüfung in der Brücke, Contract, Skill, Tests."
    status: completed
  - id: n2-kacheln
    content: "N2 Kachel-Block `<!-- cards -->` (drei Karten nebeneinander: Titel, Text, Link) und die Zielauflösung `?view=gallery` / `?mode=story` / `?site=<slug>` ohne Neuladen; `onShowStory` im `siteView`-Slot der Galerie."
    status: completed
  - id: n3-perspektive-blatt
    content: "N3 Perspektive als Blatt von rechts: `PerspektiveDialog` bekommt die Darstellung `blatt`; die Story-Sektion nutzt sie, der Story-Modus seit 07.11. ebenso (Owner-Entscheid)."
    status: completed
  - id: n4-inhalt
    content: "N4 Inhalt über die Brücke (kein Code): Startseite der Library Naturmuseum mit Hero, Story-Sektion (vier Fragen), Kacheln und Seite „Wie funktioniert der KnowledgeScout?“; `siteEnabled`; Rückmeldung an den Museumsdirektor."
    status: pending
---

# Website-Startseite mit Story-Sektion

> **Stand 08.11.2026 (Owner-Entscheid):** Die Story-Sektion verhält sich wie
> eine Suche, nicht wie ein Chat. Sichtbar ist nur das jüngste
> Frage-Antwort-Paar der Sitzung; eine neue Frage ersetzt die Anzeige
> (`sichtbaresPaar` in `src/lib/website/story-sichtbares-paar.ts`). Die
> Sitzung bleibt vollständig und geteilt mit dem Story-Modus; ältere Fragen
> erreicht der Verweis „N frühere Fragen dieser Sitzung im Story-Modus"
> unter der Antwort (`?mode=story`, Zielauflösung wie die Kacheln). Kein
> Lösch-Knopf auf der Startseite, keine neue Einstellung. Begründung: Die
> Startseite ist Visitenkarte, der wachsende Verlauf schob Kacheln und
> Erklärseite nach unten; der Verlauf gehört in die Chronik des Story-Modus.
>
> **Stand 06.11.2026:** N2 gebaut (Block `cards` im Sektions-Parser,
> `kartenziel.ts` mit `loeseKartenziel`/`kartenaktion`, Renderer
> `section-cards.tsx`, `onShowStory` im `siteView`-Slot der Galerie, durchgereicht
> über `client.tsx` und `website-landing-live.tsx` als `kartenNavigation` in
> `WebsiteDetail`; Brücke 2.64.0 mit `karten` je Sektion, Contract §1, Skill,
> Tests). Kacheln in einer Story-Sektion bleiben gewöhnliche Links.
>
> **Stand 05.11.2026:** N1 gebaut (Parser `layout=story` + `placeholder`,
> Block `questions`, `storyBloecke`, `StoryEingabeInline` und
> `ohneUebersicht` im Story-Paket, `BelegListe`/`ReferencesSheet` exportiert,
> `WebsiteStorySektion` + Rahmen + Belege-Blatt, `storySlot` in
> `WebsiteDetail`, Brücke 2.63.0 mit Warnung und `fragen`, Contract, Skill,
> Tests). Owner 05.11.: Blatt von rechts für Belege und Perspektive ist
> beschlossen (N3 setzt es für die Perspektive um; N1 öffnet dort noch den
> Dialog in der Mitte). Layout-Konzept in Figma: Klickmodell D0, Seite
> „Startseite mit Story-Sektion · Naturmuseum (05.11.)".

> Anlass: die Vorlage `knowledgescout_prototyp.html` des Museumsdirektors
> (Mail vom 29.10.2026, abgelegt im Vorhabensordner `26.07 Naturmuseum
> Knowledgescout` des Archivs). Seine Forderung: **erst fragen, dann
> einstellen** — das Eingabefeld mit ein paar vorgefertigten Fragen steht
> ganz oben, Erklärungen und Archiv folgen weiter unten; Quellen, Perspektive
> und Modell sind optionales „Finetuning“. Owner 05.11.2026: das wird keine
> Sonderseite, sondern ein **Baustein der Website-Landingpage**, der sich mit
> Hero und weiteren Sektionen kombinieren lässt und für andere Libraries
> genauso taugt. Contract:
> [`../contracts/website-landingpage.md`](../contracts/website-landingpage.md);
> Nachbar: [`website-startseite-sektionen.plan.md`](website-startseite-sektionen.plan.md)
> (S1–S5, dieselbe Sektions-Konvention).

## 1. Was heute geht (Bestand, geprüft am 05.11.2026)

- **Landingpage.** `publicPublishing.siteEnabled` rendert `/explore/<slug>`
  als Website aus `website`-Docs: Hero aus dem Frontmatter (`hero_layout`
  `overlay|cover|campaign|none`, `hero_title`, `hero_subtitle`, `hero_image`,
  `cta_*`), Body als Sektionen mit HTML-Kommentar-Markern
  (`src/lib/website/parse-website-sections.ts`), Blöcke in Sektionen
  (`stats`, `chips`, `box`; `parse-section-blocks.ts`), Banner an wählbarer
  Stelle (`layout=banner`, `bannerSlot` in `website-detail.tsx`), Design-Profil
  `siteTheme`. Galerie und Story-Modus erreicht man über die TopNav bzw.
  `?view=gallery` / `?mode=story` (`mode-params.ts`).
- **Story-Modus.** `StoryRoot` (`@ks/module-story`) in der Mitte der Galerie,
  Themenübersicht (vom Sprachmodell berechnet) als Einstieg, Eingabe als
  aufklappbarer Knopf unten rechts (`story-eingabe.tsx`, Strg+Enter sendet),
  Belege rechts (`BelegListe`, auf dem Telefon als Blatt `ReferencesSheet`),
  Chronik links. Beim ersten Betreten geht der Perspektiv-Dialog automatisch
  auf (`story-perspektive-dialog.tsx`) — genau das, was der Direktor
  kritisiert. Der Hook `useStoryKonversation` trägt Sitzung, Verlauf, Stream
  und Belege; er holt die Themenübersicht, sobald Dokumente und Modell da
  sind.
- **Was fehlt.** Kein Chat auf der Landingpage; keine vorgegebenen
  Beispielfragen (die Fragen der Themenübersicht liegen einen Klick tiefer
  und kosten einen Modellaufruf); keine Karten mit Links auf Galerie,
  Story-Modus und Seiten; der Perspektiv-Dialog ist zentriert, kein Blatt.

## 2. Zielbild (Owner 05.11.2026)

Von oben nach unten auf der Startseite:

1. **Hero** wie heute (`hero_layout: cover` oder `campaign`), Titel z. B.
   „Welche Fragen hast du an die Natur?“ — kein Code.
2. **Story-Sektion**: eine Karte mit Einleitung (Markdown), vier
   Beispielfragen als Kacheln, einem **immer sichtbaren** Eingabefeld (Enter
   sendet), darunter die Konversation, die mit jeder Frage wächst. Rechts
   oben „Antworten anpassen“ → Perspektive, Sprache, Modell als Blatt von
   rechts. Belege einer Antwort → Blatt von rechts, wie im Story-Modus.
   Darunter Platz für eine Vertrauenszeile (Markdown).
3. **Drei Kacheln nebeneinander**: „Das Wissensarchiv entdecken“ → Galerie;
   „Inhaltsverzeichnis des Wissensarchivs“ → Story-Modus mit den Themen; „Wie
   funktioniert der KnowledgeScout?“ → eine Website-Seite.
4. **Weitere Sektionen** nach Bedarf (Text-Bild, Banner, Kontakt) — kein Code.

Was dabei NICHT entsteht: keine zweite Startseite, keine Library-Einstellung
für die Beispielfragen, keine Kopie des Story-Modus. Die Sektion ist ein
dritter Gastgeber der Story-Bausteine (nach Galerie-Mitte und Embed) und
teilt mit dem Story-Modus Sitzung, Perspektive und Verlauf: Was auf der
Startseite gefragt wird, steht im Story-Modus in der Chronik.

## 3. Konvention (dokumentgetrieben, flach)

```markdown
<!-- section layout=story bg=light kicker="KnowledgeScout" placeholder="Stelle deine Frage zur Natur Südtirols …" -->
## Frag einfach drauflos.
Zum Beispiel eine dieser Fragen — oder stelle deine eigene.

<!-- questions -->
- Wie verändert der Klimawandel die Artenvielfalt Südtirols?
- Welche Arten sind in Südtirol besonders gefährdet?
- Warum sind Moore für die Biodiversität wichtig?
- Wie wirkt sich Lichtverschmutzung auf Tiere aus?

✓ Antworten mit Quellenangaben · ✓ Inhalte des Naturmuseums
<!-- /section -->

<!-- section layout=text-only bg=default -->
<!-- cards -->
- **Das Wissensarchiv entdecken** Stöbere in Studien, Berichten und Quellen. [Zum Archiv →](?view=gallery)
- **Inhaltsverzeichnis des Wissensarchivs** Die Themen des Bestands, vom Scout gegliedert. [Zu den Themen →](?mode=story)
- **Wie funktioniert der KnowledgeScout?** Was der Scout kann und woher die Antworten kommen. [Mehr erfahren →](?site=wie-funktioniert)
<!-- /section -->
```

- `layout=story` (N1): neues Sektions-Layout. Markdown **vor** dem
  `questions`-Block steht über der Eingabe, Markdown **danach** darunter.
  Attribut `placeholder="…"` für das Eingabefeld (ohne: Übersetzung
  `chat.input.placeholderExample`). `kicker`, `bg` wie bei jeder Sektion.
- `<!-- questions -->` + Liste (N1): Block wie `stats`/`chips`; Einträge sind
  die Beispielfragen, Klick stellt die Frage sofort. Nur in `layout=story`
  erlaubt — sonst wirft der Sektions-Parser (kein stiller Fallback). Eine
  Story-Sektion ohne `questions` ist erlaubt (nur Eingabe); `seite_pruefen`
  warnt. **Höchstens eine** Story-Sektion je Seite (Sitzung und Story-Atome
  sind geteilt; zwei Instanzen würden sich überschreiben) — mehr als eine
  wirft.
- `<!-- cards -->` + Liste (N2): Block in jeder Sektion; Eintrag `- **Titel**
  Text [Linktext](Ziel)`. Drei Spalten ab `md`, Karte im Stil `box kind=card`.
  Ziele: `?view=gallery`, `?mode=story`, `?site=<slug>` oder eine absolute
  URL. Eintrag ohne `**Titel**` oder ohne Link wirft.
- Frontmatter bleibt flach; es kommt **kein** neues Frontmatter-Feld und
  **keine** Library-Einstellung dazu (`AGENTS.md`, Frontmatter-Format;
  Regel 3 des Nachbarplans).

## 4. Bausteine

### N1 Sektion `story`

| Datei | Änderung |
|---|---|
| `src/lib/website/types.ts` | `SectionLayout` um `story`; `WebsiteSection.placeholder?` |
| `src/lib/website/parse-section-blocks.ts` | Block `questions` → `{ type: 'questions'; items: string[] }` (Liste wie `chips`; leere Liste wirft) |
| `src/lib/website/parse-website-sections.ts` | `story` in `SECTION_LAYOUTS`; Attribut `placeholder`; Prüfung: `questions` nur in `story`, höchstens eine Story-Sektion je Body |
| `packages/module-story/src/react/konversation/story-eingabe-inline.tsx` | Eingabe als sichtbares Feld (Textarea + Knopf; Enter sendet, Shift+Enter Zeilenumbruch); Antwortlänge wie `StoryEingabe`; Export im Paket-Index. Kein `next/*`, kein Clerk (`paket-schnitt.test.ts`) |
| `packages/module-story/src/react/story-root/use-story-konversation.ts` | Option `ohneUebersicht?: boolean` — die Sektion braucht keine Themenübersicht (spart den Modellaufruf, der Story-Modus berechnet sie weiter) |
| `packages/module-explorer/src/gallery/index.ts` | `BelegListe` und `ReferencesSheet` exportieren (bisher nur die Helfer) |
| `src/components/library/website/story/website-story-sektion.tsx` | Client-Baustein: `useStoryContext` (Perspektive, Modell), `useStoryKonversation` mit `ohneUebersicht`, Fragen-Kacheln, `StoryEingabeInline`, `StoryKonversation` über das **jüngste** Paar der Sitzung (`sichtbaresPaar(paare(nachrichten))`; bis 08.11. alle Paare — die Konversation wuchs), darunter der Verweis auf die früheren Fragen im Story-Modus, Belege-Zähler je Antwort und Blatt `ReferencesSheet` (Modus `answer`), Knopf „Antworten anpassen“ → `PerspektiveDialogApp`; KI-Hinweis als `fuss` wie `StoryAntwortFuss`. Farben nur über `--site-*` und `surfaceStyle()` |
| `src/components/library/website/story/website-story-sektion-rahmen.tsx` | Rahmen (Fläche, Kennzeile, Markdown vor/nach, Karte) — getrennt, damit die Archiv-Vorschau ohne Chat dieselbe Hülle zeigt (Dateigrenze 200 Zeilen) |
| `src/components/library/website-detail.tsx` | Slot `storySlot?: (section) => ReactNode` wie `bannerSlot`; ohne Slot (Archiv-Vorschau) Einleitung, Fragen als Liste und Hinweis „Chat nur auf der Live-Seite“ |
| `src/components/library/website/website-landing-live.tsx` | reicht den Slot im Site- und Root-Modus; Beleg öffnen → `onShowGallery({ doc: <slug> })` bzw. Original über `useDokumentOeffnen` |
| `src/lib/mcp/website-pruefung.ts`, `tools-website-pruefen.ts` | Warnung „Story-Sektion ohne Fragen“; `seite_pruefen` nennt je Sektion `fragen` (Anzahl); Fehler des Parsers laufen wie heute durch |
| `src/lib/mcp/tools-info.ts` | `TOOLSET_VERSION` 2.63.0, `NEU_IN_VERSION` |
| `packages/i18n/src/translations/{de,en,it,es,fr}.json` | `website.story.*`: Senden, Antworten anpassen, Quellen (n), Enter-Hinweis, Vorschau-Hinweis |
| `docs/contracts/website-landingpage.md` §1, `.claude/skills/website-publishing/SKILL.md` | Layout `story`, Block `questions`, Regeln oben |
| Tests `tests/unit/website/*.test.ts`, `tests/unit/mcp/website-pruefung*.test.ts` | Parser (Layout, Attribut, Block, die drei Fehlerfälle), Prüfung (Warnung) |

Verhalten im Detail:

- **Erst fragen.** Kein automatischer Perspektiv-Dialog auf der Startseite
  (er hängt am `StoryModeHeader`, der hier nicht montiert ist). Die
  Voreinstellungen gelten, bis jemand „Antworten anpassen“ wählt; Wahl landet
  wie heute in Story-Atomen, localStorage und Profil.
- **Sitzung.** `useStorySitzungId(libraryId)` wie im Story-Modus — eine
  Sitzung je Browser und Library. Die Fragen der Startseite stehen danach in
  der Chronik des Story-Modus.
- **Wie eine Suche (08.11.2026).** Die Sektion zeigt nur das jüngste
  Frage-Antwort-Paar; während eine neue Antwort läuft, steht die neue Frage
  mit den Verarbeitungsschritten da, die alte Antwort ist weg. Hat die
  Sitzung mehr als ein Paar, steht unter der Antwort der Verweis
  „N frühere Fragen dieser Sitzung im Story-Modus" (`website.story.fruehereFragen`),
  der über `kartenaktion({ art: 'story' })` ohne Neuladen in den Story-Modus
  wechselt (Site-Modus `onShowStory`, Root-Modus `storyBaseHref`). Er gibt
  `q=<queryId>` der jüngsten früheren, beantworteten Frage mit
  (`juengsteFruehereKennung`; Root-Modus im `href`, Site-Modus als `extra`
  an `onShowStory`, das `useGalleryMode.setMode('story', extra)` in die
  Adresse schreibt), denn ohne `q` zeigt der Story-Modus per Design die
  Themenübersicht (`StoryAuswahlUrl`, D2).
- **Belege.** `onBelege` liefert die Belege der zuletzt gezeigten Antwort;
  die Sektion zeigt je Antwort einen Zähler („3 Quellen“) und öffnet das
  Blatt. `BelegListe` kommt ohne `DocCardMeta` aus (Titel aus
  `reference.title`, D12k); Plakette und Kennzeile fehlen dann — Vorrat
  unten.
- **Anonym.** Öffentliche Library: der Stream läuft anonym über die
  Sitzungs-Header wie im Story-Modus. Rate-Limiting ist Meilenstein M3 des
  Vorhabens, nicht Teil dieses Plans.
- **Telefon.** Kacheln einspaltig, Eingabe unter den Kacheln, Belege als
  Blatt (wie Desktop — die Sektion hat keine Spalten).
- **Kein stiller Fallback.** Unbekannter `placeholder`-Typ, `questions`
  außerhalb von `story`, zwei Story-Sektionen: der Parser wirft,
  `seite_pruefen` meldet es vor dem Publizieren, der Renderer zeigt die
  Meldung.

### N2 Kacheln und Zielauflösung

| Datei | Änderung |
|---|---|
| `src/lib/website/parse-section-blocks.ts` | Block `cards` → `{ type: 'cards'; items: { title; text; linkLabel; href }[] }` |
| `src/lib/website/kartenziel.ts` | reine Funktion: `?view=gallery` / `?mode=story` / `?site=…` / `http(s)` → `{ art, …}`; alles andere wirft |
| `src/components/library/website/section-cards.tsx` (eigene Datei, Dateigrenze 200 Zeilen; `section-content.tsx` ruft sie) | `Cards`: Raster `md:grid-cols-3`, Karte wie `box kind=card`; Klick ruft im Site-Modus die Rückrufe (`onShowGallery`, `onShowStory`, `setSiteParam`), im Root-Modus `href` mit `exploreBaseHref` |
| `packages/module-explorer/src/gallery/components/gallery-root.tsx` | `siteView` bekommt `onShowStory: () => setMode('story')` |
| `src/app/library/gallery/client.tsx`, `website-landing-live.tsx` | reichen `onShowStory` durch; `SectionContent` bekommt die Navigation als Prop (ohne Prop: reine Links) |
| Brücke, Contract, Skill, Tests | Block in `seite_pruefen` (Anzahl Karten, ungültiges Ziel als Fehler); Doku |

### N3 Perspektive als Blatt

| Datei | Änderung |
|---|---|
| `packages/module-story/src/react/perspektive/perspektive-dialog.tsx` | Prop `darstellung?: 'dialog' \| 'blatt'`; `blatt` rendert `Sheet` von rechts (`@ks/ui`), Inhalt unverändert |
| `src/components/library/story/perspektive-dialog-app.tsx` | reicht `darstellung` durch |
| `website-story-sektion.tsx` | `darstellung="blatt"` |
| `src/components/library/story/story-perspektive-dialog.tsx` | `darstellung="blatt"` — der Story-Modus zeigt die Perspektive seit 07.11. als Blatt von rechts (Owner-Entscheid). Das Embed (`embed-galerie.tsx`) bleibt beim zentrierten Dialog |

### N4 Inhalt (kein Code)

Über die Brücke (Skill `website-publishing`): Startseiten-Doc der Library
Naturmuseum mit Hero, Story-Sektion (die vier Fragen aus der Vorlage, Text
„nur vorübergehend“ laut Mail — mit dem Museum abstimmen), Kacheln, Seite
„Wie funktioniert der KnowledgeScout?“, Fußzeile; `siteEnabled` setzen;
`seite_pruefen` vor jedem Publizieren. Danach Rückmeldung an den Direktor
mit den drei offenen Punkten (Belege an der Antwort oder im Blatt; Zielgruppe
„Kinder“ erst in M3; seine Quellenkategorien passen zum Umweltarchiv, nicht
zum Museumsbestand). Vorhabensstand im Archiv nachziehen (`BERICHT.md`:
die Vorlage liegt seit 02.11. im Ordner).

## 5. Regeln

- **Dokumentgetrieben, flach.** Beispielfragen, Texte und Kacheln stehen im
  Markdown der Seite; keine Library-Einstellung, kein neues Frontmatter-Feld.
- **Ein Story-Kern.** Die Sektion komponiert die Bausteine aus
  `@ks/module-story` und `@ks/module-explorer`; sie kopiert nichts aus
  `StoryRoot`. Was die Sektion braucht und das Paket nicht hat (sichtbare
  Eingabe, Option ohne Übersicht), wird im Paket ergänzt — Paket-Schnitt
  (`paket-schnitt.test.ts`, `instanz-fetch.test.ts`) bleibt.
- **Kein stiller Fallback** (`no-silent-fallbacks.md`): Parser wirft,
  `seite_pruefen` nennt es, Renderer zeigt es.
- **Farben nur über das Design-Profil** (`--site-*`, `surfaceStyle()`),
  keine festen Hex-Klassen (Contract §1 S2).
- **Dateien ≤ 200 Zeilen**; Rahmen und Chat der Sektion getrennt.
- **Gates**: `pnpm test`, `pnpm lint`, `npx tsc --noEmit -p tsconfig.json |
  grep '^src/'` leer; kein `pnpm build` im Cloud-Agent.

## 6. Vorrat (nicht in diesem Plan)

- Beleg-Karten der Startseite mit `DocCardMeta` (Plakette, Kennzeile,
  Kurztext): die zitierten Dokumente über die öffentliche Docs-API nachladen.
- Sprachumschalter DE/IT/EN auf der Startseite (S5 des Nachbarplans) — die
  Vorlage verspricht drei Sprachen; die Sprache der Antwort stellt heute die
  Perspektive.
- Zielgruppenmodi („Für Kinder“, „Wissenschaftlich“) — Meilenstein M3 des
  Vorhabens; heute über `character`/`socialContext` der Perspektive.
- „Einstellungen“ in der TopNav (Vorlage): erst, wenn das Blatt (N3) steht
  und der Owner es dort will.
- Rate-Limiting und Anmeldung für intensive Nutzung (M3).
