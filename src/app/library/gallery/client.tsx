'use client'

import React from 'react'
import { GalleryRoot } from '@/components/library/gallery/gallery-root'

export default function GalleryClient(props: { libraryIdProp?: string } = {}) {
  const { libraryIdProp } = props
  return <GalleryRoot libraryIdProp={libraryIdProp} />
}

