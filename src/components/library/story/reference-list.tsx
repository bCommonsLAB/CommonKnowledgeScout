"use client"

/**
 * Die Anhang-Liste der Voll-App (Session-Ansicht).
 *
 * Die Komponente liegt seit M5 als `AttachmentList` im Paket
 * (`@ks/module-explorer/react`), weil die Buch-Ansicht des Embeds sie braucht.
 * Hier kommt nur hinzu, womit die App Bilder rendert: `next/image`.
 */

import type { ComponentProps } from "react"
import { AttachmentList } from "@ks/module-explorer/react"
import { NextBild } from "@/components/providers/next-bild"

type ReferenceListProps = Omit<ComponentProps<typeof AttachmentList>, "Bild">

export function ReferenceList(props: ReferenceListProps) {
  return <AttachmentList {...props} Bild={NextBild} />
}

export default ReferenceList
