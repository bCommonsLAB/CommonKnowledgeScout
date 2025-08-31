import GalleryClient from './client'

export default async function GalleryPage() {
  return (
    <div className="p-6">
      <div className="text-xl font-semibold mb-4">Gallery</div>
      <GalleryClient />
    </div>
  )
}


