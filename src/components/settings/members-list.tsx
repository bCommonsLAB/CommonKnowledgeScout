/**
 * @fileoverview Members List Component
 * 
 * @description
 * Component for displaying and managing library members (co-creators, moderators).
 * Allows owners to invite and remove members. Zeigt den Einladungsstatus
 * (ausstehend/aktiv) und ermoeglicht erneutes Senden.
 * 
 * Alle API-Aktionen und State-Verwaltung sind in useMembersActions extrahiert.
 * 
 * @module settings
 */

"use client"

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
import type { LibraryRole } from "@/types/library-members"
import { useMembersActions } from "@/components/settings/hooks/use-members-actions"

interface MembersListProps {
  libraryId: string
}

/**
 * Komponente fuer Liste der Library-Mitglieder mit Einladungsflow.
 * Delegiert API-Logik an useMembersActions.
 */
export function MembersList({ libraryId }: MembersListProps) {
  const {
    members,
    loading,
    error,
    isDialogOpen,
    setIsDialogOpen,
    newMemberEmail,
    setNewMemberEmail,
    newMemberRole,
    setNewMemberRole,
    dialogError,
    isAddingMember,
    handleInviteMember,
    resendingEmail,
    handleResendInvite,
    removingEmail,
    handleRemoveMember,
  } = useMembersActions({ libraryId })

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
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); }}>
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
