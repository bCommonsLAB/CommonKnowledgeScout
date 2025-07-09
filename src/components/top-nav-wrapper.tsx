'use client'

import dynamic from 'next/dynamic'

// TopNav dynamisch laden, um SSR-Probleme zu vermeiden
const TopNav = dynamic(() => import('./top-nav').then(mod => ({ default: mod.TopNav })), {
  ssr: false,
  loading: () => null
})

export function TopNavWrapper() {
  // Die neue Auth-Abstraktionsschicht handhabt sowohl Clerk als auch Offline-Modus
  // Daher können wir die TopNav immer rendern
  return <TopNav />;
} 