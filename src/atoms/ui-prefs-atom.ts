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
  /** Breite (%) der Sitzungs-Liste im Reiter „Sitzungen" (Register, Welle R3; Figma 480 von 1200 px). */
  sitzungenListeSize: number
}

const VORGABEN: UiPanePrefs = {
  treeVisible: true,
  listCompact: false,
  werkbankListeSize: 30,
  werkbankBerichtZu: false,
  sitzungenListeSize: 40,
}

// Persistente UI-Einstellungen in localStorage
const uiPanePrefsBase = atomWithStorage<UiPanePrefs>('ui:pane-prefs', VORGABEN)

export const uiPanePrefsAtom = atom(
  // Ein aelterer Speicherstand kennt neuere Felder nicht: sie bekommen die Vorgabe.
  (get): UiPanePrefs => ({ ...VORGABEN, ...get(uiPanePrefsBase) }),
  (get, set, update: Partial<UiPanePrefs>) => {
    const prev = get(uiPanePrefsBase)
    set(uiPanePrefsBase, { ...prev, ...update })
  }
)
