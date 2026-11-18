/**
 * Die oeffentliche Oberflaeche von `@ks/embed` — nur Typen, ohne Abhaengigkeit
 * zu den Paketen des Monorepos.
 *
 * Aus dieser Datei entsteht `dist/index.d.ts` (tsup `dts.entry`): Die fremde
 * Anwendung kennt `@ks/i18n` und die anderen Pakete nicht, und deren Typen
 * lassen sich auch nicht portabel in eine Datei giessen (Radix-Typen in
 * `@ks/ui`, TS2742). Die Umsetzung in `knowledge-scout-explorer.tsx` ist im
 * Typecheck gegen diese Datei geprueft.
 */

import type { ReactElement } from 'react'

/** Die Sprachen des Embeds — dieselben wie in `@ks/i18n` (im Typecheck geprueft). */
export type KnowledgeScoutLocale = 'en' | 'de' | 'it' | 'fr' | 'es'

/**
 * Listen-Einstellungen der Galerie, die ein Link mitnimmt — nur, was auch
 * anonym wirkt (Plan `startseite-als-embed`, WE0).
 */
export interface KsGalerieListe {
  /** Nur Eintraege mit Stern („Im Fokus"); wirkt, wenn die Library die Sterne-Zahl oeffentlich zeigt. */
  nurMitStern?: boolean
  /** Reihenfolge: `stars` (die meisten Sterne zuerst) oder `rating` (Prioritaetsindex). */
  sortierung?: 'stars' | 'rating'
}

/**
 * Ein Weg aus einer KnowledgeScout-Komponente hinaus. Wohin er in der
 * Container-Anwendung fuehrt, entscheidet die Container-Anwendung; die Details
 * reisen als Adress-Parameter (`ksZielAlsParameter`).
 */
export type KsZiel =
  | { art: 'galerie'; liste?: KsGalerieListe }
  | { art: 'dokument'; slug: string; seitenzahl?: number; liste?: KsGalerieListe }
  | { art: 'story'; frage?: string }
  | { art: 'seite'; seite: string }

/**
 * Womit `KnowledgeScoutExplorer` startet. Gilt beim Montieren; aendert er sich
 * (andere Adresse der Container-Seite), beginnt die Komponente neu.
 */
export interface KsEinstieg {
  /** Slug des Dokuments, dessen Detailansicht beim Start offen ist — nur mit `view="gallery"`. */
  dokument?: string
  /** Seite im Dokument (ab 1) — nur zusammen mit `dokument`. */
  seitenzahl?: number
  /** Kennung einer gespeicherten Frage (queryId), die der Story-Modus zeigt — nur mit `view="story"`. */
  frage?: string
  /** Listen-Einstellungen der Galerie — nur mit `view="gallery"`. */
  liste?: KsGalerieListe
}

/** Adress-Parameter, wie Next sie einer Seite reicht, oder ein `URLSearchParams`. */
export type KsAdressParameter = URLSearchParams | Record<string, string | string[] | undefined>

export interface KnowledgeScoutExplorerProps {
  /** Die Instanz, z. B. `https://knowledgescout.org`. */
  baseUrl: string
  /** Slug der oeffentlichen Library, z. B. `aeced`. */
  library: string
  /**
   * Welche Ansicht: `gallery` (Inhalte) oder `story` (D6b: Themenuebersicht,
   * Fragen und Belege, anonym ueber die Sitzungskennung des Browsers).
   */
  view: 'gallery' | 'story'
  /**
   * Story-Modus aus der Galerie heraus anbieten: Mit `view="gallery"` startet
   * das Embed in den Inhalten und zeigt den Knopf „In Story Mode ansehen".
   * Bei `view="story"` ist er immer an (`false` dort ist ein Fehler).
   * Standard: aus. Jede Frage kostet die Instanz einen Modell-Aufruf.
   */
  enableStory?: boolean
  /**
   * Eigene Perspektive im Story-Modus: Knopf „Perspektive anpassen" mit Dialog
   * (Interessen, Zugang, Sprachstil). Sprache (`locale`) und Modell bleiben
   * fest. Die Wahl merkt sich der Browser je Library. Braucht den Story-Modus
   * (`view="story"` oder `enableStory`), sonst ein Fehler. Standard: aus —
   * jede neue Perspektive laesst die Instanz die Themenuebersicht neu rechnen.
   */
  enablePerspective?: boolean
  /** Sprache der Oberflaeche und der Inhalte. */
  locale: KnowledgeScoutLocale
  /**
   * Womit die Komponente startet: ein offenes Dokument, eine Frage im
   * Story-Modus, Listen-Einstellungen. Aus der Adresse der Container-Seite
   * liest `ksEinstiegAusParametern` ihn. Passt er nicht zur Ansicht, meldet
   * die Komponente das im Rahmen.
   */
  start?: KsEinstieg
  /** Hoehe des Rahmens als CSS-Wert; die Galerie scrollt darin. Standard: `80vh`. */
  height?: string
  /** Zusaetzliche Klassen fuer den Rahmen. */
  className?: string
}

/**
 * Die Galerie einer oeffentlichen KnowledgeScout-Library in einer fremden
 * Seite. Stile einmal laden: `import '@ks/embed/styles.css'`.
 */
export declare function KnowledgeScoutExplorer(props: KnowledgeScoutExplorerProps): ReactElement

/**
 * Die Details eines Ziels als Adress-Parameter der Container-Anwendung, alle
 * mit Vorsatz `ks-` (die eigenen Parameter der Container-Seite bleiben
 * unberuehrt). Ein ungueltiges Ziel wirft.
 */
export declare function ksZielAlsParameter(ziel: KsZiel): Record<string, string>

/**
 * Der Einstieg fuer `KnowledgeScoutExplorer` aus den Adress-Parametern der
 * Container-Seite. Liest nur `ks-`-Parameter; ein ungueltiger Wert wird in der
 * Konsole gemeldet und nicht uebernommen.
 */
export declare function ksEinstiegAusParametern(params: KsAdressParameter): KsEinstieg

/** Die Kennung der Website-Seite aus den Adress-Parametern (`ks-site`), sonst `undefined`. */
export declare function ksSeiteAusParametern(params: KsAdressParameter): string | undefined

/**
 * Props der Startseite einer oeffentlichen Library (Plan `startseite-als-embed`,
 * WE4). Jeder Weg aus der Seite hinaus — Galerie, Story-Modus, andere
 * Website-Seite, ein Dokument ohne eingebettete Detailansicht — ist ein Link der
 * Container-Anwendung: Welche ihrer Seiten das Ziel zeigt, entscheidet `hrefFor`.
 */
export interface KnowledgeScoutSiteProps {
  /** Die Instanz, z. B. `https://knowledgescout.org`. */
  baseUrl: string
  /** Slug der oeffentlichen Library mit Website, z. B. `aeced`. */
  library: string
  /**
   * Kennung der Website-Seite (Slug oder fileId, wie `?site=` der Instanz).
   * Ohne Angabe die Startseite (Main-Menue-Seite mit kleinstem `menu_order`).
   * Passt sie zu keiner Seite: Fehler im Rahmen, kein Rueckfall.
   */
  page?: string
  /** Sprache der Oberflaeche und der Inhalte. */
  locale: KnowledgeScoutLocale
  /**
   * Die Adresse eines Ziels in der Container-Anwendung, gerendert als
   * gewoehnlicher Link `<a href>`. `null` = die Container-Anwendung hat dafuer
   * keine Seite: Das Element entfaellt, die Konsole sagt es einmal.
   * `ksZielAlsParameter` liefert die Details als `ks-`-Parameter.
   */
  hrefFor: (ziel: KsZiel) => string | null
  /**
   * Schlanke Menuezeile oben: die Website-Seiten nach `menu_order`, „Inhalte"
   * und „Story", alle ueber `hrefFor`. Standard: an; `false` blendet sie aus.
   */
  menu?: boolean
  /**
   * Ohne Angabe natuerliche Hoehe — die Container-Seite scrollt. Mit Angabe
   * (CSS-Wert) ein fester Rahmen mit eigenem Scroll. Blaetter und
   * Detailansicht liegen in beiden Faellen ueber dem Fenster.
   */
  height?: string
  /** Zusaetzliche Klassen fuer den Rahmen. */
  className?: string
}

/**
 * Die Startseite einer oeffentlichen KnowledgeScout-Library mit Fragen-Sektion
 * und Galerie-Band in einer fremden Seite. Stile einmal laden:
 * `import '@ks/embed/styles.css'` (bringt die Schriften des Design-Profils mit).
 * Jede Frage kostet die Instanz einen Modell-Aufruf.
 */
export declare function KnowledgeScoutSite(props: KnowledgeScoutSiteProps): ReactElement
