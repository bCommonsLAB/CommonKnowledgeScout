/**
 * Server-Mock-Implementierungen für Clerk-Funktionen
 * Verwendet für Offline-Betrieb ohne Clerk-Abhängigkeiten
 * Nur Server-Side Funktionen
 */

import { AuthUser, ServerAuth, getAuthConfig } from './types';

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

// Server-Side Mocks
export const mockServerAuth: ServerAuth = {
  auth: async () => ({
    userId: 'offline-user',
    user: createMockUser()
  }),
  currentUser: async () => createMockUser(),
  getToken: async () => 'mock-token'
};

export const mockAuth = async () => ({
  userId: 'offline-user',
  user: createMockUser()
});

export const mockCurrentUser = async () => createMockUser();

export const mockGetAuth = async () => ({
  userId: 'offline-user',
  user: createMockUser()
});

// Mock-Middleware
export const mockClerkMiddleware = (handler: (auth: { userId: string; user: AuthUser }, req: unknown) => Promise<unknown>) => {
  return async (req: unknown) => {
    const mockAuth = {
      userId: 'offline-user',
      user: createMockUser()
    };
    
    return handler(mockAuth, req);
  };
};

// Utility-Funktion für dynamisches Laden von Server-Auth
export async function loadServerAuth() {
  const config = getAuthConfig();
  
  if (config.mode === 'offline') {
    return {
      auth: mockAuth,
      currentUser: mockCurrentUser,
      getAuth: mockGetAuth
    };
  }
  
  // Dynamisches Laden von Clerk Server (falls verfügbar)
  try {
    const clerkModule = await import('@clerk/nextjs/server');
    return {
      auth: clerkModule.auth,
      currentUser: clerkModule.currentUser,
      getAuth: clerkModule.getAuth
    };
  } catch (error) {
    console.warn('Clerk Server nicht verfügbar, verwende Offline-Modus:', error);
    return {
      auth: mockAuth,
      currentUser: mockCurrentUser,
      getAuth: mockGetAuth
    };
  }
}

// Export für dynamisches Laden
export const clerkServerMocks = {
  // Server-Side
  auth: mockAuth,
  currentUser: mockCurrentUser,
  getAuth: mockGetAuth,
  clerkMiddleware: mockClerkMiddleware
}; 