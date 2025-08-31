'use client'

import { useEffect } from 'react'
import { useAtomValue } from 'jotai'
import { activeLibraryIdAtom } from '@/atoms/library-atom'
import { useRouter, useSearchParams } from 'next/navigation'

export default function EnsureLibrary({ paramKey = 'libraryId' }: { paramKey?: string }) {
  const activeLibraryId = useAtomValue(activeLibraryIdAtom)
  const router = useRouter()
  const sp = useSearchParams()

  useEffect(() => {
    const existing = sp?.get(paramKey)
    if (!existing && activeLibraryId) {
      const params = new URLSearchParams(sp?.toString() || '')
      params.set(paramKey, activeLibraryId)
      router.replace(`/library/gallery?${params.toString()}`)
    }
  }, [activeLibraryId, router, sp, paramKey])

  return null
}


