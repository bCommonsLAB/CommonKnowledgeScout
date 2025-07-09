'use client';

import { getAuthComponents } from "@/lib/auth/client";
import { useState, useEffect } from "react";

// Dynamische Komponente für SignInButton
function DynamicSignInButton({ children }: { children: React.ReactNode }) {
  const [SignInButton, setSignInButton] = useState<React.ComponentType<{ children: React.ReactNode }> | null>(null);

  useEffect(() => {
    const loadComponent = async () => {
      try {
        const { SignInButton: ClerkSignInButton } = await getAuthComponents();
        setSignInButton(() => ClerkSignInButton);
      } catch (error) {
        console.error('Fehler beim Laden der Auth-Komponente:', error);
        // Fallback: Einfacher Button
        const FallbackButton = ({ children }: { children: React.ReactNode }) => (
          <button className="px-4 py-2 bg-blue-500 text-white rounded">
            {children}
          </button>
        );
        FallbackButton.displayName = 'FallbackButton';
        setSignInButton(() => FallbackButton);
      }
    };
    
    loadComponent();
  }, []);

  if (!SignInButton) {
    return <div>Laden...</div>;
  }

  return <SignInButton>{children}</SignInButton>;
}

// Display name hinzufügen
DynamicSignInButton.displayName = 'DynamicSignInButton';

export { DynamicSignInButton }; 