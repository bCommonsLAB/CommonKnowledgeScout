"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { useUser, SignInButton, SignOutButton } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, CheckCircle2, AlertCircle, LogOut, Mail } from "lucide-react"

/**
 * Seite zum Akzeptieren von Library-Einladungen
 * 
 * Flow:
 * 1. Prüft ob Token gültig ist
 * 2. Wenn nicht angemeldet: Zeigt Hinweis zur Anmeldung
 * 3. Wenn angemeldet: Akzeptiert Einladung automatisch
 */
export default function InviteAcceptPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isLoaded: userLoaded } = useUser()
  const [status, setStatus] = useState<'loading' | 'checking' | 'accepting' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [expectedEmail, setExpectedEmail] = useState<string | null>(null)
  const [currentEmail, setCurrentEmail] = useState<string | null>(null)
  const [librarySlug, setLibrarySlug] = useState<string | null>(null)
  const [lastAttemptedUserId, setLastAttemptedUserId] = useState<string | null>(null)

  const tokenParam = typeof params.token === 'string' ? params.token : null
  
  // Token im Session Storage speichern, damit er nach Abmelden/Anmelden erhalten bleibt
  useEffect(() => {
    if (tokenParam && typeof window !== 'undefined') {
      sessionStorage.setItem('inviteToken', tokenParam)
    }
  }, [tokenParam])

  // Token aus Session Storage oder Param holen
  const token = tokenParam || (typeof window !== 'undefined' ? sessionStorage.getItem('inviteToken') : null)

  // acceptInvite muss VOR dem useEffect definiert werden, der es verwendet
  const acceptInvite = useCallback(async () => {
    // Token aus Session Storage oder Param holen
    const currentToken = tokenParam || (typeof window !== 'undefined' ? sessionStorage.getItem('inviteToken') : null)
    if (!currentToken) {
      console.error('[InviteAcceptPage] Kein Token gefunden')
      setStatus('error')
      setError('Ungültiger Einladungslink')
      return
    }

    console.log('[InviteAcceptPage] Akzeptiere Einladung mit Token:', currentToken)
    setStatus('accepting')

    try {
      const response = await fetch(`/api/libraries/invites/${currentToken}/accept`, {
        method: 'POST',
      })

      const data = await response.json()
      console.log('[InviteAcceptPage] API Response:', { status: response.status, data })

      if (!response.ok) {
        // Speichere zusätzliche Informationen für E-Mail-Mismatch-Fehler
        if (data.expectedEmail) {
          setExpectedEmail(data.expectedEmail)
        }
        if (data.currentEmail) {
          setCurrentEmail(data.currentEmail)
        }
        throw new Error(data.error || 'Fehler beim Akzeptieren der Einladung')
      }

      setStatus('success')
      if (data.librarySlug) {
        setLibrarySlug(data.librarySlug)
      }

      // Token aus Session Storage entfernen nach erfolgreicher Annahme
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('inviteToken')
      }

      // Nach 2 Sekunden zur Library weiterleiten
      setTimeout(() => {
        if (data.librarySlug) {
          router.push(`/explore/${data.librarySlug}`)
        } else {
          router.push('/')
        }
      }, 2000)
    } catch (err) {
      console.error('[InviteAcceptPage] Fehler beim Akzeptieren:', err)
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    }
  }, [tokenParam, router])

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setError('Ungültiger Einladungslink')
      return
    }

    if (!userLoaded) {
      return
    }

    // Wenn nicht angemeldet, zeige Hinweis und reset lastAttemptedUserId
    if (!user) {
      setStatus('checking')
      // Reset lastAttemptedUserId wenn Benutzer abgemeldet ist, damit nach erneutem Anmelden die Einladung akzeptiert wird
      if (lastAttemptedUserId !== null) {
        setLastAttemptedUserId(null)
      }
      return
    }

    // Wenn angemeldet und Benutzer-ID hat sich geändert (neuer Login), akzeptiere Einladung
    const currentUserId = user.id
    const currentUserEmail = user.emailAddresses?.[0]?.emailAddress
    
    // Prüfe ob Benutzer sich geändert hat (neuer Login nach Abmelden)
    if (currentUserId && currentUserId !== lastAttemptedUserId) {
      console.log('[InviteAcceptPage] Neuer Benutzer erkannt, akzeptiere Einladung:', {
        currentUserId,
        lastAttemptedUserId,
        currentUserEmail,
        status,
        token,
      })
      
      // Reset error state wenn Benutzer sich neu angemeldet hat
      if (status === 'error') {
        setError(null)
        setExpectedEmail(null)
        setCurrentEmail(null)
      }
      
      setLastAttemptedUserId(currentUserId)
      
      // Kurze Verzögerung, damit der State richtig gesetzt ist
      setTimeout(() => {
        acceptInvite()
      }, 100)
    }
  }, [token, user, userLoaded, lastAttemptedUserId, status, acceptInvite])

  if (!token) {
    return (
      <div className="container mx-auto py-12 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Ungültiger Einladungslink</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Fehler</AlertTitle>
              <AlertDescription>
                Der Einladungslink ist ungültig oder fehlerhaft.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === 'checking' || !userLoaded) {
    return (
      <div className="container mx-auto py-12 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Einladung annehmen</CardTitle>
            <CardDescription>
              Bitte melden Sie sich an, um die Einladung anzunehmen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Sie wurden zu einer Library eingeladen. Bitte melden Sie sich an, um fortzufahren.
              </p>
              <SignInButton
                mode="modal"
                fallbackRedirectUrl={token ? `/invite/${token}` : '/'}
              >
                <Button>
                  Zur Anmeldung
                </Button>
              </SignInButton>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === 'accepting') {
    return (
      <div className="container mx-auto py-12 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Einladung wird angenommen...</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm text-muted-foreground">
                Bitte warten Sie, während wir Ihre Einladung verarbeiten.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="container mx-auto py-12 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Einladung erfolgreich angenommen!</CardTitle>
            <CardDescription>
              Sie werden gleich zur Library weitergeleitet...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <p className="text-sm text-muted-foreground">
                Ihre Einladung wurde erfolgreich angenommen. Sie haben nun Zugriff auf die Library.
              </p>
            </div>
            {librarySlug && (
              <div className="mt-4">
                <Button onClick={() => router.push(`/explore/${librarySlug}`)}>
                  Zur Library
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === 'error') {
    const isEmailMismatch = error?.includes('andere E-Mail-Adresse') || expectedEmail !== null

    return (
      <div className="container mx-auto py-12 px-4 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Fehler beim Akzeptieren der Einladung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Fehler</AlertTitle>
              <AlertDescription>
                {error || 'Ein unbekannter Fehler ist aufgetreten'}
              </AlertDescription>
            </Alert>

            {isEmailMismatch && (
              <Alert>
                <Mail className="h-4 w-4" />
                <AlertTitle>E-Mail-Adresse stimmt nicht überein</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>
                    Diese Einladung wurde für eine andere E-Mail-Adresse erstellt.
                  </p>
                  {expectedEmail && (
                    <div className="mt-3 p-3 bg-muted rounded-md">
                      <p className="text-sm font-medium mb-1">Erwartete E-Mail-Adresse:</p>
                      <p className="text-sm font-mono text-primary">{expectedEmail}</p>
                    </div>
                  )}
                  {currentEmail && (
                    <div className="mt-2 p-3 bg-muted rounded-md">
                      <p className="text-sm font-medium mb-1">Aktuell angemeldet als:</p>
                      <p className="text-sm font-mono">{currentEmail}</p>
                    </div>
                  )}
                  <p className="mt-3 text-sm">
                    Bitte melden Sie sich ab und melden Sie sich dann mit der E-Mail-Adresse an, für die die Einladung bestimmt ist.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              {isEmailMismatch && user && (
                <SignOutButton
                  redirectUrl={token ? `/invite/${token}` : '/'}
                >
                  <Button variant="default">
                    <LogOut className="h-4 w-4 mr-2" />
                    Abmelden
                  </Button>
                </SignOutButton>
              )}
              <Button variant="outline" onClick={() => router.push('/')}>
                Zur Startseite
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}

