# @ks/embed

Die Galerie einer **öffentlichen** KnowledgeScout-Library als React-Komponente
für fremde Anwendungen (M5, AECED). Sie liest anonym von der zentralen
Instanz — keine Anmeldung, kein Token.

## Einbau (Next.js App Router)

```bash
npm install ./ks-embed-0.1.0.tgz
# Austausch bei gleicher Version: npm install @ks/embed@file:./ks-embed-0.1.0.tgz
# (sonst passt die Pruefsumme in package-lock.json nicht mehr)
```

```tsx
import '@ks/embed/styles.css'
import { KnowledgeScoutExplorer } from '@ks/embed'

export default function Galerie() {
  return (
    <KnowledgeScoutExplorer
      baseUrl="https://knowledgescout.org"
      library="aeced"
      view="gallery"
      locale="de"
      height="80vh"
    />
  )
}
```

| Prop | Bedeutung |
|---|---|
| `baseUrl` | Die Instanz, mit `https://` |
| `library` | Slug einer öffentlichen Library |
| `view` | `"gallery"` (Inhalte) oder `"story"` (Themenübersicht, Fragen, Belege; anonym über eine Sitzungskennung im Browser der Besucherin) |
| `locale` | `en`, `de`, `it`, `fr` oder `es` — gilt für Oberfläche und Inhalte |
| `enableStory` | Optional. Mit `view="gallery"`: startet in den Inhalten und bietet den Knopf „In Story Mode ansehen“ an. Bei `view="story"` immer an; `false` dort meldet einen Fehler. Standard: aus |
| `enablePerspective` | Optional, nur mit Story-Modus. Knopf „Perspektive anpassen“ im Story-Kopf: Interessen, Zugang und Sprachstil im Dialog; Sprache (`locale`) und Modell bleiben fest. Der Browser merkt sich die Wahl je Library. Ohne Story-Modus meldet die Komponente einen Fehler. Standard: aus |
| `start` | Optional. Womit die Komponente beginnt: `dokument` (Slug, Detailansicht offen) mit `seitenzahl`, `liste` (`nurMitStern`, `sortierung` `stars`/`rating`) — beides nur mit `view="gallery"`; `frage` (Kennung einer gespeicherten Frage) — nur mit `view="story"`. Passt der Einstieg nicht zur Ansicht, meldet die Komponente das im Rahmen. Ändert er sich, beginnt die Komponente neu |
| `height` | Höhe des Rahmens (Standard `80vh`); die Galerie scrollt darin |
| `className` | Zusätzliche Klassen für den Rahmen |

### Startseite: `KnowledgeScoutSite`

Die Startseite einer öffentlichen Library mit Website (`siteEnabled`): Kopf,
Sektionen, Kacheln, die Fragen-Sektion mit Antwort, Belegen und Detailansicht,
das Galerie-Band und die Fußzeile. Jeder Weg aus der Seite hinaus — Galerie,
Story-Modus, andere Website-Seite — ist ein Link der Container-Anwendung:
`hrefFor` sagt, welche ihrer Seiten das Ziel zeigt.

```tsx
import '@ks/embed/styles.css'
import { KnowledgeScoutSite, ksZielAlsParameter } from '@ks/embed'

export default function Fragen() {
  return (
    <KnowledgeScoutSite
      baseUrl="https://knowledgescout.org"
      library="aeced"
      locale="de"
      hrefFor={(ziel) => {
        const q = new URLSearchParams(ksZielAlsParameter(ziel)).toString()
        if (ziel.art === 'galerie' || ziel.art === 'dokument') return `/inhalte${q ? `?${q}` : ''}`
        if (ziel.art === 'story') return `/story${q ? `?${q}` : ''}`
        return null // weitere Website-Seiten gibt es in dieser Anwendung nicht
      }}
    />
  )
}
```

- `hrefFor(ziel)` (Pflicht) liefert die Adresse oder `null`. Bei `null`
  entfällt das Element (Menüpunkt, Kachel, Link), die Konsole sagt es einmal.
  Baut die Seite `hrefFor` je Render neu, lädt nichts neu — es gilt die
  jeweils letzte Fassung.
- `page` (optional): Slug oder fileId einer Website-Seite. Ohne Angabe die
  Startseite; eine unbekannte Kennung ist ein Fehler im Rahmen.
- `menu` (Standard an): schlanke Menüzeile mit den Website-Seiten, „Inhalte“
  und „Story“ — alle über `hrefFor`. `menu={false}` blendet sie aus.
- `height` (optional): ohne Angabe natürliche Höhe, die Container-Seite
  scrollt; mit Angabe ein fester Rahmen mit eigenem Scroll.
- Blätter, Dialoge und die Detailansicht liegen über dem **Fenster** (eigener
  Portal-Ort am `body`, ebenfalls unter `.ks-embed`), nicht nur über dem Rahmen.
- Banner-Karten und Belege öffnen die Detailansicht über der Seite (Buch,
  Testimonial, Blog); andere Typen führen über `hrefFor` (Ziel `dokument`) auf
  die Galerie-Seite.
- Links der Autoren auf relative Adressen außerhalb des Vokabulars
  (`/kontakt` in einem Text) entfallen — sie hätten in der fremden Seite keine
  Bedeutung. `?view=gallery`, `?mode=story`, `?site=…` und absolute Adressen
  gehen.
- Das Kontaktformular steht im Embed nicht zur Verfügung; die Sektion zeigt
  einen Hinweis.
- Die Schriften des Design-Profils liegen dem Paket bei (`dist/fonts`, OFL)
  und kommen mit `@ks/embed/styles.css`.
- Jede Frage kostet die Instanz einen Modell-Aufruf.

### Einstieg aus der Adresse der Container-Seite

Führt ein Link einer KnowledgeScout-Komponente auf eine Seite der
Container-Anwendung (z. B. „mehr Inhalte“ der Startseite), reisen die Details
als Adress-Parameter mit Vorsatz `ks-` (`ks-doc`, `ks-page`, `ks-starred`,
`ks-sort`, `ks-q`, `ks-site`). Die eigenen Parameter der Seite bleiben
unberührt. Die Seite reicht sie unverändert weiter:

```tsx
import { KnowledgeScoutExplorer, ksEinstiegAusParametern } from '@ks/embed'

export default async function Inhalte({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const start = ksEinstiegAusParametern(await searchParams)
  return <KnowledgeScoutExplorer baseUrl="https://knowledgescout.org" library="aeced" view="gallery" locale="de" start={start} />
}
```

- `ksZielAlsParameter(ziel)` macht aus einem Ziel (`galerie`, `dokument`,
  `story`, `seite`) diese Parameter — für die Adresse, die die
  Container-Anwendung baut. Ein ungültiges Ziel wirft.
- `ksEinstiegAusParametern(params)` liest sie zurück (`URLSearchParams` oder
  die `searchParams` einer Next-Seite). Ein ungültiger Wert (`ks-page=zwei`)
  wird in der Konsole gemeldet und nicht übernommen.
- `ksSeiteAusParametern(params)` liest die Website-Seite (`ks-site`).
- Mit `frage` stellt die Komponente die aktive Sitzung auf die der Frage um.
  Sie findet die Frage, wenn sie im selben Browser auf derselben
  Container-Anwendung gestellt wurde (anonyme Sitzungskennung).

- React 18 oder 19 bringt die Anwendung mit (geprüft mit Next 16, React 19
  und Turbopack). Die Komponente ist eine Client-Komponente (`"use client"`
  steht im Bündel); auf dem Server rendert sie nur den leeren Rahmen, die
  Galerie montiert und lädt im Browser.
- Alle Stile liegen unter `.ks-embed` und wirken nicht auf die übrige Seite.
  Dialoge, Menüs und die Detailansicht öffnen innerhalb dieses Rahmens.
- Dunkles Design: das Embed folgt der Klasse `dark` an einem Vorfahren
  (wie Tailwind `darkMode: 'class'`), nicht `prefers-color-scheme`. Schaltet
  die Seite ihr Design per Klasse um, geht das Embed mit; sonst bleibt es hell.
- Falsche Props (Basis-URL ohne `https://`, unbekannte Sprache) meldet die
  Komponente sichtbar im Rahmen und in der Konsole.
- Eine Library, die eine Anmeldung verlangt, wird nicht angezeigt.
- `view="story"`: Fragen laufen über die Instanz mit deren erstem öffentlich
  gelisteten Sprachmodell; die Perspektive (Interessenprofil, Sprachstil)
  kommt aus der Chat-Konfiguration der Library, die Sprache aus `locale`.
  Sitzungen und Fragen hängen an einer anonymen Sitzungskennung (30 Tage,
  localStorage) — keine Anmeldung, kein Token.
- Mitreden-Band (G5): Steht an der Library `publicPublishing.mitreden` mit
  Überschrift und Ziel, zeigt die Galerie im geführten Profil unter der Liste
  ein Band mit Link. Ein relatives Ziel (`/…`) läuft im Embed gegen den Host
  der einbettenden Seite — für das Embed also eine `https://`-Adresse setzen.

## English

A React component that shows the gallery of a **public** KnowledgeScout
library inside another application. It reads anonymously from the central
instance. Install the `.tgz`, import `@ks/embed/styles.css` once, and render
`<KnowledgeScoutExplorer baseUrl library view="gallery" locale />` as above;
`view="story"` adds the story mode (topic overview, questions with cited
sources) over an anonymous browser session. With `view="gallery"`, `enableStory`
starts in the gallery and offers the switch to the story mode.
`enablePerspective` lets visitors pick their own perspective (interests,
access, language style) in a dialog; language and model stay fixed.
`start` opens the component on a document, a list setting or a stored
question; `ksEinstiegAusParametern(searchParams)` reads it from the host page's
`ks-` parameters, `ksZielAlsParameter(ziel)` writes them.
All styles are scoped to `.ks-embed`.

## Bauen (im Monorepo)

```bash
pnpm --filter @ks/embed run pack:datei
```

Das erzeugt `packages/embed/ks-embed-0.1.0.tgz`: tsup baut `dist/index.js`
mit Typen, `scripts/build-css.mjs` baut `dist/styles.css` (Tailwind, Theme aus
`src/styles/globals.css`, jede Regel unter `.ks-embed`).
