'use client'

import { Suspense } from 'react'
import { TopNav } from './top-nav'

/**
 * OPTIMIERUNG: TopNav direkt importieren statt Dynamic Import
 * 
 * Vorteile:
 * - Schnelleres initiales Rendering
 * - Keine zusätzliche Render-Verzögerung durch Dynamic Import
 * - TopNav ist klein genug für direktes Laden
 * 
 * TopNav verwendet useSearchParams(), daher muss es in Suspense gewrappt werden
 */
export function TopNavWrapper() {
  // Prüfen, ob Clerk verfügbar ist und ob wir nicht im Build-Modus sind
  const isDummyKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY === 'dummy_pk_test_placeholder';
  const hasValidClerk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !isDummyKey;
  
  if (!hasValidClerk) {
    return null;
  }

  // TopNav verwendet useSearchParams(), daher muss es in Suspense gewrappt werden.
  // Variante 1: Die TopNav ist `position: fixed` und nimmt KEINEN Platz im Flow ein.
  // Der Inhalts-Wrapper im AppLayout reserviert den 64px-Platz per `pt-16`.
  // Daher braucht der Fallback hier KEINE Höhe mehr — sonst entstünde doppelter Versatz.
  return (
    <Suspense fallback={null}>
      <TopNav />
    </Suspense>
  );
} 