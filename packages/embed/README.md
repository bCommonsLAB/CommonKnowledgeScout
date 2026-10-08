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
- `view="story"`: Fragen laufen über die Instanz mit deren erstem öffentlich
  gelisteten Sprachmodell; die Perspektive (Interessenprofil, Sprachstil)
  kommt aus der Chat-Konfiguration der Library, die Sprache aus `locale`.
  Sitzungen und Fragen hängen an einer anonymen Sitzungskennung (30 Tage,
  localStorage) — keine Anmeldung, kein Token.

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
All styles are scoped to `.ks-embed`.

## Bauen (im Monorepo)

```bash
pnpm --filter @ks/embed run pack:datei
```

Das erzeugt `packages/embed/ks-embed-0.1.0.tgz`: tsup baut `dist/index.js`
mit Typen, `scripts/build-css.mjs` baut `dist/styles.css` (Tailwind, Theme aus
`src/styles/globals.css`, jede Regel unter `.ks-embed`).
