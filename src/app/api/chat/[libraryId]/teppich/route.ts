import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import type { Document } from 'mongodb'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { maybePublicationFilter } from '@/lib/chat/publication-filter'
import { getCollectionNameForLibrary, getCollectionOnly } from '@/lib/repositories/vector-repo'
import { getPreferredUserEmail } from '@/lib/auth/user-email'
import { TEPPICH_PROJEKTION, type TeppichMetaZeile } from '@/lib/graph/teppich-felder'
import { baueTeppichAntwort } from '@/lib/graph/teppich-antwort'
import { explorerGate } from '@ks/module-explorer'

/**
 * GET /api/chat/[libraryId]/teppich — alle Punkte des Teppichs der Dokumente in
 * EINEM Aufruf (Plan `teppich-der-dokumente`, T1): je Dokument Kennung, Lage,
 * Gewicht, Jahr und Kurztitel. Keine Seiten, kein Filter: Der Teppich zeigt immer
 * den ganzen Bestand.
 *
 * Anonym lesbar wie `docs` (Eintrag in `isChatApiPath`, `src/middleware.ts`), aber
 * nur fuer oeffentliche Libraries; Entwuerfe sieht nur, wer sie auch in der Galerie
 * sieht (`maybePublicationFilter`). Seiten der Website liegen nicht auf dem Teppich.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ libraryId: string }> }) {
  const gated = explorerGate(req)
  if (gated) return gated

  try {
    const { libraryId } = await params

    const { userId } = await auth()
    const userEmail = userId ? getPreferredUserEmail(await currentUser()) : ''

    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    if (!ctx.library.config?.publicPublishing?.isPublic && !userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const filter: Record<string, unknown> = { kind: 'meta', libraryId }
    const pubFilter = await maybePublicationFilter(libraryId, userEmail)
    if (pubFilter) Object.assign(filter, pubFilter)

    const col = await getCollectionOnly(getCollectionNameForLibrary(ctx.library))
    const zeilen = await col
      .find(filter as unknown as Document, { projection: TEPPICH_PROJEKTION })
      .toArray() as unknown as TeppichMetaZeile[]

    return NextResponse.json(baueTeppichAntwort(zeilen), {
      headers: { 'Cache-Control': 'private, max-age=60' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
