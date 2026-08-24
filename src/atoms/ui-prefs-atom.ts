import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

export interface UiPanePrefs {
  treeVisible: boolean
  listCompact: boolean
  /** Breite (%) der Vorhaben-Liste in der Werkbank (F6, Welle W3). */
  werkbankListeSize: number
  /** Bericht im Werkbank-Detail zugeklappt? Der Bericht ist der laengste
      Block; wer abnimmt, will die offenen Punkte sehen, nicht ihn. */
  werkbankBerichtZu: boolean
}

// Persistente UI-Einstellungen in localStorage
const uiPanePrefsBase = atomWithStorage<UiPanePrefs>('ui:pane-prefs', {
  treeVisible: true,
  listCompact: false,
  werkbankListeSize: 30,
  werkbankBerichtZu: false,
})

export const uiPanePrefsAtom = atom(
  (get) => get(uiPanePrefsBase),
  (get, set, update: Partial<UiPanePrefs>) => {
    const prev = get(uiPanePrefsBase)
    set(uiPanePrefsBase, { ...prev, ...update })
  }
)







