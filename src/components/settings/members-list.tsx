/**
 * @fileoverview Members List Component
 * 
 * @description
 * Component for displaying and managing library members (co-creators, moderators).
 * Allows owners to invite and remove members. Zeigt den Einladungsstatus
 * (ausstehend/aktiv) und ermoeglicht erneutes Senden.
 * 
 * @module settings
 */

"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Trash2, Shield, Users, AlertCircle, Mail, Clock, CheckCircle2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import type { LibraryMember, LibraryRole } from "@/types/library-members"

interface MembersListProps {
  libraryId: string
}

/**
 * Komponente fuer Liste der Library-Mitglieder mit Einladungsflow
 */
export function MembersList({ libraryId }: MembersListProps) {
  const { toast } = useToast()
  const [members, setMembers] = useState<LibraryMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAddingMember, setIsAddingMember] = useState(false)
  const [newMemberEmail, setNewMemberEmail] = useState("")
  const [newMemberRole, setNewMemberRole] = useState<LibraryRole>("co-creator")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [removingEmail, setRemovingEmail] = useState<string | null>(null)
  const [resendingEmail, setResendingEmail] = useState<string | null>(null)

  const loadMembers = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/libraries/${libraryId}/members`)

      if (!response.ok) {
        throw new Error('Fehler beim Laden der Mitglieder')
      }

      const data = await response.json()
      setMembers(data.members || [])
    } catch (err) {
      console.error('Fehler beim Laden der Mitglieder:', err)
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }, [libraryId])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  async function handleInviteMember() {
    setDialogError(null)
    
    if (!newMemberEmail || !newMemberEmail.includes("@")) {
      setDialogError("Bitte geben Sie eine gueltige E-Mail-Adresse ein.")
      return
    }

    setIsAddingMember(true)

    try {
      const response = await fetch(`/api/libraries/${libraryId}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: newMemberEmail.trim(),
          role: newMemberRole,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setDialogError(data.error || "Fehler beim Einladen des Mitglieds")
        return
      }

      const roleLabel = newMemberRole === 'co-creator' ? 'Co-Creator' : 'Moderator'
      toast({
        title: "Einladung gesendet",
        description: data.emailSent
          ? `Einladung als ${roleLabel} an ${newMemberEmail} gesendet.`
          : `Einladung als ${roleLabel} erstellt. E-Mail konnte nicht gesendet werden.`,
      })

      setNewMemberEmail("")
      setNewMemberRole("co-creator")
      setDialogError(null)
      setIsDialogOpen(false)
      await loadMembers()
    } catch (error) {
      console.error("Fehler beim Einladen des Mitglieds:", error)
      setDialogError(error instanceof Error ? error.message : "Unbekannter Fehler")
    } finally {
      setIsAddingMember(false)
    }
  }

  /** Einladungs-E-Mail erneut senden (nur fuer pending Members) */
  async function handleResendInvite(email: string) {
    setResendingEmail(email)

    try {
      const response = await fetch(`/api/libraries/${libraryId}/members`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Fehler beim erneuten Senden")
      }

      toast({
        title: "Einladung erneut gesendet",
        description: data.message,
      })

      await loadMembers()
    } catch (err) {
      console.error("Fehler beim erneuten Senden:", err)
      toast({
        title: "Fehler",
        description: err instanceof Error ? err.message : "Unbekannter Fehler",
        variant: "destructive",
      })
    } finally {
      setResendingEmail(null)
    }
  }

  async function handleRemoveMember(email: string, memberStatus?: string) {
    const label = memberStatus === 'pending' ? 'die Einladung zurueckziehen' : 'das Mitglied entfernen'
    if (!confirm(`Moechten Sie ${label} fuer ${email}?`)) {
      return
    }

    setRemovingEmail(email)

    try {
      const url = `/api/libraries/${libraryId}/members?email=${encodeURIComponent(email)}`

      const response = await fetch(url, { method: "DELETE" })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Fehler beim Entfernen des Mitglieds")
      }

      toast({
        title: "Erfolg",
        description: memberStatus === 'pending'
          ? `Einladung fuer ${email} wurde zurueckgezogen.`
          : `Mitglied ${email} wurde entfernt.`,
      })

      await loadMembers()
    } catch (error) {
      console.error("Fehler beim Entfernen des Mitglieds:", error)
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      })
    } finally {
      setRemovingEmail(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      {/* Invite Member Button */}
      <div className="flex justify-end">
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (open) setDialogError(null); }}>
          <DialogTrigger asChild>
            <Button>
              <Mail className="h-4 w-4 mr-2" />
              Mitglied einladen
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mitglied einladen</DialogTitle>
              <DialogDescription>
                Die eingeladene Person erhaelt eine E-Mail mit einem Bestaetigungslink.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="member-email">E-Mail-Adresse *</Label>
                <Input
                  id="member-email"
                  type="email"
                  placeholder="benutzer@example.com"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  disabled={isAddingMember}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="member-role">Rolle *</Label>
                <Select
                  value={newMemberRole}
                  onValueChange={(val) => setNewMemberRole(val as LibraryRole)}
                  disabled={isAddingMember}
                >
                  <SelectTrigger id="member-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="co-creator">
                      <div className="flex flex-col">
                        <span className="font-medium">Co-Creator</span>
                        <span className="text-xs text-muted-foreground">
                          Voller Arbeitszugriff (Archiv, Explore, Story, Templates)
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="moderator">
                      <div className="flex flex-col">
                        <span className="font-medium">Moderator</span>
                        <span className="text-xs text-muted-foreground">
                          Zugriffsanfragen verwalten und Einladungen senden
                        </span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Fehlermeldung direkt im Dialog */}
            {dialogError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{dialogError}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isAddingMember}
              >
                Abbrechen
              </Button>
              <Button onClick={handleInviteMember} disabled={isAddingMember || !newMemberEmail}>
                {isAddingMember ? (
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
      </div>

      {/* Members Table */}
      {members.length === 0 ? (
        <Alert>
          <AlertDescription>
            Keine Mitglieder vorhanden. Laden Sie Co-Creators oder Moderatoren ein.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-Mail</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Eingeladen am</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={`${member.libraryId}-${member.userEmail}`}>
                  <TableCell className="font-medium">{member.userEmail}</TableCell>
                  <TableCell>
                    {member.role === 'co-creator' ? (
                      <Badge variant="default" className="bg-blue-600">
                        <Users className="h-3 w-3 mr-1" />
                        Co-Creator
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <Shield className="h-3 w-3 mr-1" />
                        Moderator
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {member.status === 'active' ? (
                      <Badge variant="default" className="bg-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Aktiv
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <Clock className="h-3 w-3 mr-1" />
                        Ausstehend
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(member.addedAt).toLocaleDateString('de-DE', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {/* Erneut senden - nur fuer pending Mitglieder */}
                    {member.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResendInvite(member.userEmail)}
                        disabled={resendingEmail === member.userEmail}
                      >
                        {resendingEmail === member.userEmail ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Mail className="h-4 w-4 mr-1" />
                            Erneut senden
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleRemoveMember(member.userEmail, member.status)}
                      disabled={removingEmail === member.userEmail}
                    >
                      {removingEmail === member.userEmail ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-1" />
                          {member.status === 'pending' ? 'Zurueckziehen' : 'Entfernen'}
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
