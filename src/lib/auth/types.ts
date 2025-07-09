/**
 * Auth-Abstraktionsschicht für CommonKnowledgeScout
 * Unterstützt sowohl Clerk als auch Offline-Betrieb
 */

// Basis-User-Interface
export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  imageUrl?: string;
}

// Auth-Status
export interface AuthStatus {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  user: AuthUser | null;
}

// Auth-Kontext-Interface
export interface AuthContextValue {
  // Status
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  user: AuthUser | null;
  
  // Methoden
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

// Server-Auth-Interface
export interface ServerAuth {
  auth: () => Promise<{ userId: string | null; user: AuthUser | null }>;
  currentUser: () => Promise<AuthUser | null>;
  getToken: () => Promise<string | null>;
}

// Konfiguration für Auth-Provider
export interface AuthConfig {
  mode: 'clerk' | 'offline';
  offlineUser?: {
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

// Mock-User für Offline-Betrieb
export const DEFAULT_OFFLINE_USER: AuthUser = {
  id: 'offline-user',
  email: 'offline@example.com',
  firstName: 'Offline',
  lastName: 'User',
  fullName: 'Offline User',
  imageUrl: undefined
};

// Environment-basierte Konfiguration
export function getAuthConfig(): AuthConfig {
  const mode = process.env.NEXT_PUBLIC_AUTH_MODE as 'clerk' | 'offline' || 'clerk';
  
  // Prüfe, ob Clerk-Keys vorhanden sind
  const hasClerkKeys = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && 
                       process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== 'dummy_pk_test_placeholder';
  
  // Wenn keine Clerk-Keys vorhanden sind, verwende Offline-Modus
  const finalMode = hasClerkKeys ? mode : 'offline';
  
  return {
    mode: finalMode,
    offlineUser: {
      email: process.env.NEXT_PUBLIC_OFFLINE_USER_EMAIL || 'offline@example.com',
      firstName: process.env.NEXT_PUBLIC_OFFLINE_USER_FIRST_NAME || 'Offline',
      lastName: process.env.NEXT_PUBLIC_OFFLINE_USER_LAST_NAME || 'User'
    }
  };
}

// Type Guards
export function isAuthUser(user: unknown): user is AuthUser {
  return (
    typeof user === 'object' &&
    user !== null &&
    typeof (user as AuthUser).id === 'string' &&
    typeof (user as AuthUser).email === 'string'
  );
} 