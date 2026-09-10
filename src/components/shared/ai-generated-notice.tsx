'use client'

/**
 * Der KI-Hinweis der Voll-App (EU AI Act Art. 50-53).
 *
 * Die Komponente liegt seit M5 im Paket (`@ks/module-explorer/react`), weil die
 * Buch-Ansicht des Embeds sie braucht. Hier kommt nur hinzu, was die App anders
 * macht: `next/link` auf ihre eigene Route der rechtlichen Hinweise. Die neun
 * Aufrufstellen (Detailansichten, Story, Chat) importieren weiter von hier.
 */

import type { ComponentProps } from "react"
import Link from "next/link"
import { AIGeneratedNotice as PaketHinweis, type HinweisLinkProps } from "@ks/module-explorer/react"

function AppLink({ href, className, children }: HinweisLinkProps) {
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}

type AIGeneratedNoticeProps = Omit<ComponentProps<typeof PaketHinweis>, "hinweisHref" | "Link">

export function AIGeneratedNotice(props: AIGeneratedNoticeProps) {
  return <PaketHinweis {...props} hinweisHref="/info?type=rechtliche-hinweise" Link={AppLink} />
}
