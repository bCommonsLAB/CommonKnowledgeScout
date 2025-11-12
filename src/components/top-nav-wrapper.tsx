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

  // TopNav verwendet useSearchParams(), daher muss es in Suspense gewrappt werden
  // Fallback: Leerer Platzhalter mit korrekter Höhe um Layout-Shift zu vermeiden
  return (
    <Suspense fallback={<div className="h-16 border-b bg-background" />}>
      <TopNav />
    </Suspense>
  );
} 