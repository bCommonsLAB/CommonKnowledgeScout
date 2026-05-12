import { atom } from 'jotai'

/**
 * True when the Secretary Jobs drawer is open. Used to hide the fixed TopNav
 * (z-50) so it does not cover the panel header (z-30).
 */
export const jobMonitorPanelOpenAtom = atom(false)
