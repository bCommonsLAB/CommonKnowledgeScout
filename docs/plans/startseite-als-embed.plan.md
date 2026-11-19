---
name: startseite-als-embed
overview: "Die Website-Startseite einer öffentlichen Library wird eine eigene einbettbare Komponente in `@ks/embed` (`KnowledgeScoutSite`). Sie zeigt alles, was die Seite enthält: Kopf, Sektionen, Kacheln, die Fragen-Sektion mit Antwort, Belegen und Detailansicht, das Galerie-Band und die Fußzeile. Jeder Weg aus der Seite hinaus (Galerie, Story-Modus, andere Website-Seite) ist ein Link in die Container-Anwendung; welche Komponente hinter welcher Adresse liegt, entscheidet die Container-Anwendung. Parameter ist die Kennung der Website-Seite; zuerst nur die Startseite. Dafür ziehen die Startseiten-Bausteine aus der App in ein Paket `@ks/module-website`, das App und Embed gemeinsam nutzen."
vorhaben: [24.09 KnowledgeScout]
status: entwurf
todos:
  - id: we0-einstieg-explorer
    content: "WE0 Einstieg für Galerie und Story: `KnowledgeScoutExplorer` nimmt `start` (`KsEinstieg`: `dokument`, `seitenzahl`, `liste`, `frage`) entgegen — Dokument und Liste als `initialParams` der Speicher-Adressierung, die Frage als Story-Auswahl mit aufgelöster Sitzung; `@ks/embed` exportiert das Ziel-Vokabular `KsZiel` mit `ksZielAlsParameter`, `ksEinstiegAusParametern` und `ksSeiteAusParametern` (Parameter mit Vorsatz `ks-`). Berührt keine Startseiten-Datei. GEBAUT 18.11.2026 (Branch `claude/we0-einstieg-explorer`)."
    status: completed
  - id: we1-regeln-ins-paket
    content: "WE1 Paket `@ks/module-website` anlegen, die reinen Regeln aus `src/lib/website/**` hinein (Parser, Design-Profil ohne Schriften, Kachelziele, Banner, Story-Karten), dazu `mapToWebsiteDetail` und `safe-video-iframe`. Commit 1 nur `git mv`, Commit 2 Importe. Wächter-Test Paketgrenze. Gate: Startseiten-Arbeit der Parallelsitzung ist gemergt. GEBAUT 18.11.2026 (Branch `claude/website-modul-we1-c491f4`); `safe-video-iframe` lag schon in `@ks/util` und bleibt dort."
    status: completed
  - id: we2-bausteine-ins-paket
    content: "WE2 Bausteine ins Paket: Kopf-Varianten, Sektionen, Kacheln, Banner, Fußzeile, `WebsiteDetail`, Daten-Hooks. Abrufe über `InstanceApi`, alle Wege über eine Navigation-Schnittstelle (Ziel → Adresse oder Klick), Schriften als Prop. Die App behält `WebsiteLandingLive` als Hülle; ihr Verhalten bleibt unverändert. GEBAUT 18.11.2026 (Branch `claude/website-modul-we2`, gestapelt auf WE1); Schnittstelle heißt `WebsiteNavigation`."
    status: completed
  - id: we3-fragen-sektion
    content: "WE3 Fragen-Sektion ohne App-Bindung: Clerk, `useStoryContext`, `useProfilPerspektive`, `PerspektiveDialogApp`, `useLibraryConfig` raus; Viewer, Perspektive, Modell und Sitzungs-Kopfzeilen als Props, Fuß der Antwort und Detail-Renderer als Slots. App reicht ihre Teile, das Embed die anonymen aus `embed-story.tsx` und `embed-perspektive.tsx`. GEBAUT 18.11.2026 (Branch `claude/website-modul-we3`); Schnittstelle `WebsiteStoryGastgeber`."
    status: completed
  - id: we4-komponente
    content: "WE4 `KnowledgeScoutSite` in `@ks/embed`: Props `baseUrl`, `library`, `page`, `locale`, `hrefFor`, `menu`, `height`; Seiten-Kennung auflösen (unbekannt = Fehler im Rahmen); CORS für `popular-questions`; Schriften in `styles.css`; Blätter und Detailansicht über dem Fenster; README, Contract §7, Tarball. GEBAUT 18.11.2026 (Branch `claude/website-modul-we4`, Entscheide A–E nach Empfehlung)."
    status: completed
  - id: we5-nachweis
    content: "WE5 Nachweis in der Partner-App: Menüpunkt „Fragen“ mit `KnowledgeScoutSite`, „mehr Inhalte“ und Menüpunkt „Inhalte“ öffnen die Galerie-Seite der Partner-App mit `KnowledgeScoutExplorer` und Einstieg; Prüfliste Abschnitt 6 live gegen die Instanz."
    status: pending
---

# Startseite als einbettbare Komponente

## 1. Auftrag (Owner, 18.11.2026)

- Die Startseite einer Library ist eine **eigene Komponente**, die in einer
  fremden Anwendung aufgeht.
- In ihr ist alles eingebettet, was die Seite enthält: die Fragen-Sektion
  (der Story-Teil) und das Galerie-Band („Mehr aus dieser Bibliothek“).
- Oben gibt es einen Menüpunkt in die Galerie. Dieser Link und „mehr Inhalte“
  sind **Links der Container-Anwendung**: Sie öffnen deren nächste Seite, auf
  der die Galerie-Komponente eingebettet ist. Kein Wechsel innerhalb der
  Komponente.
- So später auch für andere Seiten: Die Komponente bekommt die **Kennung der
  Website-Seite** als Parameter. Welche Komponente bei welcher Adresse aufgeht,
  entscheidet die Container-Anwendung.
- **Jetzt nur die Startseite.**

Anlass: Die Partner-App, in der Galerie und Story-Modus schon eingebettet sind
(M5, D6b), bekommt einen Menüpunkt „Fragen“ mit dieser Komponente.

## 2. Ausgangslage (Analyse 18.11.2026)

**Schon da**

- `KnowledgeScoutExplorer` (`@ks/embed`): Galerie und Story-Modus, anonym, nur
  öffentliche Libraries (ADR 0008), Adressierung im Speicher, Stile unter `.ks-embed`.
- Die Bausteine der Fragen-Sektion liegen großteils in Paketen:
  `useStoryKonversation`, `StoryEingabeInline`, `StoryKonversation`,
  `AntwortText`, `PerspektiveDialog` (`@ks/module-story`); `DocumentCard`,
  `ReferencesSheet`, `DetailOverlay`, `EMBED_DETAIL_RENDERERS`
  (`@ks/module-explorer`). Modell und Perspektive anonym: `embed-story.tsx`,
  `embed-perspektive.tsx`.
- Sitzungskennung und Story-Sitzung liegen im `localStorage` je Library. Zwei
  Komponenten auf derselben Container-Anwendung teilen sie (gleiche Herkunft):
  „N frühere Fragen im Story-Modus“ findet die Fragen auch auf der nächsten
  Seite der Container-Anwendung.
- Der öffentliche Library-Abruf liefert `siteEnabled`, `siteTheme`, `gallery`
  (mit `itemLabel`; im Typ `ExplorerLibraryPayload` noch nicht erfasst) und `chat`.
- Für fremde Herkunft freigegeben (`src/lib/embed/embed-cors.ts`): `docs`,
  `doc-meta`, `docs/by-fileids`, `queries`, `stream`.
- Bilder der Startseite sind absolute Blob-Adressen (Contract §5).
- `kartenziel.ts` (`KartenNavigation`) kennt die Wege Galerie, Story, andere
  Seite und extern — Grundlage der Link-Schnittstelle.

**Fehlt**

| Hindernis | Stelle | Welle |
|---|---|---|
| Bausteine liegen in der App (`@/…`), rund 4.500 Zeilen | `src/components/library/website/**`, `website-detail.tsx`, `src/lib/website/**` | WE1, WE2 |
| Next.js: `next/dynamic`, `usePathname`, `useRouter`, `next/link`, `next/image`, `next/font/local`, `nuqs` | Landingpage, Banner, Story-Navigation, Konversation, `site-fonts.ts` | WE2, WE4 |
| Anmeldung (Clerk) und App-Hooks | `use-website-story.ts`, `website-story-sektion.tsx`, `useStoryContext`, `useProfilPerspektive`, `useLibraryConfig`, `ChatConfigDisplay` | WE3 |
| Relative Abrufe, Sprache per `x-locale` (für fremde Herkunft nicht freigegeben) | `use-website-landing-data.ts`, Banner, Kontakt, `SAME_ORIGIN_API` in der Story-Sektion | WE2, WE3 |
| Links als rohe Adressen: `cta_url`, `cta2_url`, Links im Sektions-Markdown, Fußzeile, Banner | `hero-*.tsx`, `markdown-text.tsx`, `website-site-footer.tsx`, `website-banner-grid.tsx` | WE2 |
| CORS fehlt: `popular-questions` (GET), Kontakt (POST) | `embed-cors.ts` | WE4, Entscheid C |
| Verbrauch-Link unter der Antwort: relativ, und die Instanz kennt die Sitzung der fremden Herkunft nicht | `website-story-konversation.tsx` | WE3 (im Embed weg) |
| Detailansicht im Embed nur für Buch, Testimonial, Blog | `embed-detail-renderers.tsx` | WE4 (sonst Link) |
| Galerie-Komponente kann nicht mit Dokument, Frage oder Filter starten | `KnowledgeScoutExplorer` | WE0 |

## 3. Zielbild

### 3.1 Die Komponente

```tsx
import '@ks/embed/styles.css'
import { KnowledgeScoutSite, ksZielAlsParameter } from '@ks/embed'

<KnowledgeScoutSite
  baseUrl="https://knowledgescout.org"
  library="<slug>"
  locale="de"
  hrefFor={(ziel) => {
    const q = new URLSearchParams(ksZielAlsParameter(ziel)).toString()
    if (ziel.art === 'galerie' || ziel.art === 'dokument') return `/inhalte?${q}`
    if (ziel.art === 'story') return `/story?${q}`
    return null // weitere Website-Seiten gibt es in dieser Anwendung noch nicht
  }}
/>
```

- `baseUrl`, `library`, `locale`: wie beim Explorer.
- `page` (optional): Kennung der Website-Seite, Slug oder fileId wie `?site=`.
  Ohne `page` die Startseite (Main-Menü-Seite mit kleinstem `menu_order`).
  Passt die Kennung zu keiner Seite: Fehler im Rahmen, **kein** Rückfall auf
  die Startseite (die App warnt heute nur und zeigt die Startseite).
- `hrefFor(ziel)` (Pflicht): die Adresse in der Container-Anwendung, gerendert
  als gewöhnlicher Link `<a href>`. Zu `null` siehe Entscheid E.
- `menu` (optional): Menüzeile oben, Entscheid B.
- `height` (optional): ohne Angabe natürliche Höhe, die Container-Seite
  scrollt; mit Angabe ein fester Rahmen mit eigenem Scroll.
- `className`.

### 3.2 Ziele

| Ziel | Woher auf der Startseite |
|---|---|
| `{ art: 'galerie', liste? }` | Menüpunkt „Inhalte“, Kachel `?view=gallery`, „mehr Inhalte“ des Banners (bei `banner_sort: stars` mit `liste: { nurMitStern, sortierung: 'stars' }`) |
| `{ art: 'dokument', slug, seitenzahl?, liste? }` | Banner-Karte (Entscheid A), Beleg eines Typs ohne Embed-Renderer |
| `{ art: 'story', frage? }` | Menüpunkt „Story“, Kachel `?mode=story`, Verweis „N frühere Fragen“ (`frage` = queryId) |
| `{ art: 'seite', seite }` | Kachel `?site=`, Fußzeilen-Links, weitere Menüpunkte, `?site=`-Links im Markdown |
| absolute `http(s)`-Adresse | Kachel, CTA, Markdown — direkt, ohne `hrefFor` |

`ksZielAlsParameter` und `ksEinstiegAusParametern` übersetzen zwischen Ziel
und Adress-Parametern; die Namen sind die der KS-Adresse mit Vorsatz `ks-`
(`ks-doc`, `ks-page`, `ks-starred`, `ks-sort`, `ks-q`, `ks-site`), damit sie
nicht mit eigenen Parametern der Container-Seite kollidieren (die Partner-App
nutzt selbst `view`). Die Container-Anwendung muss das KS-Vokabular nicht
kennen: Sie reicht die Parameter ihrer Adresse an die Galerie-Komponente
weiter (`start={ksEinstiegAusParametern(searchParams)}`).
Ein relatives Ziel außerhalb der Tabelle (CTA, Markdown) wird geloggt und nicht
als Link gerendert; `seite_pruefen` meldet es schon vor dem Publizieren.

### 3.3 Was in der Komponente bleibt

Frage stellen, Antwort, populäre Fragen, Filter-Chip, Belege-Blatt,
Perspektive-Blatt („Antworten anpassen“) und die Detailansicht eines
zitierten Dokuments über der Startseite (wie seit 10.11.2026). Blätter und
Detailansicht liegen über dem **Fenster** der Container-Seite, nicht nur über
dem Rahmen: Bei natürlicher Höhe ist der Rahmen höher als das Fenster, und
`contain: layout` würde sie an den Rahmen binden.

### 3.4 Eine Quelle für App und Embed

`@ks/module-website` enthält Regeln und Bausteine. Die App behält
`WebsiteLandingLive` als dünne Hülle: Navigation intern (Moduswechsel, nuqs
`?site=`), Schriften aus `next/font`, Anmeldung aus Clerk. Das Embed liefert
`hrefFor`, Schriften aus CSS und den anonymen Betrachter. Paketgrenze wie
`tests/unit/packages/module-story/paket-schnitt.test.ts`: kein `next/*`, kein
Clerk, kein `@/`, keine Adresszeile. Die Brücke (`website-pruefung.ts`,
`website-seite.ts`) importiert Parser und Regeln danach aus dem Paket —
dieselben Regeln wie der Renderer (Contract §6).

## 4. Wellen

**WE0 Einstieg für Galerie und Story** — gebaut 18.11.2026. Prop `start`
(`KsEinstieg`) am Explorer: `dokument`/`seitenzahl`/`liste` werden
`initialParams` der Speicher-Adressierung (`einstieg.ts`), `frage` setzt die
Story-Auswahl beim Anlegen des Speichers (`embed-inhalt.tsx`) und
`useStoryEinstieg` stellt die aktive Sitzung auf die der Frage um
(`GET …/queries/<id>` → `chatId`). Ein Einstieg, der nicht zur Ansicht passt,
ist ein Fehler im Rahmen. Der Inhalt montiert neu, wenn sich der Einstieg
ändert (Schlüssel aus dem Inhalt, nicht aus der Objekt-Identität). Übersetzer
in `ziel-parameter.ts`; Tests `tests/unit/packages/embed/{ziel-parameter,einstieg}.test.ts`
und `knowledge-scout-explorer-einstieg.test.tsx`. Bekannte Grenze: Die Galerie
löst `doc` nur unter den geladenen Karten auf — wer ein Dokument aus einer
Rangliste öffnet, gibt die `liste` mit (wie das Banner heute).

**WE1 Regeln ins Paket** — Gate: Die Startseiten-Arbeit der Parallelsitzung
(Fragen-Sektion) ist gemergt; sonst Konflikte in genau diesen Dateien.
Paket anlegen (`package.json`, Root-Abhängigkeiten nachziehen, `sideEffects:
false`), `src/lib/website/**` ohne `site-fonts.ts` und ohne den Server-Teil
`website-translation-guard.ts` hinein, dazu `mapToWebsiteDetail` aus
`doc-meta-mappers.ts` und `safe-video-iframe`. Rund 1.700 Zeilen, Commit 1 nur
Umzug. Zeile im Routing-Index von `CLAUDE.md` und im Skill `contracts-ui`.
Mittel, mechanisch.
Gebaut 18.11.2026: 17 Regel-Dateien plus `website-detail-daten.ts`
(`WebsiteDetailData` und `mapToWebsiteDetail`; `website-detail.tsx` und
`doc-meta-mappers.ts` reichen beide weiter). Die App importiert direkt aus
`@ks/module-website`, unter `src/lib/website/` bleiben nur `site-fonts.ts`
samt `fonts/` und `website-translation-guard.ts`. `safe-video-iframe` lag
schon in `@ks/util` (die App-Datei ist eine Hülle); die Bausteine in WE2
importieren es von dort. Wächter:
`tests/unit/packages/module-website/paket-schnitt.test.ts` (dazu kein
nacktes `fetch`, Wurzel-Barrel zur Laufzeit React- und Galerie-frei).

**WE2 Bausteine ins Paket** — Kopf-Varianten, Sektionen, Kacheln, Banner,
Fußzeile, Kontakt, `WebsiteDetail`, Daten-Hooks; rund 1.600 Zeilen. Abrufe
über `instanz.fetch` mit `Accept-Language`. `KartenNavigation` wird die
Navigation-Schnittstelle aller Wege (Ziel → `href` und optional Klick); CTA,
Markdown-Links, Fußzeile und Banner laufen hindurch. `SITE_FONT_FAMILIES` wird
Prop. Prüfung live in der App: `/explore/<slug>` (Startseite, Kacheln,
Banner, Fußzeile, `?site=`), Root `/` auf einer gemappten Domain,
Archiv-Vorschau ohne Story-Slot. Groß.
Gebaut 18.11.2026: Die Bausteine liegen unter `@ks/module-website/react`,
dazu die Rahmen der Story- und Themen-Sektion (Vorschau von `WebsiteDetail`).
Die Schnittstelle heißt `WebsiteNavigation` (`weg(ziel)` → `href` und
optional `ausfuehren`, `null` = Element entfällt mit Meldung; `fremd(href)`
für relative Adressen außerhalb des Vokabulars). `WebsiteZiel` hat die Form
von `KsZiel`. `kartenaktion`/`KartenNavigation` sind ersetzt durch
`appNavigation(modus)` — die zwei App-Modi mit denselben Adressen wie
vorher. Der Kern der Live-Seite heißt `WebsiteLanding` (Props: Instanz,
Seite, Navigation, Schriften, Profil, Story-Slot); `WebsiteLandingLive` ist
die Hülle (nuqs, `router.push`, `next/font`, `next/dynamic`). Abweichend vom
alten Verhalten, gewollt: Handlungsaufrufe und Markdown-Links mit `?site=`
wechseln ohne Neuladen, und auf der Root-Seite führen `?view=gallery`-Links in
die Explore-Galerie. Live geprüft auf `/explore/klimamassnahmen`
(Handlungsaufruf, Fußzeile, Zurück, „mehr Inhalte“, Banner-Karte mit
Detailansicht), `/explore/aeced` (Kacheln) und `/` mit Domain-Zuordnung auf
die Library (Banner-Karte über `router.push`). Die Archiv-Vorschau (Anmeldung
nötig) ist nur über Tests belegt. Offen für WE4: Das Banner braucht wie bisher
den `GalleryNavigationProvider` der Karte.

**WE3 Fragen-Sektion ohne App-Bindung** — rund 1.100 Zeilen. Viewer,
Perspektive, Modell, Sitzungs-Kopfzeilen und Eingabegrenzen als Props;
Fuß der Antwort (Konfig-Anzeige, Verbrauch, Verarbeitung) und
Detail-Renderer als Slots. Die App reicht ihre heutigen Teile, das Embed die
aus `embed-story.tsx`/`embed-perspektive.tsx`. Der Verweis „N frühere Fragen“
geht über die Navigation (Ziel `story` mit `frage`). Mittel.
Gebaut 18.11.2026: Die Story-Bausteine liegen unter `@ks/module-website/react`;
was nur der Gastgeber hat, kommt über `WebsiteStoryGastgeber` — Instanz,
Anmeldung, Perspektive mit Modell, Eingabe (Platzhalter, Zeichengrenze,
Laden/Fehler der Konfig) als Props; Dialog „Antworten anpassen“, Fuß der
Antwort, Bild neben der Antwort und Detailansicht als Slots. Ohne Dialog-Slot
gibt es den Knopf nicht, ohne Detail-Slot öffnet ein Dokument über die
Navigation (Ziel `dokument`). Die Sitzungs-Kopfzeilen holt das Paket selbst
(`useSessionHeaders` aus `@ks/api-client`, hängt nur an `angemeldet`). Belege,
Katalog und „frühere Fragen“ gehen über `WebsiteNavigation`; ein Beleg-Weg
ohne Rückruf steht laut in der Konsole (WE4 gibt dem Embed dafür einen
Wechsel mit). Die App baut den Gastgeber in `story/website-story-app.tsx`; in
der App bleiben `use-website-perspektive.ts` und `website-story-detail.tsx`.
Live geprüft ohne lokalen Secretary: `/explore/aeced` (Eingabe mit Platzhalter
der Library, Beispielfragen, Knopf öffnet den Dialog der App, Themen-Sektion
meldet den fehlenden Secretary sichtbar), `/explore/sfscon-talks`
(Katalog-Zahl mit Filter und Verlauf über die Instanz). Antwort, Fuß, Belege
und „frühere Fragen“ sind über `story-sektion-gastgeber.test.tsx` belegt,
nicht live (dafür braucht es den Secretary).

**WE4 `KnowledgeScoutSite`** — Komponente in `@ks/embed` nach 3.1; eigener
Jotai-Speicher, `PortalContainerProvider`, `TooltipProvider` wie der Explorer;
ein zweiter Portal-Ort mit Klasse `.ks-embed` für Blätter und Detailansicht
über dem Fenster. CORS-Eintrag `popular-questions` (GET) mit Test in
`embed-cors.test.ts`. Schriften des Design-Profils als `@font-face` in
`styles.css` (Dateien liegen dem Paket bei; Nachweis, dass Turbopack sie aus
`node_modules` lädt — sonst feste Pfade auf der Instanz mit CORS).
Detailansicht für Typen ohne Embed-Renderer: Ziel `dokument`. README,
Contract `website-landingpage.md` §7 „Einbettung“, Tarball. Mittel.
Gebaut 18.11.2026: `knowledge-scout-site.tsx` (Props prüfen, Portal-Ort am
`body`, Rahmen ohne `contain`), `embed-site-inhalt.tsx` (Speicher, Provider,
Library laden, anonymer Gastgeber der Fragen-Sektion, Detailansicht),
`embed-site-navigation.ts` (`hrefFor` → `WebsiteNavigation`, Klick öffnet
dieselbe Adresse; keine `fremd`-Methode), `embed-site-menue.tsx`,
`embed-site-detail.tsx`. Im Paket dazu `useWebsiteSeite` (`unbekannteSeite:
'startseite' | 'fehler'`), Slot `menue` und `onDokument` an `WebsiteLanding`.
`EMBED_DETAIL_TYPEN` (book, testimonial, blog) im Explorer. Schriften:
`build-css.mjs` kopiert die Dateien nach `dist/fonts` und schreibt
`@font-face` (Familien `KS …`, `EMBED_SCHRIFTEN`). Nachweis in einer fremden
Next-App (lädt Turbopack die Schriften aus `node_modules`?) ist Teil von WE5.

**WE5 Nachweis in der Partner-App** — Seite „Fragen“ mit
`KnowledgeScoutSite`, Galerie-Seite mit `KnowledgeScoutExplorer`, der seinen
Einstieg aus der eigenen Adresse liest (`ksEinstiegAusParametern`). Prüfliste
Abschnitt 6. Klein.

**Später, nicht jetzt:** Galerie- und Story-Komponente reichen ihre Wege nach
außen ebenfalls über `hrefFor` (heute wechseln sie intern); weitere
Website-Seiten als eigene Adressen der Container-Anwendung (`page`).

## 5. Owner-Entscheide

**Entschieden 18.11.2026: alle fünf nach Empfehlung** (A Detailansicht über
der Startseite, B Menüzeile mit `menu={false}`, C kein Kontaktformular im
Embed, D eigene Komponente `KnowledgeScoutSite`, E `null` = Element entfällt
mit einer Meldung).

- **A Banner-Karte:** Detailansicht über der Startseite wie die Belegkarten
  (Empfehlung) — oder Link `dokument` auf die Galerie-Seite der
  Container-Anwendung.
- **B Menüzeile:** Die Komponente zeichnet oben eine schlanke Zeile
  (Startseite, weitere Seiten nach `menu_order`, Inhalte, Story), alle Punkte
  über `hrefFor`; `menu={false}` blendet sie aus (Empfehlung). Oder die
  Container-Anwendung baut ihr Menü allein; dann exportiert das Embed die
  Seitenliste als Funktion.
- **C Kontaktformular im Embed:** eine schreibende Route mit Mailversand von
  fremder Herkunft. Empfehlung: zunächst nicht; die Sektion sagt sichtbar,
  dass das Formular auf der Website der Library steht, mit Link dorthin.
- **D Name:** eigene Komponente `KnowledgeScoutSite` (Empfehlung: andere
  Pflicht-Props als der Explorer) statt `view="site"` am Explorer.
- **E `hrefFor` liefert `null`:** Das Element entfällt, die Komponente meldet
  es einmal in der Konsole (Empfehlung). Oder jedes Ziel ist Pflicht, sonst
  Fehler im Rahmen.

## 6. Prüfliste (WE5, live gegen die Instanz)

1. Startseite erscheint in natürlicher Höhe, Design-Profil mit Schriften.
2. Beispielfrage antwortet; Belege-Blatt, Perspektive-Blatt und Detailansicht
   liegen über dem Fenster und schließen sauber.
3. Karten-Darstellung `cards=column` bzw. `inline` mit Platzhaltern beim Laden.
4. „mehr Inhalte“ öffnet die Galerie-Seite der Container-Anwendung mit
   demselben Filter bzw. derselben Rangliste.
5. Menüpunkt „Inhalte“ und Kachel `?view=gallery` öffnen dieselbe Seite.
6. „N frühere Fragen“ öffnet die Story-Seite der Container-Anwendung auf der
   jüngsten früheren Frage; die Chronik zeigt die Fragen von der Startseite.
7. Ziel ohne Adresse in der Container-Anwendung: Element fehlt, eine Meldung
   in der Konsole.
8. Unbekannte `page`: Fehler im Rahmen.
9. Keine Stile der Komponente außerhalb `.ks-embed`; Dunkel-Klasse wirkt.
10. Telefonbreite: Karten unter der Antwort, Blätter von unten bzw. voll.

## 7. Lehren aus M5 und D6b, die hier gelten

- `git mv` und Hülle unter dem alten Pfad im selben Commit: Git sieht keine
  Umbenennung mehr. Commit 1 nur Umzug, Commit 2 Hüllen und Importe.
- Das Docker-Image installiert nur Root-Abhängigkeiten: Was das Paket braucht,
  steht auch im Root-`package.json`; Wächter `docker-abhaengigkeiten.test.ts`.
- `dts` von tsup scheitert an Radix-Typen: Öffentliche Typen stehen in
  `typen.ts` ohne Monorepo-Import.
- Pakete ohne `sideEffects: false` ziehen ungenutzte Module ins Bündel.
- Tarball bei gleicher Version: `npm install @ks/embed@file:…`, sonst passt
  die Prüfsumme nicht.
- In der Partner-App vor `NEXT_PUBLIC_`-Schaltern den Build-Weg prüfen.
- Pre-Merge-Check nie neben einem laufenden `next dev` desselben Worktrees.
- Vor jedem Merge `pnpm build` lokal; `tsc` vollständig gegen den Stand
  davor vergleichen (`AGENTS.md`).

## 8. Kosten und Umfang

Jede Frage auf der eingebetteten Startseite kostet die Instanz einen
Modell-Aufruf, wie im Story-Embed. Umfang: WE0 klein, WE1 mittel und
mechanisch, WE2 groß (eine PR, vermutlich zwei Teile wegen der Diff-Grenze),
WE3 und WE4 mittel, WE5 klein. WE0 kann vor dem Gate laufen.
