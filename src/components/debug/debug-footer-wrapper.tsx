'use client';

import dynamic from 'next/dynamic';
import { useUser } from '@clerk/nextjs';

const DebugFooter = dynamic(
  () => import('./debug-footer'),
  { ssr: false }
);

/**
 * Debug-Footer-Wrapper, der das Debug-Panel nur für angemeldete Benutzer anzeigt
 * Im anonymen Modus wird das Panel komplett ausgeblendet
 */
export function DebugFooterWrapper() {
  const { isSignedIn, isLoaded } = useUser();
  
  // Warte auf Auth-Status, bevor wir entscheiden
  if (!isLoaded) {
    return null;
  }
  
  // Debug-Panel nur für angemeldete Benutzer anzeigen
  if (!isSignedIn) {
    return null;
  }
  
  return <DebugFooter />;
} 