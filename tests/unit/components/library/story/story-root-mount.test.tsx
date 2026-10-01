// @vitest-environment jsdom

/**
 * `StoryRootMount` (D6c): montiert `StoryRoot` mit dem, was nur die App kennt —
 * Perspektive aus dem Story-Context, Konfig-Texte aus den Libraries,
 * Eingabegrenze aus der Chat-Konfig, Filter und Dokumentenzahl der Galerie,
 * Belege an das Atom der Galerie; Loeschen erlaubt; Fuesse mit App-Stuecken.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import type { ComponentProps } from 'react'
import { chatReferencesAtom, galleryFiltersAtom } from '@ks/module-explorer/react'
import type { StoryRoot } from '@ks/module-story/react'

type RootProps = ComponentProps<typeof StoryRoot>
const empfangen: { props?: RootProps } = {}

vi.mock('@clerk/nextjs', () => ({ useUser: () => ({ isSignedIn: true, isLoaded: true }) }))
vi.mock('@ks/i18n/react', () => ({ useTranslation: () => ({ t: (k: string) => k, locale: 'de' }) }))
vi.mock('@ks/shell/react', () => ({
  useLibraries: () => [{ id: 'lib', label: 'Lib', config: { publicPublishing: { publicName: 'Klimaplan', description: 'Besch', story: { topicsTitle: 'Themen' } } } }],
}))
vi.mock('@/hooks/use-story-context', () => ({
  useStoryContext: () => ({ targetLanguage: 'it', character: ['ecology'], accessPerspective: ['insight'], socialContext: 'youth', llmModel: 'm-1' }),
}))
vi.mock('@/hooks/use-library-config', () => ({
  useLibraryConfig: () => ({ cfg: { library: { id: 'lib', label: 'Lib' }, config: { placeholder: 'Frag', maxChars: 300, maxCharsWarningMessage: 'Zu lang' } }, loading: false, error: null }),
}))
vi.mock('@/components/library/chat/chat-config-display', () => ({ ChatConfigDisplay: ({ queryId }: { queryId?: string }) => <span data-testid="konfig">{queryId}</span> }))
vi.mock('@/components/library/chat/query-details-dialog', () => ({ QueryDetailsDialog: () => null }))
vi.mock('@/components/library/chat/processing-logs-dialog', () => ({ ProcessingLogsDialog: () => null }))
vi.mock('@/components/shared/ai-generated-notice', () => ({ AIGeneratedNotice: () => <span data-testid="ki" /> }))
vi.mock('@ks/module-explorer/react', async (original) => ({
  ...(await original<typeof import('@ks/module-explorer/react')>()),
  useGalleryData: () => ({ totalCount: 42, loading: false }),
}))
vi.mock('@ks/module-story/react', async (original) => ({
  ...(await original<typeof import('@ks/module-story/react')>()),
  StoryRoot: (props: RootProps) => {
    empfangen.props = props
    return (
      <div data-testid="root">
        {props.antwortFuss?.({ id: 'a', art: 'antwort', text: 'x', createdAt: '', queryId: 'q7', belege: [{ number: 1, fileId: 'f', description: 'd' }] })}
        {props.uebersichtFuss?.({ queryId: 'toc-1' })}
      </div>
    )
  },
}))

import { StoryRootMount } from '@/components/library/story/story-root-mount'

afterEach(cleanup)

describe('StoryRootMount', () => {
  it('reicht Perspektive, Kopf, Eingabegrenze, Filter und Dokumentenzahl an StoryRoot; Belege landen im Galerie-Atom', () => {
    localStorage.setItem('story-context-genderInclusive', 'false')
    const store = createStore()
    store.set(galleryFiltersAtom, { jahr: ['2024'] })
    render(
      <Provider store={store}>
        <StoryRootMount libraryId="lib" />
      </Provider>,
    )
    const p = empfangen.props!
    expect(p.perspektive).toEqual({ targetLanguage: 'it', character: ['ecology'], accessPerspective: ['insight'], socialContext: 'youth', genderInclusive: false, llmModel: 'm-1' })
    expect(p.kopf).toEqual({ titel: 'Klimaplan', beschreibung: 'Besch', themenTitel: 'Themen', themenIntro: undefined })
    expect(p.eingabe).toEqual({ placeholder: 'Frag', maxZeichen: 300, maxZeichenHinweis: 'Zu lang' })
    expect(p.filter).toEqual({ jahr: ['2024'] })
    expect(p.dokumente).toBe(42)
    expect(p.viewer).toEqual({ isSignedIn: true })
    expect(p.loeschenErlaubt).toBe(true)
    p.onBelege?.([{ number: 1, fileId: 'f', description: 'd' }], 'q7')
    expect(store.get(chatReferencesAtom)).toEqual({ references: [{ number: 1, fileId: 'f', description: 'd' }], queryId: 'q7' })
    // Fuesse: Konfig-Anzeige mit der Kennung der Antwort bzw. der Uebersicht, Protokoll/Debug fuer Angemeldete.
    expect(screen.getAllByTestId('konfig').map((el) => el.textContent)).toEqual(['q7', 'toc-1'])
    expect(screen.getAllByTestId('ki')).toHaveLength(2)
    expect(screen.getByRole('button', { name: /Debug/ })).toBeTruthy()
    localStorage.clear()
  })
})
