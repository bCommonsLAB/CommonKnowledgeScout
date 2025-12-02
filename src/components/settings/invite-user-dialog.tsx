/**
 * @fileoverview Invite User Dialog Component
 * 
 * @description
 * Dialog component for inviting users to a library via email.
 * Used by owners and moderators to send invitations.
 * 
 * @module settings
 */

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Mail, UserPlus } from "lucide-react"

interface InviteUserDialogProps {
  libraryId: string
  onInviteSent?: () => void
}

/**
 * Dialog zum Einladen von Benutzern per E-Mail
 */
export function InviteUserDialog({ libraryId, onInviteSent }: InviteUserDialogProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [inviteMessage, setInviteMessage] = useState("")
  const [isSending, setIsSending] = useState(false)

  async function handleInvite() {
    if (!email || !email.includes("@")) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
        variant: "destructive",
      })
      return
    }

    setIsSending(true)

    try {
      const response = await fetch(`/api/libraries/${libraryId}/invites`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          inviteMessage: inviteMessage.trim() || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Fehler beim Versenden der Einladung")
      }

      toast({
        title: "Erfolg",
        description: `Einladung wurde erfolgreich an ${email} gesendet.`,
      })

      // Formular zurücksetzen
      setEmail("")
      setName("")
      setInviteMessage("")
      setOpen(false)

      // Callback aufrufen, um Liste zu aktualisieren
      if (onInviteSent) {
        onInviteSent()
      }
    } catch (error) {
      console.error("Fehler beim Versenden der Einladung:", error)
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Benutzer einladen
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Benutzer einladen</DialogTitle>
          <DialogDescription>
            Laden Sie einen Benutzer per E-Mail ein, um Zugriff auf diese Library zu erhalten.
            Der eingeladene Benutzer erhält einen Link per E-Mail und kann nach der Anmeldung automatisch auf die Library zugreifen.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail-Adresse *</Label>
            <Input
              id="email"
              type="email"
              placeholder="benutzer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Name (optional)</Label>
            <Input
              id="name"
              type="text"
              placeholder="Max Mustermann"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inviteMessage">Einladungstext (optional)</Label>
            <Textarea
              id="inviteMessage"
              placeholder="Persönliche Nachricht für den eingeladenen Benutzer..."
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
              disabled={isSending}
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSending}
          >
            Abbrechen
          </Button>
          <Button onClick={handleInvite} disabled={isSending || !email}>
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Wird gesendet...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Einladung senden
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

