'use client';

import dynamic from 'next/dynamic';

const DebugFooter = dynamic(() => import('./debug-footer'), {
  ssr: false // Deaktiviere Server-Side Rendering für diese Komponente
});

export function DebugFooterClient() {
  return <DebugFooter />;
} 