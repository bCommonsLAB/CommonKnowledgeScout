"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { useAtomValue, useAtom } from 'jotai'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

import { activeLibraryIdAtom, librariesAtom } from '@/atoms/library-atom'
import { SettingsLogger } from '@/lib/debug/logger'
import { AuthDialog } from '@/components/auth/auth-dialog'
import { useStorageAuth } from '@/hooks/use-storage-auth'

import {
  StorageTypeSelector,
  OneDriveForm,
  WebDAVForm,
  LocalForm,
  GDriveForm,
  type StorageType,
  type StorageFormData
} from './storage-types'

interface StorageFormContainerProps {
  searchParams?: URLSearchParams
}

interface TestStep {
  step: string
  success?: boolean
  error?: string
  message?: string
  status: 'pending' | 'running' | 'success' | 'error'
}

export function StorageFormContainer({ searchParams }: StorageFormContainerProps) {
  const activeLibraryId = useAtomValue(activeLibraryIdAtom)
  const [libraries, setLibraries] = useAtom(librariesAtom)
  
  // Sicherheitsprüfung: libraries ist ein Array
  const librariesArray = Array.isArray(libraries) ? libraries : []
  const activeLibrary = librariesArray.find(lib => lib.id === activeLibraryId)
  
  // Debug: Libraries-State analysieren
  SettingsLogger.info('StorageFormContainer', 'Libraries-State', {
    libraries: typeof libraries,
    isArray: Array.isArray(libraries),
    length: librariesArray.length,
    activeLibraryId,
    hasActiveLibrary: !!activeLibrary
  })

  // State für kaskadierende Form-Logik
  const [selectedStorageType, setSelectedStorageType] = useState<StorageType | undefined>()
  const [isFormVisible, setIsFormVisible] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isTestLoading, setIsTestLoading] = useState(false)
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [testSteps, setTestSteps] = useState<TestStep[]>([])
  const [currentTestStep, setCurrentTestStep] = useState<number>(-1)
  const [formDefaultValues, setFormDefaultValues] = useState<Partial<StorageFormData> | undefined>()

  // Storage-Authentifizierung Hook
  const {
    isAuthDialogOpen,
    authLibrary,
    showAuthDialog,
    hideAuthDialog,
    handleAuthSuccess,
    handleAuthError,
    checkAuthentication,
    ensureAuthenticated
  } = useStorageAuth({
    onAuthSuccess: () => {
      // Nach erfolgreicher Auth automatisch Test wiederholen
      if (activeLibrary) {
        setTimeout(() => handleTest(), 1000)
      }
    }
  })

  // Loading-State: Warten bis Libraries geladen sind UND activeLibrary gefunden wurde
  const isLibrariesLoading = librariesArray.length === 0 || (!activeLibrary && activeLibraryId)

  // Libraries werden bereits vom StorageContext geladen und sind im librariesAtom verfügbar
  // Kein eigenes Loading benötigt

  // Aktive Library änderungen verfolgen
  useEffect(() => {
    if (activeLibrary) {
      SettingsLogger.info('StorageFormContainer', 'Active library changed', {
        libraryId: activeLibrary.id,
        libraryLabel: activeLibrary.label,
        type: activeLibrary.type
      })
    }
  }, [activeLibrary?.id])

  // Storage-Typ aus aktiver Library setzen
  useEffect(() => {
    if (activeLibrary) {
      const storageType = activeLibrary.type as StorageType
      SettingsLogger.info('StorageFormContainer', 'Setze Storage-Typ aus aktiver Library', {
        storageType,
        libraryPath: activeLibrary.path
      })
      
      setSelectedStorageType(storageType)
      
      // Default-Werte basierend auf aktiver Library vorbereiten
      const defaultValues: Partial<StorageFormData> = {
        type: storageType,
        path: activeLibrary.path || "",
      }

      // Typ-spezifische Config-Werte hinzufügen
      if (storageType === 'onedrive' && activeLibrary.config) {
        Object.assign(defaultValues, {
          tenantId: activeLibrary.config.tenantId as string || "",
          clientId: activeLibrary.config.clientId as string || "",
          clientSecret: (activeLibrary.config.clientSecret as string === '********') 
            ? '' 
            : activeLibrary.config.clientSecret as string || "",
        })
      } else if (storageType === 'webdav' && activeLibrary.config) {
        Object.assign(defaultValues, {
          url: activeLibrary.config.url as string || '',
          username: activeLibrary.config.username as string || '',
          password: activeLibrary.config.password as string || '',
          basePath: activeLibrary.config.basePath as string || '',
        })
      } else if (storageType === 'gdrive' && activeLibrary.config) {
        Object.assign(defaultValues, {
          clientId: activeLibrary.config.clientId as string || "",
          clientSecret: activeLibrary.config.clientSecret as string || "",
        })
      }

      setFormDefaultValues(defaultValues)
      
      // Form nach kurzer Verzögerung anzeigen (verhindert Flash)
      setTimeout(() => {
        setIsFormVisible(true)
      }, 100)
    } else {
      // Keine aktive Library - Form zurücksetzen
      setSelectedStorageType(undefined)
      setIsFormVisible(false)
      setFormDefaultValues(undefined)
    }
  }, [activeLibrary])

  // Storage-Typ manuell geändert
  const handleStorageTypeChange = (newType: StorageType) => {
    SettingsLogger.info('StorageFormContainer', 'Storage-Typ manuell geändert', {
      from: selectedStorageType,
      to: newType
    })
    
    setSelectedStorageType(newType)
    setIsFormVisible(false)
    
    // Default-Werte für neuen Typ vorbereiten
    const defaultValues: Partial<StorageFormData> = {
      type: newType,
      path: activeLibrary?.path || "",
    }
    
    setFormDefaultValues(defaultValues)
    
    // Form nach kurzer Verzögerung anzeigen
    setTimeout(() => {
      setIsFormVisible(true)
    }, 100)
  }

  // Form-Submit-Handler
  const handleSubmit = async (data: StorageFormData) => {
    if (!activeLibrary) return

    try {
      setIsLoading(true)
      SettingsLogger.info('StorageFormContainer', 'Speichere Storage-Konfiguration', data)

      const response = await fetch(`/api/libraries/${activeLibrary.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: data.type,
          path: data.path,
          config: {
            // Typ-spezifische Config-Felder extrahieren
            ...(data.type === 'onedrive' && {
              tenantId: (data as any).tenantId,
              clientId: (data as any).clientId,
              clientSecret: (data as any).clientSecret,
            }),
            ...(data.type === 'webdav' && {
              url: (data as any).url,
              username: (data as any).username,
              password: (data as any).password,
              basePath: (data as any).basePath,
            }),
            ...(data.type === 'gdrive' && {
              clientId: (data as any).clientId,
              clientSecret: (data as any).clientSecret,
            }),
          }
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      SettingsLogger.info('StorageFormContainer', 'Storage-Konfiguration erfolgreich gespeichert')
      
      // Die Library wird automatisch über den StorageContext aktualisiert
      // Kein manuelles refreshLibraries benötigt
      
    } catch (error) {
      SettingsLogger.error('StorageFormContainer', 'Fehler beim Speichern der Storage-Konfiguration', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Test-Handler für generische StorageProvider-Tests mit automatischer Auth
  const handleTest = async () => {
    if (!activeLibrary) {
      toast({
        title: "Fehler",
        description: "Keine Bibliothek ausgewählt.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsTestLoading(true)
      
      // Zunächst Authentifizierung prüfen
      const isAuthenticated = await checkAuthentication(activeLibrary)
      
      if (!isAuthenticated) {
        setIsTestLoading(false)
        SettingsLogger.info('StorageFormContainer', 'Authentifizierung erforderlich - öffne Auth-Dialog', {
          libraryId: activeLibrary.id,
          libraryType: activeLibrary.type
        })
        
        showAuthDialog(activeLibrary)
        return
      }
      
      // Initiale Test-Schritte definieren
      const initialSteps: TestStep[] = [
        { step: 'Authentifizierung prüfen', status: 'pending' },
        { step: 'Konfiguration validieren', status: 'pending' },
        { step: 'Root-Verzeichnis auflisten', status: 'pending' },
        { step: 'Root-Element abrufen', status: 'pending' }
      ]
      
      setTestSteps(initialSteps)
      setCurrentTestStep(-1)
      setTestDialogOpen(true)
      
      SettingsLogger.info('StorageFormContainer', 'Starte generischen Storage-Test', {
        libraryId: activeLibrary.id,
        libraryType: activeLibrary.type,
        libraryLabel: activeLibrary.label
      })

      // Kurze Verzögerung für bessere UX
      await new Promise(resolve => setTimeout(resolve, 500))

      const response = await fetch(`/api/libraries/${activeLibrary.id}/test`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      SettingsLogger.info('StorageFormContainer', 'Storage-Test abgeschlossen', result)

      // Test-Schritte aus API-Response in Dialog-Format konvertieren
      if (result.steps && Array.isArray(result.steps)) {
        const dialogSteps: TestStep[] = result.steps.map((step: any) => ({
          step: step.step,
          success: step.success,
          error: step.error,
          message: step.message,
          status: step.success ? 'success' : 'error'
        }))
        
        // Schritte mit Animation durchlaufen
        for (let i = 0; i < dialogSteps.length; i++) {
          setCurrentTestStep(i)
          setTestSteps(prev => prev.map((s, idx) => 
            idx === i ? { ...s, status: 'running' } : s
          ))
          
          await new Promise(resolve => setTimeout(resolve, 300))
          
          setTestSteps(prev => prev.map((s, idx) => 
            idx === i ? dialogSteps[i] : s
          ))
          
          await new Promise(resolve => setTimeout(resolve, 200))
        }

        // Bei Auth-Fehlern automatisch Auth-Dialog öffnen
        const authStep = dialogSteps.find(step => step.step === 'Authentifizierung prüfen')
        if (authStep && !authStep.success) {
          SettingsLogger.info('StorageFormContainer', 'Auth-Fehler im Test erkannt - öffne Auth-Dialog')
          
          setTimeout(() => {
            setTestDialogOpen(false)
            showAuthDialog(activeLibrary)
          }, 2000)
        }
      }

      // Detaillierte Logs für Debugging
      SettingsLogger.info('StorageFormContainer', 'Detaillierte Test-Ergebnisse', {
        summary: result.summary,
        steps: result.steps?.map((step: any) => ({
          step: step.step,
          success: step.success,
          message: step.message
        })) || []
      })

      // Toast-Nachricht am Ende
      if (result.success) {
        toast({
          title: "✅ Storage-Test erfolgreich",
          description: `${result.summary.successfulSteps}/${result.summary.totalSteps} Tests bestanden.`,
        })
      } else {
        const failedSteps = result.steps?.filter((step: any) => !step.success) || []
        const hasAuthError = failedSteps.some(step => 
          step.step === 'Authentifizierung prüfen' || 
          step.error?.toLowerCase().includes('auth')
        )
        
        if (hasAuthError) {
          toast({
            title: "🔐 Authentifizierung erforderlich",
            description: "Bitte melden Sie sich an, um fortzufahren.",
            variant: "destructive",
          })
        } else {
          toast({
            title: "⚠️ Test teilweise erfolgreich",
            description: `${result.summary.successfulSteps}/${result.summary.totalSteps} Tests bestanden.`,
            variant: "destructive",
          })
        }
      }
      
    } catch (error) {
      SettingsLogger.error('StorageFormContainer', 'Fehler beim Storage-Test', error)
      
      // Prüfen ob es ein Auth-Fehler ist
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler'
      const isAuthError = errorMessage.toLowerCase().includes('auth') || 
                         errorMessage.toLowerCase().includes('token') ||
                         errorMessage.toLowerCase().includes('unauthorized')
      
      if (isAuthError) {
        setTestDialogOpen(false)
        showAuthDialog(activeLibrary)
        return
      }
      
      // Anderen Fehler in Dialog anzeigen
      setTestSteps(prev => prev.map((step, idx) => 
        idx === currentTestStep + 1 ? { 
          ...step, 
          status: 'error', 
          error: errorMessage
        } : step
      ))
      
      toast({
        title: "❌ Storage-Test fehlgeschlagen",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsTestLoading(false)
    }
  }

  // Render-Funktion für Test-Dialog-Schritte
  const renderTestSteps = () => {
    return (
      <div className="space-y-3">
        {testSteps.map((step, index) => (
          <div key={index} className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              {step.status === 'pending' && (
                <div className="w-6 h-6 rounded-full border-2 border-gray-300 flex items-center justify-center">
                  <span className="text-xs text-gray-500">{index + 1}</span>
                </div>
              )}
              {step.status === 'running' && (
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
              )}
              {step.status === 'success' && (
                <CheckCircle className="w-6 h-6 text-green-500" />
              )}
              {step.status === 'error' && (
                <XCircle className="w-6 h-6 text-red-500" />
              )}
            </div>
            <div className="flex-1">
              <div className="font-medium">{step.step}</div>
              {step.message && (
                <div className="text-sm text-muted-foreground">{step.message}</div>
              )}
              {step.error && (
                <div className="text-sm text-red-600">{step.error}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Form-Komponente basierend auf Storage-Typ rendern
  const renderStorageForm = () => {
    if (!selectedStorageType || !isFormVisible || !formDefaultValues) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Lade Formular...</span>
        </div>
      )
    }

    const commonProps = {
      defaultValues: formDefaultValues,
      onSubmit: handleSubmit,
      onTest: handleTest,
      isLoading,
      isTestLoading,
    }

    switch (selectedStorageType) {
      case 'onedrive':
        return <OneDriveForm {...commonProps} />
      case 'webdav':
        return <WebDAVForm {...commonProps} />
      case 'local':
        return <LocalForm {...commonProps} />
      case 'gdrive':
        return <GDriveForm {...commonProps} />
      default:
        return (
          <Alert>
            <AlertDescription>
              Unbekannter Storage-Typ: {selectedStorageType}
            </AlertDescription>
          </Alert>
        )
    }
  }

  // Loading-State für Libraries
  if (isLibrariesLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <p>Lade Bibliotheken...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Keine aktive Library
  if (!activeLibrary) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p>Keine Bibliothek ausgewählt. Bitte wählen Sie eine Bibliothek aus.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between">
          <CardTitle>Storage-Konfiguration</CardTitle>
          <Badge variant="outline">{activeLibrary.label}</Badge>
        </div>
        
        {/* Storage-Typ-Auswahl */}
        <StorageTypeSelector
          value={selectedStorageType}
          onChange={handleStorageTypeChange}
          disabled={isLoading}
        />
      </CardHeader>
      
      <CardContent>
        {renderStorageForm()}
      </CardContent>
      
      {/* Test-Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Storage-Provider Test</DialogTitle>
            <DialogDescription>
              Test der Storage-Provider-Schnittstellen für "{activeLibrary.label}"
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {renderTestSteps()}
          </div>
          <div className="flex justify-end space-x-2">
            <Button 
              onClick={() => setTestDialogOpen(false)} 
              variant="secondary"
              disabled={isTestLoading}
            >
              {isTestLoading ? "Test läuft..." : "Schließen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Auth-Dialog */}
      {authLibrary && (
        <AuthDialog
          open={isAuthDialogOpen}
          onOpenChange={hideAuthDialog}
          library={authLibrary}
          onAuthSuccess={handleAuthSuccess}
          onAuthError={handleAuthError}
        />
      )}
    </Card>
  )
}