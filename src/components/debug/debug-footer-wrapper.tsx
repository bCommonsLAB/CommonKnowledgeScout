'use client';

import dynamic from 'next/dynamic';

const DebugFooter = dynamic(
  () => import('./debug-footer'),
  { ssr: false }
);

export function DebugFooterWrapper() {
  return <DebugFooter />;
} 