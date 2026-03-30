import { Suspense } from 'react'
import GalleryPageClient from './page-client'

export default async function GalleryPage() {
  return (
    <div className="h-full overflow-hidden flex flex-col px-6 lg:px-4 pb-6 pt-0">
      <div className="flex-1 min-h-0">
        <Suspense fallback={<div className="flex items-center justify-center h-full">Lade Gallery...</div>}>
          <GalleryPageClient />
        </Suspense>
      </div>
    </div>
  )
}


