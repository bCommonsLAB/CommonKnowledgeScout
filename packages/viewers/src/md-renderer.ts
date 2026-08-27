/**
 * markdown-preview/md-renderer.ts
 *
 * Remarkable-Markdown-Renderer-Setup mit Tailwind-Klassen + highlight.js.
 *
 * Aus `markdown-preview.tsx` ausgegliedert (Welle 3-II-b, Schritt 3/8).
 *
 * Exportiert eine **Singleton-Instanz** `md`, die in der MarkdownPreview-
 * Komponente fuer das Rendern verwendet wird. Der Setup ist 1:1 portiert
 * (selbe Renderer-Rules, selber Custom-HR-Block-Parser).
 *
 * Hinweis: Modul-State (Singleton) ist hier OK, weil:
 * - Der Setup ist deterministisch (keine externen Inputs)
 * - Wiederholtes Setzen waere Verschwendung (200+ Zeilen Setup)
 * - Tests rendern entweder gegen denselben Setup oder mocken `md` ganz
 */

import { Remarkable } from 'remarkable'
import { linkify } from 'remarkable/linkify'
import hljs from 'highlight.js'
import 'highlight.js/styles/vs2015.css'
import 'highlight.js/styles/github-dark.css'

// Initialize Remarkable with options
export const md = new Remarkable({
  html: true,        // Enable HTML tags in source
  xhtmlOut: true,    // Use '/' to close single tags (<br />)
  breaks: true,      // Convert '\n' in paragraphs into <br>
  typographer: true, // Enable smartypants and other sweet transforms
  highlight: function (str: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value
      } catch {
        // hljs.highlight kann bei seltenen Token-Patterns werfen.
        // Bewusster Fallback auf highlightAuto unten — Anwender sieht trotzdem
        // Code, nur ohne Sprach-Hervorhebung. Render-Pfad darf nicht crashen
        // (.cursor/rules/no-silent-fallbacks.mdc — dokumentierter Fallback).
      }
    }
    try {
      return hljs.highlightAuto(str).value
    } catch {
      // highlightAuto kann ebenfalls werfen. Fallback: ungehighlighteter
      // leerer String (Markdown-Renderer faellt auf den Original-Code zurueck).
    }
    return ''
  },
}).use(linkify) // Linkify als Plugin hinzufuegen

// Configure horizontal line detection
md.block.ruler.disable(['hr'])
md.block.ruler.at('hr', function (state, startLine, endLine, silent) {
  const pos = state.bMarks[startLine] + state.tShift[startLine]
  const max = state.eMarks[startLine]
  const marker = state.src.charCodeAt(pos)

  if (marker !== 0x2A /* * */ && marker !== 0x2D /* - */ && marker !== 0x5F /* _ */) {
    return false
  }

  let count = 1
  let ch = marker
  let pos2 = pos + 1

  while (pos2 < max) {
    ch = state.src.charCodeAt(pos2)
    if (ch !== marker) { break }
    count++
    pos2++
  }

  if (count < 3) { return false }

  if (silent) { return true }

  state.line = startLine + 1
  interface PushableState { push: (type: string, tag: string, nesting: number) => unknown }
  const token = (state as unknown as PushableState).push('hr', 'hr', 0) as Record<string, unknown>
  token.map = [startLine, state.line]
  token.markup = Array(count + 1).join(String.fromCharCode(marker))

  return true
}, {})

md.inline.ruler.enable(['emphasis'])

// Customize renderer rules for better formatting
md.renderer.rules.heading_open = function(tokens, idx) {
  const token = tokens[idx]
  const level = token.hLevel
  const classes = {
    1: 'text-4xl font-bold mt-8 mb-4',
    2: 'text-3xl font-semibold mt-6 mb-3',
    3: 'text-2xl font-semibold mt-4 mb-2',
    4: 'text-xl font-medium mt-4 mb-2',
    5: 'text-lg font-medium mt-3 mb-2',
    6: 'text-base font-medium mt-3 mb-2',
  }[level as 1|2|3|4|5|6] || ''

  return `<h${level} class="${classes}">`
}

// Code blocks with syntax highlighting
md.renderer.rules.fence = function (tokens, idx) {
  const token = tokens[idx]
  const lang = token.params || ''
  const content = token.content || ''

  let code = content
  if (lang && hljs.getLanguage(lang)) {
    try {
      code = hljs.highlight(content, { language: lang }).value
    } catch {
      // hljs.highlight kann bei seltenen Token-Patterns werfen.
      // Fallback: unbearbeiteter Code (siehe Block oben fuer Begruendung).
    }
  }

  return `
    <div class="relative">
      <div class="absolute right-2 top-2 text-xs text-muted-foreground">${lang}</div>
      <pre class="hljs bg-muted p-4 rounded-lg overflow-x-auto">
        <code class="language-${lang}">${code}</code>
      </pre>
    </div>`
}

// Inline code
md.renderer.rules.code = function (tokens, idx) {
  const token = tokens[idx]
  return `<code class="bg-muted px-1.5 py-0.5 rounded-sm text-sm">${token.content || ''}</code>`
}

// Blockquotes
md.renderer.rules.blockquote_open = function() {
  return '<blockquote class="border-l-4 border-muted-foreground/20 pl-4 italic my-4">'
}

// Lists
md.renderer.rules.list_item_open = function() {
  return '<li class="ml-6 pl-2">'
}

md.renderer.rules.bullet_list_open = function() {
  return '<ul class="list-disc list-outside space-y-1 my-4">'
}

// Horizontal lines
md.renderer.rules.hr = function() {
  return '<div class="w-full px-0 my-8"><hr class="w-full border-0 border-b-[3px] border-muted-foreground/40" /></div>'
}

// Paragraphs and line breaks
md.renderer.rules.paragraph_open = function() {
  return '<p class="mb-4 whitespace-pre-wrap">'
}

md.renderer.rules.softbreak = function() {
  return '\n'
}

md.renderer.rules.hardbreak = function() {
  return '<br />'
}

md.renderer.rules.ordered_list_open = function() {
  return '<ol class="list-decimal list-outside space-y-1 my-4">'
}

// Nested lists
md.renderer.rules.bullet_list_close = function() {
  return '</ul>'
}

md.renderer.rules.ordered_list_close = function() {
  return '</ol>'
}

// Links
md.renderer.rules.link_open = function (tokens, idx) {
  const href = tokens[idx].href || ''
  if (href && href.startsWith('http')) {
    return `<a href="${href}" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">`
  }
  return `<a href="${href}" class="text-primary hover:underline">`
}

// Tables
md.renderer.rules.table_open = function() {
  return '<div class="overflow-x-auto my-4"><table class="min-w-full divide-y divide-muted-foreground/20 border-collapse">'
}

md.renderer.rules.table_close = function() {
  return '</table></div>'
}

md.renderer.rules.thead_open = function() {
  return '<thead class="bg-muted">'
}

md.renderer.rules.tbody_open = function() {
  return '<tbody class="divide-y divide-muted-foreground/10">'
}

md.renderer.rules.tr_open = function() {
  return '<tr class="border-b border-muted-foreground/10">'
}

md.renderer.rules.th_open = function() {
  return '<th class="px-4 py-3 text-left text-sm font-semibold align-top w-1/2">'
}

md.renderer.rules.th_close = function() {
  return '</th>'
}

md.renderer.rules.td_open = function() {
  return '<td class="px-4 py-3 text-sm align-top w-1/2 prose prose-sm max-w-none [&_p]:my-1 [&_strong]:font-bold [&_em]:italic [&_a]:text-primary [&_a]:underline [&_h3]:!text-lg [&_h3]:!font-semibold [&_h3]:!mt-4 [&_h3]:!mb-2 [&_h3]:first:!mt-0 [&_hr]:!border-t [&_hr]:!border-muted-foreground/20 [&_hr]:!my-3 [&_hr]:!block">'
}

md.renderer.rules.td_close = function() {
  return '</td>'
}

// Emphasis
md.renderer.rules.em_open = function() {
  return '<em class="italic">'
}

md.renderer.rules.strong_open = function() {
  return '<strong class="font-bold">'
}
