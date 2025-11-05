"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  TARGET_LANGUAGE_VALUES,
  TARGET_LANGUAGE_LABELS,
  TARGET_LANGUAGE_DEFAULT,
  CHARACTER_VALUES,
  CHARACTER_LABELS,
  CHARACTER_DEFAULT,
  SOCIAL_CONTEXT_VALUES,
  SOCIAL_CONTEXT_LABELS,
  SOCIAL_CONTEXT_DEFAULT,
  GENDER_INCLUSIVE_DEFAULT,
  type TargetLanguage,
  type Character,
  type SocialContext,
} from '@/lib/chat/constants'
import { BookOpen, X } from 'lucide-react'

interface ChatWelcomeAssistantProps {
  libraryId: string
  initialTargetLanguage?: TargetLanguage
  initialCharacter?: Character
  initialSocialContext?: SocialContext
  initialGenderInclusive?: boolean
  onSettingsConfirm: (settings: {
    targetLanguage: TargetLanguage
    character: Character
    socialContext: SocialContext
    genderInclusive: boolean
  }) => Promise<void>
  onGenerateTOC: () => void
  onDismiss?: () => void
}

/**
 * Begrüßungs-Assistent für neue Chats.
 * Zeigt eine Karte mit Auswahlmöglichkeiten für Zielsprache, Charakter und sozialen Kontext.
 * Bietet Option zur Generierung eines Inhaltsverzeichnisses.
 */
export function ChatWelcomeAssistant({
  libraryId,
  initialTargetLanguage = TARGET_LANGUAGE_DEFAULT,
  initialCharacter = CHARACTER_DEFAULT,
  initialSocialContext = SOCIAL_CONTEXT_DEFAULT,
  initialGenderInclusive = GENDER_INCLUSIVE_DEFAULT,
  onSettingsConfirm,
  onGenerateTOC,
  onDismiss,
}: ChatWelcomeAssistantProps) {
  console.log('[ChatWelcomeAssistant] Rendering with props:', {
    libraryId,
    initialTargetLanguage,
    initialCharacter,
    initialSocialContext,
    initialGenderInclusive,
  })
  const [targetLanguage, setTargetLanguage] = useState<TargetLanguage>(initialTargetLanguage)
  const [character, setCharacter] = useState<Character>(initialCharacter)
  const [socialContext, setSocialContext] = useState<SocialContext>(initialSocialContext)
  const [genderInclusive, setGenderInclusive] = useState<boolean>(initialGenderInclusive)
  const [isSaving, setIsSaving] = useState(false)

  async function handleConfirm() {
    setIsSaving(true)
    try {
      await onSettingsConfirm({
        targetLanguage,
        character,
        socialContext,
        genderInclusive,
      })
    } finally {
      setIsSaving(false)
    }
  }

  function handleGenerateTOC() {
    if (isSaving) return // Verhindere doppelte Ausführung
    setIsSaving(true)
    // Speichere Einstellungen und starte dann sofort die TOC-Generierung
    handleConfirm().then(() => {
      // Starte TOC-Generierung direkt (ohne Timeouts)
      onGenerateTOC()
    }).catch(() => {
      // Fehler bereits in handleConfirm behandelt
    }).finally(() => {
      setIsSaving(false)
    })
  }

  return (
    <Card className="mb-4 border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 rounded-full bg-muted p-1.5">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base font-medium">Chat-Assistent</CardTitle>
              <CardDescription className="mt-0.5 text-xs">
                Wähle deine bevorzugten Einstellungen für den Chat
              </CardDescription>
            </div>
          </div>
          {onDismiss && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onDismiss}
              aria-label="Schließen"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {/* Zielsprache */}
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Zielsprache</div>
          <div className="flex flex-wrap gap-1.5">
            {TARGET_LANGUAGE_VALUES.map((lang) => (
              <Button
                key={lang}
                type="button"
                size="sm"
                variant={targetLanguage === lang ? 'secondary' : 'outline'}
                onClick={() => setTargetLanguage(lang)}
                className="h-7 text-xs"
              >
                {TARGET_LANGUAGE_LABELS[lang]}
              </Button>
            ))}
          </div>
        </div>

        {/* Charakter */}
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Charakter / Perspektive</div>
          <div className="flex flex-wrap gap-1.5">
            {CHARACTER_VALUES.map((char) => (
              <Button
                key={char}
                type="button"
                size="sm"
                variant={character === char ? 'secondary' : 'ghost'}
                onClick={() => setCharacter(char)}
                className="h-7 text-xs"
              >
                {CHARACTER_LABELS[char]}
              </Button>
            ))}
          </div>
        </div>

        {/* Sozialer Kontext */}
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Sozialer Kontext / Sprachebene</div>
          <div className="flex flex-wrap gap-1.5">
            {SOCIAL_CONTEXT_VALUES.map((ctx) => (
              <Button
                key={ctx}
                type="button"
                size="sm"
                variant={socialContext === ctx ? 'secondary' : 'outline'}
                onClick={() => setSocialContext(ctx)}
                className="h-7 text-xs"
              >
                {SOCIAL_CONTEXT_LABELS[ctx]}
              </Button>
            ))}
          </div>
        </div>

        {/* Gendergerechte Formulierung */}
        <div className="flex items-center justify-between rounded-md border p-2.5">
          <div className="space-y-0.5">
            <div className="text-xs font-medium">Gendergerechte Formulierung</div>
            <div className="text-xs text-muted-foreground">
              Verwende geschlechtsneutrale Formulierungen in den Antworten
            </div>
          </div>
          <Switch
            checked={genderInclusive}
            onCheckedChange={setGenderInclusive}
            disabled={isSaving}
          />
        </div>

        {/* Aktionen */}
        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            onClick={() => {
              if (!isSaving) {
                handleGenerateTOC()
              }
            }}
            disabled={isSaving}
            variant="default"
            size="sm"
            className="flex-1 h-8 text-xs"
          >
            <BookOpen className="mr-1.5 h-3.5 w-3.5" />
            Inhaltsverzeichnis generieren
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleConfirm}
            disabled={isSaving}
            className="h-8 text-xs"
          >
            {isSaving ? 'Speichere...' : 'Bestätigen'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

