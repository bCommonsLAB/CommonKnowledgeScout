"use client"

import { useState, useCallback } from 'react'
import { toast } from '@/hooks/use-toast'
import { SettingsLogger } from '@/lib/debug/logger'
import { BrowserAuthStorage } from '@/lib/auth/browser-auth-storage'
import type { ClientLibrary } from '@/types/library'

interface UseStorageAuthOptions {
  onAuthSuccess?: () => void
  onAuthError?: (error: string) => void
}

export function useStorageAuth(options: UseStorageAuthOptions = {}) {
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false)
  const [authLibrary, setAuthLibrary] = useState<ClientLibrary | null>(null)

  /**
   * Überprüft ob eine Library authentifiziert ist
   */
  const checkAuthentication = useCallback(async (library: ClientLibrary): Promise<boolean> => {
    try {
      SettingsLogger.info('StorageAuth', 'Prüfe Authentifizierung', {
        libraryId: library.id,
        libraryType: library.type
      })

      switch (library.type) {
        case 'onedrive':
        case 'gdrive': {
          // Extrahiere Library-ID aus der URL oder verwende Fallback
          const urlParams = new URLSearchParams(window.location.search)
          const libraryId = urlParams.get('activeLibraryId') || library.id
          const tokensKey = `${library.type}_${libraryId}_tokens`
          
          SettingsLogger.info('StorageAuth', 'Prüfe OAuth-Token', { 
            libraryId: library.id,
            extractedLibraryId: libraryId,
            tokensKey 
          })
          
          const isValid = BrowserAuthStorage.isValid(tokensKey)
          
          if (isValid) {
            const { mode } = BrowserAuthStorage.load(tokensKey)
            SettingsLogger.info('StorageAuth', 'OAuth-Token gefunden und gültig', { 
              libraryType: library.type,
              storageMode: mode 
            })
            return true
          }

          SettingsLogger.warn('StorageAuth', 'Keine gültigen OAuth-Token gefunden', { tokensKey })
          return false
        }

        case 'webdav': {
          const credentialsKey = `webdav_${library.id}_credentials`
          const isValid = BrowserAuthStorage.isValid(credentialsKey)
          
          if (isValid) {
            const { mode } = BrowserAuthStorage.load(credentialsKey)
            SettingsLogger.info('StorageAuth', 'WebDAV-Credentials gefunden und gültig', { 
              libraryId: library.id,
              storageMode: mode 
            })
            return true
          }

          SettingsLogger.warn('StorageAuth', 'Keine gültigen WebDAV-Credentials gefunden', { credentialsKey })
          return false
        }

        case 'local':
          // Lokales Dateisystem benötigt keine Authentifizierung
          return true

        default:
          SettingsLogger.warn('StorageAuth', 'Unbekannter Storage-Typ', { type: library.type })
          return false
      }
    } catch (error) {
      SettingsLogger.error('StorageAuth', 'Fehler bei Authentifizierungsprüfung', error)
      return false
    }
  }, [])

  /**
   * Zeigt den Auth-Dialog für eine Library an
   */
  const showAuthDialog = useCallback((library: ClientLibrary) => {
    SettingsLogger.info('StorageAuth', 'Öffne Auth-Dialog', {
      libraryId: library.id,
      libraryType: library.type,
      libraryLabel: library.label
    })

    setAuthLibrary(library)
    setIsAuthDialogOpen(true)
  }, [])

  /**
   * Versteckt den Auth-Dialog
   */
  const hideAuthDialog = useCallback(() => {
    setIsAuthDialogOpen(false)
    setAuthLibrary(null)
  }, [])

  /**
   * Versucht eine Storage-Operation und triggert Auth-Dialog bei Bedarf
   */
  const ensureAuthenticated = useCallback(async (
    library: ClientLibrary,
    operation: () => Promise<any>
  ): Promise<any> => {
    try {
      // Zunächst Authentifizierung prüfen
      const isAuthenticated = await checkAuthentication(library)
      
      if (!isAuthenticated) {
        SettingsLogger.info('StorageAuth', 'Authentifizierung erforderlich - öffne Dialog', {
          libraryId: library.id
        })
        
        showAuthDialog(library)
        
        // Promise zurückgeben, die nach erfolgreicher Auth aufgelöst wird
        return new Promise((resolve, reject) => {
          const originalOnSuccess = options.onAuthSuccess
          const originalOnError = options.onAuthError

          options.onAuthSuccess = async () => {
            try {
              originalOnSuccess?.()
              const result = await operation()
              resolve(result)
            } catch (error) {
              reject(error)
            }
          }

          options.onAuthError = (error) => {
            originalOnError?.(error)
            reject(new Error(error))
          }
        })
      }

      // Bereits authentifiziert - Operation direkt ausführen
      return await operation()

    } catch (error) {
      SettingsLogger.error('StorageAuth', 'Fehler bei ensureAuthenticated', error)
      
      // Prüfen ob es ein Auth-Fehler ist
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler'
      
      if (errorMessage.toLowerCase().includes('auth') || 
          errorMessage.toLowerCase().includes('token') ||
          errorMessage.toLowerCase().includes('unauthorized')) {
        
        SettingsLogger.info('StorageAuth', 'Auth-Fehler erkannt - öffne Dialog', {
          error: errorMessage
        })
        
        showAuthDialog(library)
        return null
      }

      throw error
    }
  }, [checkAuthentication, showAuthDialog, options])

  /**
   * Handler für erfolgreiche Authentifizierung
   */
  const handleAuthSuccess = useCallback(() => {
    SettingsLogger.info('StorageAuth', 'Authentifizierung erfolgreich')
    
    toast({
      title: "✅ Anmeldung erfolgreich",
      description: "Sie können jetzt auf Ihre Dateien zugreifen.",
    })

    hideAuthDialog()
    options.onAuthSuccess?.()
  }, [hideAuthDialog, options])

  /**
   * Handler für fehlgeschlagene Authentifizierung
   */
  const handleAuthError = useCallback((error: string) => {
    SettingsLogger.error('StorageAuth', 'Authentifizierung fehlgeschlagen', { error })
    
    toast({
      title: "❌ Anmeldung fehlgeschlagen",
      description: error,
      variant: "destructive",
    })

    options.onAuthError?.(error)
  }, [options])

  return {
    // Dialog State
    isAuthDialogOpen,
    authLibrary,
    
    // Dialog Controls
    showAuthDialog,
    hideAuthDialog,
    
    // Auth Handlers
    handleAuthSuccess,
    handleAuthError,
    
    // Auth Operations
    checkAuthentication,
    ensureAuthenticated,
  }
}