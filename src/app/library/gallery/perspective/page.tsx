import { redirect } from 'next/navigation'

/**
 * Frueher die Perspektiv-Seite der Galerie; seit 09.10.2026 ist die
 * Perspektiv-Wahl ein Dialog im Story-Modus (`StoryPerspektiveDialog`).
 * Alte Links fuehren in den Story-Modus, die Library bleibt erhalten.
 */
export default async function PerspectivePage({ searchParams }: { searchParams: Promise<{ libraryId?: string }> }) {
  const { libraryId } = await searchParams
  const ziel = new URLSearchParams()
  if (libraryId) ziel.set('libraryId', libraryId)
  ziel.set('mode', 'story')
  redirect(`/library/gallery?${ziel.toString()}`)
}
