import { LibraryHeader } from "@/components/library-header"
import { KnowledgeGallery } from "@/components/knowledge-gallery"

export default function LibraryPage({ params }: { params: { slug: string } }) {
  return (
    <div className="min-h-screen bg-background">
      <LibraryHeader slug={params.slug} />
      <KnowledgeGallery slug={params.slug} />
    </div>
  )
}
