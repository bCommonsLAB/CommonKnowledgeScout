'use client'

import React from 'react'
import { GalleryRoot } from '@/components/library/gallery/gallery-root'

export default function GalleryClient(props: { libraryIdProp?: string; hideTabs?: boolean } = {}) {
  const { libraryIdProp, hideTabs } = props
  return <GalleryRoot libraryIdProp={libraryIdProp} hideTabs={hideTabs} />
}

