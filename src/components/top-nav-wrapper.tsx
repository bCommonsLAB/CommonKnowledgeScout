'use client'

import dynamic from 'next/dynamic'

// TopNav dynamisch laden, um SSR-Probleme zu vermeiden
const TopNav = dynamic(() => import('./top-nav').then(mod => ({ default: mod.TopNav })), {
  ssr: false,
  loading: () => null
})

export function TopNavWrapper() {
  // Prüfen, ob Clerk verfügbar ist
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return null;
  }

  return <TopNav />;
} 