/**
 * @fileoverview Zugangsprüfung der Verwaltungsrouten „Fragen & Antworten" (Owner/Moderator).
 *
 * @description
 * Dieselbe Reihenfolge in beiden Routen: angemeldet (401) → Owner oder
 * aktiver Moderator der Library (403) → Library geladen (404). Die
 * Berechtigung kommt aus `isModeratorOrOwner` (library-members-repo), die
 * Library direkt über ihre Id — Moderatoren haben sie nicht in ihrer eigenen
 * Liste, und der Chat-Kontext (Antwortregeln) wird aus ihrer Konfiguration
 * normalisiert wie im Loader.
 *
 * @module chat
 */

import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { Library } from '@/types/library'
import { LibraryService } from '@/lib/services/library-service'
import { isModeratorOrOwner } from '@/lib/repositories/library-members-repo'
import { normalizeChatConfig, type NormalizedChatConfig } from '@/lib/chat/config'

export type VerwaltungsZugang =
  | { ok: true; userEmail: string; library: Library; chat: NormalizedChatConfig }
  | { ok: false; response: NextResponse }

export async function pruefeVerwaltungsZugang(libraryId: string): Promise<VerwaltungsZugang> {
  const { userId } = await auth()
  const user = await currentUser()
  const userEmail = user?.emailAddresses?.[0]?.emailAddress
  if (!userId || !userEmail) {
    return { ok: false, response: NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 }) }
  }
  if (!(await isModeratorOrOwner(libraryId, userEmail))) {
    return { ok: false, response: NextResponse.json({ error: 'Nur Owner oder Moderator dieser Bibliothek' }, { status: 403 }) }
  }
  const library = await LibraryService.getInstance().getLibraryById(libraryId)
  if (!library) {
    return { ok: false, response: NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 }) }
  }
  return { ok: true, userEmail, library, chat: normalizeChatConfig(library.config?.chat) }
}
