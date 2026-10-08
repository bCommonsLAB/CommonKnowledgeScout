import { redirect } from 'next/navigation'

/**
 * Frueher die Perspektiv-Seite der Explore-Ansicht; seit 09.10.2026 ist die
 * Perspektiv-Wahl ein Dialog im Story-Modus (`StoryPerspektiveDialog`).
 * Alte Links fuehren in den Story-Modus der Library.
 */
export default async function PerspectivePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  redirect(`/explore/${encodeURIComponent(slug)}?mode=story`)
}
