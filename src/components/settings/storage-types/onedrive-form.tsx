"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Cloud, CheckCircle, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { onedriveStorageSchema, type StorageFormProps, type TokenStatus } from "./types"
import { SettingsLogger } from "@/lib/debug/logger"
import { OneDriveProvider } from "@/lib/storage/onedrive-provider"
import { BrowserAuthStorage, type AuthMode } from "@/lib/auth/browser-auth-storage"

type OneDriveFormData = {
  type: "onedrive"
  path: string
  tenantId?: string
  clientId?: string
  clientSecret?: string
}

type OneDriveDefaultValues = Partial<OneDriveFormData>

interface OneDriveFormProps {
  defaultValues?: OneDriveDefaultValues
  onSubmit: (data: OneDriveFormData) => Promise<void>
  onTest?: () => Promise<void>
  isLoading?: boolean
  isTestLoading?: boolean
}

export function OneDriveForm({ defaultValues, onSubmit, onTest, isLoading, isTestLoading }: OneDriveFormProps) {
  const [tokenStatus, setTokenStatus] = useState<TokenStatus>({
    isAuthenticated: false,
    isExpired: false,
    loading: true,
  })
  const [oauthDefaults, setOauthDefaults] = useState<{
    tenantId: string
    clientId: string
    clientSecret: string
  }>({
    tenantId: "",
    clientId: "",
    clientSecret: "",
  })

  const form = useForm<OneDriveFormData>({
    resolver: zodResolver(onedriveStorageSchema),
    defaultValues: {
      type: "onedrive",
      path: "",
      tenantId: "",
      clientId: "",
      clientSecret: "",
      ...defaultValues,
    }
  })

  // OAuth-Defaults laden
  useEffect(() => {
    async function loadOAuthDefaults() {
      try {
        SettingsLogger.info('OneDriveForm', 'Lade OAuth-Standardwerte...')
        const response = await fetch('/api/settings/oauth-defaults')
        
        if (response.ok) {
          const data = await response.json()
          SettingsLogger.info('OneDriveForm', 'Geladene OAuth-Defaults', {
            hasDefaults: !!data,
            tenantId: data?.tenantId ? 'vorhanden' : 'nicht vorhanden',
            clientId: data?.clientId ? 'vorhanden' : 'nicht vorhanden',
            clientSecret: data?.clientSecret ? 'vorhanden' : 'nicht vorhanden'
          })
          
          setOauthDefaults({
            tenantId: data?.tenantId || "",
            clientId: data?.clientId || "",
            clientSecret: data?.clientSecret || "",
          })
        }
      } catch (error) {
        SettingsLogger.error('OneDriveForm', 'Fehler beim Laden der OAuth-Defaults', error)
      }
    }

    loadOAuthDefaults()
  }, [])

  // Token-Status laden
  useEffect(() => {
    async function loadTokenStatus() {
      if (!defaultValues?.path) return

      try {
        SettingsLogger.info('OneDriveForm', 'Lade Token-Status...')
        setTokenStatus(prev => ({ ...prev, loading: true }))

        // Der OAuth-Callback verwendet die echte Library-ID, nicht den Storage-Pfad
        // Extrahiere Library-ID aus der URL oder verwende Fallback
        const urlParams = new URLSearchParams(window.location.search)
        const libraryId = urlParams.get('activeLibraryId') || 'ID_OnedriveTest'
        const key = `onedrive_${libraryId}_tokens`
        const { data: tokens } = BrowserAuthStorage.load(key)
        
        if (tokens && 'expiresAt' in tokens && tokens.expiresAt) {
          const isExpired = Date.now() > tokens.expiresAt
          
          SettingsLogger.info('OneDriveForm', 'Token-Status aus localStorage geladen', {
            hasTokens: true,
            isExpired
          })
          
          setTokenStatus({
            isAuthenticated: true,
            isExpired,
            loading: false,
          })
        } else {
          SettingsLogger.info('OneDriveForm', 'Keine Tokens im localStorage gefunden')
          setTokenStatus({
            isAuthenticated: false,
            isExpired: false,
            loading: false,
          })
        }
      } catch (error) {
        SettingsLogger.error('OneDriveForm', 'Fehler beim Laden des Token-Status', error)
        setTokenStatus({
          isAuthenticated: false,
          isExpired: false,
          loading: false,
        })
      }
    }

    loadTokenStatus()
  }, [defaultValues?.path])

  // Form mit Defaults befüllen, wenn verfügbar
  useEffect(() => {
    if (defaultValues) {
      SettingsLogger.info('OneDriveForm', 'Befülle Form mit Default-Werten', defaultValues)
      form.reset({
        type: "onedrive",
        ...defaultValues,
      })
    }
  }, [defaultValues, form])

  // OAuth-Defaults in leere Felder setzen
  useEffect(() => {
    if (!oauthDefaults.tenantId) return

    const currentValues = form.getValues()
    if (!currentValues.tenantId && oauthDefaults.tenantId) {
      form.setValue('tenantId', oauthDefaults.tenantId)
    }
    if (!currentValues.clientId && oauthDefaults.clientId) {
      form.setValue('clientId', oauthDefaults.clientId)
    }
    if (!currentValues.clientSecret && oauthDefaults.clientSecret) {
      form.setValue('clientSecret', oauthDefaults.clientSecret)
    }
  }, [oauthDefaults, form])

  const handleOneDriveAuth = async () => {
    try {
      // Verwende OneDriveProvider für korrekte OAuth-URL
      const mockLibrary = {
        id: defaultValues?.path || 'unknown',
        label: 'OneDrive Library',
        type: 'onedrive' as const,
        path: defaultValues?.path || '',
        isEnabled: true,
        config: {
          tenantId: form.getValues().tenantId,
          clientId: form.getValues().clientId,
          clientSecret: form.getValues().clientSecret
        }
      }
      
      const provider = new OneDriveProvider(mockLibrary)
      const authUrl = await provider.getAuthUrl()
      
      // State-Objekt mit Library-ID erstellen
      // Verwende immer die aktuelle URL als Redirect (ursprünglicher Tab)
      const redirectUrl = window.location.href
      const stateObj = { 
        libraryId: mockLibrary.id,
        redirect: redirectUrl
      }
      const urlWithState = new URL(authUrl)
      urlWithState.searchParams.set('state', JSON.stringify(stateObj))
      
      // Popup öffnen und auf Message warten
      const authWindow = window.open(urlWithState.toString(), 'oauth_popup')
      
      if (!authWindow) {
        throw new Error('Popup-Fenster wurde blockiert. Bitte erlauben Sie Popups für diese Seite.')
      }
      
      // Warten auf OAuth-Erfolg
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
                 SettingsLogger.info('OneDriveForm', 'OAuth erfolgreich - Tokens direkt erhalten', {
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
                   
                   // Tokens mit BrowserAuthStorage speichern
                   const tokensKey = `onedrive_${event.data.libraryId}_tokens`
                   const tokenData = {
                     accessToken: event.data.tokens.accessToken,
                     refreshToken: event.data.tokens.refreshToken,
                     expiresAt: (Math.floor(Date.now() / 1000) + event.data.tokens.expiresIn) * 1000, // Konvertiere zu Millisekunden
                     tokenType: 'Bearer',
                     timestamp: Date.now()
                   }
                   
                   BrowserAuthStorage.store(tokensKey, tokenData, storageMode)
                   
                   SettingsLogger.info('OneDriveForm', 'Tokens erfolgreich im localStorage gespeichert', {
                     libraryId: event.data.libraryId,
                     tokensKey
                   })
                   
                   // Token-Status aktualisieren
                   setTokenStatus({
                     isAuthenticated: true,
                     isExpired: false,
                     loading: false,
                   })
                 } else {
                   SettingsLogger.error('OneDriveForm', 'Keine Tokens in der Message erhalten', {
                     libraryId: event.data.libraryId
                   })
                   throw new Error('Keine Authentifizierungs-Token erhalten')
                 }
                 
                 resolve()
               } catch (error) {
                 SettingsLogger.error('OneDriveForm', 'Fehler beim Token-Speichern', error)
                 reject(error)
               }
            }
          }
          window.addEventListener('message', handleMessage)
          
                               pollInterval = setInterval(() => {
            // Prüfe ob Tokens gespeichert wurden (auch wenn Fenster noch offen ist)
            if (defaultValues?.path) {
              // Der OAuth-Callback verwendet die echte Library-ID, nicht den Storage-Pfad
              // Extrahiere Library-ID aus der URL oder verwende Fallback
              const urlParams = new URLSearchParams(window.location.search)
              const libraryId = urlParams.get('activeLibraryId') || 'ID_OnedriveTest'
              const key = `onedrive_${libraryId}_tokens`
              
              const { data: tokens } = BrowserAuthStorage.load(key)
              if (tokens && 'expiresAt' in tokens && tokens.expiresAt) {
                const isExpired = Date.now() > tokens.expiresAt
                if (!isExpired) {
                  // Tokens gefunden und gültig - Authentifizierung erfolgreich
                  clearInterval(pollInterval)
                  window.removeEventListener('message', handleMessage)
                  setTokenStatus({
                    isAuthenticated: true,
                    isExpired: false,
                    loading: false,
                  })
                  resolve()
                  return
                }
              }
            }
            
            // Prüfe ob Fenster geschlossen wurde
            if (authWindow.closed) {
              clearInterval(pollInterval)
              window.removeEventListener('message', handleMessage)
              // Finale Token-Status-Prüfung
              if (defaultValues?.path) {
                // Der OAuth-Callback verwendet die echte Library-ID, nicht den Storage-Pfad
                // Extrahiere Library-ID aus der URL oder verwende Fallback
                const urlParams = new URLSearchParams(window.location.search)
                const libraryId = urlParams.get('activeLibraryId') || 'ID_OnedriveTest'
                const key = `onedrive_${libraryId}_tokens`
                
                const { data: tokens } = BrowserAuthStorage.load(key)
                if (tokens && 'expiresAt' in tokens && tokens.expiresAt) {
                  const isExpired = Date.now() > tokens.expiresAt
                  setTokenStatus({
                    isAuthenticated: true,
                    isExpired,
                    loading: false,
                  })
                }
              }
              resolve()
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
      
      SettingsLogger.info('OneDriveForm', 'OneDrive-Authentifizierung erfolgreich abgeschlossen')
      
    } catch (error) {
      SettingsLogger.error('OneDriveForm', 'Fehler bei OneDrive-Authentifizierung', error)
    }
  }

  const handleOneDriveLogout = async () => {
    try {
      if (!defaultValues?.path) return
      
      // Der OAuth-Callback verwendet die echte Library-ID, nicht den Storage-Pfad
      // Extrahiere Library-ID aus der URL oder verwende Fallback
      const urlParams = new URLSearchParams(window.location.search)
      const libraryId = urlParams.get('activeLibraryId') || 'ID_OnedriveTest'
      const key = `onedrive_${libraryId}_tokens`
      BrowserAuthStorage.remove(key)
      
      setTokenStatus({
        isAuthenticated: false,
        isExpired: false,
        loading: false,
      })
      
      SettingsLogger.info('OneDriveForm', 'OneDrive-Logout erfolgreich')
    } catch (error) {
      SettingsLogger.error('OneDriveForm', 'Fehler beim OneDrive-Logout', error)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="path"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Speicherpfad</FormLabel>
              <FormControl>
                <Input {...field} value={field.value || ""} />
              </FormControl>
              <FormDescription>
                Der Pfad in OneDrive, unter dem die Dateien gespeichert werden sollen.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tenantId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tenant ID</FormLabel>
              <FormControl>
                <Input {...field} value={field.value || ""} />
              </FormControl>
              <FormDescription>
                Die Tenant ID Ihres Microsoft Azure AD-Verzeichnisses. Lassen Sie dieses Feld leer für persönliche Microsoft-Konten.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="clientId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Client ID</FormLabel>
              <FormControl>
                <Input {...field} value={field.value || ""} />
              </FormControl>
              <FormDescription>
                Die Client ID Ihrer Microsoft Azure AD-Anwendung.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="clientSecret"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Client Secret</FormLabel>
              <FormControl>
                <Input 
                  {...field} 
                  type="password" 
                  value={field.value || ""} 
                  placeholder={
                    (defaultValues as any)?.clientSecret === '********' 
                      ? "Client Secret ist gespeichert (zum Ändern neuen Wert eingeben)" 
                      : "Client Secret eingeben"
                  }
                />
              </FormControl>
              <FormDescription>
                Das Client Secret Ihrer Microsoft Azure AD-Anwendung.
                {(defaultValues as any)?.clientSecret === '********' && (
                  <span className="block mt-1 text-green-600 dark:text-green-400">
                    ✓ Ein Client Secret ist bereits gespeichert. Lassen Sie das Feld leer, um es beizubehalten.
                  </span>
                )}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <Button
            type="button"
            variant={tokenStatus.isAuthenticated ? "destructive" : "secondary"}
            onClick={tokenStatus.isAuthenticated ? handleOneDriveLogout : handleOneDriveAuth}
            className="w-full"
          >
            <Cloud className="h-4 w-4 mr-2" />
            {tokenStatus.isAuthenticated ? "Von OneDrive abmelden" : "Bei OneDrive anmelden"}
          </Button>

          {/* Token-Status anzeigen */}
          {tokenStatus.loading ? (
            <div className="text-sm text-muted-foreground">
              Lade Authentifizierungsstatus...
            </div>
          ) : tokenStatus.isAuthenticated ? (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Authentifiziert</AlertTitle>
              <AlertDescription>
                Sie sind bei OneDrive angemeldet.
                {tokenStatus.isExpired && (
                  <span className="text-yellow-600 dark:text-yellow-400 block mt-1">
                    ⚠️ Die Authentifizierung ist abgelaufen. Bitte melden Sie sich erneut an.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="default">
              <Info className="h-4 w-4" />
              <AlertTitle>Nicht authentifiziert</AlertTitle>
              <AlertDescription>
                Sie müssen sich bei OneDrive anmelden, um auf Ihre Dateien zugreifen zu können.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex items-center justify-between">
          {onTest && (
            <Button 
              type="button" 
              variant="outline"
              onClick={onTest}
              disabled={isTestLoading}
            >
              {isTestLoading ? "Teste..." : "Verbindung testen"}
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Speichere..." : "Speichern"}
          </Button>
        </div>
      </form>
    </Form>
  )
}