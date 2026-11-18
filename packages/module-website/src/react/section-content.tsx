/**
 * Inhalt einer Sektion als Blockfolge (Welle S3): Markdown-Text, Kennzahl-
 * Kacheln (`<!-- stats -->`), Chips (`<!-- chips -->`), Kasten
 * (`<!-- box -->`) und Link-Karten (`<!-- cards -->`, Welle N2), siehe `parse-section-blocks.ts`. Farben kommen aus den
 * `--site-*`-Variablen der Flaeche; `--site-tile` ist der durchscheinende
 * Kachel-Hintergrund (hell auf dunkel, dunkel auf hell).
 */

import * as React from 'react'
import { cn } from '@ks/util'
import {
  type HeadingCase,
  type WebsiteSection,
  type SectionContentBlock,
  OLDIES_THEME,
  type SiteThemeResolved,
  HEADING_FONT,
  KICKER_CLASS,
  type WebsiteNavigation,
} from '..'
import { MarkdownHtml, renderMarkdownText } from './markdown-text'
import { Cards } from './section-cards'

const TILE = 'rounded-xl bg-[color:var(--site-tile)] p-4'

function Stats({ items }: { items: Array<{ value: string; label: string }> }): React.ReactElement {
  return (
    <div className="not-prose my-6 grid grid-cols-2 gap-3 md:grid-cols-3">
      {items.map((s, i) => (
        <div key={i} className={TILE}>
          <div className={cn('text-3xl leading-tight text-[color:var(--site-heading)] md:text-4xl', HEADING_FONT)}>{s.value}</div>
          <div className="mt-1 text-xs font-medium opacity-80">{s.label}</div>
        </div>
      ))}
    </div>
  )
}

function Chips({ label, items }: { label?: string; items: string[] }): React.ReactElement {
  return (
    <div className="not-prose my-6">
      {label && <p className={KICKER_CLASS}>{label}</p>}
      <ul className="flex flex-wrap gap-2">
        {items.map((c, i) => (
          <li key={i} className="rounded-md bg-[color:var(--site-tile)] px-3 py-1.5 text-sm font-medium">{c}</li>
        ))}
      </ul>
    </div>
  )
}

function Fragenliste({ items }: { items: string[] }): React.ReactElement {
  return (
    <ul className="not-prose my-4 list-disc space-y-1 pl-5 text-sm">
      {items.map((f, i) => <li key={i}>{f}</li>)}
    </ul>
  )
}

function Box({ label, kind, markdown, bg, theme, navigation }: {
  label?: string; kind: 'card' | 'note'; markdown: string; bg: WebsiteSection['bg']; theme: SiteThemeResolved
  navigation?: WebsiteNavigation
}): React.ReactElement {
  if (kind === 'note') {
    return (
      <div className="not-prose my-6 rounded-lg border border-current/10 bg-[color:var(--site-tile)] px-4 py-3 text-sm">
        {label && <span className="mr-2 rounded-full bg-[color:var(--site-tile)] px-2 py-0.5 text-xs font-semibold uppercase tracking-wider">{label}</span>}
        <MarkdownHtml markdown={markdown} navigation={navigation} className="inline [&_p]:inline" />
      </div>
    )
  }
  // `card`: weisse Karte mit Schatten — eigene, dunkle Typografie unabhaengig von der Flaeche.
  void bg; void theme
  return (
    <div className="not-prose my-6 rounded-xl bg-white p-5 text-neutral-900 shadow-sm">
      {label && <span className="mb-2 inline-block rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-neutral-700">{label}</span>}
      <MarkdownHtml markdown={markdown} navigation={navigation} className="prose prose-sm prose-neutral max-w-none" />
    </div>
  )
}

export function SectionContent({ blocks, bg, headingCase = 'capitalize', theme = OLDIES_THEME, navigation }: {
  blocks: SectionContentBlock[]
  bg: WebsiteSection['bg']
  headingCase?: HeadingCase
  theme?: SiteThemeResolved
  /** N2/WE2: wohin Kachel- und Markdown-Links fuehren; ohne Prop sind sie reine Links. */
  navigation?: WebsiteNavigation
}): React.ReactElement {
  return (
    <>
      {blocks.map((b, i) => {
        if (b.type === 'markdown') return <React.Fragment key={i}>{renderMarkdownText(b.markdown, bg, headingCase, theme, navigation)}</React.Fragment>
        if (b.type === 'stats') return <Stats key={i} items={b.items} />
        if (b.type === 'cards') return <Cards key={i} items={b.items} navigation={navigation} />
        if (b.type === 'chips') return <Chips key={i} label={b.label} items={b.items} />
        // N1: `questions` nimmt der Story-Rahmen heraus (storyBloecke); landet er doch hier, als Liste — sichtbar, nicht verschluckt.
        if (b.type === 'questions') return <Fragenliste key={i} items={b.items} />
        // popular rendert der Story-Rahmen als Chips; ausserhalb (Vorschau) nur ein Hinweis.
        if (b.type === 'popular') return <p key={i} className="text-sm text-neutral-500" data-popular-vorschau={b.n}>Populäre Fragen ({b.n}) – nur auf der Live-Seite</p>
        return <Box key={i} label={b.label} kind={b.kind} markdown={b.markdown} bg={bg} theme={theme} navigation={navigation} />
      })}
    </>
  )
}
