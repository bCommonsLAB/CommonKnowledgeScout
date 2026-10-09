'use client'

/**
 * Der Perspektiv-Dialog aus `@ks/module-story` in der App (09.10.2026).
 *
 * Die App stellt Sprache und Modell zur Wahl und legt die Perspektive dort
 * ab, wo sie schon immer lag: in den Story-Atomen und im localStorage
 * (`saveStoryContextToLocalStorage` setzt auch das Flag „Perspektive
 * gewaehlt"), angemeldet zusaetzlich im Profil (`onProfil`). Montiert nur,
 * solange der Dialog offen ist — `useStoryContext` prueft beim Mount das
 * Modell gegen die Instanz.
 */

import { useEffect, useMemo } from 'react'
import { useUser } from '@clerk/nextjs'
import { useLlmModels } from '@ks/api-client'
import { useTranslation } from '@ks/i18n/react'
import { PerspektiveDialog, sprachenSortiert, type PerspektivWahl } from '@ks/module-story/react'
import { saveStoryContextToLocalStorage, useStoryContext } from '@/hooks/use-story-context'

export interface PerspektiveDialogAppProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Legt die Wahl im Profil ab (angemeldet; `useProfilPerspektive`). */
  onProfil: (wahl: PerspektivWahl) => void
}

export function PerspektiveDialogApp({ open, onOpenChange, onProfil }: PerspektiveDialogAppProps) {
  const { locale } = useTranslation()
  const { isSignedIn } = useUser()
  const ctx = useStoryContext()
  const modelle = useLlmModels('public')

  useEffect(() => {
    // Ohne Liste zeigt der Abschnitt „Keine Modelle verfuegbar"; der Grund gehoert in die Konsole.
    if (modelle.error) console.error('[PerspektiveDialogApp] Sprachmodelle nicht ladbar', modelle.error)
  }, [modelle.error])

  const wert = useMemo<PerspektivWahl>(
    () => ({
      targetLanguage: ctx.targetLanguage,
      character: ctx.character,
      accessPerspective: ctx.accessPerspective,
      socialContext: ctx.socialContext,
      llmModel: ctx.llmModel ?? '',
    }),
    [ctx.targetLanguage, ctx.character, ctx.accessPerspective, ctx.socialContext, ctx.llmModel],
  )
  const sprachen = useMemo(() => sprachenSortiert(locale, ctx.targetLanguageLabels), [locale, ctx.targetLanguageLabels])

  function speichern(wahl: PerspektivWahl) {
    ctx.setTargetLanguage(wahl.targetLanguage)
    ctx.setCharacter(wahl.character)
    ctx.setAccessPerspective(wahl.accessPerspective)
    ctx.setSocialContext(wahl.socialContext)
    ctx.setLlmModel(wahl.llmModel)
    saveStoryContextToLocalStorage(wahl.targetLanguage, wahl.character, wahl.socialContext, wahl.accessPerspective, wahl.llmModel, !isSignedIn)
    onProfil(wahl)
  }

  return (
    <PerspektiveDialog
      open={open}
      onOpenChange={onOpenChange}
      wert={wert}
      onSpeichern={speichern}
      sprachwahl={{ sprachen, labels: ctx.targetLanguageLabels }}
      modellwahl={{ modelle: modelle.data ?? [], laedt: modelle.isLoading }}
    />
  )
}
