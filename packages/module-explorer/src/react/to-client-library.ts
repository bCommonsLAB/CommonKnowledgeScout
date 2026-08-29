/**
 * Uebersetzt die oeffentliche Explorer-Antwort in den Library-Steckbrief der
 * Schale. Reine Funktion — damit ist der Zuschnitt pruefbar, ohne die
 * Wurzelkomponente zu rendern.
 */

import type { ClientLibrary } from '@ks/contracts'
import type { ExplorerContext, ExplorerLibraryPayload } from './types'

/**
 * `isPublic` haengt von der Sicht ab: Im `public`-Kontext ist die Library per
 * Definition oeffentlich; im `member`-Kontext gilt, was der Server meldet.
 */
export function toClientLibrary(
  payload: ExplorerLibraryPayload,
  context: ExplorerContext,
): ClientLibrary {
  return {
    id: payload.id,
    label: payload.label,
    type: 'local',
    path: '',
    isEnabled: true,
    config: {
      chat: payload.chat,
      publicPublishing: {
        slugName: payload.slugName,
        publicName: payload.label,
        description: payload.description || '',
        icon: payload.icon,
        isPublic: context === 'public' ? true : (payload.isPublic === true),
        requiresAuth: payload.requiresAuth,
        siteEnabled: payload.siteEnabled,
        logoUrl: payload.logoUrl,
        gallery: payload.gallery,
      },
    },
  }
}
