"use client"

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Cloud, HardDrive, Globe, Folder, CheckCircle, Loader2, Shield, Clock } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { SettingsLogger } from '@/lib/debug/logger'
import { Switch } from '@/components/ui/switch'
import { BrowserAuthStorage, type AuthMode } from '@/lib/auth/browser-auth-storage'
import type { ClientLibrary } from '@/types/library'
import { OneDriveProvider } from '@/lib/storage/onedrive-provider'

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  library: ClientLibrary
  onAuthSuccess?: () => void
  onAuthError?: (error: string) => void
}

type AuthStep = 'form' | 'authenticating' | 'success' | 'error'

export function AuthDialog({ open, onOpenChange, library, onAuthSuccess, onAuthError }: AuthDialogProps) {
  const [authStep, setAuthStep] = useState<AuthStep>('form')
  const [error, setError] = useState<string>('')
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  
     // Storage-spezifische Auth-Daten
   const [authData, setAuthData] = useState<Record<string, string>>({})

  const handleClose = () => {
    if (!isAuthenticating) {
      onOpenChange(false)
      setAuthStep('form')
      setError('')
             setAuthData({})
    }
  }

  const getStorageIcon = (type: string) => {
    switch (type) {
      case 'onedrive': return <Cloud className="h-8 w-8 text-blue-600" />
      case 'gdrive': return <Cloud className="h-8 w-8 text-green-600" />
      case 'webdav': return <Globe className="h-8 w-8 text-orange-600" />
      case 'local': return <HardDrive className="h-8 w-8 text-gray-600" />
      default: return <Folder className="h-8 w-8 text-gray-600" />
    }
  }

  const getStorageDisplayName = (type: string) => {
    switch (type) {
      case 'onedrive': return 'Microsoft OneDrive'
      case 'gdrive': return 'Google Drive'
      case 'webdav': return 'WebDAV/Nextcloud'
      case 'local': return 'Lokales Dateisystem'
      default: return 'Unbekannter Storage'
    }
  }

  const getAuthDescription = (type: string) => {
    switch (type) {
      case 'onedrive': 
        return 'Melden Sie sich bei Microsoft OneDrive an, um auf Ihre Dateien zugreifen zu können.'
      case 'gdrive': 
        return 'Melden Sie sich bei Google Drive an, um auf Ihre Dateien zugreifen zu können.'
      case 'webdav': 
        return 'Geben Sie Ihre WebDAV/Nextcloud-Zugangsdaten ein.'
      case 'local': 
        return 'Lokales Dateisystem benötigt keine Authentifizierung.'
      default: 
        return 'Authentifizierung erforderlich.'
    }
  }

  const renderAuthForm = () => {
    switch (library.type) {
      case 'onedrive':
      case 'gdrive':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Klicken Sie auf "Anmelden", um den OAuth-Flow zu starten.
            </p>
            
                         <p className="text-sm text-muted-foreground">
               Nach der Anmeldung werden die Zugangsdaten automatisch gespeichert (wenn möglich).
             </p>
            
            <Button 
              onClick={handleOAuthAuth} 
              className="w-full"
              disabled={isAuthenticating}
            >
              {isAuthenticating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Anmeldung läuft...
                </>
              ) : (
                <>
                  <Cloud className="h-4 w-4 mr-2" />
                  Bei {getStorageDisplayName(library.type)} anmelden
                </>
              )}
            </Button>
          </div>
        )

      case 'webdav':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webdav-url">WebDAV URL</Label>
              <Input
                id="webdav-url"
                type="url"
                placeholder="https://ihre-nextcloud.de/remote.php/dav/files/username/"
                value={authData.url || ''}
                onChange={(e) => setAuthData(prev => ({ ...prev, url: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webdav-username">Benutzername</Label>
              <Input
                id="webdav-username"
                type="text"
                placeholder="ihr-benutzername"
                value={authData.username || ''}
                onChange={(e) => setAuthData(prev => ({ ...prev, username: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webdav-password">Passwort</Label>
              <Input
                id="webdav-password"
                type="password"
                placeholder="ihr-passwort"
                value={authData.password || ''}
                              onChange={(e) => setAuthData(prev => ({ ...prev, password: e.target.value }))}
            />
            </div>
            
                         <p className="text-sm text-muted-foreground">
               Nach der Verbindung werden die Zugangsdaten automatisch gespeichert (wenn möglich).
             </p>
            
            <Button 
              onClick={handleWebDAVAuth} 
              className="w-full"
              disabled={isAuthenticating || !authData.url || !authData.username || !authData.password}
            >
              {isAuthenticating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verbindung testen...
                </>
                             ) : (
                 'Verbindung testen'
               )}
            </Button>
          </div>
        )

      case 'local':
        return (
          <div className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Lokales Dateisystem benötigt keine Authentifizierung.
              </AlertDescription>
            </Alert>
            <Button onClick={() => onAuthSuccess?.()} className="w-full">
              Weiter
            </Button>
          </div>
        )

      default:
        return (
          <Alert variant="destructive">
            <AlertDescription>
              Authentifizierung für Storage-Typ "{library.type}" nicht unterstützt.
            </AlertDescription>
          </Alert>
        )
    }
  }

  const handleOAuthAuth = async () => {
    try {
      setIsAuthenticating(true)
      setError('')
      
      SettingsLogger.info('AuthDialog', `Starte ${library.type} OAuth-Flow`, {
        libraryId: library.id,
        libraryLabel: library.label
      })

             // OAuth-URL basierend auf Storage-Typ erstellen
       let authUrl = ''
       if (library.type === 'onedrive') {
         // Verwende OneDriveProvider für korrekte OAuth-URL
         const provider = new OneDriveProvider(library)
         authUrl = await provider.getAuthUrl()
         
         // State-Objekt mit Library-ID erstellen (ohne Auth-Modus)
         // Verwende immer die aktuelle URL als Redirect (ursprünglicher Tab)
         const redirectUrl = window.location.href
         const stateObj = { 
           libraryId: library.id,
           redirect: redirectUrl
         }
         const urlWithState = new URL(authUrl)
         urlWithState.searchParams.set('state', JSON.stringify(stateObj))
         authUrl = urlWithState.toString()
         
       } else if (library.type === 'gdrive') {
         authUrl = `/api/storage/gdrive/auth?libraryId=${library.id}`
       }

      if (!authUrl) {
        throw new Error('OAuth-URL konnte nicht erstellt werden')
      }

      // OAuth-Fenster öffnen
      const authWindow = window.open(authUrl, 'oauth_popup', 'width=600,height=700')
      
      if (!authWindow) {
        throw new Error('Popup-Fenster wurde blockiert. Bitte erlauben Sie Popups für diese Seite.')
      }

      // Warten auf OAuth-Erfolg (Message-Event oder Fenster-Schließung)
      const pollForSuccess = () => {
        return new Promise<void>((resolve, reject) => {
          let pollInterval: NodeJS.Timeout
          
                     // Event-Listener für Message-Events vom Popup
           const handleMessage = async (event: MessageEvent) => {
             if (event.data?.type === 'OAUTH_SUCCESS') {
               if (pollInterval) clearInterval(pollInterval)
               window.removeEventListener('message', handleMessage)
               
                               try {
                  // Tokens direkt aus der Message verwenden
                  SettingsLogger.info('AuthDialog', 'OAuth erfolgreich - Tokens direkt erhalten', {
                    libraryId: event.data.libraryId,
                    hasTokens: !!event.data.tokens
                  })
                  
                                     if (event.data.tokens) {
                     // Automatisch LocalStorage verwenden (wenn möglich)
                     // Private Mode = automatisch nur Memory (Browser verhindert LocalStorage)
                     let storageMode: AuthMode = 'local-storage'
                     
                     try {
                       // Teste ob LocalStorage verfügbar ist
                       const testKey = 'test_local_storage'
                       localStorage.setItem(testKey, 'test')
                       localStorage.removeItem(testKey)
                     } catch {
                       // LocalStorage nicht verfügbar (z.B. Private Mode)
                       storageMode = 'memory'
                     }
                     
                     // Tokens im gewählten Browser-Modus speichern
                     const tokensKey = `${library.type}_${event.data.libraryId}_tokens`
                     const tokenData = {
                       accessToken: event.data.tokens.accessToken,
                       refreshToken: event.data.tokens.refreshToken,
                       expiresAt: (Math.floor(Date.now() / 1000) + event.data.tokens.expiresIn) * 1000, // Konvertiere zu Millisekunden
                       tokenType: 'Bearer',
                       timestamp: Date.now()
                     }
                     
                     BrowserAuthStorage.store(tokensKey, tokenData, storageMode)
                     
                     SettingsLogger.info('AuthDialog', 'Tokens erfolgreich im Browser gespeichert', {
                       libraryId: event.data.libraryId,
                       storageMode,
                       tokensKey
                     })
                  } else {
                    SettingsLogger.error('AuthDialog', 'Keine Tokens in der Message erhalten', {
                      libraryId: event.data.libraryId
                    })
                    throw new Error('Keine Authentifizierungs-Token erhalten')
                  }
                  
                  // Navigiere zur Redirect-URL im ursprünglichen Tab
                  if (event.data.redirectUrl) {
                    window.location.href = event.data.redirectUrl
                  }
                  
                  resolve()
                } catch (error) {
                  SettingsLogger.error('AuthDialog', 'Fehler beim Token-Speichern', error)
                  reject(error)
                }
             }
           }
          window.addEventListener('message', handleMessage)
          
          pollInterval = setInterval(() => {
            if (authWindow.closed) {
              clearInterval(pollInterval)
              window.removeEventListener('message', handleMessage)
              // Token-Status prüfen
              checkAuthenticationStatus().then(resolve).catch(reject)
            }
          }, 1000)

          // Timeout nach 5 Minuten
          setTimeout(() => {
            if (pollInterval) clearInterval(pollInterval)
            window.removeEventListener('message', handleMessage)
            if (!authWindow.closed) {
              authWindow.close()
            }
            reject(new Error('OAuth-Timeout erreicht'))
          }, 5 * 60 * 1000)
        })
      }

      await pollForSuccess()
      
      setAuthStep('success')
      
             toast({
         title: "✅ Anmeldung erfolgreich",
         description: `Bei ${getStorageDisplayName(library.type)} angemeldet. Zugangsdaten automatisch gespeichert.`,
       })

      setTimeout(() => {
        handleClose()
        onAuthSuccess?.()
      }, 2000)

    } catch (error) {
      SettingsLogger.error('AuthDialog', `${library.type} OAuth-Fehler`, error)
      setError(error instanceof Error ? error.message : 'Unbekannter Fehler')
      setAuthStep('error')
      onAuthError?.(error instanceof Error ? error.message : 'Unbekannter Fehler')
    } finally {
      setIsAuthenticating(false)
    }
  }

  const handleWebDAVAuth = async () => {
    try {
      setIsAuthenticating(true)
      setError('')

      SettingsLogger.info('AuthDialog', 'Teste WebDAV-Authentifizierung', {
        libraryId: library.id,
        url: authData.url,
        username: authData.username
      })

      // WebDAV-Verbindung testen
      const response = await fetch('/api/storage/webdav', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          libraryId: library.id,
          url: authData.url,
          username: authData.username,
          password: authData.password
        })
      })

      if (!response.ok) {
        throw new Error(`WebDAV-Test fehlgeschlagen: ${response.status}`)
      }

             // Automatisch LocalStorage verwenden (wenn möglich)
       // Private Mode = automatisch nur Memory (Browser verhindert LocalStorage)
       let storageMode: AuthMode = 'local-storage'
       
       try {
         // Teste ob LocalStorage verfügbar ist
         const testKey = 'test_local_storage'
         localStorage.setItem(testKey, 'test')
         localStorage.removeItem(testKey)
       } catch {
         // LocalStorage nicht verfügbar (z.B. Private Mode)
         storageMode = 'memory'
       }
       
       // WebDAV-Credentials im gewählten Browser-Modus speichern
       const credentialsKey = `webdav_${library.id}_credentials`
       const credentials = {
         url: authData.url,
         username: authData.username,
         password: authData.password,
         timestamp: Date.now()
       }

       BrowserAuthStorage.store(credentialsKey, credentials, storageMode)
       
       SettingsLogger.info('AuthDialog', 'WebDAV-Credentials gespeichert', {
         libraryId: library.id,
         storageMode,
         credentialsKey
       })

      setAuthStep('success')
      
             toast({
         title: "✅ WebDAV-Verbindung erfolgreich",
         description: "Verbindung erfolgreich. Zugangsdaten automatisch gespeichert.",
       })

      setTimeout(() => {
        handleClose()
        onAuthSuccess?.()
      }, 2000)

    } catch (error) {
      SettingsLogger.error('AuthDialog', 'WebDAV-Auth-Fehler', error)
      setError(error instanceof Error ? error.message : 'Unbekannter Fehler')
      setAuthStep('error')
      onAuthError?.(error instanceof Error ? error.message : 'Unbekannter Fehler')
    } finally {
      setIsAuthenticating(false)
    }
  }

  const checkAuthenticationStatus = async () => {
    // Token-Status für OAuth-Provider prüfen
    if (library.type === 'onedrive' || library.type === 'gdrive') {
      const tokensKey = `${library.type}_${library.id}_tokens`
      const { data: tokens } = BrowserAuthStorage.load(tokensKey)
      
      if (!tokens) {
        throw new Error('Keine Authentifizierungs-Token gefunden')
      }

      if ('expiresAt' in tokens && tokens.expiresAt && Date.now() > tokens.expiresAt) {
        BrowserAuthStorage.remove(tokensKey)
        throw new Error('Authentifizierungs-Token ist abgelaufen')
      }
    }
  }

  // Hilfsfunktion um Token-Status zu prüfen (für OneDrive-Form)
  const checkTokenStatus = (libraryId: string) => {
    const tokensKey = `${library.type}_${libraryId}_tokens`
    const { data: tokens } = BrowserAuthStorage.load(tokensKey)
    
    if (!tokens) {
      return { isAuthenticated: false, isExpired: false }
    }

    if ('expiresAt' in tokens && tokens.expiresAt && Date.now() > tokens.expiresAt) {
      BrowserAuthStorage.remove(tokensKey)
      return { isAuthenticated: false, isExpired: true }
    }

    return { isAuthenticated: true, isExpired: false }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            {getStorageIcon(library.type)}
            <span>Authentifizierung erforderlich</span>
          </DialogTitle>
          <DialogDescription>
            {getAuthDescription(library.type)}
          </DialogDescription>
        </DialogHeader>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Bibliothek: {library.label}</CardTitle>
            <CardDescription>{library.path}</CardDescription>
          </CardHeader>
          <CardContent>
            {authStep === 'form' && renderAuthForm()}
            
            {authStep === 'success' && (
              <div className="text-center space-y-3">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                <p className="font-medium">Authentifizierung erfolgreich!</p>
                <p className="text-sm text-muted-foreground">
                  Sie werden automatisch weitergeleitet...
                </p>
              </div>
            )}

            {authStep === 'error' && (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Button 
                  onClick={() => setAuthStep('form')} 
                  variant="outline" 
                  className="w-full"
                >
                  Erneut versuchen
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  )
}