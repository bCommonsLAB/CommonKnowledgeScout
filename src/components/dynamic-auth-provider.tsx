"use client";

import React, { useState, useEffect, ReactNode } from 'react';
import { getAuthConfig } from '@/lib/auth/types';

interface DynamicAuthProviderProps {
  children: ReactNode;
}

export function DynamicAuthProvider({ children }: DynamicAuthProviderProps) {
  const [Provider, setProvider] = useState<React.ComponentType<{ children: ReactNode }> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadProvider = async () => {
      const config = getAuthConfig();
      
      if (config.mode === 'offline') {
        // Offline-Modus: Verwende Mock-Provider
        const { MockClerkProvider } = await import('@/lib/auth/mock-client');
        setProvider(() => MockClerkProvider);
      } else {
        // Clerk-Modus: Versuche Clerk zu laden
        try {
          const { ClerkProvider } = await import('@clerk/nextjs');
          setProvider(() => ClerkProvider);
        } catch (error) {
          console.warn('Clerk nicht verfügbar, verwende Offline-Modus:', error);
          const { MockClerkProvider } = await import('@/lib/auth/mock-client');
          setProvider(() => MockClerkProvider);
        }
      }
      
      setIsLoading(false);
    };
    
    loadProvider();
  }, []);

  if (isLoading) {
    return <div>Laden...</div>;
  }

  if (!Provider) {
    return <>{children}</>;
  }

  return <Provider>{children}</Provider>;
} 