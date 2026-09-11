# @ks/embed

Die Galerie einer **öffentlichen** KnowledgeScout-Library als React-Komponente
für fremde Anwendungen (M5, AECED). Sie liest anonym von der zentralen
Instanz — keine Anmeldung, kein Token.

## Einbau (Next.js App Router)

```bash
npm install ./ks-embed-0.1.0.tgz
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
| `view` | Bisher nur `"gallery"` |
| `locale` | `en`, `de`, `it`, `fr` oder `es` — gilt für Oberfläche und Inhalte |
| `height` | Höhe des Rahmens (Standard `80vh`); die Galerie scrollt darin |
| `className` | Zusätzliche Klassen für den Rahmen |

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

## English

A React component that shows the gallery of a **public** KnowledgeScout
library inside another application. It reads anonymously from the central
instance. Install the `.tgz`, import `@ks/embed/styles.css` once, and render
`<KnowledgeScoutExplorer baseUrl library view="gallery" locale />` as above.
All styles are scoped to `.ks-embed`.

## Bauen (im Monorepo)

```bash
pnpm --filter @ks/embed run pack:datei
```

Das erzeugt `packages/embed/ks-embed-0.1.0.tgz`: tsup baut `dist/index.js`
mit Typen, `scripts/build-css.mjs` baut `dist/styles.css` (Tailwind, Theme aus
`src/styles/globals.css`, jede Regel unter `.ks-embed`).
