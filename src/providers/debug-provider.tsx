'use client';

import { PropsWithChildren, useEffect } from 'react';

export function DebugProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Dynamically import WDYR config
      import('@/lib/debug/wdyr');
    }
  }, []);

  return children;
} 