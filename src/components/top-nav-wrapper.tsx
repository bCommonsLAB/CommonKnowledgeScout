'use client'

import dynamic from 'next/dynamic'

// TopNav dynamisch laden, um SSR-Probleme zu vermeiden
const TopNav = dynamic(() => import('./top-nav').then(mod => ({ default: mod.TopNav })), {
  ssr: false,
  loading: () => null
})

export function TopNavWrapper() {
  // Prüfen, ob Clerk verfügbar ist und ob wir nicht im Build-Modus sind
  const isDummyKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY === 'dummy_pk_test_placeholder';
  const hasValidClerk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !isDummyKey;
  
  if (!hasValidClerk) {
    return null;
  }

  return <TopNav />;
} 