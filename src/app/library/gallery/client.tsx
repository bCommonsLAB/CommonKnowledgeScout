'use client'

import React from 'react'
import { GalleryRoot, type GalleryRootProps } from '@/components/library/gallery/gallery-root'

export default function GalleryClient(props: GalleryRootProps = {}) {
  return <GalleryRoot {...props} />
}

