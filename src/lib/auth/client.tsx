"use client";

/**
 * Client-Auth-Abstraktionsschicht
 * Bietet einheitliche Auth-Funktionen für React-Komponenten
 */

import { useState, useEffect, useContext, createContext, ReactNode } from 'react';
import { AuthUser, AuthContextValue, getAuthConfig } from './types';

// Auth-Context für die gesamte App
const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Auth-Provider für die gesamte App
 * Abstrahiert sowohl Clerk als auch Offline-Modus
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [authValue, setAuthValue] = useState<AuthContextValue>({
    isLoaded: false,
    isSignedIn: false,
    userId: null,
    user: null,
    signIn: async () => {},
    signOut: async () => {},
    getToken: async () => null
  });

  useEffect(() => {
    const initAuth = async () => {
      const config = getAuthConfig();
      
      if (config.mode === 'offline') {
        // Offline-Modus: Sofort bereit mit Mock-User
        const mockUser: AuthUser = {
          id: 'offline-user',
          email: config.offlineUser?.email || 'offline@example.com',
          firstName: config.offlineUser?.firstName || 'Offline',
          lastName: config.offlineUser?.lastName || 'User',
          fullName: `${config.offlineUser?.firstName || 'Offline'} ${config.offlineUser?.lastName || 'User'}`,
          imageUrl: undefined
        };
        
        setAuthValue({
          isLoaded: true,
          isSignedIn: true,
          userId: 'offline-user',
          user: mockUser,
          signIn: async () => {},
          signOut: async () => {},
          getToken: async () => 'mock-token'
        });
      } else {
        // Clerk-Modus: Dynamisch laden
        try {
          await loadAuthHooks();
          
          // Hier könnten wir einen Hook-Wrapper erstellen
          // Für jetzt setzen wir einen Platzhalter
          setAuthValue({
            isLoaded: true,
            isSignedIn: false,
            userId: null,
            user: null,
            signIn: async () => {},
            signOut: async () => {},
            getToken: async () => null
          });
        } catch (error) {
          console.error('Fehler beim Laden der Auth-Hooks:', error);
          
          // Fallback zu Offline-Modus
          const mockUser: AuthUser = {
            id: 'offline-user',
            email: 'offline@example.com',
            firstName: 'Offline',
            lastName: 'User',
            fullName: 'Offline User',
            imageUrl: undefined
          };
          
          setAuthValue({
            isLoaded: true,
            isSignedIn: true,
            userId: 'offline-user',
            user: mockUser,
            signIn: async () => {},
            signOut: async () => {},
            getToken: async () => 'mock-token'
          });
        }
      }
    };
    
    initAuth();
  }, []);

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook zum Zugriff auf Auth-Informationen
 * Abstrahiert sowohl Clerk als auch Offline-Modus
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth muss innerhalb eines AuthProvider verwendet werden');
  }
  return context;
}

/**
 * Hook zum Zugriff auf User-Informationen
 * Kompatibel mit Clerk's useUser Hook
 */
export function useUser() {
  const { user, isLoaded, isSignedIn } = useAuth();
  
  return {
    user,
    isLoaded,
    isSignedIn
  };
}

// Utility-Funktion für dynamisches Laden von Auth-Hooks
async function loadAuthHooks() {
  const config = getAuthConfig();
  
  if (config.mode === 'offline') {
    const { mockUseAuth, mockUseUser } = await import('./mock-client');
    return {
      useAuth: mockUseAuth,
      useUser: mockUseUser
    };
  }
  
  // Dynamisches Laden von Clerk (falls verfügbar)
  try {
    const clerkModule = await import('@clerk/nextjs');
    return {
      useAuth: clerkModule.useAuth,
      useUser: clerkModule.useUser
    };
  } catch (error) {
    console.warn('Clerk nicht verfügbar, verwende Offline-Modus:', error);
    const { mockUseAuth, mockUseUser } = await import('./mock-client');
    return {
      useAuth: mockUseAuth,
      useUser: mockUseUser
    };
  }
}

/**
 * Utility-Funktion zum Laden von Auth-Komponenten
 * Abstrahiert sowohl Clerk als auch Offline-Modus
 */
export async function getAuthComponents() {
  const config = getAuthConfig();
  
  if (config.mode === 'offline') {
    const { MockSignInButton, MockUserButton, MockSignedIn, MockSignedOut } = await import('./mock-client');
    return {
      SignInButton: MockSignInButton,
      UserButton: MockUserButton,
      SignedIn: MockSignedIn,
      SignedOut: MockSignedOut
    };
  }
  
  // Clerk-Modus: Versuche Clerk zu laden, aber mit Fallback zu Mocks
  try {
    const clerkModule = await import('@clerk/nextjs');
    return {
      SignInButton: clerkModule.SignInButton,
      UserButton: clerkModule.UserButton,
      SignedIn: clerkModule.SignedIn,
      SignedOut: clerkModule.SignedOut
    };
  } catch (error) {
    console.warn('Clerk nicht verfügbar, verwende Offline-Modus:', error);
    const { MockSignInButton, MockUserButton, MockSignedIn, MockSignedOut } = await import('./mock-client');
    return {
      SignInButton: MockSignInButton,
      UserButton: MockUserButton,
      SignedIn: MockSignedIn,
      SignedOut: MockSignedOut
    };
  }
}

/**
 * Utility-Funktion zum Prüfen, ob im Offline-Modus
 */
export function isOfflineMode(): boolean {
  return getAuthConfig().mode === 'offline';
}

/**
 * Utility-Funktion zum Prüfen, ob Clerk verfügbar ist
 */
export function isClerkAvailable(): boolean {
  const config = getAuthConfig();
  return config.mode === 'clerk' && 
         !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
         process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== 'dummy_pk_test_placeholder';
} 