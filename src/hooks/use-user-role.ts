/**
 * @fileoverview User Role Hook
 * 
 * @description
 * Hook to check if the current user is a Creator (MiSpace) or Guest (WeSpace).
 * Uses Clerk Public Metadata and checks if user is owner of any library.
 * 
 * @module hooks
 */

"use client"

import { useUser } from "@clerk/nextjs"
import { useAtomValue } from "jotai"
import { librariesAtom } from "@/atoms/library-atom"

export type UserRole = 'creator' | 'guest'

/**
 * Hook to get the current user's role
 * 
 * Automatically detects Creator role if user is owner of at least one library.
 * Clerk wird nur als Identity Service Provider (ISP) verwendet.
 * Rollen werden über Library-Ownership verwaltet, nicht über Clerk Metadata.
 * 
 * @returns Object with:
 * - role: 'creator' | 'guest' | null (null if not loaded or not signed in)
 * - isCreator: boolean - true if user is a creator (owner of at least one library)
 * - isGuest: boolean - true if user is a guest
 * - isLoaded: boolean - true if Clerk has finished loading
 */
export function useUserRole() {
  const { user, isLoaded } = useUser()
  const libraries = useAtomValue(librariesAtom)

  if (!isLoaded || !user) {
    return {
      role: null as UserRole | null,
      isCreator: false,
      isGuest: false,
      isLoaded: false,
    }
  }

  // Wenn Benutzer Owner einer Library ist, ist er automatisch Creator
  // Rollen werden über Library-Ownership verwaltet, nicht über Clerk Metadata
  // Wenn keine Libraries geladen sind, wird der Benutzer als Guest behandelt
  // (bis die Libraries geladen sind)
  const isOwnerOfLibrary = libraries.length > 0
  const role: UserRole = isOwnerOfLibrary ? 'creator' : 'guest'

  return {
    role,
    isCreator: role === 'creator',
    isGuest: role === 'guest',
    isLoaded: true,
  }
}

