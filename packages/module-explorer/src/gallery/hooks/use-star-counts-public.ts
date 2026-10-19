'use client'

import { useMemo } from 'react'
import { useLibraries } from '@ks/shell/react'
import { useLibraryRole } from './use-library-role'

export interface UseSterneSichtbarResult {
  /** `publicPublishing.starCountsPublic` der Library (ADR 0012). */
  starCountsPublic: boolean
  /** Owner oder Co-Creator: sieht Zahl UND Namen, darf bewerten. */
  isMember: boolean
  /** Sterne-Zahl, Knopf „Im Fokus" und `sort=stars` fuer diesen Betrachter sichtbar? */
  sterneSichtbar: boolean
}

/**
 * Wer sieht Sterne (ADR 0012)? Mitglieder immer; alle anderen nur, wenn die
 * Library den Schalter `starCountsPublic` gesetzt hat — dann die Zahl, nie
 * die Namen. Der Schalter kommt mit dem Library-Steckbrief
 * (`GET /api/libraries` bzw. die oeffentliche Explorer-Antwort), so bleibt
 * die Galerie ohne zweiten Aufruf einbettbar.
 */
export function useSterneSichtbar(libraryId?: string): UseSterneSichtbarResult {
  const libraries = useLibraries()
  const { isMember } = useLibraryRole(libraryId)
  return useMemo(() => {
    const starCountsPublic =
      libraries.find((lib) => lib.id === libraryId)?.config?.publicPublishing?.starCountsPublic === true
    return { starCountsPublic, isMember, sterneSichtbar: isMember || starCountsPublic }
  }, [libraries, libraryId, isMember])
}
