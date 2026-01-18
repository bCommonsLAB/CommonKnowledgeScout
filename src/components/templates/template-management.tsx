"use client"

import { useState, useEffect, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { StructuredTemplateEditor } from "@/components/templates/structured-template-editor"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Save, Eye, Play, FolderOpen, Info, Upload, Download } from "lucide-react"
import { useAtom, useAtomValue } from "jotai"
import { activeLibraryAtom, libraryStatusAtom } from "@/atoms/library-atom"
import { useUser } from "@clerk/nextjs"
import { 
  templatesAtom, 
  selectedTemplateNameAtom, 
  selectedTemplateAtom,
  templatesFolderIdAtom,
  templateLoadingAtom,
  templateErrorAtom,
  type Template
} from "@/atoms/template-atom"
import { useStorage } from "@/contexts/storage-context"
import { templateContextDocsAtom } from '@/atoms/template-context-atom'
import { useRootItems } from '@/hooks/use-root-items'
import { Checkbox } from "@/components/ui/checkbox"
import { MarkdownPreview } from "@/components/library/markdown-preview"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { JobReportTab } from "@/components/library/job-report-tab"
import { Textarea } from "@/components/ui/textarea"
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { TemplateCreationConfig, TemplateMetadataSchema } from '@/lib/templates/template-types'
import { injectCreationIntoFrontmatter } from '@/lib/templates/template-frontmatter-utils'
// Separator ungenutzt entfernt

// Schema für Template-Daten (strukturiert, ohne Frontmatter-String)
const templateSchema = z.object({
  name: z.string().min(1, "Prompt-Name ist erforderlich"),
  metadata: z.custom<TemplateMetadataSchema>(),
  markdownBody: z.string(),
  systemprompt: z.string(),
  creation: z.custom<TemplateCreationConfig | null | undefined>().optional(),
})

type TemplateFormValues = z.infer<typeof templateSchema>

export function TemplateManagement() {
  const [previewMode, setPreviewMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [selectedContextIds, setSelectedContextIds] = useState<string[]>([])
  const [selectedContextMarkdown, setSelectedContextMarkdown] = useState<string>("")
  const [rightTab, setRightTab] = useState<'kontext'|'preview'|'testen'>('kontext')
  const [resultSavedItemId, setResultSavedItemId] = useState<string | null>(null)
  const [freeText, setFreeText] = useState<string>("")
  // Lokaler State, um Änderungen zu verfolgen, da React Hook Form verschachtelte Objekte nicht immer korrekt erkennt
  const [hasChanges, setHasChanges] = useState(false)
  // State für Validierungsfehler-Dialog
  const [validationError, setValidationError] = useState<string | null>(null)
  // Magic Design
  const [magicMode, setMagicMode] = useState<boolean>(false)
  const [magicBody, setMagicBody] = useState<string>("")
  const [magicFrontmatter, setMagicFrontmatter] = useState<string>("")
  const [magicSystem, setMagicSystem] = useState<string>("")
  const [magicRunning, setMagicRunning] = useState<boolean>(false)
  // Dialog-UI: Test-Umgebung vom Editor trennen, damit der Editor volle Breite nutzen kann
  const [isTestDialogOpen, setIsTestDialogOpen] = useState<boolean>(false)
  // Magic-Diff/SavedId aktuell ungenutzt im UI – wir speichern nur per Setter
  const [, setMagicLastDiff] = useState<string>("")
  const [, setMagicSavedItemId] = useState<string | null>(null)
  const { toast } = useToast()

  // Atoms
  const [templates, setTemplates] = useAtom(templatesAtom)
  const [selectedTemplateName, setSelectedTemplateName] = useAtom(selectedTemplateNameAtom)
  // Diese Atome werden aktuell nicht verwendet, aber für zukünftige Verwendung bereitgehalten
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_unused_selectedTemplate] = useAtom(selectedTemplateAtom)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_unused_templatesFolderId, _unused_setTemplatesFolderId] = useAtom(templatesFolderIdAtom)
  const [isLoading, setIsLoading] = useAtom(templateLoadingAtom)
  const [error, setError] = useAtom(templateErrorAtom)

  // Library und Storage
  const activeLibrary = useAtomValue(activeLibraryAtom)
  const libraryStatus = useAtomValue(libraryStatusAtom)
  const { 
    provider: providerInstance, 
    listItems
  } = useStorage()
  const getRootItems = useRootItems()
  const contextDocs = useAtomValue(templateContextDocsAtom)
  const { user } = useUser()
  const userEmail = user?.emailAddresses?.[0]?.emailAddress || null

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: "",
      metadata: {
        fields: [
          { key: 'title', variable: 'title', description: 'Titel des Dokuments', rawValue: '{{title|Titel des Dokuments}}' },
          { key: 'tags', variable: 'tags', description: 'Relevante Tags', rawValue: '{{tags|Relevante Tags}}' },
          { key: 'date', variable: 'date', description: 'Datum im Format yyyy-mm-dd', rawValue: '{{date|Datum im Format yyyy-mm-dd}}' },
        ],
        rawFrontmatter: ''
      },
      markdownBody: `# {{title}}

## Zusammenfassung
{{summary|Kurze Zusammenfassung des Inhalts}}

## Details
{{details|Detaillierte Beschreibung}}`,
      systemprompt: `You are a specialized assistant that processes and structures information clearly and concisely.

IMPORTANT: Your response must be a valid JSON object where each key corresponds to a template variable.`,
      creation: null,
    },
  })

  // Template-Daten laden wenn sich die Auswahl ändert
  useEffect(() => {
    if (selectedTemplateName) {
      const template = templates.find(t => t.name === selectedTemplateName)
      if (template) {
        form.reset({
          name: template.name,
          metadata: template.metadata,
          markdownBody: template.markdownBody,
          systemprompt: template.systemprompt,
          creation: template.creation || null,
        })
        setHasChanges(false) // Reset hasChanges beim Laden eines neuen Templates
      }
    }
  }, [selectedTemplateName, templates, form])

  // Ordner-Erstellung/Suche memoisiert, damit als Dep verwendbar
  const ensureTemplatesFolder = useCallback(async (): Promise<string> => {
    if (!providerInstance || !activeLibrary) {
      throw new Error("Keine aktive Bibliothek oder Provider verfügbar");
    }

    try {
      console.log('[TemplateManagement] Suche nach Templates-Ordner...');
      // Verwende zentrale Template-Service Library
      const { ensureTemplatesFolderId } = await import('@/lib/templates/template-service')
      const templatesFolderId = await ensureTemplatesFolderId(providerInstance)
      console.log('[TemplateManagement] Templates-Ordner gefunden/erstellt:', templatesFolderId);
      return templatesFolderId;
    } catch (error) {
      console.error('Fehler beim Erstellen des Templates-Ordners:', {
        error: error instanceof Error ? {
          message: error.message,
          name: error.name,
          stack: error.stack?.split('\n').slice(0, 3)
        } : error,
        libraryId: activeLibrary?.id,
        libraryPath: activeLibrary?.path,
        providerName: providerInstance?.name
      });
      let errorMessage = 'Fehler beim Erstellen des Templates-Ordners';
      if (error instanceof Error) {
        if (error.message.includes('Nicht authentifiziert')) {
          errorMessage = 'Bitte authentifizieren Sie sich bei Ihrem Cloud-Speicher, um den Templates-Ordner zu erstellen.';
        } else if (error.message.includes('Keine Berechtigung')) {
          errorMessage = 'Keine Berechtigung zum Erstellen von Ordnern in der Bibliothek.';
        } else if (error.message.includes('Bibliothek nicht gefunden')) {
          errorMessage = 'Die ausgewählte Bibliothek wurde nicht gefunden.';
        } else {
          errorMessage = `Fehler beim Erstellen des Templates-Ordners: ${error.message}`;
        }
      }
      throw new Error(errorMessage);
    }
  }, [providerInstance, activeLibrary]);

  // Templates aus MongoDB laden
  const loadTemplates = useCallback(async () => {
    if (libraryStatus !== 'ready' || !activeLibrary || !userEmail) {
      console.log('[TemplateManagement] loadTemplates übersprungen:', {
        libraryStatus,
        hasActiveLibrary: !!activeLibrary,
        hasUserEmail: !!userEmail
      });
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('[TemplateManagement] Starte Prompt-Loading aus MongoDB:', {
        libraryId: activeLibrary.id,
        userEmail
      });

      // MongoDB API-Call
      const response = await fetch(`/api/templates?libraryId=${encodeURIComponent(activeLibrary.id)}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const mongoTemplates = data.templates || [];

      // Konvertiere MongoDB Templates direkt zu Template-Format (ohne Frontmatter-String)
      const convertedTemplates: Template[] = mongoTemplates.map((t: {
        _id: string;
        name: string;
        libraryId: string;
        user: string;
        metadata: { fields: Array<{ key: string; variable: string; description: string; rawValue: string }>; rawFrontmatter: string };
        systemprompt: string;
        markdownBody: string;
        creation?: TemplateCreationConfig | null;
        createdAt?: Date | string;
        updatedAt: Date | string;
        version?: number;
      }) => {
        return {
          _id: t._id,
          name: t.name,
          libraryId: t.libraryId,
          user: t.user,
          metadata: t.metadata,
          systemprompt: t.systemprompt,
          markdownBody: t.markdownBody,
          creation: t.creation || null,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          version: t.version,
          // Legacy-Felder für Kompatibilität
          fileId: t._id,
          lastModified: typeof t.updatedAt === 'string' ? t.updatedAt : t.updatedAt.toISOString(),
        } as Template;
      });
      
      setTemplates(convertedTemplates);
      
      console.log('[TemplateManagement] Prompts erfolgreich geladen:', convertedTemplates.length);
      
      if (convertedTemplates.length === 0) {
        toast({
          title: "Keine Prompts gefunden",
          description: "Erstellen Sie Ihren ersten Prompt oder importieren Sie einen aus dem Storage.",
        });
      }
    } catch (error) {
      console.error('Fehler beim Laden der Prompts:', error);
      
      let errorMessage = 'Unbekannter Fehler beim Laden der Prompts';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      toast({
        title: "Fehler beim Laden der Prompts",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [libraryStatus, activeLibrary, userEmail, setTemplates, setIsLoading, setError, toast]);

  // Effect für Template Loading
  useEffect(() => {
    const isReady = libraryStatus === 'ready' && activeLibrary && userEmail
    
    if (!isReady) {
      return
    }

    // Templates laden
    loadTemplates()
  }, [libraryStatus, activeLibrary, userEmail, loadTemplates])

  // Reset wenn sich die Library ändert
  useEffect(() => {
    setSelectedTemplateName(null)
    setTemplates([])
    setError(null)
  }, [libraryStatus, setSelectedTemplateName, setTemplates, setError])

  useEffect(() => {
    async function loadSelectedContext() {
      if (!providerInstance || !Array.isArray(selectedContextIds) || selectedContextIds.length === 0) {
        setSelectedContextMarkdown("")
        return
      }
      try {
        const parts: string[] = []
        for (const id of selectedContextIds) {
          const { blob } = await providerInstance.getBinary(id)
          const text = await blob.text()
          const name = Array.isArray(contextDocs) ? (contextDocs.find(d => d.id === id)?.name || id) : id
          const section = `\n\n---\nDatei: ${name}\n---\n\n${text}\n\n---\nEnde Datei: ${name}\n---\n`
          parts.push(section)
        }
        setSelectedContextMarkdown(parts.join("\n\n"))
      } catch (e) {
        console.error('Fehler beim Laden des Kontextes', e)
        setSelectedContextMarkdown("")
      }
    }
    void loadSelectedContext()
  }, [providerInstance, selectedContextIds, contextDocs])

  function generateTemplateContent(values: TemplateFormValues): string {
    // Generiere Frontmatter aus metadata
    const frontmatterLines: string[] = []
    for (const field of values.metadata.fields) {
      frontmatterLines.push(`${field.key}: ${field.rawValue || `{{${field.variable}|${field.description}}}`}`)
    }
    
    // Füge creation-Block hinzu, falls vorhanden
    let frontmatter = `---\n${frontmatterLines.join('\n')}\n---`
    if (values.creation) {
      frontmatter = injectCreationIntoFrontmatter(frontmatter, values.creation)
    }
    
    // Kombiniere Frontmatter, Body und Systemprompt
    let content = frontmatter + '\n\n' + values.markdownBody
    if (values.systemprompt.trim()) {
      content += '\n\n--- systemprompt\n' + values.systemprompt
    }
    
    return content
  }

  async function onSubmit(data: TemplateFormValues) {
    console.log('[TemplateManagement] onSubmit aufgerufen', { 
      hasActiveLibrary: !!activeLibrary, 
      hasUserEmail: !!userEmail,
      templateName: data.name,
      hasCreation: !!data.creation,
      creationUI: data.creation?.ui,
      activeLibraryId: activeLibrary?.id,
      userEmailValue: userEmail
    })
    
    if (!activeLibrary || !userEmail) {
      console.log('[TemplateManagement] Fehler: Keine Library oder User', { 
        activeLibrary: !!activeLibrary, 
        userEmail: !!userEmail 
      })
      toast({
        title: "Fehler",
        description: "Keine aktive Bibliothek oder Benutzer nicht authentifiziert.",
        variant: "destructive",
      })
      return
    }
    
    console.log('[TemplateManagement] Validierung startet...', {
      hasCreation: !!data.creation,
      hasFlow: !!data.creation?.flow,
      hasSteps: !!data.creation?.flow?.steps,
      stepsCount: data.creation?.flow?.steps?.length || 0,
      metadataFieldsCount: data.metadata.fields.length
    })

    try {
      // Validierung: Prüfe, ob alle referenzierten Felder in den Metadaten existieren
      if (data.creation?.flow?.steps) {
      console.log('[TemplateManagement] Prüfe Creation Flow Steps...', {
        stepsCount: data.creation.flow.steps.length,
        metadataFields: data.metadata.fields.map(f => f.key)
      })
      
      const availableFieldKeys = new Set(data.metadata.fields.map(f => f.key))
      const invalidFields: Array<{ stepId: string; stepTitle?: string; fields: string[] }> = []
      
      for (const step of data.creation.flow.steps) {
        console.log('[TemplateManagement] Prüfe Step:', {
          stepId: step.id,
          preset: step.preset,
          hasFields: !!step.fields,
          fields: step.fields
        })
        
        if (step.preset === 'editDraft' && step.fields) {
          const missingFields = step.fields.filter(field => !availableFieldKeys.has(field))
          if (missingFields.length > 0) {
            console.log('[TemplateManagement] Fehlende Felder gefunden:', missingFields)
            invalidFields.push({
              stepId: step.id,
              stepTitle: step.title,
              fields: missingFields
            })
          }
        }
      }
      
      if (invalidFields.length > 0) {
        console.log('[TemplateManagement] Validierungsfehler gefunden:', invalidFields)
        const errorMessages = invalidFields.map(({ stepId, stepTitle, fields }) => 
          `Step "${stepTitle || stepId}": Felder ${fields.map(f => `"${f}"`).join(', ')} existieren nicht in den Metadaten.`
        ).join('\n')
        
        console.log('[TemplateManagement] Zeige Toast mit Validierungsfehler...')
        toast({
          title: "Validierungsfehler",
          description: errorMessages,
          variant: "destructive",
          duration: 10000, // 10 Sekunden anzeigen
        })
        
        // Zusätzlich Alert-Dialog anzeigen, damit der Fehler sicher sichtbar ist
        setValidationError(errorMessages)
        console.log('[TemplateManagement] Toast und Dialog angezeigt, beende Funktion')
        return
      }
      
      console.log('[TemplateManagement] Validierung erfolgreich - keine fehlenden Felder')
      } else {
        console.log('[TemplateManagement] Keine Creation Flow Steps zu validieren')
      }
    } catch (validationError) {
      console.error('[TemplateManagement] Fehler während der Validierung:', validationError)
      toast({
        title: "Validierungsfehler",
        description: validationError instanceof Error ? validationError.message : "Unbekannter Validierungsfehler",
        variant: "destructive",
      })
      return
    }

    console.log('[TemplateManagement] Validierung erfolgreich, starte Speichern...')
    setIsSaving(true)
    try {
      const existing = templates.find(t => t.name.toLowerCase() === data.name.toLowerCase())
      
      console.log('[TemplateManagement] Speichere Template', {
        isUpdate: !!existing,
        templateName: data.name,
        libraryId: activeLibrary.id,
        creation: data.creation
      })
      
      if (existing) {
        // Update bestehendes Template
        const response = await fetch('/api/templates', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateId: data.name,
            libraryId: activeLibrary.id,
            metadata: data.metadata,
            systemprompt: data.systemprompt,
            markdownBody: data.markdownBody,
            creation: data.creation || null,
          }),
        })
        
        console.log('[TemplateManagement] PUT Response', { status: response.status, ok: response.ok })
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `HTTP ${response.status}`)
        }
      } else {
        // Erstelle neues Template
        const response = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.name,
            libraryId: activeLibrary.id,
            metadata: data.metadata,
            systemprompt: data.systemprompt,
            markdownBody: data.markdownBody,
            creation: data.creation || null,
          }),
        })
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `HTTP ${response.status}`)
        }
      }
      
      // Templates neu laden
      await loadTemplates()
      
      // Auswahl auf das Template setzen
      setSelectedTemplateName(data.name)
      form.reset(data, { keepDirty: false })
      setHasChanges(false) // Reset hasChanges nach erfolgreichem Speichern
      
      toast({
        title: "Prompt gespeichert",
        description: `"${data.name}" wurde ${existing ? 'aktualisiert' : 'erstellt'}.`,
      })
    } catch (error) {
      console.error('Fehler beim Speichern des Templates:', error)
      toast({
        title: "Fehler beim Speichern",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function renameCurrentTemplate() {
    if (!selectedTemplateName || !activeLibrary || !userEmail) return
    
    const current = templates.find(t => t.name === selectedTemplateName)
    if (!current) return
    
    const newName = (window.prompt('Neuen Namen eingeben:', current.name) || '').trim()
    if (!newName || newName === current.name) return
    if (/[^a-zA-Z0-9._\- ]/.test(newName)) { 
      toast({ title: 'Ungültiger Name', description: 'Nur Buchstaben, Zahlen, Leerzeichen, . _ - sind erlaubt.', variant: 'destructive' })
      return 
    }
    if (templates.some(t => t.name.toLowerCase() === newName.toLowerCase())) { 
      toast({ title: 'Bereits vorhanden', description: 'Bitte anderen Namen wählen.', variant: 'destructive' })
      return 
    }
    
    try {
      // Lade aktuelles Template aus MongoDB
      const loadResponse = await fetch(`/api/templates?libraryId=${encodeURIComponent(activeLibrary.id)}`)
      if (!loadResponse.ok) throw new Error('Fehler beim Laden des Templates')
      const { templates: allTemplates } = await loadResponse.json()
      const currentTemplate = allTemplates.find((t: { name: string }) => t.name === selectedTemplateName)
      
      if (!currentTemplate) {
        throw new Error('Template nicht gefunden')
      }

      // Erstelle neues Template mit neuem Namen
      const createResponse = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          libraryId: activeLibrary.id,
          metadata: currentTemplate.metadata,
          systemprompt: currentTemplate.systemprompt,
          markdownBody: currentTemplate.markdownBody,
          creation: currentTemplate.creation,
        }),
      })
      
      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${createResponse.status}`)
      }

      // Lösche altes Template
      await deleteTemplate(selectedTemplateName)
      
      await loadTemplates()
      setSelectedTemplateName(newName)
      form.setValue('name', newName, { shouldDirty: false })
      toast({ title: 'Umbenannt', description: `${current.name} → ${newName}` })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
      toast({ title: 'Fehler beim Umbenennen', description: msg, variant: 'destructive' })
    }
  }

  async function deleteTemplate(templateName: string) {
    if (!activeLibrary || !userEmail) return

    try {
      const response = await fetch(`/api/templates?templateId=${encodeURIComponent(templateName)}&libraryId=${encodeURIComponent(activeLibrary.id)}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      // Templates neu laden
      await loadTemplates()
      
      if (selectedTemplateName === templateName) {
        setSelectedTemplateName(null)
        form.reset()
      }
      
      toast({
        title: "Template gelöscht",
        description: `Template "${templateName}" wurde erfolgreich gelöscht.`,
      })
    } catch (error) {
      console.error('Fehler beim Löschen des Templates:', error)
      toast({
        title: "Fehler beim Löschen",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      })
    }
  }

  async function createNewTemplate() {
    if (!activeLibrary || !userEmail) {
      toast({ title: 'Fehler', description: 'Keine aktive Bibliothek oder Benutzer nicht authentifiziert.', variant: 'destructive' })
      return
    }
    
    const name = (window.prompt('Neuen Template‑Namen eingeben:') || '').trim()
    if (!name) return
    if (/[^a-zA-Z0-9._\- ]/.test(name)) { toast({ title: 'Ungültiger Name', description: 'Nur Buchstaben, Zahlen, Leerzeichen, . _ - sind erlaubt.', variant: 'destructive' }); return }
    if (templates.some(t => t.name.toLowerCase() === name.toLowerCase())) { toast({ title: 'Bereits vorhanden', description: 'Bitte anderen Namen wählen.', variant: 'destructive' }); return }
    
    try {
      const defaultMetadata: TemplateMetadataSchema = {
        fields: [
          { key: 'title', variable: 'title', description: 'Titel des Dokuments', rawValue: '{{title|Titel des Dokuments}}' },
          { key: 'tags', variable: 'tags', description: 'Relevante Tags', rawValue: '{{tags|Relevante Tags}}' },
          { key: 'date', variable: 'date', description: 'Datum im Format yyyy-mm-dd', rawValue: '{{date|Datum im Format yyyy-mm-dd}}' },
        ],
        rawFrontmatter: ''
      }
      
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          libraryId: activeLibrary.id,
          metadata: defaultMetadata,
          systemprompt: `You are a specialized assistant that processes and structures information clearly and concisely.

IMPORTANT: Your response must be a valid JSON object where each key corresponds to a template variable.`,
          markdownBody: `# {{title}}

## Zusammenfassung
{{summary|Kurze Zusammenfassung des Inhalts}}

## Details
{{details|Detaillierte Beschreibung}}`,
          creation: null,
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }
      
      await loadTemplates()
      setSelectedTemplateName(name)
      toast({ title: 'Template angelegt', description: `"${name}" wurde erstellt.` })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
      toast({ title: 'Fehler beim Anlegen', description: msg, variant: 'destructive' })
    }
  }

  async function handleImport() {
    if (!activeLibrary || !userEmail) {
      toast({ title: 'Fehler', description: 'Keine aktive Bibliothek oder Benutzer nicht authentifiziert.', variant: 'destructive' })
      return
    }

    // Erstelle verstecktes File-Input-Element
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.md'
    input.style.display = 'none'
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        // Lade Datei-Inhalt
        const content = await file.text()
        const fileName = file.name.replace(/\.md$/, '')
        
        // Parse Template
        const { parseTemplateContent: parseTemplate } = await import('@/lib/templates/template-service')
        const { template } = parseTemplate(content, fileName)
        
        // Prüfe, ob Template bereits existiert
        const checkResponse = await fetch(`/api/templates?libraryId=${encodeURIComponent(activeLibrary.id)}`)
        let templateExists = false
        
        if (checkResponse.ok) {
          const data = await checkResponse.json()
          const templates = data.templates || []
          // Prüfe sowohl _id als auch name (beide sollten gleich sein, aber sicherheitshalber beide prüfen)
          templateExists = templates.some((t: { _id?: string; name?: string }) => 
            (t._id && t._id === fileName) || (t.name && t.name === fileName)
          )
        }
        
        // Wenn Template existiert, frage nach Bestätigung
        if (templateExists) {
          const shouldOverwrite = window.confirm(
            `Das Template "${fileName}" existiert bereits.\n\nMöchten Sie es überschreiben?`
          )
          if (!shouldOverwrite) {
            toast({ title: 'Import abgebrochen', description: 'Das Template wurde nicht importiert.' })
            return
          }
        }
        
        // Speichere oder aktualisiere in MongoDB
        const method = templateExists ? 'PUT' : 'POST'
        
        const response = await fetch('/api/templates', {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(templateExists ? { templateId: fileName } : { name: fileName }),
            libraryId: activeLibrary.id,
            metadata: template.metadata,
            systemprompt: template.systemprompt,
            markdownBody: template.markdownBody,
            creation: template.creation,
          }),
        })
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `HTTP ${response.status}`)
        }

        await loadTemplates()
        toast({ 
          title: templateExists ? 'Template aktualisiert' : 'Template importiert', 
          description: `"${fileName}" wurde erfolgreich ${templateExists ? 'aktualisiert' : 'importiert'}.` 
        })
      } catch (error) {
        console.error('Fehler beim Importieren:', error)
        toast({
          title: 'Fehler beim Importieren',
          description: error instanceof Error ? error.message : 'Unbekannter Fehler',
          variant: 'destructive',
        })
      } finally {
        document.body.removeChild(input)
      }
    }
    
    document.body.appendChild(input)
    input.click()
  }

  async function handleExport() {
    if (!selectedTemplateName || !activeLibrary || !userEmail) {
      toast({ title: 'Fehler', description: 'Bitte wählen Sie ein Template aus.', variant: 'destructive' })
      return
    }

    try {
      // Lade Template als Markdown von API
      const response = await fetch(
        `/api/templates/${encodeURIComponent(selectedTemplateName)}/download?libraryId=${encodeURIComponent(activeLibrary.id)}`
      )
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      // Erstelle Blob und trigger Download
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${selectedTemplateName}.md`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({ title: 'Template exportiert', description: `"${selectedTemplateName}.md" wurde heruntergeladen.` })
    } catch (error) {
      console.error('Fehler beim Exportieren:', error)
      toast({
        title: 'Fehler beim Exportieren',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
        variant: 'destructive',
      })
    }
  }

  function generatePreview(): string {
    const values = form.getValues()
    return generateTemplateContent(values)
  }

  async function testTemplate() {
    if (!activeLibrary) return

    setIsTesting(true)
    setTestResult(null)

    const values = form.getValues()
    const templateContent = generateTemplateContent(values)
    const sections: string[] = []
    if (selectedContextMarkdown.trim()) sections.push(selectedContextMarkdown.trim())
    if (freeText.trim()) sections.push(`---\nDatei: Freitext\n---\n\n${freeText.trim()}\n\n---\nEnde Datei: Freitext\n---`)
    const testText = sections.join("\n\n")

    if (!testText || testText.trim().length === 0) {
      setIsTesting(false)
      toast({
        title: 'Kein Testtext vorhanden',
        description: 'Bitte wählen Sie Kontextdateien oder geben Sie Freitext ein.',
        variant: 'destructive',
      })
      return
    }

    const pickMarkdown = (result: unknown): string => {
      if (typeof result === 'string') return result
      if (result && typeof result === 'object') {
        const obj = result as Record<string, unknown>
        const directCandidates = ['text','markdown','content','output'] as const
        for (const k of directCandidates) {
          const v = obj[k]
          if (typeof v === 'string') return v
        }
        // verschachtelte Felder prüfen
        const nested = obj['data']
        if (nested && typeof nested === 'object') {
          const nobj = nested as Record<string, unknown>
          for (const k of directCandidates) {
            const v = nobj[k]
            if (typeof v === 'string') return v
          }
        }
      }
      return JSON.stringify(result, null, 2)
    }

    try {
      const response = await fetch('/api/secretary/process-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Library-Id': activeLibrary.id,
        },
        body: new URLSearchParams({
          text: testText,
          template_content: templateContent,
          source_language: 'de',
          target_language: 'de',
          use_cache: 'false',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      const formattedResult = pickMarkdown(result)
      console.log('Prompt-Test Ergebnis:', formattedResult)
      
      setTestResult(formattedResult)
      setRightTab('testen')

      toast({
        title: "Prompt-Test erfolgreich",
        description: "Der Prompt wurde erfolgreich mit dem gewählten Kontext verarbeitet.",
      })

      console.log('Prompt-Test Ergebnis (roh):', result)
    } catch (error) {
      console.error('Fehler beim Prompt-Test:', error)
      const errorMessage = error instanceof Error ? error.message : "Unbekannter Fehler"
      setTestResult(`Fehler: ${errorMessage}`)
      setRightTab('testen')
      toast({
        title: "Prompt-Test fehlgeschlagen",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsTesting(false)
    }
  }

  async function ensurePromptTestsFolder(): Promise<string> {
    if (!providerInstance) throw new Error('Kein Provider verfügbar')
    const roots = await getRootItems()
    const found = roots.find(it => it.type === 'folder' && it.metadata.name === 'prompt-tests')
    if (found) return found.id
    const created = await providerInstance.createFolder('root', 'prompt-tests')
    return created.id
  }

  async function saveTestResult() {
    try {
      if (!providerInstance || !activeLibrary || !testResult) return
      const folderId = await ensurePromptTestsFolder()
      const name = `${selectedTemplateName || 'prompt'}-test-${new Date().toISOString().replace(/[:.]/g,'-')}.md`
      const blob = new Blob([testResult], { type: 'text/markdown' })
      const file = new File([blob], name, { type: 'text/markdown' })
      const item = await providerInstance.uploadFile(folderId, file)
      setResultSavedItemId(item.id)
      toast({ title: 'Ergebnis gespeichert', description: name })
    } catch (e) {
      toast({ title: 'Speichern fehlgeschlagen', description: e instanceof Error ? e.message : 'Unbekannter Fehler', variant: 'destructive' })
    }
  }

  async function runMagicDesign() {
    if (!selectedTemplateName || !providerInstance || !activeLibrary) {
      toast({ title: 'Kein Prompt ausgewählt', description: 'Bitte wählen Sie zuerst einen Prompt.', variant: 'destructive' })
      return
    }
    const scopeParts: string[] = []
    if (magicFrontmatter.trim()) scopeParts.push('frontmatter')
    if (magicBody.trim()) scopeParts.push('body')
    if (magicSystem.trim()) scopeParts.push('systemprompt')
    const allowedScope = scopeParts.length === 0 ? 'all' : (scopeParts.length === 1 ? scopeParts[0] : 'all')

    try {
      setMagicRunning(true)
      // 1) Magic-Template laden (magicpromptdesign.md)
      const folderId = await ensureTemplatesFolder()
      const items = await listItems(folderId)
      const magicItem = items.find(it => it.type === 'file' && (it.metadata.name.toLowerCase() === 'magicpromptdesign.md'))
      let magicTemplateContent: string
      if (!magicItem) {
        // Fallback: aus /public/templates laden
        try {
          const res = await fetch('/templates/magicpromptdesign.md', { cache: 'no-store' })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          magicTemplateContent = await res.text()
          console.log('[Magic] Fallback magicpromptdesign.md aus /public/templates verwendet')
        } catch {
          toast({ title: 'Magic-Template fehlt', description: 'magicpromptdesign.md weder in /templates noch in /public/templates gefunden.', variant: 'destructive' })
          return
        }
      } else {
        const { blob } = await providerInstance.getBinary(magicItem.id)
        magicTemplateContent = await blob.text()
      }

      // 2) Inputtext zusammenstellen
      const currentTemplate = generateTemplateContent(form.getValues())
      const inputText = [
        'INPUT_TEMPLATE:',
        currentTemplate,
        '',
        'CHANGES:',
        'Aufgabe:',
        magicBody || '(keine)',
        '',
        'Metadaten:',
        magicFrontmatter || '(keine)',
        '',
        'Rollenanweisung:',
        magicSystem || '(keine)',
        '',
        'CONFIG:',
        `allowed_scope: ${allowedScope}`,
        'diff_mode: diff',
        'preserve_comments: ja'
      ].join('\n')

      // 3) Secretary-Service aufrufen
      const response = await fetch('/api/secretary/process-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Library-Id': activeLibrary.id },
        body: new URLSearchParams({
          text: inputText,
          template_content: magicTemplateContent,
          source_language: 'de',
          target_language: 'de'
        })
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err?.error || `HTTP ${response.status}`)
      }
      const data = await response.json()
      // data kann string (JSON) oder object sein
      let corrected: string | undefined
      let diff: string = ''
      try {
        const obj = typeof data === 'string' ? JSON.parse(data) : (typeof data === 'object' ? data : {})
        corrected = typeof obj?.corrected_template === 'string' ? obj.corrected_template : undefined
        diff = typeof obj?.diff_preview === 'string' ? obj.diff_preview : ''
      } catch {
        // Fallback: Wenn data.text existiert
        const maybe = (data && typeof data.text === 'string') ? JSON.parse(data.text) : null
        corrected = maybe?.corrected_template
        diff = maybe?.diff_preview || ''
      }
      if (!corrected) throw new Error('Antwort ohne corrected_template')

      // 4) Template parsen und Formular übernehmen
      const { parseTemplateContent: parseTemplate } = await import('@/lib/templates/template-service')
      const { template } = parseTemplate(corrected, selectedTemplateName)
      form.setValue('metadata', template.metadata, { shouldDirty: true })
      form.setValue('markdownBody', template.markdownBody, { shouldDirty: true })
      form.setValue('systemprompt', template.systemprompt, { shouldDirty: true })
      form.setValue('creation', template.creation || null, { shouldDirty: true })
      setMagicLastDiff(diff || '')
      toast({ title: 'Magic Design angewendet', description: 'Änderungen übernommen (nicht gespeichert).' })

      // 5) Korrigiertes Template im Ordner prompt-tests ablegen (Debug/Verfolgung)
      try {
        const testsFolderId = await ensurePromptTestsFolder()
        const ts = new Date().toISOString().replace(/[:.]/g, '-')
        const baseName = `${selectedTemplateName}-magic-${ts}.md`
        const blobCorrected = new Blob([corrected], { type: 'text/markdown' })
        const fileCorrected = new File([blobCorrected], baseName, { type: 'text/markdown' })
        const savedItem = await providerInstance.uploadFile(testsFolderId, fileCorrected)
        setMagicSavedItemId(savedItem.id)
        toast({ title: 'Magic-Ergebnis gespeichert', description: baseName })

        if (diff && diff.trim().length > 0) {
          const diffName = `${selectedTemplateName}-magic-diff-${ts}.md`
          const blobDiff = new Blob([diff], { type: 'text/markdown' })
          const fileDiff = new File([blobDiff], diffName, { type: 'text/markdown' })
          await providerInstance.uploadFile(testsFolderId, fileDiff)
          console.log('[Magic] Diff gespeichert', diffName)
        }
      } catch (saveErr) {
        console.warn('Magic-Ergebnis konnte nicht gespeichert werden:', saveErr)
        const msg = saveErr instanceof Error ? saveErr.message : 'Unbekannter Fehler'
        toast({ title: 'Magic-Ergebnis NICHT gespeichert', description: msg, variant: 'destructive' })
      }
    } catch (e) {
      toast({ title: 'Magic fehlgeschlagen', description: e instanceof Error ? e.message : 'Unbekannter Fehler', variant: 'destructive' })
    } finally {
      setMagicRunning(false)
    }
  }

  // Render-Logik für verschiedene Status
  if (libraryStatus === "waitingForAuth") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <span>Diese Bibliothek benötigt eine Authentifizierung.</span>
        <span className="text-sm mt-2">Bitte konfigurieren Sie die Bibliothek in den Einstellungen.</span>
      </div>
    )
  }
  
  if (libraryStatus !== "ready") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <span>Lade Storage...</span>
      </div>
    )
  }

  if (!activeLibrary) {
    return (
      <div className="text-center text-muted-foreground">
        Bitte wählen Sie eine Bibliothek aus.
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center text-destructive">
        <p>Fehler beim Laden der Prompts:</p>
        <p className="text-sm">{error}</p>
        <Button 
          variant="outline" 
          className="mt-4"
          onClick={loadTemplates}
        >
          Erneut versuchen
        </Button>
      </div>
    )
  }

  /**
   * Rendert die Test-UI im Dialog.
   * Ziel: Wiederverwendung der bestehenden Test-Logik ohne Funktionsänderungen.
   */
  function renderTransformationTest(): JSX.Element {
    return (
      <div className="space-y-4">
        {/* Hinweis: Der Test nutzt die aktuelle Template-Auswahl und optionalen Kontext */}
        {!selectedTemplateName ? (
          <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            Bitte oben eine Vorlage auswählen. Die Vorschau und Test‑Funktionen werden erst danach aktiviert.
          </div>
        ) : (
          <Tabs value={rightTab} onValueChange={(v) => setRightTab(v as typeof rightTab)}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="kontext">Daten‑Kontext</TabsTrigger>
              <TabsTrigger value="preview">Prompt‑Vorschau</TabsTrigger>
              <TabsTrigger value="testen">Testen</TabsTrigger>
            </TabsList>

            <TabsContent value="kontext" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Kontext-Texte</Label>
                <div className="border rounded p-2 text-sm">
                  {Array.isArray(contextDocs) && contextDocs.length > 0 ? (
                    contextDocs.map(d => {
                      const checked = selectedContextIds.includes(d.id)
                      return (
                        <label key={d.id} className="flex items-center gap-2 py-1">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const isOn = v === true
                              setSelectedContextIds(prev => isOn ? [...prev, d.id] : prev.filter(x => x !== d.id))
                            }}
                          />
                          <span className="truncate">{d.name}</span>
                        </label>
                      )
                    })
                  ) : (
                    <div className="text-muted-foreground text-sm">Keine Kontext-Texte verfügbar</div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Gewählter Kontext (Lesemodus)</Label>
                <div className="border rounded-md">
                  <MarkdownPreview content={selectedContextMarkdown} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Freitext (optional)</Label>
                <Textarea
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  placeholder="Hier Text einkleben, um schnell zu testen"
                  className="min-h-[120px] font-mono text-sm"
                />
              </div>
            </TabsContent>

            <TabsContent value="preview" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Generierter Prompt (Markdown)</Label>
                <div className="border rounded-md">
                  <MarkdownPreview content={generatePreview()} />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={testTemplate}
                  disabled={!selectedTemplateName || isTesting}
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Teste...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Transformation starten
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="testen" className="space-y-4 mt-4">
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={testTemplate}
                  disabled={!selectedTemplateName || isTesting}
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Teste...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Transformation starten
                    </>
                  )}
                </Button>
              </div>
              {activeLibrary && providerInstance && (testResult || resultSavedItemId) ? (
                <JobReportTab
                  libraryId={activeLibrary.id}
                  fileId={resultSavedItemId || 'preview'}
                  provider={providerInstance}
                  sourceMode="frontmatter"
                  viewMode="metaOnly"
                  mdFileId={resultSavedItemId || undefined}
                  rawContent={testResult || undefined}
                />
              ) : (
                <div className="text-sm text-muted-foreground">Kein Ergebnis vorhanden.</div>
              )}
              <div className="flex gap-2">
                <Button type="button" onClick={saveTestResult} disabled={!testResult}>Speichern</Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Kompakte Toolbar oben */}
      <div className="flex items-center gap-2">
        <Select value={selectedTemplateName || ''} onValueChange={(v) => { setSelectedTemplateName(v); form.setValue('name', v, { shouldDirty: false }) }} disabled={isLoading}>
          <SelectTrigger className="w-64">
              <SelectValue placeholder="Vorlage auswählen..." />
          </SelectTrigger>
          <SelectContent>
            {templates.map((t) => (
              <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Info className="h-4 w-4" /></Button>
            </TooltipTrigger>
            <TooltipContent>
              <div className="flex items-center gap-2"><FolderOpen className="h-4 w-4" /><span>Ort: /templates in „{activeLibrary.label}“</span></div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button type="button" variant="outline" size="sm" onClick={createNewTemplate} disabled={isLoading}>Neu</Button>
        <Button type="button" variant="outline" size="sm" onClick={handleImport} disabled={isLoading || !userEmail}>
          <Upload className="h-4 w-4 mr-2" />
          Import
        </Button>
        {/* Test-Dialog öffnen: bewusst immer sichtbar für schnellen Zugriff */}
        <Button type="button" variant="secondary" size="sm" onClick={() => setIsTestDialogOpen(true)} disabled={isLoading}>
          <Play className="h-4 w-4 mr-2" />
          Transformation testen
        </Button>
        {selectedTemplateName && (
          <>
            <Button type="button" variant="outline" size="sm" onClick={handleExport} disabled={isLoading || !userEmail}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={renameCurrentTemplate} disabled={!selectedTemplateName}>Umbenennen</Button>
            <Button type="button" variant="destructive" size="sm" onClick={() => deleteTemplate(selectedTemplateName!)}>Löschen</Button>
          </>
        )}
      </div>

      {/* Einspaltiges Layout: Editor bekommt volle Breite */}
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Vorlage gestalten</CardTitle>
            <CardDescription>
              Diese Vorlage beschreibt, wie Eingaben wie Dateien, Webseiten, Notizen oder Ideen in gut lesbaren, strukturierten Text verwandelt werden.
              Sie legt fest, welche Informationen daraus extrahiert werden, wie der Text klingen soll, wie er aufgebaut ist
              und wie Menschen ihre Daten Schritt für Schritt eingeben.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
              console.log('[TemplateManagement] Form-Validierungsfehler:', errors)
              toast({
                title: "Validierungsfehler",
                description: "Bitte prüfen Sie die Eingaben.",
                variant: "destructive",
              })
            })} className="space-y-6">
              {/* Template-Name Feld entfernt (oben verwaltet) */}

                  {!selectedTemplateName ? (
                    <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                      Bitte oben eine Vorlage auswählen oder Neu anlegen.
                    </div>
              ) : previewMode ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Vorlagen-Vorschau</h4>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewMode(false)}
                    >
                      Bearbeiten
                    </Button>
                  </div>
                  <div className="border rounded-md p-4 bg-muted/50">
                    <pre className="text-sm whitespace-pre-wrap font-mono">
                      {generatePreview()}
                    </pre>
                  </div>
                </div>
              ) : (
                <>
                  <StructuredTemplateEditor
                    markdownBody={form.watch('markdownBody')}
                    metadata={form.watch('metadata')}
                    systemprompt={form.watch('systemprompt')}
                    creation={form.watch('creation')}
                    availableTemplates={templates.map(t => ({ name: t.name, creation: t.creation || null }))}
                    magicMode={magicMode}
                    magicValues={{ body: magicBody, frontmatter: magicFrontmatter, system: magicSystem }}
                    onMagicChange={(next) => {
                      if (next.body !== undefined) setMagicBody(next.body)
                      if (next.frontmatter !== undefined) setMagicFrontmatter(next.frontmatter)
                      if (next.system !== undefined) setMagicSystem(next.system)
                    }}
                    onChange={({ markdownBody, metadata, systemprompt, creation }) => {
                      form.setValue('markdownBody', markdownBody, { shouldDirty: true })
                      form.setValue('metadata', metadata, { shouldDirty: true })
                      form.setValue('systemprompt', systemprompt, { shouldDirty: true })
                      // Stelle sicher, dass creation immer ein neues Objekt ist, damit React Hook Form die Änderung erkennt
                      // Erstelle eine Deep-Copy, damit React Hook Form die Änderung als "dirty" erkennt
                      const creationValue = creation ? {
                        ...creation,
                        followWizards: creation.followWizards ? { ...creation.followWizards } : undefined,
                        supportedSources: creation.supportedSources ? [...creation.supportedSources] : [],
                        flow: creation.flow ? {
                          ...creation.flow,
                          steps: creation.flow.steps ? [...creation.flow.steps] : []
                        } : { steps: [] },
                        ui: creation.ui ? { ...creation.ui } : undefined
                      } : null
                      form.setValue('creation', creationValue, { shouldDirty: true })
                      // Markiere als geändert, da React Hook Form verschachtelte Objekte nicht immer korrekt erkennt
                      setHasChanges(true)
                    }}
                  />
                </>
              )}

              <div className="flex justify-end gap-2">
                {selectedTemplateName && (
                  <Button type="button" variant={magicMode ? 'secondary' : 'outline'} onClick={() => setMagicMode(v => !v)}>
                    {magicMode ? 'Magic Design ausblenden' : 'Magic Design'}
                  </Button>
                )}
                {magicMode && (
                  <>
                    <Button type="button" variant="secondary" onClick={() => { setMagicBody(''); setMagicFrontmatter(''); setMagicSystem(''); setMagicLastDiff('') }} disabled={magicRunning}>Magic zurücksetzen</Button>
                    <Button type="button" onClick={runMagicDesign} disabled={magicRunning || (!magicBody && !magicFrontmatter && !magicSystem)}>
                      {magicRunning ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Magic läuft…</>) : 'Magic absenden'}
                    </Button>
                  </>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPreviewMode(!previewMode)}
                  disabled={!selectedTemplateName}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {previewMode ? "Bearbeiten" : "Vorschau"}
                </Button>
                <Button
                  type="submit"
                  disabled={!selectedTemplateName || isSaving || (!form.formState.isDirty && !hasChanges)}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Wird gespeichert...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Speichern
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Test-Dialog: ausgelagert für bessere Übersicht */}
      <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transformation testen</DialogTitle>
            <DialogDescription>
              Test mit Beispieltext. Nutzt Metadaten, Rollenanweisung und Struktur des Templates – unabhängig vom Creation Flow.
            </DialogDescription>
          </DialogHeader>
          {/* Bestehende Test-UI wiederverwenden */}
          {renderTransformationTest()}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsTestDialogOpen(false)}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Validierungsfehler-Dialog */}
      <AlertDialog open={!!validationError} onOpenChange={(open) => !open && setValidationError(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Validierungsfehler</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-wrap">
              {validationError}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setValidationError(null)}>Verstanden</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
} 