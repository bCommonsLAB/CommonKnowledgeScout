"use client"

/**
 * ConfirmActionDialog — einheitliche Bestaetigung fuer destruktive
 * oder folgenreiche Aktionen (Welle 3-IV-UX-3d, D3/D6).
 *
 * Ersetzt die frueheren window.confirm()-Aufrufe durch das
 * Design-System-Muster (Vorbild: Loesch-Dialog der Bibliothek).
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ConfirmActionDialogProps {
  /** Ausloesendes Element (Button) — wird als asChild-Trigger gerendert */
  trigger: React.ReactNode
  title: string
  description: React.ReactNode
  /** Beschriftung der Bestaetigungs-Aktion (Default: "Fortfahren") */
  confirmLabel?: string
  /** Rotes Styling fuer unwiderrufliche Aktionen */
  destructive?: boolean
  onConfirm: () => void
}

export function ConfirmActionDialog({
  trigger,
  title,
  description,
  confirmLabel = "Fortfahren",
  destructive = false,
  onConfirm,
}: ConfirmActionDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            className={cn(destructive && buttonVariants({ variant: "destructive" }))}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
