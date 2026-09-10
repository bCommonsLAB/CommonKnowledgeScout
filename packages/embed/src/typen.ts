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

export interface KnowledgeScoutExplorerProps {
  /** Die Instanz, z. B. `https://knowledgescout.org`. */
  baseUrl: string
  /** Slug der oeffentlichen Library, z. B. `aeced`. */
  library: string
  /** Welche Ansicht. Das Embed kann bisher die Galerie. */
  view: 'gallery'
  /** Sprache der Oberflaeche und der Inhalte. */
  locale: KnowledgeScoutLocale
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
