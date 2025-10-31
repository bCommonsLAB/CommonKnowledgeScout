import GalleryClient from './client'

export default async function GalleryPage() {
  return (
    <div className="h-full overflow-hidden flex flex-col p-6">
      <div className="text-xl font-semibold mb-4 flex-shrink-0">Gallery</div>
      <div className="flex-1 min-h-0">
        <GalleryClient />
      </div>
    </div>
  )
}


