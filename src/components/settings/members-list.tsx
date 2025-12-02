/**
 * @fileoverview Members List Component
 * 
 * @description
 * Component for displaying and managing library members (moderators).
 * Allows owners to add and remove moderators.
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
import { Loader2, UserPlus, Trash2, Shield } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import type { LibraryMember } from "@/types/library-members"

interface MembersListProps {
  libraryId: string
}

/**
 * Komponente für Liste der Library-Mitglieder (Moderatoren)
 */
export function MembersList({ libraryId }: MembersListProps) {
  const { toast } = useToast()
  const [members, setMembers] = useState<LibraryMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAddingMember, setIsAddingMember] = useState(false)
  const [newMemberEmail, setNewMemberEmail] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [removingEmail, setRemovingEmail] = useState<string | null>(null)

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

  async function handleAddMember() {
    if (!newMemberEmail || !newMemberEmail.includes("@")) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
        variant: "destructive",
      })
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
          role: "moderator",
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Fehler beim Hinzufügen des Moderators")
      }

      toast({
        title: "Erfolg",
        description: `Moderator ${newMemberEmail} wurde erfolgreich hinzugefügt.`,
      })

      setNewMemberEmail("")
      setIsDialogOpen(false)
      await loadMembers()
    } catch (error) {
      console.error("Fehler beim Hinzufügen des Moderators:", error)
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      })
    } finally {
      setIsAddingMember(false)
    }
  }

  async function handleRemoveMember(email: string) {
    if (!confirm(`Möchten Sie ${email} wirklich als Moderator entfernen?`)) {
      return
    }

    setRemovingEmail(email)

    try {
      const url = `/api/libraries/${libraryId}/members?email=${encodeURIComponent(email)}`
      console.log('[MembersList] Entferne Moderator:', { libraryId, email, url })

      const response = await fetch(url, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('[MembersList] Fehler beim Entfernen:', { status: response.status, data })
        throw new Error(data.error || "Fehler beim Entfernen des Moderators")
      }

      console.log('[MembersList] Moderator erfolgreich entfernt:', data)

      toast({
        title: "Erfolg",
        description: `Moderator ${email} wurde erfolgreich entfernt.`,
      })

      await loadMembers()
    } catch (error) {
      console.error("Fehler beim Entfernen des Moderators:", error)
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
      {/* Add Member Button */}
      <div className="flex justify-end">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Moderator hinzufügen
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Moderator hinzufügen</DialogTitle>
              <DialogDescription>
                Fügen Sie einen Moderator zu dieser Library hinzu. Moderatoren können Zugriffsanfragen verwalten und Einladungen versenden.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="member-email">E-Mail-Adresse *</Label>
                <Input
                  id="member-email"
                  type="email"
                  placeholder="moderator@example.com"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  disabled={isAddingMember}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isAddingMember}
              >
                Abbrechen
              </Button>
              <Button onClick={handleAddMember} disabled={isAddingMember || !newMemberEmail}>
                {isAddingMember ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Wird hinzugefügt...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    Moderator hinzufügen
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
            Keine Moderatoren vorhanden. Fügen Sie einen Moderator hinzu, um Zugriffsanfragen zu verwalten.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-Mail</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead>Hinzugefügt am</TableHead>
                <TableHead>Hinzugefügt von</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={`${member.libraryId}-${member.userEmail}`}>
                  <TableCell className="font-medium">{member.userEmail}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      <Shield className="h-3 w-3 mr-1" />
                      {member.role === 'moderator' ? 'Moderator' : member.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(member.addedAt).toLocaleDateString('de-DE', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {member.addedBy}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleRemoveMember(member.userEmail)}
                      disabled={removingEmail === member.userEmail}
                    >
                      {removingEmail === member.userEmail ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-1" />
                          Entfernen
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

