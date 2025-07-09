/**
 * Client-Mock-Implementierungen für Clerk-Funktionen
 * Verwendet für Offline-Betrieb ohne Clerk-Abhängigkeiten
 * Nur Client-Side Funktionen, keine Server-Imports
 */

import React from 'react';
import { AuthUser, getAuthConfig } from './types';

// Mock-User aus Konfiguration erstellen
function createMockUser(): AuthUser {
  const config = getAuthConfig();
  const offlineUser = config.offlineUser || {};
  
  return {
    id: 'offline-user',
    email: (offlineUser as { email?: string }).email || 'offline@example.com',
    firstName: (offlineUser as { firstName?: string }).firstName || 'Offline',
    lastName: (offlineUser as { lastName?: string }).lastName || 'User',
    fullName: `${(offlineUser as { firstName?: string }).firstName || 'Offline'} ${(offlineUser as { lastName?: string }).lastName || 'User'}`,
    imageUrl: undefined
  };
}

// Client-Side Mocks
export const mockUseAuth = () => ({
  isLoaded: true,
  isSignedIn: true,
  userId: 'offline-user',
  user: createMockUser(),
  signIn: async () => {},
  signOut: async () => {},
  getToken: async () => 'mock-token'
});

export const mockUseUser = () => ({
  isLoaded: true,
  isSignedIn: true,
  user: createMockUser()
});

// Mock-Komponenten
export const MockSignInButton = ({ children }: { children: React.ReactNode }) => (
  <div className="cursor-pointer" onClick={() => console.log('Mock Sign In')}>
    {children}
  </div>
);

export const MockUserButton = () => (
  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-sm">
    {createMockUser().firstName?.[0] || 'U'}
  </div>
);

export const MockSignedIn = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
);

export const MockSignedOut = () => (
  <></>
);

export const MockClerkProvider = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
);

// Utility-Funktion für Conditional Imports
export function isOfflineMode(): boolean {
  return getAuthConfig().mode === 'offline';
}

// Utility-Funktion für dynamisches Laden von Auth-Hooks
export async function loadAuthHooks() {
  const config = getAuthConfig();
  
  if (config.mode === 'offline') {
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
    return {
      useAuth: mockUseAuth,
      useUser: mockUseUser
    };
  }
}

// Utility-Funktion für dynamisches Laden von Auth-Komponenten
export async function loadAuthComponents() {
  const config = getAuthConfig();
  
  if (config.mode === 'offline') {
    return {
      SignInButton: MockSignInButton,
      UserButton: MockUserButton,
      SignedIn: MockSignedIn,
      SignedOut: MockSignedOut,
      ClerkProvider: MockClerkProvider
    };
  }
  
  // Dynamisches Laden von Clerk (falls verfügbar)
  try {
    const clerkModule = await import('@clerk/nextjs');
    return {
      SignInButton: clerkModule.SignInButton,
      UserButton: clerkModule.UserButton,
      SignedIn: clerkModule.SignedIn,
      SignedOut: clerkModule.SignedOut,
      ClerkProvider: clerkModule.ClerkProvider
    };
  } catch (error) {
    console.warn('Clerk nicht verfügbar, verwende Offline-Modus:', error);
    return {
      SignInButton: MockSignInButton,
      UserButton: MockUserButton,
      SignedIn: MockSignedIn,
      SignedOut: MockSignedOut,
      ClerkProvider: MockClerkProvider
    };
  }
}

// Export für dynamisches Laden
export const clerkClientMocks = {
  // Client-Side
  useAuth: mockUseAuth,
  useUser: mockUseUser,
  SignInButton: MockSignInButton,
  UserButton: MockUserButton,
  SignedIn: MockSignedIn,
  SignedOut: MockSignedOut,
  ClerkProvider: MockClerkProvider
}; 