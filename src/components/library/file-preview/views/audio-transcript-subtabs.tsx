'use client'

/**
 * Reiter „Transkript" der Audio-Vorschau mit Unter-Reitern: „Text" (das
 * Transkript wie bisher) und „Korrektur" (Satz fuer Satz lesen, anhoeren,
 * korrigieren). Die Haupt-Reiter bleiben den Phasen vorbehalten (Owner
 * 10.10.2026: Korrektur gehoert zur Phase Transkript, nicht daneben).
 */

import * as React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ks/ui'
import { FileText, ListChecks } from 'lucide-react'

interface Props {
  /** Das bisherige Transkript-Panel. */
  text: React.ReactNode
  /** Die Korrektur-Ansicht; null, solange es kein Transkript gibt (Unter-Reiter ausgeblendet). */
  korrektur: React.ReactNode | null
}

export type TranskriptUnterReiter = 'text' | 'korrektur'

export function AudioTranscriptSubtabs({ text, korrektur }: Props) {
  const [ansicht, setAnsicht] = React.useState<TranskriptUnterReiter>('text')
  if (korrektur === null) return <>{text}</>
  return (
    <Tabs value={ansicht} onValueChange={(v) => setAnsicht(v === 'korrektur' ? 'korrektur' : 'text')} className="flex h-full min-h-0 flex-col gap-2">
      <TabsList className="w-fit">
        <TabsTrigger value="text" className="px-2 py-1 text-xs"><FileText className="mr-1 h-3.5 w-3.5" /> Text</TabsTrigger>
        <TabsTrigger value="korrektur" className="px-2 py-1 text-xs"><ListChecks className="mr-1 h-3.5 w-3.5" /> Korrektur</TabsTrigger>
      </TabsList>
      <TabsContent value="text" className="mt-0 min-h-0 flex-1 overflow-hidden">{text}</TabsContent>
      {/* Nur rendern, wenn sichtbar: die Korrektur laedt Saetze und Audio erst beim Oeffnen. */}
      <TabsContent value="korrektur" className="mt-0 min-h-0 flex-1 overflow-hidden">{ansicht === 'korrektur' ? korrektur : null}</TabsContent>
    </Tabs>
  )
}
