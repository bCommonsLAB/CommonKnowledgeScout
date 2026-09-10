// @vitest-environment jsdom

/**
 * Wohin Radix-Portale rendern (M5): ohne Anbieter wie bisher unter `<body>`,
 * mit Anbieter in den Rahmen des Embeds. Und jede Portal-Stelle in `@ks/ui`
 * nimmt den Rahmen — sonst oeffnete genau dieser Dialog im Embed ausserhalb
 * von `.ks-embed`, ohne Stile und ohne Farb-Variablen.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Dialog, DialogContent, DialogDescription, DialogTitle, PortalContainerProvider } from '@ks/ui'

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

function offenerDialog() {
  return (
    <Dialog open>
      <DialogContent>
        <DialogTitle>Titel</DialogTitle>
        <DialogDescription>Beschreibung</DialogDescription>
        Inhalt
      </DialogContent>
    </Dialog>
  )
}

describe('PortalContainerProvider', () => {
  it('ohne Anbieter rendert der Dialog wie bisher unter body — die Voll-App', () => {
    const { container } = render(offenerDialog())
    const inhalt = screen.getByText('Beschreibung')
    expect(container.contains(inhalt)).toBe(false)
    expect(document.body.contains(inhalt)).toBe(true)
  })

  it('mit Anbieter rendert der Dialog in den Rahmen — das Embed', () => {
    const rahmen = document.createElement('div')
    document.body.appendChild(rahmen)

    render(<PortalContainerProvider container={rahmen}>{offenerDialog()}</PortalContainerProvider>)

    expect(rahmen.contains(screen.getByText('Beschreibung'))).toBe(true)
  })
})

describe('Portal-Stellen in @ks/ui', () => {
  it('jede nimmt den Rahmen des Anbieters', () => {
    const verzeichnis = join(process.cwd(), 'packages/ui/src')
    const ohne: string[] = []
    for (const datei of readdirSync(verzeichnis).filter((d) => d.endsWith('.tsx'))) {
      const inhalt = readFileSync(join(verzeichnis, datei), 'utf-8')
      for (const treffer of inhalt.matchAll(/<(\w+Portal|\w+Primitive\.Portal)\b([^>]*)>/g)) {
        if (!/container=/.test(treffer[2])) ohne.push(`${datei}: ${treffer[0]}`)
      }
    }
    expect(
      ohne,
      `Portal ohne container — im Embed oeffnete es ausserhalb von .ks-embed:\n${ohne.join('\n')}`,
    ).toEqual([])
  })
})
