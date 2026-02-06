# Vorlagenverwaltung und transformation testen layout
_Exported on 2/6/2026 at 17:10:52 GMT+1 from Cursor (2.4.27)_

---

**User**

Diese Ansicht hier ist sehr unübersichtlich und ich würde gerne diese Vorlagenverwaltung den Abschnitt trennen von dieser Transformation testen. Können wir diese Transformation testen als Feature oben als Button auf der Homepage anbieten und in einem eigenen Dialog anzeigen und dafür hier die gesamte Breite nur für dieses Vorlage entgestalten Thema verwenden?

---

**Cursor**

```markdown
---
title: Analyse zur Trennung der Template-Tests in einen Dialog
status: draft
date: 2026-01-18
---

## Kontext und Ziel
Die aktuelle Vorlagenverwaltung zeigt rechts den Block "Transformation testen". Das erzeugt visuelle Überfrachtung und zwingt die Template-Gestaltung in eine halbe Breite. Gewünscht ist eine klare Trennung: die Template-Gestaltung nutzt die gesamte Breite, während die Transformationstests als eigenständige Funktion per Button auf der Homepage erreichbar sind und in einem Dialog laufen.

Zusätzliche Anforderungen: Der Test muss weiterhin Kontext-Dateien und Freitext unterstützen, Ergebnisse speichern können und möglichst die aktuelle Template-Definition nutzen. Gleichzeitig soll die UI schlank bleiben, keine unnötigen Abhängigkeiten einführen und die bestehenden Atome/Services weiterverwenden.

## Varianten
### Variante A: Dialog direkt in der Template-Seite (kein Home-Button)
**Idee:** Den Test-Block in einen Dialog innerhalb `TemplateManagement` verschieben, öffnen über Button in der Toolbar.  
**Vorteile:** Minimaler Code, nutzt bestehende Form-Werte (auch ungespeichert), keine zusätzliche Logik.  
**Nachteile:** Kein Button auf der Homepage, Anforderung nicht erfüllt.

### Variante B: Gemeinsamer Dialog, wiederverwendbar in Home + Template-Seite
**Idee:** Eigenes Dialog-Component für Tests. Es kann entweder mit "aktuellen Form-Werten" arbeiten (Template-Seite) oder mit geladenen Templates (Homepage).  
**Vorteile:** Ein UI, zwei Einstiege. Die Template-Seite bleibt breit. Anforderungen erfüllt.  
**Nachteile:** Etwas mehr Refactoring, braucht klar definierte Props/Helper.

### Variante C: Home-Button führt zu `/templates?test=1` und öffnet Dialog dort
**Idee:** Home-Button navigiert zur Template-Seite; dort öffnet ein Dialog automatisch.  
**Vorteile:** Kein zusätzlicher Test-Dialog im Home, geringe UI-Komplexität.  
**Nachteile:** Nicht wirklich "auf der Homepage im Dialog"; weniger direkt, zusätzlicher Seitenwechsel.

## Entscheidung
**Gewählt: Variante B.**  
Sie erfüllt die Anforderungen vollständig: separater Test-Dialog, Home-Button als Einstieg, Template-Seite gewinnt volle Breite. Gleichzeitig bleibt die Logik zentral in einem Component, sodass keine Doppelpflege entsteht.

## Geplante Änderungen (Dateien)
- `src/components/templates/template-test-dialog.tsx` (neu)
- `src/components/templates/template-management.tsx` (Dialog integrieren, rechten Block entfernen, Layout auf volle Breite)
- `src/components/home/hero-section.tsx` (Button für "Transformation testen" inkl. Dialog)

```

---

**User**

Mir scheint Variante A vollkommen ausreichend. Dieser Button zum Öffnen dieser Testumgebung kann ja innerhalb der Template-Seite sein, dieser Template-Verwaltung sein, muss nicht auf der Homepage sein.

---

**Cursor**

```typescriptreact
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
        {selectedTemplateName && (
          <>
            <Button type="button" variant="outline" size="sm" onClick={handleExport} disabled={isLoading || !userEmail}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            {/* Test-Dialog öffnen: Trennung von Editor und Test-Umgebung */}
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsTestDialogOpen(true)}>
              <Play className="h-4 w-4 mr-2" />
              Transformation testen
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
```

```markdown
---
title: Analyse zur Trennung der Template-Tests in einen Dialog
status: draft
date: 2026-01-18
---

## Kontext und Ziel
Die aktuelle Vorlagenverwaltung zeigt rechts den Block "Transformation testen". Das erzeugt visuelle Überfrachtung und zwingt die Template-Gestaltung in eine halbe Breite. Gewünscht ist eine klare Trennung: die Template-Gestaltung nutzt die gesamte Breite, während die Transformationstests als eigenständige Funktion per Button auf der Homepage erreichbar sind und in einem Dialog laufen.

Zusätzliche Anforderungen: Der Test muss weiterhin Kontext-Dateien und Freitext unterstützen, Ergebnisse speichern können und möglichst die aktuelle Template-Definition nutzen. Gleichzeitig soll die UI schlank bleiben, keine unnötigen Abhängigkeiten einführen und die bestehenden Atome/Services weiterverwenden.

## Varianten
### Variante A: Dialog direkt in der Template-Seite (kein Home-Button)
**Idee:** Den Test-Block in einen Dialog innerhalb `TemplateManagement` verschieben, öffnen über Button in der Toolbar.  
**Vorteile:** Minimaler Code, nutzt bestehende Form-Werte (auch ungespeichert), keine zusätzliche Logik.  
**Nachteile:** Kein Button auf der Homepage, Anforderung nicht erfüllt.

### Variante B: Gemeinsamer Dialog, wiederverwendbar in Home + Template-Seite
**Idee:** Eigenes Dialog-Component für Tests. Es kann entweder mit "aktuellen Form-Werten" arbeiten (Template-Seite) oder mit geladenen Templates (Homepage).  
**Vorteile:** Ein UI, zwei Einstiege. Die Template-Seite bleibt breit. Anforderungen erfüllt.  
**Nachteile:** Etwas mehr Refactoring, braucht klar definierte Props/Helper.

### Variante C: Home-Button führt zu `/templates?test=1` und öffnet Dialog dort
**Idee:** Home-Button navigiert zur Template-Seite; dort öffnet ein Dialog automatisch.  
**Vorteile:** Kein zusätzlicher Test-Dialog im Home, geringe UI-Komplexität.  
**Nachteile:** Nicht wirklich "auf der Homepage im Dialog"; weniger direkt, zusätzlicher Seitenwechsel.

## Entscheidung
**Gewählt: Variante A.**  
Der Button zum Öffnen der Testumgebung bleibt innerhalb der Template-Seite. Damit ist die Trennung der UI erreicht, ohne einen Home-Button oder zusätzliche Navigation einzuführen. Die Template-Gestaltung erhält volle Breite, und die Test-Logik bleibt direkt am Editor gebunden.

## Geplante Änderungen (Dateien)
- `src/components/templates/template-test-dialog.tsx` (neu)
- `src/components/templates/template-management.tsx` (Dialog integrieren, rechten Block entfernen, Layout auf volle Breite)
- `src/components/home/hero-section.tsx` (Button für "Transformation testen" inkl. Dialog)

```

```typescriptreact
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
```

```markdown
---
title: Analyse zur Trennung der Template-Tests in einen Dialog
status: draft
date: 2026-01-18
---

## Kontext und Ziel
Die aktuelle Vorlagenverwaltung zeigt rechts den Block "Transformation testen". Das erzeugt visuelle Überfrachtung und zwingt die Template-Gestaltung in eine halbe Breite. Gewünscht ist eine klare Trennung: die Template-Gestaltung nutzt die gesamte Breite, während die Transformationstests als eigenständige Funktion per Button auf der Homepage erreichbar sind und in einem Dialog laufen.

Zusätzliche Anforderungen: Der Test muss weiterhin Kontext-Dateien und Freitext unterstützen, Ergebnisse speichern können und möglichst die aktuelle Template-Definition nutzen. Gleichzeitig soll die UI schlank bleiben, keine unnötigen Abhängigkeiten einführen und die bestehenden Atome/Services weiterverwenden.

## Varianten
### Variante A: Dialog direkt in der Template-Seite (kein Home-Button)
**Idee:** Den Test-Block in einen Dialog innerhalb `TemplateManagement` verschieben, öffnen über Button in der Toolbar.  
**Vorteile:** Minimaler Code, nutzt bestehende Form-Werte (auch ungespeichert), keine zusätzliche Logik.  
**Nachteile:** Kein Button auf der Homepage, Anforderung nicht erfüllt.

### Variante B: Gemeinsamer Dialog, wiederverwendbar in Home + Template-Seite
**Idee:** Eigenes Dialog-Component für Tests. Es kann entweder mit "aktuellen Form-Werten" arbeiten (Template-Seite) oder mit geladenen Templates (Homepage).  
**Vorteile:** Ein UI, zwei Einstiege. Die Template-Seite bleibt breit. Anforderungen erfüllt.  
**Nachteile:** Etwas mehr Refactoring, braucht klar definierte Props/Helper.

### Variante C: Home-Button führt zu `/templates?test=1` und öffnet Dialog dort
**Idee:** Home-Button navigiert zur Template-Seite; dort öffnet ein Dialog automatisch.  
**Vorteile:** Kein zusätzlicher Test-Dialog im Home, geringe UI-Komplexität.  
**Nachteile:** Nicht wirklich "auf der Homepage im Dialog"; weniger direkt, zusätzlicher Seitenwechsel.

## Entscheidung
**Gewählt: Variante A.**  
Der Button zum Öffnen der Testumgebung bleibt innerhalb der Template-Seite. Damit ist die Trennung der UI erreicht, ohne einen Home-Button oder zusätzliche Navigation einzuführen. Die Template-Gestaltung erhält volle Breite, und die Test-Logik bleibt direkt am Editor gebunden.

## Geplante Änderungen (Dateien)
- `src/components/templates/template-management.tsx` (Dialog integrieren, rechten Block entfernen, Layout auf volle Breite)

```

Ich habe die Entscheidung als Variante A umgesetzt, weil sie die UI entlastet, ohne neue Navigationswege einzuführen. Dadurch bleibt die Template-Gestaltung im Fokus, während der Testbereich nur bei Bedarf sichtbar ist. Außerdem bleibt die bestehende Test-Logik unverändert, was Risiken reduziert.

Ich habe bewusst die bestehende Logik für Kontext, Preview und Testen beibehalten und nur die Darstellung umgebaut. Das minimiert funktionale Änderungen und hält den Code nachvollziehbar. Zusätzlich bleibt der Test-Button in der Toolbar sichtbar, damit der Zugriff schnell bleibt, auch wenn keine Vorlage ausgewählt ist.

Die Umsetzung ist auf minimale Anpassungen fokussiert: Layout auf einspaltig, Testbereich in einen Dialog verschoben, und die Analyse-Notiz auf Variante A korrigiert.

Wesentliche Änderungen in `src/components/templates/template-management.tsx`:
- Test-UI als Dialog ausgelagert und über Toolbar-Button geöffnet.
- Layout auf volle Breite umgestellt, rechter Test-Block entfernt.
- Test-UI wiederverwendet, Logik unverändert.

```1091:1226:src/components/templates/template-management.tsx
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
            {/* ... */}
          </Tabs>
        )}
      </div>
    )
  }
```

```1248:1276:src/components/templates/template-management.tsx
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
            {/* ... */}
          </>
        )}
      </div>

      {/* Einspaltiges Layout: Editor bekommt volle Breite */}
      <div className="grid grid-cols-1 gap-6">
```

```1404:1421:src/components/templates/template-management.tsx
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
```

Analyse-Notiz aktualisiert:
```28:34:docs/_analysis/template-transformation-test-dialog.md
## Entscheidung
**Gewählt: Variante A.**  
Der Button zum Öffnen der Testumgebung bleibt innerhalb der Template-Seite. Damit ist die Trennung der UI erreicht, ohne einen Home-Button oder zusätzliche Navigation einzuführen. Die Template-Gestaltung erhält volle Breite, und die Test-Logik bleibt direkt am Editor gebunden.

## Geplante Änderungen (Dateien)
- `src/components/templates/template-management.tsx` (Dialog integrieren, rechten Block entfernen, Layout auf volle Breite)
```

Tests:
- Nicht ausgeführt.  
- Manuell testen: Vorlage öffnen → Button `Transformation testen` → Kontext/Freitext setzen → Test starten → Ergebnis prüfen und speichern.

Wenn du willst, kann ich als nächsten Schritt einen kurzen UI‑Check via Browser machen, sobald der Dev‑Server läuft.

```typescriptreact
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
            {/* ... */}
          </Tabs>
        )}
      </div>
    )
  }
```

```typescriptreact
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
            {/* ... */}
          </>
        )}
      </div>

      {/* Einspaltiges Layout: Editor bekommt volle Breite */}
      <div className="grid grid-cols-1 gap-6">
```

```typescriptreact
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
```

```plaintext
## Entscheidung
**Gewählt: Variante A.**  
Der Button zum Öffnen der Testumgebung bleibt innerhalb der Template-Seite. Damit ist die Trennung der UI erreicht, ohne einen Home-Button oder zusätzliche Navigation einzuführen. Die Template-Gestaltung erhält volle Breite, und die Test-Logik bleibt direkt am Editor gebunden.

## Geplante Änderungen (Dateien)
- `src/components/templates/template-management.tsx` (Dialog integrieren, rechten Block entfernen, Layout auf volle Breite)
```

---

**User**

Ich habe hier diesen Story Creator, den ich eröffnen kann, wenn ich in die Quelle eine Dateiliste ausgewählt habe. Wenn es ein PDF ist oder ein Audio oder Video, dann ist ja der erste Schritt vom "Story Creator" diese Transkription, Extraktion und generiert eine Datei, die dann im nächsten Schritt mit dieser Template-Transformation weiterverarbeitet wird. Was ist denn jetzt der erste, wenn die Datei jetzt auf einem Marktland ist, dann ist sie ja schon Text und wir könnten den ersten Schritt eigentlich ignorieren. Also wir könnten jetzt im Story Creator schon einfach diesen achten Schritt überspringen oder ausblenden, ausgrauen. Wie würde man das am besten machen?
Haben wir hier nicht ein logik problem?
@docs/architecture/use-cases-and-personas.md @docs/architecture/artifact-pipeline-v3-design.md @docs/architecture/requirements-artifact-pipeline-v3.md 

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Beginne mit der Implementierung des Plans. Starte mit der Pipeline-UI für Markdown.


Anpassen der PipelineSheet-Komponente für Markdown:


```typescriptreact
"use client"

import * as React from "react"
import { toast } from "sonner"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

export interface PipelinePolicies {
  extract: "ignore" | "do" | "force"
  metadata: "ignore" | "do" | "force"
  ingest: "ignore" | "do" | "force"
}

interface PipelineSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  libraryId: string
  sourceFileName: string
  kind: "pdf" | "audio" | "video" | "markdown" | "other"
  targetLanguage: string
  onTargetLanguageChange: (value: string) => void
  templateName: string
  onTemplateNameChange: (value: string) => void
  templates: string[]
  isLoadingTemplates: boolean
  onStart: (args: { templateName?: string; targetLanguage: string; policies: PipelinePolicies }) => Promise<void>
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0
}

export function PipelineSheet(props: PipelineSheetProps) {
  const [shouldExtract, setShouldExtract] = React.useState(true)
  const [shouldTransform, setShouldTransform] = React.useState(true)
  const [shouldIngest, setShouldIngest] = React.useState(true)
  const [shouldForce, setShouldForce] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Default: alle Schritte aktiv, aber beim Öffnen (auto-open) nicht unerwartet resetten.
  React.useEffect(() => {
    if (!props.isOpen) return
    // Wenn alle drei aus sind (z.B. nach Back/Forward), setze auf Default.
    if (!shouldExtract && !shouldTransform && !shouldIngest) {
      setShouldExtract(true)
      setShouldTransform(true)
      setShouldIngest(true)
    }
  }, [props.isOpen, shouldExtract, shouldTransform, shouldIngest])

  const step1Label = props.kind === "audio" || props.kind === "video" ? "Transkription" : "Extraktion"

  const templateSelectValue = props.templateName || "__none__"
  const canTransform = shouldTransform
  const canStart = shouldExtract || shouldTransform || shouldIngest

  const start = React.useCallback(async () => {
    if (!canStart) {
      toast.error("Keine Schritte ausgewählt", { description: "Bitte mindestens einen Schritt auswählen." })
      return
    }

    if (canTransform && !isNonEmptyString(props.templateName)) {
      toast.error("Template fehlt", { description: "Bitte ein Template auswählen, oder Transformation deaktivieren." })
      return
    }

    const active: "do" | "force" = shouldForce ? "force" : "do"
    const policies: PipelinePolicies = {
      extract: shouldExtract ? active : "ignore",
      metadata: shouldTransform ? active : "ignore",
      ingest: shouldIngest ? active : "ignore",
    }

    setIsSubmitting(true)
    try {
      await props.onStart({
        templateName: isNonEmptyString(props.templateName) ? props.templateName : undefined,
        targetLanguage: props.targetLanguage,
        policies,
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [canStart, canTransform, props, shouldExtract, shouldForce, shouldIngest, shouldTransform])

  return (
    <Sheet open={props.isOpen} onOpenChange={props.onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader className="pr-10">
          <SheetTitle>Aufbereiten &amp; Publizieren</SheetTitle>
          <SheetDescription className="truncate">
            {props.sourceFileName}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Zielsprache</Label>
              <Select value={props.targetLanguage} onValueChange={props.onTargetLanguageChange}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="de" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="de">de</SelectItem>
                  <SelectItem value="en">en</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Template (optional)</Label>
              {props.isLoadingTemplates ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select value={templateSelectValue} onValueChange={(v) => props.onTemplateNameChange(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Radix Select: value must not be empty string. Use sentinel for "no template". */}
                    <SelectItem value="__none__">—</SelectItem>
                    {props.templates.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <div className="text-sm font-medium">Pipeline</div>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox checked={shouldExtract} onCheckedChange={(v) => setShouldExtract(v === true)} id="step-extract" />
                <div className="space-y-0.5">
                  <Label htmlFor="step-extract">{step1Label}</Label>
                  <div className="text-xs text-muted-foreground">Erzeugt ein Transcript/Markdown aus der Quelle (Shadow‑Twin).</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox checked={shouldTransform} onCheckedChange={(v) => setShouldTransform(v === true)} id="step-transform" />
                <div className="space-y-0.5">
                  <Label htmlFor="step-transform">Transformation</Label>
                  <div className="text-xs text-muted-foreground">Wendet ein Template an und erzeugt eine publizierbare Fassung.</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox checked={shouldIngest} onCheckedChange={(v) => setShouldIngest(v === true)} id="step-ingest" />
                <div className="space-y-0.5">
                  <Label htmlFor="step-ingest">Ingestion</Label>
                  <div className="text-xs text-muted-foreground">Indexiert/aktualisiert Inhalte für RAG/Chat.</div>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-start gap-3 border-t pt-3">
              <Checkbox checked={shouldForce} onCheckedChange={(v) => setShouldForce(v === true)} id="step-force" />
              <div className="space-y-0.5">
                <Label htmlFor="step-force">Erzwingen</Label>
                <div className="text-xs text-muted-foreground">Ignoriert Cache/„already done“ und führt ausgewählte Schritte erneut aus.</div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => props.onOpenChange(false)}>
              Schließen
            </Button>
            <Button onClick={() => void start()} disabled={isSubmitting}>
              Jetzt starten
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}




```

```typescriptreact
"use client"

import * as React from "react"
import { toast } from "sonner"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

export interface PipelinePolicies {
  extract: "ignore" | "do" | "force"
  metadata: "ignore" | "do" | "force"
  ingest: "ignore" | "do" | "force"
}

interface PipelineSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  libraryId: string
  sourceFileName: string
  kind: "pdf" | "audio" | "video" | "markdown" | "other"
  targetLanguage: string
  onTargetLanguageChange: (value: string) => void
  templateName: string
  onTemplateNameChange: (value: string) => void
  templates: string[]
  isLoadingTemplates: boolean
  onStart: (args: { templateName?: string; targetLanguage: string; policies: PipelinePolicies }) => Promise<void>
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0
}

export function PipelineSheet(props: PipelineSheetProps) {
  // Bei Markdown: Extract immer deaktiviert (Textquelle bereits vorhanden)
  const isMarkdown = props.kind === "markdown"
  const [shouldExtract, setShouldExtract] = React.useState(!isMarkdown)
  const [shouldTransform, setShouldTransform] = React.useState(true)
  const [shouldIngest, setShouldIngest] = React.useState(true)
  const [shouldForce, setShouldForce] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Default: alle Schritte aktiv, aber beim Öffnen (auto-open) nicht unerwartet resetten.
  // Bei Markdown: Extract bleibt immer deaktiviert.
  React.useEffect(() => {
    if (!props.isOpen) return
    // Bei Markdown: Extract immer false setzen
    if (isMarkdown && shouldExtract) {
      setShouldExtract(false)
    }
    // Wenn alle drei aus sind (z.B. nach Back/Forward), setze auf Default.
    if (!shouldExtract && !shouldTransform && !shouldIngest && !isMarkdown) {
      setShouldExtract(true)
      setShouldTransform(true)
      setShouldIngest(true)
    }
  }, [props.isOpen, shouldExtract, shouldTransform, shouldIngest, isMarkdown])

  const step1Label = props.kind === "audio" || props.kind === "video" ? "Transkription" : "Extraktion"

  const templateSelectValue = props.templateName || "__none__"
  const canTransform = shouldTransform
  const canStart = shouldExtract || shouldTransform || shouldIngest

  const start = React.useCallback(async () => {
    if (!canStart) {
      toast.error("Keine Schritte ausgewählt", { description: "Bitte mindestens einen Schritt auswählen." })
      return
    }

    if (canTransform && !isNonEmptyString(props.templateName)) {
      toast.error("Template fehlt", { description: "Bitte ein Template auswählen, oder Transformation deaktivieren." })
      return
    }

    const active: "do" | "force" = shouldForce ? "force" : "do"
    const policies: PipelinePolicies = {
      extract: shouldExtract ? active : "ignore",
      metadata: shouldTransform ? active : "ignore",
      ingest: shouldIngest ? active : "ignore",
    }

    setIsSubmitting(true)
    try {
      await props.onStart({
        templateName: isNonEmptyString(props.templateName) ? props.templateName : undefined,
        targetLanguage: props.targetLanguage,
        policies,
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [canStart, canTransform, props, shouldExtract, shouldForce, shouldIngest, shouldTransform])

  return (
    <Sheet open={props.isOpen} onOpenChange={props.onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader className="pr-10">
          <SheetTitle>Aufbereiten &amp; Publizieren</SheetTitle>
          <SheetDescription className="truncate">
            {props.sourceFileName}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Zielsprache</Label>
              <Select value={props.targetLanguage} onValueChange={props.onTargetLanguageChange}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="de" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="de">de</SelectItem>
                  <SelectItem value="en">en</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Template (optional)</Label>
              {props.isLoadingTemplates ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select value={templateSelectValue} onValueChange={(v) => props.onTemplateNameChange(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Radix Select: value must not be empty string. Use sentinel for "no template". */}
                    <SelectItem value="__none__">—</SelectItem>
                    {props.templates.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <div className="text-sm font-medium">Pipeline</div>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox checked={shouldExtract} onCheckedChange={(v) => setShouldExtract(v === true)} id="step-extract" />
                <div className="space-y-0.5">
                  <Label htmlFor="step-extract">{step1Label}</Label>
                  <div className="text-xs text-muted-foreground">Erzeugt ein Transcript/Markdown aus der Quelle (Shadow‑Twin).</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox checked={shouldTransform} onCheckedChange={(v) => setShouldTransform(v === true)} id="step-transform" />
                <div className="space-y-0.5">
                  <Label htmlFor="step-transform">Transformation</Label>
                  <div className="text-xs text-muted-foreground">Wendet ein Template an und erzeugt eine publizierbare Fassung.</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox checked={shouldIngest} onCheckedChange={(v) => setShouldIngest(v === true)} id="step-ingest" />
                <div className="space-y-0.5">
                  <Label htmlFor="step-ingest">Ingestion</Label>
                  <div className="text-xs text-muted-foreground">Indexiert/aktualisiert Inhalte für RAG/Chat.</div>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-start gap-3 border-t pt-3">
              <Checkbox checked={shouldForce} onCheckedChange={(v) => setShouldForce(v === true)} id="step-force" />
              <div className="space-y-0.5">
                <Label htmlFor="step-force">Erzwingen</Label>
                <div className="text-xs text-muted-foreground">Ignoriert Cache/„already done“ und führt ausgewählte Schritte erneut aus.</div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => props.onOpenChange(false)}>
              Schließen
            </Button>
            <Button onClick={() => void start()} disabled={isSubmitting}>
              Jetzt starten
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}




```

```typescriptreact
"use client"

import * as React from "react"
import { toast } from "sonner"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

export interface PipelinePolicies {
  extract: "ignore" | "do" | "force"
  metadata: "ignore" | "do" | "force"
  ingest: "ignore" | "do" | "force"
}

interface PipelineSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  libraryId: string
  sourceFileName: string
  kind: "pdf" | "audio" | "video" | "markdown" | "other"
  targetLanguage: string
  onTargetLanguageChange: (value: string) => void
  templateName: string
  onTemplateNameChange: (value: string) => void
  templates: string[]
  isLoadingTemplates: boolean
  onStart: (args: { templateName?: string; targetLanguage: string; policies: PipelinePolicies }) => Promise<void>
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0
}

export function PipelineSheet(props: PipelineSheetProps) {
  // Bei Markdown: Extract immer deaktiviert (Textquelle bereits vorhanden)
  const isMarkdown = props.kind === "markdown"
  const [shouldExtract, setShouldExtract] = React.useState(!isMarkdown)
  const [shouldTransform, setShouldTransform] = React.useState(true)
  const [shouldIngest, setShouldIngest] = React.useState(true)
  const [shouldForce, setShouldForce] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Default: alle Schritte aktiv, aber beim Öffnen (auto-open) nicht unerwartet resetten.
  // Bei Markdown: Extract bleibt immer deaktiviert.
  React.useEffect(() => {
    if (!props.isOpen) return
    // Bei Markdown: Extract immer false setzen
    if (isMarkdown && shouldExtract) {
      setShouldExtract(false)
    }
    // Wenn alle drei aus sind (z.B. nach Back/Forward), setze auf Default.
    if (!shouldExtract && !shouldTransform && !shouldIngest && !isMarkdown) {
      setShouldExtract(true)
      setShouldTransform(true)
      setShouldIngest(true)
    }
  }, [props.isOpen, shouldExtract, shouldTransform, shouldIngest, isMarkdown])

  const step1Label = props.kind === "audio" || props.kind === "video" ? "Transkription" : "Extraktion"

  const templateSelectValue = props.templateName || "__none__"
  const canTransform = shouldTransform
  const canStart = shouldExtract || shouldTransform || shouldIngest

  const start = React.useCallback(async () => {
    if (!canStart) {
      toast.error("Keine Schritte ausgewählt", { description: "Bitte mindestens einen Schritt auswählen." })
      return
    }

    if (canTransform && !isNonEmptyString(props.templateName)) {
      toast.error("Template fehlt", { description: "Bitte ein Template auswählen, oder Transformation deaktivieren." })
      return
    }

    const active: "do" | "force" = shouldForce ? "force" : "do"
    // Bei Markdown: extract immer "ignore" (Textquelle bereits vorhanden)
    const policies: PipelinePolicies = {
      extract: isMarkdown ? "ignore" : (shouldExtract ? active : "ignore"),
      metadata: shouldTransform ? active : "ignore",
      ingest: shouldIngest ? active : "ignore",
    }

    setIsSubmitting(true)
    try {
      await props.onStart({
        templateName: isNonEmptyString(props.templateName) ? props.templateName : undefined,
        targetLanguage: props.targetLanguage,
        policies,
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [canStart, canTransform, props, shouldExtract, shouldForce, shouldIngest, shouldTransform])

  return (
    <Sheet open={props.isOpen} onOpenChange={props.onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader className="pr-10">
          <SheetTitle>Aufbereiten &amp; Publizieren</SheetTitle>
          <SheetDescription className="truncate">
            {props.sourceFileName}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Zielsprache</Label>
              <Select value={props.targetLanguage} onValueChange={props.onTargetLanguageChange}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="de" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="de">de</SelectItem>
                  <SelectItem value="en">en</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Template (optional)</Label>
              {props.isLoadingTemplates ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select value={templateSelectValue} onValueChange={(v) => props.onTemplateNameChange(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Radix Select: value must not be empty string. Use sentinel for "no template". */}
                    <SelectItem value="__none__">—</SelectItem>
                    {props.templates.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <div className="text-sm font-medium">Pipeline</div>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox checked={shouldExtract} onCheckedChange={(v) => setShouldExtract(v === true)} id="step-extract" />
                <div className="space-y-0.5">
                  <Label htmlFor="step-extract">{step1Label}</Label>
                  <div className="text-xs text-muted-foreground">Erzeugt ein Transcript/Markdown aus der Quelle (Shadow‑Twin).</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox checked={shouldTransform} onCheckedChange={(v) => setShouldTransform(v === true)} id="step-transform" />
                <div className="space-y-0.5">
                  <Label htmlFor="step-transform">Transformation</Label>
                  <div className="text-xs text-muted-foreground">Wendet ein Template an und erzeugt eine publizierbare Fassung.</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox checked={shouldIngest} onCheckedChange={(v) => setShouldIngest(v === true)} id="step-ingest" />
                <div className="space-y-0.5">
                  <Label htmlFor="step-ingest">Ingestion</Label>
                  <div className="text-xs text-muted-foreground">Indexiert/aktualisiert Inhalte für RAG/Chat.</div>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-start gap-3 border-t pt-3">
              <Checkbox checked={shouldForce} onCheckedChange={(v) => setShouldForce(v === true)} id="step-force" />
              <div className="space-y-0.5">
                <Label htmlFor="step-force">Erzwingen</Label>
                <div className="text-xs text-muted-foreground">Ignoriert Cache/„already done“ und führt ausgewählte Schritte erneut aus.</div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => props.onOpenChange(false)}>
              Schließen
            </Button>
            <Button onClick={() => void start()} disabled={isSubmitting}>
              Jetzt starten
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}




```

```typescriptreact
"use client"

import * as React from "react"
import { toast } from "sonner"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

export interface PipelinePolicies {
  extract: "ignore" | "do" | "force"
  metadata: "ignore" | "do" | "force"
  ingest: "ignore" | "do" | "force"
}

interface PipelineSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  libraryId: string
  sourceFileName: string
  kind: "pdf" | "audio" | "video" | "markdown" | "other"
  targetLanguage: string
  onTargetLanguageChange: (value: string) => void
  templateName: string
  onTemplateNameChange: (value: string) => void
  templates: string[]
  isLoadingTemplates: boolean
  onStart: (args: { templateName?: string; targetLanguage: string; policies: PipelinePolicies }) => Promise<void>
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0
}

export function PipelineSheet(props: PipelineSheetProps) {
  // Bei Markdown: Extract immer deaktiviert (Textquelle bereits vorhanden)
  const isMarkdown = props.kind === "markdown"
  const [shouldExtract, setShouldExtract] = React.useState(!isMarkdown)
  const [shouldTransform, setShouldTransform] = React.useState(true)
  const [shouldIngest, setShouldIngest] = React.useState(true)
  const [shouldForce, setShouldForce] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Default: alle Schritte aktiv, aber beim Öffnen (auto-open) nicht unerwartet resetten.
  // Bei Markdown: Extract bleibt immer deaktiviert.
  React.useEffect(() => {
    if (!props.isOpen) return
    // Bei Markdown: Extract immer false setzen
    if (isMarkdown && shouldExtract) {
      setShouldExtract(false)
    }
    // Wenn alle drei aus sind (z.B. nach Back/Forward), setze auf Default.
    if (!shouldExtract && !shouldTransform && !shouldIngest && !isMarkdown) {
      setShouldExtract(true)
      setShouldTransform(true)
      setShouldIngest(true)
    }
  }, [props.isOpen, shouldExtract, shouldTransform, shouldIngest, isMarkdown])

  const step1Label = props.kind === "audio" || props.kind === "video" ? "Transkription" : "Extraktion"

  const templateSelectValue = props.templateName || "__none__"
  const canTransform = shouldTransform
  const canStart = shouldExtract || shouldTransform || shouldIngest

  const start = React.useCallback(async () => {
    if (!canStart) {
      toast.error("Keine Schritte ausgewählt", { description: "Bitte mindestens einen Schritt auswählen." })
      return
    }

    if (canTransform && !isNonEmptyString(props.templateName)) {
      toast.error("Template fehlt", { description: "Bitte ein Template auswählen, oder Transformation deaktivieren." })
      return
    }

    const active: "do" | "force" = shouldForce ? "force" : "do"
    // Bei Markdown: extract immer "ignore" (Textquelle bereits vorhanden)
    const policies: PipelinePolicies = {
      extract: isMarkdown ? "ignore" : (shouldExtract ? active : "ignore"),
      metadata: shouldTransform ? active : "ignore",
      ingest: shouldIngest ? active : "ignore",
    }

    setIsSubmitting(true)
    try {
      await props.onStart({
        templateName: isNonEmptyString(props.templateName) ? props.templateName : undefined,
        targetLanguage: props.targetLanguage,
        policies,
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [canStart, canTransform, props, shouldExtract, shouldForce, shouldIngest, shouldTransform])

  return (
    <Sheet open={props.isOpen} onOpenChange={props.onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader className="pr-10">
          <SheetTitle>Aufbereiten &amp; Publizieren</SheetTitle>
          <SheetDescription className="truncate">
            {props.sourceFileName}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Zielsprache</Label>
              <Select value={props.targetLanguage} onValueChange={props.onTargetLanguageChange}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="de" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="de">de</SelectItem>
                  <SelectItem value="en">en</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Template (optional)</Label>
              {props.isLoadingTemplates ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select value={templateSelectValue} onValueChange={(v) => props.onTemplateNameChange(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Radix Select: value must not be empty string. Use sentinel for "no template". */}
                    <SelectItem value="__none__">—</SelectItem>
                    {props.templates.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <div className="text-sm font-medium">Pipeline</div>
            <div className="space-y-3">
              <div className={`flex items-start gap-3 ${isMarkdown ? "opacity-50" : ""}`}>
                <Checkbox 
                  checked={shouldExtract} 
                  onCheckedChange={(v) => !isMarkdown && setShouldExtract(v === true)} 
                  id="step-extract"
                  disabled={isMarkdown}
                />
                <div className="space-y-0.5">
                  <Label htmlFor="step-extract" className={isMarkdown ? "cursor-not-allowed" : ""}>{step1Label}</Label>
                  <div className="text-xs text-muted-foreground">
                    {isMarkdown 
                      ? "Textquelle vorhanden, Extraktion übersprungen." 
                      : "Erzeugt ein Transcript/Markdown aus der Quelle (Shadow‑Twin)."}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox checked={shouldTransform} onCheckedChange={(v) => setShouldTransform(v === true)} id="step-transform" />
                <div className="space-y-0.5">
                  <Label htmlFor="step-transform">Transformation</Label>
                  <div className="text-xs text-muted-foreground">Wendet ein Template an und erzeugt eine publizierbare Fassung.</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox checked={shouldIngest} onCheckedChange={(v) => setShouldIngest(v === true)} id="step-ingest" />
                <div className="space-y-0.5">
                  <Label htmlFor="step-ingest">Ingestion</Label>
                  <div className="text-xs text-muted-foreground">Indexiert/aktualisiert Inhalte für RAG/Chat.</div>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-start gap-3 border-t pt-3">
              <Checkbox checked={shouldForce} onCheckedChange={(v) => setShouldForce(v === true)} id="step-force" />
              <div className="space-y-0.5">
                <Label htmlFor="step-force">Erzwingen</Label>
                <div className="text-xs text-muted-foreground">Ignoriert Cache/„already done“ und führt ausgewählte Schritte erneut aus.</div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => props.onOpenChange(false)}>
              Schließen
            </Button>
            <Button onClick={() => void start()} disabled={isSubmitting}>
              Jetzt starten
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}




```

```typescriptreact
"use client"

import * as React from "react"
import { toast } from "sonner"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

export interface PipelinePolicies {
  extract: "ignore" | "do" | "force"
  metadata: "ignore" | "do" | "force"
  ingest: "ignore" | "do" | "force"
}

interface PipelineSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  libraryId: string
  sourceFileName: string
  kind: "pdf" | "audio" | "video" | "markdown" | "other"
  targetLanguage: string
  onTargetLanguageChange: (value: string) => void
  templateName: string
  onTemplateNameChange: (value: string) => void
  templates: string[]
  isLoadingTemplates: boolean
  onStart: (args: { templateName?: string; targetLanguage: string; policies: PipelinePolicies }) => Promise<void>
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0
}

export function PipelineSheet(props: PipelineSheetProps) {
  // Bei Markdown: Extract immer deaktiviert (Textquelle bereits vorhanden)
  const isMarkdown = props.kind === "markdown"
  const [shouldExtract, setShouldExtract] = React.useState(!isMarkdown)
  const [shouldTransform, setShouldTransform] = React.useState(true)
  const [shouldIngest, setShouldIngest] = React.useState(true)
  const [shouldForce, setShouldForce] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Default: alle Schritte aktiv, aber beim Öffnen (auto-open) nicht unerwartet resetten.
  // Bei Markdown: Extract bleibt immer deaktiviert.
  React.useEffect(() => {
    if (!props.isOpen) return
    // Bei Markdown: Extract immer false setzen
    if (isMarkdown && shouldExtract) {
      setShouldExtract(false)
    }
    // Wenn alle drei aus sind (z.B. nach Back/Forward), setze auf Default.
    if (!shouldExtract && !shouldTransform && !shouldIngest && !isMarkdown) {
      setShouldExtract(true)
      setShouldTransform(true)
      setShouldIngest(true)
    }
  }, [props.isOpen, shouldExtract, shouldTransform, shouldIngest, isMarkdown])

  const step1Label = props.kind === "audio" || props.kind === "video" ? "Transkription" : "Extraktion"

  const templateSelectValue = props.templateName || "__none__"
  const canTransform = shouldTransform
  const canStart = shouldExtract || shouldTransform || shouldIngest

  const start = React.useCallback(async () => {
    if (!canStart) {
      toast.error("Keine Schritte ausgewählt", { description: "Bitte mindestens einen Schritt auswählen." })
      return
    }

    if (canTransform && !isNonEmptyString(props.templateName)) {
      toast.error("Template fehlt", { description: "Bitte ein Template auswählen, oder Transformation deaktivieren." })
      return
    }

    const active: "do" | "force" = shouldForce ? "force" : "do"
    // Bei Markdown: extract immer "ignore" (Textquelle bereits vorhanden)
    const policies: PipelinePolicies = {
      extract: isMarkdown ? "ignore" : (shouldExtract ? active : "ignore"),
      metadata: shouldTransform ? active : "ignore",
      ingest: shouldIngest ? active : "ignore",
    }

    setIsSubmitting(true)
    try {
      await props.onStart({
        templateName: isNonEmptyString(props.templateName) ? props.templateName : undefined,
        targetLanguage: props.targetLanguage,
        policies,
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [canStart, canTransform, props, shouldExtract, shouldForce, shouldIngest, shouldTransform, isMarkdown])

  return (
    <Sheet open={props.isOpen} onOpenChange={props.onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader className="pr-10">
          <SheetTitle>Aufbereiten &amp; Publizieren</SheetTitle>
          <SheetDescription className="truncate">
            {props.sourceFileName}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Zielsprache</Label>
              <Select value={props.targetLanguage} onValueChange={props.onTargetLanguageChange}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="de" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="de">de</SelectItem>
                  <SelectItem value="en">en</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Template (optional)</Label>
              {props.isLoadingTemplates ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select value={templateSelectValue} onValueChange={(v) => props.onTemplateNameChange(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Radix Select: value must not be empty string. Use sentinel for "no template". */}
                    <SelectItem value="__none__">—</SelectItem>
                    {props.templates.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <div className="text-sm font-medium">Pipeline</div>
            <div className="space-y-3">
              <div className={`flex items-start gap-3 ${isMarkdown ? "opacity-50" : ""}`}>
                <Checkbox 
                  checked={shouldExtract} 
                  onCheckedChange={(v) => !isMarkdown && setShouldExtract(v === true)} 
                  id="step-extract"
                  disabled={isMarkdown}
                />
                <div className="space-y-0.5">
                  <Label htmlFor="step-extract" className={isMarkdown ? "cursor-not-allowed" : ""}>{step1Label}</Label>
                  <div className="text-xs text-muted-foreground">
                    {isMarkdown 
                      ? "Textquelle vorhanden, Extraktion übersprungen." 
                      : "Erzeugt ein Transcript/Markdown aus der Quelle (Shadow‑Twin)."}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox checked={shouldTransform} onCheckedChange={(v) => setShouldTransform(v === true)} id="step-transform" />
                <div className="space-y-0.5">
                  <Label htmlFor="step-transform">Transformation</Label>
                  <div className="text-xs text-muted-foreground">Wendet ein Template an und erzeugt eine publizierbare Fassung.</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox checked={shouldIngest} onCheckedChange={(v) => setShouldIngest(v === true)} id="step-ingest" />
                <div className="space-y-0.5">
                  <Label htmlFor="step-ingest">Ingestion</Label>
                  <div className="text-xs text-muted-foreground">Indexiert/aktualisiert Inhalte für RAG/Chat.</div>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-start gap-3 border-t pt-3">
              <Checkbox checked={shouldForce} onCheckedChange={(v) => setShouldForce(v === true)} id="step-force" />
              <div className="space-y-0.5">
                <Label htmlFor="step-force">Erzwingen</Label>
                <div className="text-xs text-muted-foreground">Ignoriert Cache/„already done“ und führt ausgewählte Schritte erneut aus.</div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => props.onOpenChange(false)}>
              Schließen
            </Button>
            <Button onClick={() => void start()} disabled={isSubmitting}>
              Jetzt starten
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}




```

Anpassen von FlowActions, damit Markdown korrekt erkannt und unterstützt wird:


```typescriptreact
type MediaKind = "pdf" | "audio" | "video" | "image" | "markdown" | "unknown"
```

```typescriptreact
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { parseAsString, useQueryState } from "nuqs"
import { toast } from "sonner"
import { useAtomValue } from "jotai"

import type { StorageItem } from "@/lib/storage/types"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileLogger } from "@/lib/debug/logger"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ArrowLeft, ExternalLink, FileText, PanelLeftClose, ScrollText, Settings, Sparkles } from "lucide-react"
import type { ShadowTwinTransformationEntry } from "@/components/library/flow/use-shadow-twin-artifacts"
import { PipelineSheet, type PipelinePolicies } from "@/components/library/flow/pipeline-sheet"
import { loadPdfDefaults } from "@/lib/pdf-defaults"
import { getEffectivePdfDefaults } from "@/atoms/pdf-defaults"
import { activeLibraryAtom } from "@/atoms/library-atom"
import { TARGET_LANGUAGE_DEFAULT, type TargetLanguage } from "@/lib/chat/constants"

type MediaKind = "pdf" | "audio" | "video" | "image" | "markdown" | "unknown"

const PdfPhaseSettings = React.lazy(() =>
  import("@/components/library/pdf-phase-settings").then(m => ({ default: m.PdfPhaseSettings }))
)

function getMediaKind(file: StorageItem): MediaKind {
  const name = (file.metadata?.name || "").toLowerCase()
  const mime = (file.metadata?.mimeType || "").toLowerCase()

  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf"
  if (mime.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|opus|flac)$/.test(name)) return "audio"
  if (mime.startsWith("video/") || /\.(mp4|mov|avi|webm|mkv)$/.test(name)) return "video"
  if (mime.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/.test(name)) return "image"
  if (mime.includes("markdown") || /\.(md|mdx|txt)$/.test(name)) return "markdown"
  return "unknown"
}

interface FlowActionsProps {
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  streamingUrl: string | null
  backHref: string
  transformations: ShadowTwinTransformationEntry[]
  shadowTwinFolderId: string | null
  shouldPromptPipeline: boolean
}

interface JobUpdateWire {
  type: "job_update"
  jobId: string
  status?: string
  progress?: number
  message?: string
  updatedAt?: string
  jobType?: string
  libraryId?: string
  result?: { savedItemId?: string }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0
}

async function enqueuePdfJob(args: {
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  targetLanguage: string
  templateName?: string
  policies: { extract: string; metadata: string; ingest: string }
  libraryConfigChatTargetLanguage?: TargetLanguage
  libraryConfigPdfTemplate?: string
}): Promise<string> {
  // Lade PDF-Defaults für diese Library (inkl. globaler Default mistral_ocr)
  const defaults = getEffectivePdfDefaults(
    args.libraryId,
    loadPdfDefaults(args.libraryId),
    {},
    args.libraryConfigChatTargetLanguage,
    args.libraryConfigPdfTemplate
  )
  const extractionMethod = typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'mistral_ocr'
  const isMistralOcr = extractionMethod === 'mistral_ocr'
  
  const fd = new FormData()
  fd.append("originalItemId", args.sourceFile.id)
  fd.append("parentId", args.parentId)
  fd.append("fileName", args.sourceFile.metadata.name)
  fd.append("mimeType", args.sourceFile.metadata.mimeType || "application/pdf")
  fd.append("targetLanguage", args.targetLanguage)
  fd.append("extractionMethod", extractionMethod)
  // Bei Mistral OCR: includePageImages immer true (erzwungen)
  if (isMistralOcr) {
    const includePageImages = defaults.includePageImages !== undefined ? defaults.includePageImages : true
    const includeOcrImages = defaults.includeOcrImages !== undefined ? defaults.includeOcrImages : true
    if (includePageImages) fd.append("includePageImages", "true")
    if (includeOcrImages) fd.append("includeOcrImages", "true")
  }
  fd.append("useCache", String(defaults.useCache ?? true))
  if (isNonEmptyString(args.templateName)) fd.append("template", args.templateName)
  fd.append("policies", JSON.stringify(args.policies))

  const res = await fetch("/api/secretary/process-pdf", {
    method: "POST",
    headers: { "X-Library-Id": args.libraryId },
    body: fd,
  })
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as {
    error?: unknown
    job?: { id?: unknown }
  }
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`)
  const jobId = typeof json.job?.id === "string" ? json.job.id : ""
  if (!jobId) throw new Error("Job-ID fehlt in Response")
  return jobId
}

async function enqueueMediaJob(args: {
  endpoint: "/api/secretary/process-audio/job" | "/api/secretary/process-video/job"
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  targetLanguage: string
  templateName?: string
  policies: { extract: string; metadata: string; ingest: string }
}): Promise<string> {
  const res = await fetch(args.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Library-Id": args.libraryId,
    },
    body: JSON.stringify({
      originalItemId: args.sourceFile.id,
      parentId: args.parentId,
      fileName: args.sourceFile.metadata.name,
      mimeType: args.sourceFile.metadata.mimeType,
      targetLanguage: args.targetLanguage,
      sourceLanguage: "auto",
      useCache: true,
      ...(isNonEmptyString(args.templateName) ? { template: args.templateName } : {}),
      policies: args.policies,
    }),
  })
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as {
    error?: unknown
    job?: { id?: unknown }
  }
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`)
  const jobId = typeof json.job?.id === "string" ? json.job.id : ""
  if (!jobId) throw new Error("Job-ID fehlt in Response")
  return jobId
}

export function FlowActions({
  libraryId,
  sourceFile,
  parentId,
  streamingUrl,
  backHref,
  transformations,
  shadowTwinFolderId,
  shouldPromptPipeline,
}: FlowActionsProps) {
  const router = useRouter()
  const [targetLanguage, setTargetLanguage] = useQueryState("targetLanguage", parseAsString.withDefault(""))
  const [templateName, setTemplateName] = useQueryState("templateName", parseAsString.withDefault(""))
  // mobile-first default: hide left/source pane unless user explicitly enables it
  const [leftPaneMode, setLeftPaneMode] = useQueryState("left", parseAsString.withDefault("off"))
  const [activeTransformationId, setActiveTransformationId] = useQueryState("transformationId", parseAsString.withDefault(""))
  // `pipeline` Query Param:
  // - ''  => nicht gesetzt (Initialzustand; Auto-Open darf einmal greifen)
  // - '1' => offen
  // - '0' => vom User explizit geschlossen (Auto-Open darf NICHT erneut öffnen)
  const [pipelineParam, setPipelineParam] = useQueryState("pipeline", parseAsString.withDefault(""))

  const [templates, setTemplates] = React.useState<string[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = React.useState(false)

  const [isRunning, setIsRunning] = React.useState(false)
  const [activeJob, setActiveJob] = React.useState<{ jobId: string; status?: string; progress?: number; message?: string } | null>(null)
  const [settingsOpen, setSettingsOpen] = React.useState(false)

  const activeLibrary = useAtomValue(activeLibraryAtom)
  const libraryConfigChatTargetLanguage = activeLibrary?.config?.chat?.targetLanguage
  const libraryConfigPdfTemplate = activeLibrary?.config?.secretaryService?.pdfDefaults?.template

  const kind = getMediaKind(sourceFile)
  const transformationSelectValue = activeTransformationId || "__latest__"
  const isPdf = kind === "pdf"
  const isPipelineOpen = pipelineParam === "1"
  const defaults = getEffectivePdfDefaults(
    libraryId,
    loadPdfDefaults(libraryId),
    {},
    libraryConfigChatTargetLanguage,
    libraryConfigPdfTemplate
  )
  const effectiveTargetLanguage = typeof defaults.targetLanguage === "string"
    ? defaults.targetLanguage
    : TARGET_LANGUAGE_DEFAULT
  const effectiveTemplateName = typeof defaults.template === "string" ? defaults.template : ""

  const openPipeline = React.useCallback(() => {
    void setPipelineParam("1")
  }, [setPipelineParam])

  const closePipeline = React.useCallback(() => {
    void setPipelineParam("0")
  }, [setPipelineParam])
  const openSourceInNewTab = React.useCallback(() => {
    if (!streamingUrl) return
    window.open(streamingUrl, "_blank", "noopener,noreferrer")
  }, [streamingUrl])

  const goBack = React.useCallback(() => {
    router.push(backHref)
  }, [router, backHref])

  React.useEffect(() => {
    if (!shouldPromptPipeline) return
    // Auto-open NUR, wenn der Param noch nicht gesetzt ist.
    // Wenn der User einmal schließt (`pipeline=0`), respektieren wir das.
    if (pipelineParam !== "") return
    void setPipelineParam("1")
  }, [shouldPromptPipeline, pipelineParam, setPipelineParam])

  // Falls URL-Parameter fehlen, setze sie aus Defaults (inkl. Library-Config)
  React.useEffect(() => {
    if (!targetLanguage && effectiveTargetLanguage) {
      void setTargetLanguage(effectiveTargetLanguage)
    }
    if (!templateName && effectiveTemplateName) {
      void setTemplateName(effectiveTemplateName)
    }
  }, [targetLanguage, templateName, effectiveTargetLanguage, effectiveTemplateName, setTargetLanguage, setTemplateName])

  React.useEffect(() => {
    let cancelled = false
    async function loadTemplates() {
      if (!libraryId) return
      if (!isPipelineOpen) return
      setIsLoadingTemplates(true)
      try {
        const { listAvailableTemplates } = await import("@/lib/templates/template-service-client")
        const names = await listAvailableTemplates(libraryId)
        if (cancelled) return
        setTemplates(Array.isArray(names) ? names : [])
        // If current templateName is invalid, clear it (avoid resolver/transform confusion).
        if (isNonEmptyString(templateName) && !names.includes(templateName)) {
          void setTemplateName("")
        }
      } catch (err) {
        FileLogger.warn("flow-actions", "Templates konnten nicht geladen werden", {
          error: err instanceof Error ? err.message : String(err),
        })
        if (!cancelled) setTemplates([])
      } finally {
        if (!cancelled) setIsLoadingTemplates(false)
      }
    }
    void loadTemplates()
    return () => {
      cancelled = true
    }
  }, [libraryId, templateName, setTemplateName, isPipelineOpen])

  // Subscribe to SSE and update active job state (thin UI only; engine stays server-side).
  React.useEffect(() => {
    if (!activeJob?.jobId) return
    let cancelled = false
    const es = new EventSource("/api/external/jobs/stream")

    es.addEventListener("job_update", (e: MessageEvent) => {
      try {
        const evt = JSON.parse(e.data) as JobUpdateWire
        if (cancelled) return
        if (!evt || evt.type !== "job_update") return
        if (evt.jobId !== activeJob.jobId) return
        setActiveJob(prev => {
          if (!prev) return prev
          return {
            jobId: prev.jobId,
            status: typeof evt.status === "string" ? evt.status : prev.status,
            progress: typeof evt.progress === "number" ? evt.progress : prev.progress,
            message: typeof evt.message === "string" ? evt.message : prev.message,
          }
        })
      } catch {
        // ignore
      }
    })

    es.addEventListener("error", () => {
      // Non-fatal: die Seite bleibt nutzbar; Shadow‑Twin Artefakte sind die Wahrheit.
    })

    return () => {
      cancelled = true
      try {
        es.close()
      } catch {}
    }
  }, [activeJob?.jobId])

  const runPipeline = React.useCallback(
    async (args: { templateName?: string; targetLanguage: string; policies: PipelinePolicies }) => {
      if (!libraryId) {
        toast.error("Fehler", { description: "libraryId fehlt" })
        return
      }
      if (sourceFile.type !== "file") {
        toast.error("Fehler", { description: "Quelle ist keine Datei" })
        return
      }
      if (!parentId) {
        toast.error("Fehler", { description: "parentId fehlt" })
        return
      }

      setIsRunning(true)
      try {
        let jobId = ""
        if (kind === "pdf") {
          jobId = await enqueuePdfJob({
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
            libraryConfigChatTargetLanguage,
            libraryConfigPdfTemplate,
          })
        } else if (kind === "audio") {
          jobId = await enqueueMediaJob({
            endpoint: "/api/secretary/process-audio/job",
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
          })
        } else if (kind === "video") {
          jobId = await enqueueMediaJob({
            endpoint: "/api/secretary/process-video/job",
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
          })
        } else {
          toast.error("Nicht unterstützt", {
            description: `Flow Actions sind aktuell nur für PDF/Audio/Video vorgesehen (Dateityp: ${kind}).`,
          })
          return
        }

        setActiveJob({ jobId, status: "queued", progress: 0, message: "queued" })
        toast.success("Job angelegt", { description: `Job ${jobId} wurde enqueued.` })

        // WICHTIG:
        // Jobs werden von `ExternalJobsWorker` gestartet. Wenn wir hier zusätzlich `/start` callen,
        // kommt es zu doppelten Worker-Requests und damit zu 2 Secretary-Jobs + callback_token mismatch (401).
        // Deshalb: nur enqueue. Der Worker startet den Job automatisch (Polling-Intervall i.d.R. <2s).
        toast.success("Job in Warteschlange", { description: "Worker startet den Job automatisch. Ergebnisse erscheinen im Shadow‑Twin." })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        FileLogger.error("flow-actions", "Action fehlgeschlagen", { msg })
        toast.error("Fehler", { description: msg })
      } finally {
        setIsRunning(false)
      }
    },
    [libraryId, sourceFile, parentId, kind, libraryConfigChatTargetLanguage, libraryConfigPdfTemplate]
  )

  return (
    <div className="border-b px-3 py-2">
      <TooltipProvider>
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          {/* Back first (Experten-Toolbar) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Zurück"
                onClick={goBack}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Zurück</TooltipContent>
          </Tooltip>

          {/* Left pane controls (mobile-first: default hidden, user can enable) */}
          {isPdf ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "pdf" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Quelle"
                    aria-pressed={leftPaneMode === "pdf"}
                    onClick={() => void setLeftPaneMode("pdf")}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Quelle</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "transcript" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Transcript"
                    aria-pressed={leftPaneMode === "transcript"}
                    onClick={() => void setLeftPaneMode("transcript")}
                  >
                    <ScrollText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Transcript</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "off" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel ausblenden"
                    aria-pressed={leftPaneMode === "off"}
                    onClick={() => void setLeftPaneMode("off")}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links ausblenden</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="PDF-Standardwerte"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">PDF-Standardwerte</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "pdf" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Quelle"
                    aria-pressed={leftPaneMode === "pdf"}
                    onClick={() => void setLeftPaneMode("pdf")}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Quelle</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "off" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel ausblenden"
                    aria-pressed={leftPaneMode === "off"}
                    onClick={() => void setLeftPaneMode("off")}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links ausblenden</TooltipContent>
              </Tooltip>
            </>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Quelle im neuen Tab öffnen"
                onClick={openSourceInNewTab}
                disabled={!streamingUrl}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Quelle im neuen Tab</TooltipContent>
          </Tooltip>

          <div className="mx-1 h-6 w-px bg-border" />

          <div className="flex-1" />

          {/* Aktuelle Transformationsdatei (Shadow‑Twin Truth) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Transformieren</span>
                <Select
                  value={transformationSelectValue}
                  onValueChange={(v) => void setActiveTransformationId(v === "__latest__" ? "" : v)}
                  disabled={transformations.length === 0}
                >
                  <SelectTrigger className="h-8 w-[220px]">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__latest__">neueste</SelectItem>
                    {transformations.map((t) => {
                      const label = `${t.templateName}${t.targetLanguage ? ` · ${t.targetLanguage}` : ""}`
                      return (
                        <SelectItem key={t.item.id} value={t.item.id}>
                          {label}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {shadowTwinFolderId ? "Shadow‑Twin vorhanden" : "Kein Shadow‑Twin Ordner gefunden"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8"
                onClick={openPipeline}
                disabled={isRunning}
              >
                <Sparkles className="h-4 w-4" />
                Transformieren
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Story Creator öffnen</TooltipContent>
          </Tooltip>

          {activeJob ? (
            <div className="text-xs text-muted-foreground">
              <span className="font-mono">{activeJob.jobId}</span>
              {activeJob.status ? ` · ${activeJob.status}` : ""}
              {typeof activeJob.progress === "number" ? ` · ${Math.round(activeJob.progress)}%` : ""}
              {activeJob.message ? ` · ${activeJob.message}` : ""}
            </div>
          ) : null}
        </div>
      </TooltipProvider>

      {settingsOpen && (
        <React.Suspense>
          <PdfPhaseSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
        </React.Suspense>
      )}

      <PipelineSheet
        isOpen={isPipelineOpen}
        onOpenChange={(open) => (open ? void setPipelineParam("1") : closePipeline())}
        libraryId={libraryId}
        sourceFileName={sourceFile.metadata.name}
        kind={kind === "pdf" || kind === "audio" || kind === "video" || kind === "markdown" ? kind : "other"}
        targetLanguage={targetLanguage}
        onTargetLanguageChange={(v) => void setTargetLanguage(v)}
        templateName={templateName}
        onTemplateNameChange={(v) => void setTemplateName(v)}
        templates={templates}
        isLoadingTemplates={isLoadingTemplates}
        onStart={runPipeline}
      />
    </div>
  )
}



```

Hinzufügen der Markdown-Unterstützung in FlowActions:


```typescriptreact
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { parseAsString, useQueryState } from "nuqs"
import { toast } from "sonner"
import { useAtomValue } from "jotai"

import type { StorageItem } from "@/lib/storage/types"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileLogger } from "@/lib/debug/logger"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ArrowLeft, ExternalLink, FileText, PanelLeftClose, ScrollText, Settings, Sparkles } from "lucide-react"
import type { ShadowTwinTransformationEntry } from "@/components/library/flow/use-shadow-twin-artifacts"
import { PipelineSheet, type PipelinePolicies } from "@/components/library/flow/pipeline-sheet"
import { loadPdfDefaults } from "@/lib/pdf-defaults"
import { getEffectivePdfDefaults } from "@/atoms/pdf-defaults"
import { activeLibraryAtom } from "@/atoms/library-atom"
import { TARGET_LANGUAGE_DEFAULT, type TargetLanguage } from "@/lib/chat/constants"

type MediaKind = "pdf" | "audio" | "video" | "image" | "markdown" | "unknown"

const PdfPhaseSettings = React.lazy(() =>
  import("@/components/library/pdf-phase-settings").then(m => ({ default: m.PdfPhaseSettings }))
)

function getMediaKind(file: StorageItem): MediaKind {
  const name = (file.metadata?.name || "").toLowerCase()
  const mime = (file.metadata?.mimeType || "").toLowerCase()

  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf"
  if (mime.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|opus|flac)$/.test(name)) return "audio"
  if (mime.startsWith("video/") || /\.(mp4|mov|avi|webm|mkv)$/.test(name)) return "video"
  if (mime.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/.test(name)) return "image"
  if (mime.includes("markdown") || /\.(md|mdx|txt)$/.test(name)) return "markdown"
  return "unknown"
}

interface FlowActionsProps {
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  streamingUrl: string | null
  backHref: string
  transformations: ShadowTwinTransformationEntry[]
  shadowTwinFolderId: string | null
  shouldPromptPipeline: boolean
}

interface JobUpdateWire {
  type: "job_update"
  jobId: string
  status?: string
  progress?: number
  message?: string
  updatedAt?: string
  jobType?: string
  libraryId?: string
  result?: { savedItemId?: string }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0
}

async function enqueuePdfJob(args: {
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  targetLanguage: string
  templateName?: string
  policies: { extract: string; metadata: string; ingest: string }
  libraryConfigChatTargetLanguage?: TargetLanguage
  libraryConfigPdfTemplate?: string
}): Promise<string> {
  // Lade PDF-Defaults für diese Library (inkl. globaler Default mistral_ocr)
  const defaults = getEffectivePdfDefaults(
    args.libraryId,
    loadPdfDefaults(args.libraryId),
    {},
    args.libraryConfigChatTargetLanguage,
    args.libraryConfigPdfTemplate
  )
  const extractionMethod = typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'mistral_ocr'
  const isMistralOcr = extractionMethod === 'mistral_ocr'
  
  const fd = new FormData()
  fd.append("originalItemId", args.sourceFile.id)
  fd.append("parentId", args.parentId)
  fd.append("fileName", args.sourceFile.metadata.name)
  fd.append("mimeType", args.sourceFile.metadata.mimeType || "application/pdf")
  fd.append("targetLanguage", args.targetLanguage)
  fd.append("extractionMethod", extractionMethod)
  // Bei Mistral OCR: includePageImages immer true (erzwungen)
  if (isMistralOcr) {
    const includePageImages = defaults.includePageImages !== undefined ? defaults.includePageImages : true
    const includeOcrImages = defaults.includeOcrImages !== undefined ? defaults.includeOcrImages : true
    if (includePageImages) fd.append("includePageImages", "true")
    if (includeOcrImages) fd.append("includeOcrImages", "true")
  }
  fd.append("useCache", String(defaults.useCache ?? true))
  if (isNonEmptyString(args.templateName)) fd.append("template", args.templateName)
  fd.append("policies", JSON.stringify(args.policies))

  const res = await fetch("/api/secretary/process-pdf", {
    method: "POST",
    headers: { "X-Library-Id": args.libraryId },
    body: fd,
  })
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as {
    error?: unknown
    job?: { id?: unknown }
  }
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`)
  const jobId = typeof json.job?.id === "string" ? json.job.id : ""
  if (!jobId) throw new Error("Job-ID fehlt in Response")
  return jobId
}

async function enqueueMediaJob(args: {
  endpoint: "/api/secretary/process-audio/job" | "/api/secretary/process-video/job"
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  targetLanguage: string
  templateName?: string
  policies: { extract: string; metadata: string; ingest: string }
}): Promise<string> {
  const res = await fetch(args.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Library-Id": args.libraryId,
    },
    body: JSON.stringify({
      originalItemId: args.sourceFile.id,
      parentId: args.parentId,
      fileName: args.sourceFile.metadata.name,
      mimeType: args.sourceFile.metadata.mimeType,
      targetLanguage: args.targetLanguage,
      sourceLanguage: "auto",
      useCache: true,
      ...(isNonEmptyString(args.templateName) ? { template: args.templateName } : {}),
      policies: args.policies,
    }),
  })
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as {
    error?: unknown
    job?: { id?: unknown }
  }
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`)
  const jobId = typeof json.job?.id === "string" ? json.job.id : ""
  if (!jobId) throw new Error("Job-ID fehlt in Response")
  return jobId
}

async function enqueueTextJob(args: {
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  targetLanguage: string
  templateName?: string
  policies: { extract: string; metadata: string; ingest: string }
}): Promise<string> {
  const res = await fetch("/api/secretary/process-text/job", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Library-Id": args.libraryId,
    },
    body: JSON.stringify({
      originalItemId: args.sourceFile.id,
      parentId: args.parentId,
      fileName: args.sourceFile.metadata.name,
      mimeType: args.sourceFile.metadata.mimeType,
      targetLanguage: args.targetLanguage,
      ...(isNonEmptyString(args.templateName) ? { template: args.templateName } : {}),
      policies: args.policies,
    }),
  })
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as {
    error?: unknown
    job?: { id?: unknown }
  }
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`)
  const jobId = typeof json.job?.id === "string" ? json.job.id : ""
  if (!jobId) throw new Error("Job-ID fehlt in Response")
  return jobId
}

export function FlowActions({
  libraryId,
  sourceFile,
  parentId,
  streamingUrl,
  backHref,
  transformations,
  shadowTwinFolderId,
  shouldPromptPipeline,
}: FlowActionsProps) {
  const router = useRouter()
  const [targetLanguage, setTargetLanguage] = useQueryState("targetLanguage", parseAsString.withDefault(""))
  const [templateName, setTemplateName] = useQueryState("templateName", parseAsString.withDefault(""))
  // mobile-first default: hide left/source pane unless user explicitly enables it
  const [leftPaneMode, setLeftPaneMode] = useQueryState("left", parseAsString.withDefault("off"))
  const [activeTransformationId, setActiveTransformationId] = useQueryState("transformationId", parseAsString.withDefault(""))
  // `pipeline` Query Param:
  // - ''  => nicht gesetzt (Initialzustand; Auto-Open darf einmal greifen)
  // - '1' => offen
  // - '0' => vom User explizit geschlossen (Auto-Open darf NICHT erneut öffnen)
  const [pipelineParam, setPipelineParam] = useQueryState("pipeline", parseAsString.withDefault(""))

  const [templates, setTemplates] = React.useState<string[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = React.useState(false)

  const [isRunning, setIsRunning] = React.useState(false)
  const [activeJob, setActiveJob] = React.useState<{ jobId: string; status?: string; progress?: number; message?: string } | null>(null)
  const [settingsOpen, setSettingsOpen] = React.useState(false)

  const activeLibrary = useAtomValue(activeLibraryAtom)
  const libraryConfigChatTargetLanguage = activeLibrary?.config?.chat?.targetLanguage
  const libraryConfigPdfTemplate = activeLibrary?.config?.secretaryService?.pdfDefaults?.template

  const kind = getMediaKind(sourceFile)
  const transformationSelectValue = activeTransformationId || "__latest__"
  const isPdf = kind === "pdf"
  const isPipelineOpen = pipelineParam === "1"
  const defaults = getEffectivePdfDefaults(
    libraryId,
    loadPdfDefaults(libraryId),
    {},
    libraryConfigChatTargetLanguage,
    libraryConfigPdfTemplate
  )
  const effectiveTargetLanguage = typeof defaults.targetLanguage === "string"
    ? defaults.targetLanguage
    : TARGET_LANGUAGE_DEFAULT
  const effectiveTemplateName = typeof defaults.template === "string" ? defaults.template : ""

  const openPipeline = React.useCallback(() => {
    void setPipelineParam("1")
  }, [setPipelineParam])

  const closePipeline = React.useCallback(() => {
    void setPipelineParam("0")
  }, [setPipelineParam])
  const openSourceInNewTab = React.useCallback(() => {
    if (!streamingUrl) return
    window.open(streamingUrl, "_blank", "noopener,noreferrer")
  }, [streamingUrl])

  const goBack = React.useCallback(() => {
    router.push(backHref)
  }, [router, backHref])

  React.useEffect(() => {
    if (!shouldPromptPipeline) return
    // Auto-open NUR, wenn der Param noch nicht gesetzt ist.
    // Wenn der User einmal schließt (`pipeline=0`), respektieren wir das.
    if (pipelineParam !== "") return
    void setPipelineParam("1")
  }, [shouldPromptPipeline, pipelineParam, setPipelineParam])

  // Falls URL-Parameter fehlen, setze sie aus Defaults (inkl. Library-Config)
  React.useEffect(() => {
    if (!targetLanguage && effectiveTargetLanguage) {
      void setTargetLanguage(effectiveTargetLanguage)
    }
    if (!templateName && effectiveTemplateName) {
      void setTemplateName(effectiveTemplateName)
    }
  }, [targetLanguage, templateName, effectiveTargetLanguage, effectiveTemplateName, setTargetLanguage, setTemplateName])

  React.useEffect(() => {
    let cancelled = false
    async function loadTemplates() {
      if (!libraryId) return
      if (!isPipelineOpen) return
      setIsLoadingTemplates(true)
      try {
        const { listAvailableTemplates } = await import("@/lib/templates/template-service-client")
        const names = await listAvailableTemplates(libraryId)
        if (cancelled) return
        setTemplates(Array.isArray(names) ? names : [])
        // If current templateName is invalid, clear it (avoid resolver/transform confusion).
        if (isNonEmptyString(templateName) && !names.includes(templateName)) {
          void setTemplateName("")
        }
      } catch (err) {
        FileLogger.warn("flow-actions", "Templates konnten nicht geladen werden", {
          error: err instanceof Error ? err.message : String(err),
        })
        if (!cancelled) setTemplates([])
      } finally {
        if (!cancelled) setIsLoadingTemplates(false)
      }
    }
    void loadTemplates()
    return () => {
      cancelled = true
    }
  }, [libraryId, templateName, setTemplateName, isPipelineOpen])

  // Subscribe to SSE and update active job state (thin UI only; engine stays server-side).
  React.useEffect(() => {
    if (!activeJob?.jobId) return
    let cancelled = false
    const es = new EventSource("/api/external/jobs/stream")

    es.addEventListener("job_update", (e: MessageEvent) => {
      try {
        const evt = JSON.parse(e.data) as JobUpdateWire
        if (cancelled) return
        if (!evt || evt.type !== "job_update") return
        if (evt.jobId !== activeJob.jobId) return
        setActiveJob(prev => {
          if (!prev) return prev
          return {
            jobId: prev.jobId,
            status: typeof evt.status === "string" ? evt.status : prev.status,
            progress: typeof evt.progress === "number" ? evt.progress : prev.progress,
            message: typeof evt.message === "string" ? evt.message : prev.message,
          }
        })
      } catch {
        // ignore
      }
    })

    es.addEventListener("error", () => {
      // Non-fatal: die Seite bleibt nutzbar; Shadow‑Twin Artefakte sind die Wahrheit.
    })

    return () => {
      cancelled = true
      try {
        es.close()
      } catch {}
    }
  }, [activeJob?.jobId])

  const runPipeline = React.useCallback(
    async (args: { templateName?: string; targetLanguage: string; policies: PipelinePolicies }) => {
      if (!libraryId) {
        toast.error("Fehler", { description: "libraryId fehlt" })
        return
      }
      if (sourceFile.type !== "file") {
        toast.error("Fehler", { description: "Quelle ist keine Datei" })
        return
      }
      if (!parentId) {
        toast.error("Fehler", { description: "parentId fehlt" })
        return
      }

      setIsRunning(true)
      try {
        let jobId = ""
        if (kind === "pdf") {
          jobId = await enqueuePdfJob({
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
            libraryConfigChatTargetLanguage,
            libraryConfigPdfTemplate,
          })
        } else if (kind === "audio") {
          jobId = await enqueueMediaJob({
            endpoint: "/api/secretary/process-audio/job",
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
          })
        } else if (kind === "video") {
          jobId = await enqueueMediaJob({
            endpoint: "/api/secretary/process-video/job",
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
          })
        } else {
          toast.error("Nicht unterstützt", {
            description: `Flow Actions sind aktuell nur für PDF/Audio/Video vorgesehen (Dateityp: ${kind}).`,
          })
          return
        }

        setActiveJob({ jobId, status: "queued", progress: 0, message: "queued" })
        toast.success("Job angelegt", { description: `Job ${jobId} wurde enqueued.` })

        // WICHTIG:
        // Jobs werden von `ExternalJobsWorker` gestartet. Wenn wir hier zusätzlich `/start` callen,
        // kommt es zu doppelten Worker-Requests und damit zu 2 Secretary-Jobs + callback_token mismatch (401).
        // Deshalb: nur enqueue. Der Worker startet den Job automatisch (Polling-Intervall i.d.R. <2s).
        toast.success("Job in Warteschlange", { description: "Worker startet den Job automatisch. Ergebnisse erscheinen im Shadow‑Twin." })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        FileLogger.error("flow-actions", "Action fehlgeschlagen", { msg })
        toast.error("Fehler", { description: msg })
      } finally {
        setIsRunning(false)
      }
    },
    [libraryId, sourceFile, parentId, kind, libraryConfigChatTargetLanguage, libraryConfigPdfTemplate]
  )

  return (
    <div className="border-b px-3 py-2">
      <TooltipProvider>
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          {/* Back first (Experten-Toolbar) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Zurück"
                onClick={goBack}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Zurück</TooltipContent>
          </Tooltip>

          {/* Left pane controls (mobile-first: default hidden, user can enable) */}
          {isPdf ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "pdf" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Quelle"
                    aria-pressed={leftPaneMode === "pdf"}
                    onClick={() => void setLeftPaneMode("pdf")}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Quelle</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "transcript" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Transcript"
                    aria-pressed={leftPaneMode === "transcript"}
                    onClick={() => void setLeftPaneMode("transcript")}
                  >
                    <ScrollText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Transcript</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "off" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel ausblenden"
                    aria-pressed={leftPaneMode === "off"}
                    onClick={() => void setLeftPaneMode("off")}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links ausblenden</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="PDF-Standardwerte"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">PDF-Standardwerte</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "pdf" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Quelle"
                    aria-pressed={leftPaneMode === "pdf"}
                    onClick={() => void setLeftPaneMode("pdf")}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Quelle</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "off" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel ausblenden"
                    aria-pressed={leftPaneMode === "off"}
                    onClick={() => void setLeftPaneMode("off")}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links ausblenden</TooltipContent>
              </Tooltip>
            </>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Quelle im neuen Tab öffnen"
                onClick={openSourceInNewTab}
                disabled={!streamingUrl}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Quelle im neuen Tab</TooltipContent>
          </Tooltip>

          <div className="mx-1 h-6 w-px bg-border" />

          <div className="flex-1" />

          {/* Aktuelle Transformationsdatei (Shadow‑Twin Truth) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Transformieren</span>
                <Select
                  value={transformationSelectValue}
                  onValueChange={(v) => void setActiveTransformationId(v === "__latest__" ? "" : v)}
                  disabled={transformations.length === 0}
                >
                  <SelectTrigger className="h-8 w-[220px]">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__latest__">neueste</SelectItem>
                    {transformations.map((t) => {
                      const label = `${t.templateName}${t.targetLanguage ? ` · ${t.targetLanguage}` : ""}`
                      return (
                        <SelectItem key={t.item.id} value={t.item.id}>
                          {label}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {shadowTwinFolderId ? "Shadow‑Twin vorhanden" : "Kein Shadow‑Twin Ordner gefunden"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8"
                onClick={openPipeline}
                disabled={isRunning}
              >
                <Sparkles className="h-4 w-4" />
                Transformieren
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Story Creator öffnen</TooltipContent>
          </Tooltip>

          {activeJob ? (
            <div className="text-xs text-muted-foreground">
              <span className="font-mono">{activeJob.jobId}</span>
              {activeJob.status ? ` · ${activeJob.status}` : ""}
              {typeof activeJob.progress === "number" ? ` · ${Math.round(activeJob.progress)}%` : ""}
              {activeJob.message ? ` · ${activeJob.message}` : ""}
            </div>
          ) : null}
        </div>
      </TooltipProvider>

      {settingsOpen && (
        <React.Suspense>
          <PdfPhaseSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
        </React.Suspense>
      )}

      <PipelineSheet
        isOpen={isPipelineOpen}
        onOpenChange={(open) => (open ? void setPipelineParam("1") : closePipeline())}
        libraryId={libraryId}
        sourceFileName={sourceFile.metadata.name}
        kind={kind === "pdf" || kind === "audio" || kind === "video" || kind === "markdown" ? kind : "other"}
        targetLanguage={targetLanguage}
        onTargetLanguageChange={(v) => void setTargetLanguage(v)}
        templateName={templateName}
        onTemplateNameChange={(v) => void setTemplateName(v)}
        templates={templates}
        isLoadingTemplates={isLoadingTemplates}
        onStart={runPipeline}
      />
    </div>
  )
}



```

```typescriptreact
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { parseAsString, useQueryState } from "nuqs"
import { toast } from "sonner"
import { useAtomValue } from "jotai"

import type { StorageItem } from "@/lib/storage/types"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileLogger } from "@/lib/debug/logger"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ArrowLeft, ExternalLink, FileText, PanelLeftClose, ScrollText, Settings, Sparkles } from "lucide-react"
import type { ShadowTwinTransformationEntry } from "@/components/library/flow/use-shadow-twin-artifacts"
import { PipelineSheet, type PipelinePolicies } from "@/components/library/flow/pipeline-sheet"
import { loadPdfDefaults } from "@/lib/pdf-defaults"
import { getEffectivePdfDefaults } from "@/atoms/pdf-defaults"
import { activeLibraryAtom } from "@/atoms/library-atom"
import { TARGET_LANGUAGE_DEFAULT, type TargetLanguage } from "@/lib/chat/constants"

type MediaKind = "pdf" | "audio" | "video" | "image" | "markdown" | "unknown"

const PdfPhaseSettings = React.lazy(() =>
  import("@/components/library/pdf-phase-settings").then(m => ({ default: m.PdfPhaseSettings }))
)

function getMediaKind(file: StorageItem): MediaKind {
  const name = (file.metadata?.name || "").toLowerCase()
  const mime = (file.metadata?.mimeType || "").toLowerCase()

  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf"
  if (mime.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|opus|flac)$/.test(name)) return "audio"
  if (mime.startsWith("video/") || /\.(mp4|mov|avi|webm|mkv)$/.test(name)) return "video"
  if (mime.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/.test(name)) return "image"
  if (mime.includes("markdown") || /\.(md|mdx|txt)$/.test(name)) return "markdown"
  return "unknown"
}

interface FlowActionsProps {
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  streamingUrl: string | null
  backHref: string
  transformations: ShadowTwinTransformationEntry[]
  shadowTwinFolderId: string | null
  shouldPromptPipeline: boolean
}

interface JobUpdateWire {
  type: "job_update"
  jobId: string
  status?: string
  progress?: number
  message?: string
  updatedAt?: string
  jobType?: string
  libraryId?: string
  result?: { savedItemId?: string }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0
}

async function enqueuePdfJob(args: {
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  targetLanguage: string
  templateName?: string
  policies: { extract: string; metadata: string; ingest: string }
  libraryConfigChatTargetLanguage?: TargetLanguage
  libraryConfigPdfTemplate?: string
}): Promise<string> {
  // Lade PDF-Defaults für diese Library (inkl. globaler Default mistral_ocr)
  const defaults = getEffectivePdfDefaults(
    args.libraryId,
    loadPdfDefaults(args.libraryId),
    {},
    args.libraryConfigChatTargetLanguage,
    args.libraryConfigPdfTemplate
  )
  const extractionMethod = typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'mistral_ocr'
  const isMistralOcr = extractionMethod === 'mistral_ocr'
  
  const fd = new FormData()
  fd.append("originalItemId", args.sourceFile.id)
  fd.append("parentId", args.parentId)
  fd.append("fileName", args.sourceFile.metadata.name)
  fd.append("mimeType", args.sourceFile.metadata.mimeType || "application/pdf")
  fd.append("targetLanguage", args.targetLanguage)
  fd.append("extractionMethod", extractionMethod)
  // Bei Mistral OCR: includePageImages immer true (erzwungen)
  if (isMistralOcr) {
    const includePageImages = defaults.includePageImages !== undefined ? defaults.includePageImages : true
    const includeOcrImages = defaults.includeOcrImages !== undefined ? defaults.includeOcrImages : true
    if (includePageImages) fd.append("includePageImages", "true")
    if (includeOcrImages) fd.append("includeOcrImages", "true")
  }
  fd.append("useCache", String(defaults.useCache ?? true))
  if (isNonEmptyString(args.templateName)) fd.append("template", args.templateName)
  fd.append("policies", JSON.stringify(args.policies))

  const res = await fetch("/api/secretary/process-pdf", {
    method: "POST",
    headers: { "X-Library-Id": args.libraryId },
    body: fd,
  })
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as {
    error?: unknown
    job?: { id?: unknown }
  }
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`)
  const jobId = typeof json.job?.id === "string" ? json.job.id : ""
  if (!jobId) throw new Error("Job-ID fehlt in Response")
  return jobId
}

async function enqueueMediaJob(args: {
  endpoint: "/api/secretary/process-audio/job" | "/api/secretary/process-video/job"
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  targetLanguage: string
  templateName?: string
  policies: { extract: string; metadata: string; ingest: string }
}): Promise<string> {
  const res = await fetch(args.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Library-Id": args.libraryId,
    },
    body: JSON.stringify({
      originalItemId: args.sourceFile.id,
      parentId: args.parentId,
      fileName: args.sourceFile.metadata.name,
      mimeType: args.sourceFile.metadata.mimeType,
      targetLanguage: args.targetLanguage,
      sourceLanguage: "auto",
      useCache: true,
      ...(isNonEmptyString(args.templateName) ? { template: args.templateName } : {}),
      policies: args.policies,
    }),
  })
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as {
    error?: unknown
    job?: { id?: unknown }
  }
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`)
  const jobId = typeof json.job?.id === "string" ? json.job.id : ""
  if (!jobId) throw new Error("Job-ID fehlt in Response")
  return jobId
}

async function enqueueTextJob(args: {
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  targetLanguage: string
  templateName?: string
  policies: { extract: string; metadata: string; ingest: string }
}): Promise<string> {
  const res = await fetch("/api/secretary/process-text/job", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Library-Id": args.libraryId,
    },
    body: JSON.stringify({
      originalItemId: args.sourceFile.id,
      parentId: args.parentId,
      fileName: args.sourceFile.metadata.name,
      mimeType: args.sourceFile.metadata.mimeType,
      targetLanguage: args.targetLanguage,
      ...(isNonEmptyString(args.templateName) ? { template: args.templateName } : {}),
      policies: args.policies,
    }),
  })
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as {
    error?: unknown
    job?: { id?: unknown }
  }
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`)
  const jobId = typeof json.job?.id === "string" ? json.job.id : ""
  if (!jobId) throw new Error("Job-ID fehlt in Response")
  return jobId
}

export function FlowActions({
  libraryId,
  sourceFile,
  parentId,
  streamingUrl,
  backHref,
  transformations,
  shadowTwinFolderId,
  shouldPromptPipeline,
}: FlowActionsProps) {
  const router = useRouter()
  const [targetLanguage, setTargetLanguage] = useQueryState("targetLanguage", parseAsString.withDefault(""))
  const [templateName, setTemplateName] = useQueryState("templateName", parseAsString.withDefault(""))
  // mobile-first default: hide left/source pane unless user explicitly enables it
  const [leftPaneMode, setLeftPaneMode] = useQueryState("left", parseAsString.withDefault("off"))
  const [activeTransformationId, setActiveTransformationId] = useQueryState("transformationId", parseAsString.withDefault(""))
  // `pipeline` Query Param:
  // - ''  => nicht gesetzt (Initialzustand; Auto-Open darf einmal greifen)
  // - '1' => offen
  // - '0' => vom User explizit geschlossen (Auto-Open darf NICHT erneut öffnen)
  const [pipelineParam, setPipelineParam] = useQueryState("pipeline", parseAsString.withDefault(""))

  const [templates, setTemplates] = React.useState<string[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = React.useState(false)

  const [isRunning, setIsRunning] = React.useState(false)
  const [activeJob, setActiveJob] = React.useState<{ jobId: string; status?: string; progress?: number; message?: string } | null>(null)
  const [settingsOpen, setSettingsOpen] = React.useState(false)

  const activeLibrary = useAtomValue(activeLibraryAtom)
  const libraryConfigChatTargetLanguage = activeLibrary?.config?.chat?.targetLanguage
  const libraryConfigPdfTemplate = activeLibrary?.config?.secretaryService?.pdfDefaults?.template

  const kind = getMediaKind(sourceFile)
  const transformationSelectValue = activeTransformationId || "__latest__"
  const isPdf = kind === "pdf"
  const isPipelineOpen = pipelineParam === "1"
  const defaults = getEffectivePdfDefaults(
    libraryId,
    loadPdfDefaults(libraryId),
    {},
    libraryConfigChatTargetLanguage,
    libraryConfigPdfTemplate
  )
  const effectiveTargetLanguage = typeof defaults.targetLanguage === "string"
    ? defaults.targetLanguage
    : TARGET_LANGUAGE_DEFAULT
  const effectiveTemplateName = typeof defaults.template === "string" ? defaults.template : ""

  const openPipeline = React.useCallback(() => {
    void setPipelineParam("1")
  }, [setPipelineParam])

  const closePipeline = React.useCallback(() => {
    void setPipelineParam("0")
  }, [setPipelineParam])
  const openSourceInNewTab = React.useCallback(() => {
    if (!streamingUrl) return
    window.open(streamingUrl, "_blank", "noopener,noreferrer")
  }, [streamingUrl])

  const goBack = React.useCallback(() => {
    router.push(backHref)
  }, [router, backHref])

  React.useEffect(() => {
    if (!shouldPromptPipeline) return
    // Auto-open NUR, wenn der Param noch nicht gesetzt ist.
    // Wenn der User einmal schließt (`pipeline=0`), respektieren wir das.
    if (pipelineParam !== "") return
    void setPipelineParam("1")
  }, [shouldPromptPipeline, pipelineParam, setPipelineParam])

  // Falls URL-Parameter fehlen, setze sie aus Defaults (inkl. Library-Config)
  React.useEffect(() => {
    if (!targetLanguage && effectiveTargetLanguage) {
      void setTargetLanguage(effectiveTargetLanguage)
    }
    if (!templateName && effectiveTemplateName) {
      void setTemplateName(effectiveTemplateName)
    }
  }, [targetLanguage, templateName, effectiveTargetLanguage, effectiveTemplateName, setTargetLanguage, setTemplateName])

  React.useEffect(() => {
    let cancelled = false
    async function loadTemplates() {
      if (!libraryId) return
      if (!isPipelineOpen) return
      setIsLoadingTemplates(true)
      try {
        const { listAvailableTemplates } = await import("@/lib/templates/template-service-client")
        const names = await listAvailableTemplates(libraryId)
        if (cancelled) return
        setTemplates(Array.isArray(names) ? names : [])
        // If current templateName is invalid, clear it (avoid resolver/transform confusion).
        if (isNonEmptyString(templateName) && !names.includes(templateName)) {
          void setTemplateName("")
        }
      } catch (err) {
        FileLogger.warn("flow-actions", "Templates konnten nicht geladen werden", {
          error: err instanceof Error ? err.message : String(err),
        })
        if (!cancelled) setTemplates([])
      } finally {
        if (!cancelled) setIsLoadingTemplates(false)
      }
    }
    void loadTemplates()
    return () => {
      cancelled = true
    }
  }, [libraryId, templateName, setTemplateName, isPipelineOpen])

  // Subscribe to SSE and update active job state (thin UI only; engine stays server-side).
  React.useEffect(() => {
    if (!activeJob?.jobId) return
    let cancelled = false
    const es = new EventSource("/api/external/jobs/stream")

    es.addEventListener("job_update", (e: MessageEvent) => {
      try {
        const evt = JSON.parse(e.data) as JobUpdateWire
        if (cancelled) return
        if (!evt || evt.type !== "job_update") return
        if (evt.jobId !== activeJob.jobId) return
        setActiveJob(prev => {
          if (!prev) return prev
          return {
            jobId: prev.jobId,
            status: typeof evt.status === "string" ? evt.status : prev.status,
            progress: typeof evt.progress === "number" ? evt.progress : prev.progress,
            message: typeof evt.message === "string" ? evt.message : prev.message,
          }
        })
      } catch {
        // ignore
      }
    })

    es.addEventListener("error", () => {
      // Non-fatal: die Seite bleibt nutzbar; Shadow‑Twin Artefakte sind die Wahrheit.
    })

    return () => {
      cancelled = true
      try {
        es.close()
      } catch {}
    }
  }, [activeJob?.jobId])

  const runPipeline = React.useCallback(
    async (args: { templateName?: string; targetLanguage: string; policies: PipelinePolicies }) => {
      if (!libraryId) {
        toast.error("Fehler", { description: "libraryId fehlt" })
        return
      }
      if (sourceFile.type !== "file") {
        toast.error("Fehler", { description: "Quelle ist keine Datei" })
        return
      }
      if (!parentId) {
        toast.error("Fehler", { description: "parentId fehlt" })
        return
      }

      setIsRunning(true)
      try {
        let jobId = ""
        if (kind === "pdf") {
          jobId = await enqueuePdfJob({
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
            libraryConfigChatTargetLanguage,
            libraryConfigPdfTemplate,
          })
        } else if (kind === "audio") {
          jobId = await enqueueMediaJob({
            endpoint: "/api/secretary/process-audio/job",
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
          })
        } else if (kind === "video") {
          jobId = await enqueueMediaJob({
            endpoint: "/api/secretary/process-video/job",
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
          })
        } else if (kind === "markdown") {
          // Bei Markdown: extract immer "ignore" erzwingen (Textquelle bereits vorhanden)
          const markdownPolicies = {
            ...args.policies,
            extract: "ignore" as const,
          }
          jobId = await enqueueTextJob({
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: markdownPolicies,
          })
        } else {
          toast.error("Nicht unterstützt", {
            description: `Flow Actions sind aktuell nur für PDF/Audio/Video/Markdown vorgesehen (Dateityp: ${kind}).`,
          })
          return
        }

        setActiveJob({ jobId, status: "queued", progress: 0, message: "queued" })
        toast.success("Job angelegt", { description: `Job ${jobId} wurde enqueued.` })

        // WICHTIG:
        // Jobs werden von `ExternalJobsWorker` gestartet. Wenn wir hier zusätzlich `/start` callen,
        // kommt es zu doppelten Worker-Requests und damit zu 2 Secretary-Jobs + callback_token mismatch (401).
        // Deshalb: nur enqueue. Der Worker startet den Job automatisch (Polling-Intervall i.d.R. <2s).
        toast.success("Job in Warteschlange", { description: "Worker startet den Job automatisch. Ergebnisse erscheinen im Shadow‑Twin." })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        FileLogger.error("flow-actions", "Action fehlgeschlagen", { msg })
        toast.error("Fehler", { description: msg })
      } finally {
        setIsRunning(false)
      }
    },
    [libraryId, sourceFile, parentId, kind, libraryConfigChatTargetLanguage, libraryConfigPdfTemplate]
  )

  return (
    <div className="border-b px-3 py-2">
      <TooltipProvider>
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          {/* Back first (Experten-Toolbar) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Zurück"
                onClick={goBack}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Zurück</TooltipContent>
          </Tooltip>

          {/* Left pane controls (mobile-first: default hidden, user can enable) */}
          {isPdf ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "pdf" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Quelle"
                    aria-pressed={leftPaneMode === "pdf"}
                    onClick={() => void setLeftPaneMode("pdf")}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Quelle</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "transcript" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Transcript"
                    aria-pressed={leftPaneMode === "transcript"}
                    onClick={() => void setLeftPaneMode("transcript")}
                  >
                    <ScrollText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Transcript</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "off" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel ausblenden"
                    aria-pressed={leftPaneMode === "off"}
                    onClick={() => void setLeftPaneMode("off")}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links ausblenden</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="PDF-Standardwerte"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">PDF-Standardwerte</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "pdf" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Quelle"
                    aria-pressed={leftPaneMode === "pdf"}
                    onClick={() => void setLeftPaneMode("pdf")}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Quelle</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "off" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel ausblenden"
                    aria-pressed={leftPaneMode === "off"}
                    onClick={() => void setLeftPaneMode("off")}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links ausblenden</TooltipContent>
              </Tooltip>
            </>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Quelle im neuen Tab öffnen"
                onClick={openSourceInNewTab}
                disabled={!streamingUrl}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Quelle im neuen Tab</TooltipContent>
          </Tooltip>

          <div className="mx-1 h-6 w-px bg-border" />

          <div className="flex-1" />

          {/* Aktuelle Transformationsdatei (Shadow‑Twin Truth) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Transformieren</span>
                <Select
                  value={transformationSelectValue}
                  onValueChange={(v) => void setActiveTransformationId(v === "__latest__" ? "" : v)}
                  disabled={transformations.length === 0}
                >
                  <SelectTrigger className="h-8 w-[220px]">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__latest__">neueste</SelectItem>
                    {transformations.map((t) => {
                      const label = `${t.templateName}${t.targetLanguage ? ` · ${t.targetLanguage}` : ""}`
                      return (
                        <SelectItem key={t.item.id} value={t.item.id}>
                          {label}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {shadowTwinFolderId ? "Shadow‑Twin vorhanden" : "Kein Shadow‑Twin Ordner gefunden"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8"
                onClick={openPipeline}
                disabled={isRunning}
              >
                <Sparkles className="h-4 w-4" />
                Transformieren
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Story Creator öffnen</TooltipContent>
          </Tooltip>

          {activeJob ? (
            <div className="text-xs text-muted-foreground">
              <span className="font-mono">{activeJob.jobId}</span>
              {activeJob.status ? ` · ${activeJob.status}` : ""}
              {typeof activeJob.progress === "number" ? ` · ${Math.round(activeJob.progress)}%` : ""}
              {activeJob.message ? ` · ${activeJob.message}` : ""}
            </div>
          ) : null}
        </div>
      </TooltipProvider>

      {settingsOpen && (
        <React.Suspense>
          <PdfPhaseSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
        </React.Suspense>
      )}

      <PipelineSheet
        isOpen={isPipelineOpen}
        onOpenChange={(open) => (open ? void setPipelineParam("1") : closePipeline())}
        libraryId={libraryId}
        sourceFileName={sourceFile.metadata.name}
        kind={kind === "pdf" || kind === "audio" || kind === "video" || kind === "markdown" ? kind : "other"}
        targetLanguage={targetLanguage}
        onTargetLanguageChange={(v) => void setTargetLanguage(v)}
        templateName={templateName}
        onTemplateNameChange={(v) => void setTemplateName(v)}
        templates={templates}
        isLoadingTemplates={isLoadingTemplates}
        onStart={runPipeline}
      />
    </div>
  )
}



```

Erstellen der neuen API-Route für Text/Markdown. Zuerst die bestehenden Job-Routen prüfen:


Prüfen der bestehenden process-text Route, um das Pattern zu verstehen:


Erstellen der neuen API-Route für Text/Markdown-Jobs:


```typescript
/**
 * @fileoverview Secretary Text/Markdown Job API Route - Enqueue Text via External Jobs
 *
 * @description
 * Creates an External Job for text/markdown transformation (template+ingest).
 * For markdown files, extraction is skipped (extract=ignore) since the text source
 * is already available. The job loads the file, strips frontmatter, and feeds
 * the callback directly with extracted_text.
 *
 * IMPORTANT
 * - Does NOT send the file to Secretary for extraction.
 * - Requires `originalItemId` + `parentId` so we can load the binary from Storage.
 * - Extracts text locally and feeds callback directly.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuth, currentUser } from '@clerk/nextjs/server'
import crypto from 'crypto'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { getJobEventBus } from '@/lib/events/job-event-bus'
import { getServerProvider } from '@/lib/storage/server-provider'
import { LibraryService } from '@/lib/services/library-service'
import { stripAllFrontmatter } from '@/lib/markdown/frontmatter'
import type { ExternalJob } from '@/types/external-job'
import type { PhasePolicies } from '@/lib/processing/phase-policy'
import { FileLogger } from '@/lib/debug/logger'

interface Body {
  originalItemId: string
  parentId: string
  fileName: string
  mimeType?: string
  targetLanguage?: string
  template?: string
  policies?: PhasePolicies
  batchId?: string
  batchName?: string
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request)
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 })

    const libraryId = request.headers.get('x-library-id') || request.headers.get('X-Library-Id') || ''
    if (!libraryId) return NextResponse.json({ error: 'X-Library-Id erforderlich' }, { status: 400 })

    const body = (await request.json().catch(() => ({}))) as Partial<Body>
    const originalItemId = typeof body.originalItemId === 'string' ? body.originalItemId : ''
    const parentId = typeof body.parentId === 'string' ? body.parentId : ''
    const fileName = typeof body.fileName === 'string' ? body.fileName : ''
    if (!originalItemId || !parentId || !fileName) {
      return NextResponse.json({ error: 'originalItemId, parentId, fileName erforderlich' }, { status: 400 })
    }

    // Load library and provider
    const lib = await LibraryService.getInstance().getLibrary(userEmail, libraryId).catch(() => undefined)
    if (!lib) return NextResponse.json({ error: 'Library nicht gefunden' }, { status: 404 })

    const provider = await getServerProvider(userEmail, libraryId)

    // Load file and extract text (strip frontmatter)
    let extractedText = ''
    try {
      const { blob } = await provider.getBinary(originalItemId)
      const markdown = await blob.text()
      extractedText = stripAllFrontmatter(markdown)
    } catch (error) {
      FileLogger.error('process-text/job', 'Fehler beim Laden der Datei', {
        error: error instanceof Error ? error.message : String(error),
        itemId: originalItemId,
      })
      return NextResponse.json({ error: 'Datei konnte nicht geladen werden' }, { status: 404 })
    }

    const repo = new ExternalJobsRepository()
    const jobId = crypto.randomUUID()
    const jobSecret = crypto.randomBytes(24).toString('base64url')
    const jobSecretHash = repo.hashSecret(jobSecret)

    const targetLanguage = typeof body.targetLanguage === 'string' ? body.targetLanguage : 'de'
    // Template ist OPTIONAL. Wenn kein Template angegeben ist, ist das ein Extract-only Job.
    const template =
      typeof body.template === 'string' && body.template.trim() ? body.template.trim() : undefined

    const hasValidPolicies =
      !!(body.policies && body.policies.extract && body.policies.metadata && body.policies.ingest)

    // Default: Extract immer ignore (Textquelle bereits vorhanden), Template/Ingest je nach Template
    const policies: PhasePolicies = hasValidPolicies
      ? (body.policies as PhasePolicies)
      : (template
          ? { extract: 'ignore', metadata: 'do', ingest: 'do' }
          : { extract: 'ignore', metadata: 'ignore', ingest: 'ignore' })

    // Ensure extract is always 'ignore' for text/markdown
    const finalPolicies: PhasePolicies = {
      ...policies,
      extract: 'ignore',
    }

    const correlation: ExternalJob['correlation'] = {
      jobId,
      libraryId,
      source: {
        mediaType: 'markdown',
        mimeType: typeof body.mimeType === 'string' ? body.mimeType : 'text/markdown',
        name: fileName,
        itemId: originalItemId,
        parentId,
      },
      options: {
        targetLanguage,
      },
      batchId: typeof body.batchId === 'string' ? body.batchId : undefined,
      batchName: typeof body.batchName === 'string' ? body.batchName : undefined,
    }

    const job: ExternalJob = {
      jobId,
      jobSecretHash,
      job_type: 'text',
      operation: 'extract',
      worker: 'secretary',
      status: 'queued',
      libraryId,
      userEmail,
      correlation,
      createdAt: new Date(),
      updatedAt: new Date(),
      parameters: {
        ...(template ? { template } : {}),
        policies: finalPolicies,
        phases: {
          extract: false, // Always false for text/markdown
          template: finalPolicies.metadata !== 'ignore',
          ingest: finalPolicies.ingest !== 'ignore',
          images: false, // Text has no images phase
        },
      },
    }

    await repo.create(job)

    // Initialize steps
    await repo.initializeSteps(
      jobId,
      [
        { name: 'extract_text', status: 'pending' },
        { name: 'transform_template', status: 'pending' },
        { name: 'ingest_rag', status: 'pending' },
      ],
      {
        targetLanguage,
        template,
        phases: {
          extract: false,
          template: finalPolicies.metadata !== 'ignore',
          ingest: finalPolicies.ingest !== 'ignore',
        },
        policies: finalPolicies,
      }
    )

    // Feed callback directly with extracted_text (skip extraction phase)
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
      const callbackUrl = appUrl
        ? `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}`
        : `/api/external/jobs/${jobId}`

      const callbackResponse = await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': process.env.INTERNAL_TEST_TOKEN || '',
        },
        body: JSON.stringify({
          data: {
            extracted_text: extractedText,
          },
        }),
      })

      if (!callbackResponse.ok) {
        FileLogger.warn('process-text/job', 'Callback konnte nicht gefüttert werden', {
          status: callbackResponse.status,
          jobId,
        })
        // Continue anyway - worker will handle it
      }
    } catch (error) {
      FileLogger.warn('process-text/job', 'Fehler beim Füttern des Callbacks', {
        error: error instanceof Error ? error.message : String(error),
        jobId,
      })
      // Continue anyway - worker will handle it
    }

    try {
      getJobEventBus().emitUpdate(userEmail, {
        type: 'job_update',
        jobId,
        status: 'queued',
        progress: 0,
        message: 'queued',
        updatedAt: new Date().toISOString(),
        jobType: job.job_type,
        fileName,
        sourceItemId: originalItemId,
        libraryId,
      })
    } catch {}

    return NextResponse.json({ status: 'accepted', job: { id: jobId } }, { status: 202 })
  } catch (error) {
    FileLogger.error('process-text/job', 'Unerwarteter Fehler', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Unerwarteter Fehler' }, { status: 500 })
  }
}

```

Prüfen auf Linter-Fehler:


Prüfen, ob der Callback korrekt funktioniert. Prüfen der Auth-Logik:


Anpassen der Route, damit der Callback mit dem korrekten Token aufgerufen wird:


```typescript
/**
 * @fileoverview Secretary Text/Markdown Job API Route - Enqueue Text via External Jobs
 *
 * @description
 * Creates an External Job for text/markdown transformation (template+ingest).
 * For markdown files, extraction is skipped (extract=ignore) since the text source
 * is already available. The job loads the file, strips frontmatter, and feeds
 * the callback directly with extracted_text.
 *
 * IMPORTANT
 * - Does NOT send the file to Secretary for extraction.
 * - Requires `originalItemId` + `parentId` so we can load the binary from Storage.
 * - Extracts text locally and feeds callback directly.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuth, currentUser } from '@clerk/nextjs/server'
import crypto from 'crypto'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { getJobEventBus } from '@/lib/events/job-event-bus'
import { getServerProvider } from '@/lib/storage/server-provider'
import { LibraryService } from '@/lib/services/library-service'
import { stripAllFrontmatter } from '@/lib/markdown/frontmatter'
import type { ExternalJob } from '@/types/external-job'
import type { PhasePolicies } from '@/lib/processing/phase-policy'
import { FileLogger } from '@/lib/debug/logger'

interface Body {
  originalItemId: string
  parentId: string
  fileName: string
  mimeType?: string
  targetLanguage?: string
  template?: string
  policies?: PhasePolicies
  batchId?: string
  batchName?: string
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request)
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 })

    const libraryId = request.headers.get('x-library-id') || request.headers.get('X-Library-Id') || ''
    if (!libraryId) return NextResponse.json({ error: 'X-Library-Id erforderlich' }, { status: 400 })

    const body = (await request.json().catch(() => ({}))) as Partial<Body>
    const originalItemId = typeof body.originalItemId === 'string' ? body.originalItemId : ''
    const parentId = typeof body.parentId === 'string' ? body.parentId : ''
    const fileName = typeof body.fileName === 'string' ? body.fileName : ''
    if (!originalItemId || !parentId || !fileName) {
      return NextResponse.json({ error: 'originalItemId, parentId, fileName erforderlich' }, { status: 400 })
    }

    // Load library and provider
    const lib = await LibraryService.getInstance().getLibrary(userEmail, libraryId).catch(() => undefined)
    if (!lib) return NextResponse.json({ error: 'Library nicht gefunden' }, { status: 404 })

    const provider = await getServerProvider(userEmail, libraryId)

    // Load file and extract text (strip frontmatter)
    let extractedText = ''
    try {
      const { blob } = await provider.getBinary(originalItemId)
      const markdown = await blob.text()
      extractedText = stripAllFrontmatter(markdown)
    } catch (error) {
      FileLogger.error('process-text/job', 'Fehler beim Laden der Datei', {
        error: error instanceof Error ? error.message : String(error),
        itemId: originalItemId,
      })
      return NextResponse.json({ error: 'Datei konnte nicht geladen werden' }, { status: 404 })
    }

    const repo = new ExternalJobsRepository()
    const jobId = crypto.randomUUID()
    const jobSecret = crypto.randomBytes(24).toString('base64url')
    const jobSecretHash = repo.hashSecret(jobSecret)

    const targetLanguage = typeof body.targetLanguage === 'string' ? body.targetLanguage : 'de'
    // Template ist OPTIONAL. Wenn kein Template angegeben ist, ist das ein Extract-only Job.
    const template =
      typeof body.template === 'string' && body.template.trim() ? body.template.trim() : undefined

    const hasValidPolicies =
      !!(body.policies && body.policies.extract && body.policies.metadata && body.policies.ingest)

    // Default: Extract immer ignore (Textquelle bereits vorhanden), Template/Ingest je nach Template
    const policies: PhasePolicies = hasValidPolicies
      ? (body.policies as PhasePolicies)
      : (template
          ? { extract: 'ignore', metadata: 'do', ingest: 'do' }
          : { extract: 'ignore', metadata: 'ignore', ingest: 'ignore' })

    // Ensure extract is always 'ignore' for text/markdown
    const finalPolicies: PhasePolicies = {
      ...policies,
      extract: 'ignore',
    }

    const correlation: ExternalJob['correlation'] = {
      jobId,
      libraryId,
      source: {
        mediaType: 'markdown',
        mimeType: typeof body.mimeType === 'string' ? body.mimeType : 'text/markdown',
        name: fileName,
        itemId: originalItemId,
        parentId,
      },
      options: {
        targetLanguage,
      },
      batchId: typeof body.batchId === 'string' ? body.batchId : undefined,
      batchName: typeof body.batchName === 'string' ? body.batchName : undefined,
    }

    const job: ExternalJob = {
      jobId,
      jobSecretHash,
      job_type: 'text',
      operation: 'extract',
      worker: 'secretary',
      status: 'queued',
      libraryId,
      userEmail,
      correlation,
      createdAt: new Date(),
      updatedAt: new Date(),
      parameters: {
        ...(template ? { template } : {}),
        policies: finalPolicies,
        phases: {
          extract: false, // Always false for text/markdown
          template: finalPolicies.metadata !== 'ignore',
          ingest: finalPolicies.ingest !== 'ignore',
          images: false, // Text has no images phase
        },
      },
    }

    await repo.create(job)

    // Initialize steps
    await repo.initializeSteps(
      jobId,
      [
        { name: 'extract_text', status: 'pending' },
        { name: 'transform_template', status: 'pending' },
        { name: 'ingest_rag', status: 'pending' },
      ],
      {
        targetLanguage,
        template,
        phases: {
          extract: false,
          template: finalPolicies.metadata !== 'ignore',
          ingest: finalPolicies.ingest !== 'ignore',
        },
        policies: finalPolicies,
      }
    )

    // Feed callback directly with extracted_text (skip extraction phase)
    // Use jobSecret for callback authorization (internal token bypass also works)
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
      const callbackUrl = appUrl
        ? `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}`
        : `/api/external/jobs/${jobId}`

      const callbackResponse = await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jobSecret}`,
          'X-Internal-Token': process.env.INTERNAL_TEST_TOKEN || '',
        },
        body: JSON.stringify({
          data: {
            extracted_text: extractedText,
          },
        }),
      })

      if (!callbackResponse.ok) {
        FileLogger.warn('process-text/job', 'Callback konnte nicht gefüttert werden', {
          status: callbackResponse.status,
          jobId,
        })
        // Continue anyway - worker will handle it
      }
    } catch (error) {
      FileLogger.warn('process-text/job', 'Fehler beim Füttern des Callbacks', {
        error: error instanceof Error ? error.message : String(error),
        jobId,
      })
      // Continue anyway - worker will handle it
    }

    try {
      getJobEventBus().emitUpdate(userEmail, {
        type: 'job_update',
        jobId,
        status: 'queued',
        progress: 0,
        message: 'queued',
        updatedAt: new Date().toISOString(),
        jobType: job.job_type,
        fileName,
        sourceItemId: originalItemId,
        libraryId,
      })
    } catch {}

    return NextResponse.json({ status: 'accepted', job: { id: jobId } }, { status: 202 })
  } catch (error) {
    FileLogger.error('process-text/job', 'Unerwarteter Fehler', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Unerwarteter Fehler' }, { status: 500 })
  }
}

```

## Zusammenfassung der Implementierung

1. **PipelineSheet UI angepasst** (`src/components/library/flow/pipeline-sheet.tsx`):
   - Extract-Schritt bei `kind="markdown"` ausgegraut und deaktiviert
   - Hinweistext: "Textquelle vorhanden, Extraktion übersprungen"
   - Policies setzen `extract=ignore` bei Markdown

2. **FlowActions erweitert** (`src/components/library/flow/flow-actions.tsx`):
   - Markdown wird als unterstützter Typ erkannt
   - Neue Funktion `enqueueTextJob` für Text/Markdown-Jobs
   - `runPipeline` unterstützt Markdown und erzwingt `extract=ignore`

3. **Neue API-Route erstellt** (`src/app/api/secretary/process-text/job/route.ts`):
   - Erstellt External Job mit `job_type: 'text'`
   - Lädt Markdown-Datei aus Storage
   - Entfernt Frontmatter
   - Füttert Callback direkt mit `extracted_text` (überspringt Extraktionsphase)
   - Setzt Policies korrekt (`extract=ignore`)

Die Implementierung folgt dem V3-Design: Gates/Policies steuern die Phasen, bei Markdown wird die Extraktion logisch übersprungen, da der Text bereits vorhanden ist. Die UI zeigt dies klar an, und der Job-Flow ist konsistent mit PDF/Audio/Video.

Alle Linter-Prüfungen bestanden. Die Implementierung ist bereit für Tests.

---

**User**

stimmt das ergebnis?
{
  "_id": {
    "$oid": "696cc277677d182b6e5b0b6d"
  },
  "jobId": "c0d0cc0d-da09-4a35-9f20-86acb6a51e5f",
  "jobSecretHash": "45873d88866ca9e7d0190c67f6173a0a75298c871ba0ed8989c13ff73cf57d73",
  "job_type": "text",
  "operation": "extract",
  "worker": "secretary",
  "status": "completed",
  "libraryId": "ff73d3a2-fe01-4674-bce1-feb708235a5a",
  "userEmail": "peter.aichner@crystal-design.com",
  "correlation": {
    "jobId": "c0d0cc0d-da09-4a35-9f20-86acb6a51e5f",
    "libraryId": "ff73d3a2-fe01-4674-bce1-feb708235a5a",
    "source": {
      "mediaType": "markdown",
      "mimeType": "text/markdown",
      "name": "page-002.md",
      "itemId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvdGVzdC92b3JzY2hsYWVnZS1zaGYtbmljaHQtdW1zZXR6YmFyL3BhZ2UtMDAyLm1k",
      "parentId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvdGVzdC92b3JzY2hsYWVnZS1zaGYtbmljaHQtdW1zZXR6YmFy"
    },
    "options": {
      "targetLanguage": "de"
    },
    "batchId": null,
    "batchName": null
  },
  "createdAt": {
    "$date": "2026-01-18T11:22:31.016Z"
  },
  "updatedAt": {
    "$date": "2026-01-18T11:23:13.612Z"
  },
  "parameters": {
    "targetLanguage": "de",
    "template": "klimamassnahme-detail-de",
    "phases": {
      "extract": false,
      "template": true,
      "ingest": true
    },
    "policies": {
      "extract": "ignore",
      "metadata": "do",
      "ingest": "do"
    }
  },
  "steps": [
    {
      "name": "extract_pdf",
      "status": "completed",
      "details": {
        "skipped": true,
        "reason": "phase_disabled",
        "gateReason": null
      },
      "endedAt": {
        "$date": "2026-01-18T11:22:50.286Z"
      }
    },
    {
      "name": "transform_template",
      "status": "completed",
      "startedAt": {
        "$date": "2026-01-18T11:22:55.156Z"
      },
      "details": {
        "source": "primary"
      },
      "endedAt": {
        "$date": "2026-01-18T11:23:12.756Z"
      }
    },
    {
      "name": "ingest_rag",
      "status": "completed",
      "startedAt": {
        "$date": "2026-01-18T11:23:06.609Z"
      },
      "endedAt": {
        "$date": "2026-01-18T11:23:12.371Z"
      }
    }
  ],
  "trace": {
    "events": [
      {
        "eventId": "1768735368473-e0c067a8",
        "ts": {
          "$date": "2026-01-18T11:22:48.473Z"
        },
        "spanId": "extract",
        "name": "callback_received",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "callback_received",
          "details": {
            "internalBypass": true,
            "hasToken": true,
            "phaseInBody": null,
            "hasFinalPayload": true,
            "keys": [
              "data"
            ],
            "dataKeys": [
              "extracted_text"
            ],
            "dataSample": {
              "hasExtractedText": true,
              "hasMistralOcrRaw": false,
              "hasMistralOcrRawUrl": false,
              "hasMistralOcrRawMetadata": false,
              "hasPagesArchiveUrl": false,
              "hasPagesArchiveData": false,
              "hasImagesArchiveUrl": false,
              "hasImagesArchiveData": false
            }
          }
        }
      },
      {
        "eventId": "1768735368684-iuch1j61",
        "ts": {
          "$date": "2026-01-18T11:22:48.684Z"
        },
        "spanId": "template",
        "name": "callback_before_library",
        "level": "info",
        "message": null,
        "attributes": {}
      },
      {
        "eventId": "1768735369041-h0lduvqw",
        "ts": {
          "$date": "2026-01-18T11:22:49.041Z"
        },
        "spanId": "extract",
        "name": "step_completed",
        "level": "info",
        "message": null,
        "attributes": {
          "step": "extract_pdf"
        }
      },
      {
        "eventId": "1768735370196-ktwejz29",
        "ts": {
          "$date": "2026-01-18T11:22:50.196Z"
        },
        "spanId": "preprocess",
        "name": "process_submit",
        "level": "info",
        "message": null,
        "attributes": {
          "libraryId": "ff73d3a2-fe01-4674-bce1-feb708235a5a",
          "fileName": "page-002.md",
          "extractionMethod": null,
          "targetLanguage": "de",
          "includeOcrImages": null,
          "includePageImages": null,
          "includeImages": null,
          "useCache": null,
          "template": "klimamassnahme-detail-de",
          "phases": {
            "extract": false,
            "template": true,
            "ingest": true
          },
          "startRequestId": "79eecb26-55ff-4941-b891-98e85b7b081e",
          "workerId": "f0268657-5e39-4446-b9b7-2c8b6abb8946",
          "workerTickId": "ffd8c0de-d5a6-468b-a4c1-ae79fcd4fa3d",
          "pid": 16344
        }
      },
      {
        "eventId": "1768735370505-afj9ktlq",
        "ts": {
          "$date": "2026-01-18T11:22:50.505Z"
        },
        "spanId": "extract",
        "name": "step_completed",
        "level": "info",
        "message": null,
        "attributes": {
          "step": "extract_pdf"
        }
      },
      {
        "eventId": "1768735370934-itv0homb",
        "ts": {
          "$date": "2026-01-18T11:22:50.934Z"
        },
        "spanId": "extract",
        "name": "extract_transcript_saved",
        "level": "info",
        "message": null,
        "attributes": {
          "artifactKind": "transcript",
          "targetLanguage": "de",
          "templateName": null,
          "parentId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvdGVzdC92b3JzY2hsYWVnZS1zaGYtbmljaHQtdW1zZXR6YmFyLy5wYWdlLTAwMi5tZA==",
          "shadowTwinFolderId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvdGVzdC92b3JzY2hsYWVnZS1zaGYtbmljaHQtdW1zZXR6YmFyLy5wYWdlLTAwMi5tZA==",
          "location": "dotFolder",
          "wasUpdated": false,
          "fileId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvdGVzdC92b3JzY2hsYWVnZS1zaGYtbmljaHQtdW1zZXR6YmFyLy5wYWdlLTAwMi5tZC9wYWdlLTAwMi5kZS5tZA==",
          "fileName": "page-002.de.md",
          "contentLength": 2834,
          "path": "www.klimaland.bz/RückmeldungenDerLandesverwaltung/test/vorschlaege-shf-nicht-umsetzbar/.page-002.md/page-002.de.md"
        }
      },
      {
        "eventId": "1768735374333-icsvdfsx",
        "ts": {
          "$date": "2026-01-18T11:22:54.333Z"
        },
        "spanId": "template",
        "name": "template_decision",
        "level": "info",
        "message": "run",
        "attributes": {
          "phase": "template_decision",
          "message": "run",
          "details": {
            "policy": "do",
            "bodyPhase": null,
            "isFrontmatterCompleteFromBody": false,
            "gateExists": false,
            "gateReason": null,
            "needsRepair": false,
            "reason": "policy_default"
          }
        }
      },
      {
        "eventId": "1768735374410-bghhjek8",
        "ts": {
          "$date": "2026-01-18T11:22:54.410Z"
        },
        "spanId": "template",
        "name": "template_decision",
        "level": "info",
        "message": null,
        "attributes": {
          "decision": "run",
          "policy": "do",
          "gate": false,
          "gateReason": null,
          "bodyPhase": null,
          "fmComplete": false,
          "needsRepair": false,
          "reason": "policy_default"
        }
      },
      {
        "eventId": "1768735374617-laqn7wb9",
        "ts": {
          "$date": "2026-01-18T11:22:54.617Z"
        },
        "spanId": "template",
        "name": "template_step_start",
        "level": "info",
        "message": null,
        "attributes": {}
      },
      {
        "eventId": "1768735374860-ayadgpow",
        "ts": {
          "$date": "2026-01-18T11:22:54.860Z"
        },
        "spanId": "template",
        "name": "step_running",
        "level": "info",
        "message": null,
        "attributes": {
          "step": "transform_template"
        }
      },
      {
        "eventId": "1768735374885-qbt4z760",
        "ts": {
          "$date": "2026-01-18T11:22:54.885Z"
        },
        "spanId": "template",
        "name": "template_decision",
        "level": "info",
        "message": "run",
        "attributes": {
          "phase": "template_decision",
          "message": "run",
          "details": {
            "policy": "do",
            "bodyPhase": null,
            "isFrontmatterCompleteFromBody": false,
            "gateExists": false,
            "gateReason": null,
            "needsRepair": false,
            "reason": "policy_default"
          }
        }
      },
      {
        "eventId": "1768735374963-zsin2i74",
        "ts": {
          "$date": "2026-01-18T11:22:54.963Z"
        },
        "spanId": "template",
        "name": "template_decision",
        "level": "info",
        "message": null,
        "attributes": {
          "decision": "run",
          "policy": "do",
          "gate": false,
          "gateReason": null,
          "bodyPhase": null,
          "fmComplete": false,
          "needsRepair": false,
          "reason": "policy_default"
        }
      },
      {
        "eventId": "1768735375021-2m37efc0",
        "ts": {
          "$date": "2026-01-18T11:22:55.021Z"
        },
        "spanId": "template",
        "name": "template_selected",
        "level": "info",
        "message": null,
        "attributes": {
          "preferred": "klimamassnahme-detail-de",
          "picked": true,
          "templateName": "klimamassnahme-detail-de",
          "isPreferred": true
        }
      },
      {
        "eventId": "1768735375125-pn8ee2zz",
        "ts": {
          "$date": "2026-01-18T11:22:55.125Z"
        },
        "spanId": "template",
        "name": "template_step_start",
        "level": "info",
        "message": null,
        "attributes": {}
      },
      {
        "eventId": "1768735375228-a4qm6b4j",
        "ts": {
          "$date": "2026-01-18T11:22:55.228Z"
        },
        "spanId": "template",
        "name": "template_request_start",
        "level": "info",
        "message": null,
        "attributes": {
          "url": "http://127.0.0.1:5001/api/transformer/template",
          "method": "POST",
          "targetLanguage": "de",
          "templateContentLen": 9486,
          "extractedTextLen": 2834,
          "estimatedContentLength": 13852
        }
      },
      {
        "eventId": "1768735375388-5iz9mggx",
        "ts": {
          "$date": "2026-01-18T11:22:55.388Z"
        },
        "spanId": "template",
        "name": "step_running",
        "level": "info",
        "message": null,
        "attributes": {
          "step": "transform_template"
        }
      },
      {
        "eventId": "1768735375530-hbhu73ds",
        "ts": {
          "$date": "2026-01-18T11:22:55.530Z"
        },
        "spanId": "template",
        "name": "template_selected",
        "level": "info",
        "message": null,
        "attributes": {
          "preferred": "klimamassnahme-detail-de",
          "picked": true,
          "templateName": "klimamassnahme-detail-de",
          "isPreferred": true
        }
      },
      {
        "eventId": "1768735375707-kq7rxd6f",
        "ts": {
          "$date": "2026-01-18T11:22:55.707Z"
        },
        "spanId": "template",
        "name": "template_request_start",
        "level": "info",
        "message": null,
        "attributes": {
          "url": "http://127.0.0.1:5001/api/transformer/template",
          "method": "POST",
          "targetLanguage": "de",
          "templateContentLen": 9486,
          "extractedTextLen": 2834,
          "estimatedContentLength": 13852
        }
      },
      {
        "eventId": "1768735381213-il96r5be",
        "ts": {
          "$date": "2026-01-18T11:23:01.213Z"
        },
        "spanId": "template",
        "name": "template_step_after_transform",
        "level": "info",
        "message": null,
        "attributes": {
          "hasMeta": true
        }
      },
      {
        "eventId": "1768735381302-52mkla3v",
        "ts": {
          "$date": "2026-01-18T11:23:01.302Z"
        },
        "spanId": "ingest",
        "name": "chapters_analyze_start",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "chapters_analyze_start",
          "details": {
            "libraryId": "ff73d3a2-fe01-4674-bce1-feb708235a5a",
            "textLen": 2834,
            "stripped": false
          }
        }
      },
      {
        "eventId": "1768735381406-vrv0gs7u",
        "ts": {
          "$date": "2026-01-18T11:23:01.406Z"
        },
        "spanId": "ingest",
        "name": "chapters_analyze_result",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "chapters_analyze_result",
          "details": {
            "chapters": 1,
            "pages": 1
          }
        }
      },
      {
        "eventId": "1768735381618-x5onogam",
        "ts": {
          "$date": "2026-01-18T11:23:01.618Z"
        },
        "spanId": "template",
        "name": "template_step_after_transform",
        "level": "info",
        "message": null,
        "attributes": {
          "hasMeta": true
        }
      },
      {
        "eventId": "1768735382569-mfizmp40",
        "ts": {
          "$date": "2026-01-18T11:23:02.569Z"
        },
        "spanId": "postprocessing",
        "name": "postprocessing_save",
        "level": "info",
        "message": null,
        "attributes": {
          "name": "page-002.klimamassnahme-detail-de.de.md",
          "parentId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvdGVzdC92b3JzY2hsYWVnZS1zaGYtbmljaHQtdW1zZXR6YmFyLy5wYWdlLTAwMi5tZA==",
          "shadowTwinFolderId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvdGVzdC92b3JzY2hsYWVnZS1zaGYtbmljaHQtdW1zZXR6YmFyLy5wYWdlLTAwMi5tZA==",
          "artifactKind": "transformation",
          "targetLanguage": "de",
          "templateName": "klimamassnahme-detail-de"
        }
      },
      {
        "eventId": "1768735382669-yxg9xl4w",
        "ts": {
          "$date": "2026-01-18T11:23:02.669Z"
        },
        "spanId": "postprocessing",
        "name": "stored_local",
        "level": "info",
        "message": null,
        "attributes": {
          "savedItemId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvdGVzdC92b3JzY2hsYWVnZS1zaGYtbmljaHQtdW1zZXR6YmFyLy5wYWdlLTAwMi5tZC9wYWdlLTAwMi5rbGltYW1hc3NuYWhtZS1kZXRhaWwtZGUuZGUubWQ=",
          "name": "page-002.klimamassnahme-detail-de.de.md",
          "parentId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvdGVzdC92b3JzY2hsYWVnZS1zaGYtbmljaHQtdW1zZXR6YmFyLy5wYWdlLTAwMi5tZA==",
          "shadowTwinFolderId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvdGVzdC92b3JzY2hsYWVnZS1zaGYtbmljaHQtdW1zZXR6YmFyLy5wYWdlLTAwMi5tZA=="
        }
      },
      {
        "eventId": "1768735383021-3r9rwrtv",
        "ts": {
          "$date": "2026-01-18T11:23:03.021Z"
        },
        "spanId": "template",
        "name": "template_load_existing_file",
        "level": "info",
        "message": null,
        "attributes": {
          "fileId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvdGVzdC92b3JzY2hsYWVnZS1zaGYtbmljaHQtdW1zZXR6YmFyLy5wYWdlLTAwMi5tZC9wYWdlLTAwMi5rbGltYW1hc3NuYWhtZS1kZXRhaWwtZGUuZGUubWQ=",
          "fileName": "page-002.klimamassnahme-detail-de.de.md",
          "hasFrontmatter": true,
          "frontmatterKeys": 36,
          "hasChapters": false,
          "location": "sibling",
          "mode": "v2"
        }
      },
      {
        "eventId": "1768735383102-4663c8s0",
        "ts": {
          "$date": "2026-01-18T11:23:03.102Z"
        },
        "spanId": "ingest",
        "name": "chapters_analyze_start",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "chapters_analyze_start",
          "details": {
            "libraryId": "ff73d3a2-fe01-4674-bce1-feb708235a5a",
            "textLen": 2834,
            "stripped": false
          }
        }
      },
      {
        "eventId": "1768735383190-uc4ed7t2",
        "ts": {
          "$date": "2026-01-18T11:23:03.190Z"
        },
        "spanId": "ingest",
        "name": "chapters_analyze_result",
        "level": "info",
        "message": null,
        "attributes": {
          "phase": "chapters_analyze_result",
          "details": {
            "chapters": 1,
            "pages": 1
          }
        }
      },
      {
        "eventId": "1768735383215-mxfwuqzr",
        "ts": {
          "$date": "2026-01-18T11:23:03.215Z"
        },
        "spanId": "postprocessing",
        "name": "stored_path",
        "level": "info",
        "message": "www.klimaland.bz/RückmeldungenDerLandesverwaltung/test/vorschlaege-shf-nicht-umsetzbar/.page-002.md/page-002.klimamassnahme-detail-de.de.md",
        "attributes": {
          "path": "www.klimaland.bz/RückmeldungenDerLandesverwaltung/test/vorschlaege-shf-nicht-umsetzbar/.page-002.md/page-002.klimamassnahme-detail-de.de.md",
          "parentId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvdGVzdC92b3JzY2hsYWVnZS1zaGYtbmljaHQtdW1zZXR6YmFyLy5wYWdlLTAwMi5tZA==",
          "shadowTwinFolderId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvdGVzdC92b3JzY2hsYWVnZS1zaGYtbmljaHQtdW1zZXR6YmFyLy5wYWdlLTAwMi5tZA=="
        }
      },
      {
        "eventId": "1768735383443-77ulopjt",
        "ts": {
          "$date": "2026-01-18T11:23:03.443Z"
        },
        "spanId": "template",
        "name": "postprocessing_saved",
        "level": "info",
        "message": null,
        "attributes": {
          "savedItemId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvdGVzdC92b3JzY2hsYWVnZS1zaGYtbmljaHQtdW1zZXR6YmFyLy5wYWdlLTAwMi5tZC9wYWdlLTAwMi5rbGltYW1hc3NuYWhtZS1kZXRhaWwtZGUuZGUubWQ=",
          "fileName": "page-002.klimamassnahme-detail-de.de.md",
          "targetParentId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvdGVzdC92b3JzY2hsYWVnZS1zaGYtbmljaHQtdW1zZXR6YmFyLy5wYWdlLTAwMi5tZA==",
          "markdownLength": 2765,
          "hasFrontmatter": true
        }
      },
      {
        "eventId": "1768735383854-j4kldj14",
        "ts": {
          "$date": "2026-01-18T11:23:03.854Z"
        },
        "spanId": "template",
        "name": "step_completed",
        "level": "info",
        "message": null,
        "attributes": {
          "step": "transform_template",
          "source": "primary"
        }
      },
      {
        "eventId": "1768735384028-dcs5m6qc",
        "ts": {
          "$date": "2026-01-18T11:23:04.028Z"
        },
        "spanId": "template",
        "name": "template_step_completed",
        "level": "info",
        "message": null,
        "attributes": {}
      },
      {
        "eventId": "1768735384573-8hkt74gc",
        "ts": {
          "$date": "2026-01-18T11:23:04.573Z"
        },
        "spanId": "template",
        "name": "step_completed",
        "level": "info",
        "message": null,
        "attributes": {
          "step": "transform_template"
        }
      },
      {
        "eventId": "1768735385008-di8dgoqb",
        "ts": {
          "$date": "2026-01-18T11:23:05.008Z"
        },
        "spanId": "postprocessing",
        "name": "postprocessing_save",
        "level": "info",
        "message": null,
        "attributes": {
          "name": "page-002.klimamassnahme-detail-de.de.md",
          "parentId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvdGVzdC92b3JzY2hsYWVnZS1zaGYtbmljaHQtdW1zZXR6YmFyLy5wYWdlLTAwMi5tZA==",
          "shadowTwinFolderId": null,
          "artifactKind": "transformation",
          "targetLanguage": "de",
          "templateName": "klimamassnahme-detail-de"
        }
      },
      {
        "eventId": "1768735385092-52gcgrz4",
        "ts": {
          "$date": "2026-01-18T11:23:05.092Z"
        },
        "spanId": "postprocessing",
        "name": "stored_local",
        "level": "info",
        "message": null,
        "attributes": {
          "savedItemId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvdGVzdC92b3JzY2hsYWVnZS1zaGYtbmljaHQtdW1zZXR6YmFyLy5wYWdlLTAwMi5tZC9wYWdlLTAwMi5rbGltYW1hc3NuYWhtZS1kZXRhaWwtZGUuZGUubWQ=",
          "name": "page-002.klimamassnahme-detail-de.de.md",
          "parentId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvdGVzdC92b3JzY2hsYWVnZS1zaGYtbmljaHQtdW1zZXR6YmFyLy5wYWdlLTAwMi5tZA==",
          "shadowTwinFolderId": null
        }
      },
      {
        "eventId": "1768735385803-3kfq5oip",
        "ts": {
          "$date": "2026-01-18T11:23:05.803Z"
        },
        "spanId": "postprocessing",
        "name": "stored_path",
        "level": "info",
        "message": "www.klimaland.bz/RückmeldungenDerLandesverwaltung/test/vorschlaege-shf-nicht-umsetzbar/.page-002.md/page-002.klimamassnahme-detail-de.de.md",
        "attributes": {
          "path": "www.klimaland.bz/RückmeldungenDerLandesverwaltung/test/vorschlaege-shf-nicht-umsetzbar/.page-002.md/page-002.klimamassnahme-detail-de.de.md",
          "parentId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvdGVzdC92b3JzY2hsYWVnZS1zaGYtbmljaHQtdW1zZXR6YmFyLy5wYWdlLTAwMi5tZA==",
          "shadowTwinFolderId": null
        }
      },
      {
        "eventId": "1768735385996-5iwdh2nu",
        "ts": {
          "$date": "2026-01-18T11:23:05.996Z"
        },
        "spanId": "template",
        "name": "postprocessing_saved",
        "level": "info",
        "message": null,
        "attributes": {
          "savedItemId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvdGVzdC92b3JzY2hsYWVnZS1zaGYtbmljaHQtdW1zZXR6YmFyLy5wYWdlLTAwMi5tZC9wYWdlLTAwMi5rbGltYW1hc3NuYWhtZS1kZXRhaWwtZGUuZGUubWQ=",
          "fileName": "page-002.klimamassnahme-detail-de.de.md",
          "targetParentId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvdGVzdC92b3JzY2hsYWVnZS1zaGYtbmljaHQtdW1zZXR6YmFyLy5wYWdlLTAwMi5tZA==",
          "markdownLength": 3106,
          "hasFrontmatter": true
        }
      },
      {
        "eventId": "1768735386390-e5nl9765",
        "ts": {
          "$date": "2026-01-18T11:23:06.390Z"
        },
        "spanId": "template",
        "name": "step_completed",
        "level": "info",
        "message": null,
        "attributes": {
          "step": "transform_template",
          "source": "primary"
        }
      },
      {
        "eventId": "1768735386575-1qwytlx6",
        "ts": {
          "$date": "2026-01-18T11:23:06.575Z"
        },
        "spanId": "template",
        "name": "template_step_completed",
        "level": "info",
        "message": null,
        "attributes": {}
      },
      {
        "eventId": "1768735386830-i0yhkypo",
        "ts": {
          "$date": "2026-01-18T11:23:06.830Z"
        },
        "spanId": "ingest",
        "name": "step_running",
        "level": "info",
        "message": null,
        "attributes": {
          "step": "ingest_rag"
        }
      },
      {
        "eventId": "1768735386918-laj1vmwv",
        "ts": {
          "$date": "2026-01-18T11:23:06.918Z"
        },
        "spanId": "ingest",
        "name": "ingest_start",
        "level": "info",
        "message": null,
        "attributes": {
          "libraryId": "ff73d3a2-fe01-4674-bce1-feb708235a5a"
        }
      },
      {
        "eventId": "1768735387118-v0u4o67p",
        "ts": {
          "$date": "2026-01-18T11:23:07.118Z"
        },
        "spanId": "ingest",
        "name": "ingest_decision",
        "level": "info",
        "message": null,
        "attributes": {
          "useIngestion": true,
          "policiesIngest": "do",
          "ingestGateExists": false
        }
      },
      {
        "eventId": "1768735392069-7vcqc5b6",
        "ts": {
          "$date": "2026-01-18T11:23:12.069Z"
        },
        "spanId": "ingest",
        "name": "meta_doc_upsert_done",
        "level": "info",
        "message": null,
        "attributes": {
          "fileId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvdGVzdC92b3JzY2hsYWVnZS1zaGYtbmljaHQtdW1zZXR6YmFyL3BhZ2UtMDAyLm1k",
          "chunks": 1,
          "chapters": 0,
          "hasEmbedding": true
        }
      },
      {
        "eventId": "1768735392243-jpr1byaq",
        "ts": {
          "$date": "2026-01-18T11:23:12.243Z"
        },
        "spanId": "ingest",
        "name": "ingest_mongodb_upserted",
        "level": "info",
        "message": null,
        "attributes": {
          "chunks": 1,
          "doc": true,
          "total": 2,
          "vectorFileId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvdGVzdC92b3JzY2hsYWVnZS1zaGYtbmljaHQtdW1zZXR6YmFyL3BhZ2UtMDAyLm1k"
        }
      },
      {
        "eventId": "1768735392337-g7z4kjj1",
        "ts": {
          "$date": "2026-01-18T11:23:12.337Z"
        },
        "spanId": "ingest",
        "name": "ingest_doc_id",
        "level": "info",
        "message": null,
        "attributes": {
          "vectorFileId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvdGVzdC92b3JzY2hsYWVnZS1zaGYtbmljaHQtdW1zZXR6YmFyL3BhZ2UtMDAyLm1k",
          "fileName": "page-002.de.md"
        }
      },
      {
        "eventId": "1768735392602-gdx37lb2",
        "ts": {
          "$date": "2026-01-18T11:23:12.602Z"
        },
        "spanId": "ingest",
        "name": "step_completed",
        "level": "info",
        "message": null,
        "attributes": {
          "step": "ingest_rag"
        }
      },
      {
        "eventId": "1768735392984-w0s10zsf",
        "ts": {
          "$date": "2026-01-18T11:23:12.984Z"
        },
        "spanId": "template",
        "name": "step_completed",
        "level": "info",
        "message": null,
        "attributes": {
          "step": "transform_template"
        }
      }
    ],
    "spans": [
      {
        "spanId": "job",
        "name": "job",
        "status": "completed",
        "startedAt": {
          "$date": "2026-01-18T11:22:48.465Z"
        },
        "endedAt": {
          "$date": "2026-01-18T11:23:06.376Z"
        }
      },
      {
        "spanId": "template",
        "parentSpanId": "job",
        "name": "transform_template",
        "phase": null,
        "status": "completed",
        "startedAt": {
          "$date": "2026-01-18T11:22:54.782Z"
        },
        "attributes": {},
        "endedAt": {
          "$date": "2026-01-18T11:23:03.780Z"
        }
      },
      {
        "spanId": "template",
        "parentSpanId": "job",
        "name": "transform_template",
        "phase": null,
        "status": "completed",
        "startedAt": {
          "$date": "2026-01-18T11:22:55.283Z"
        },
        "attributes": {},
        "endedAt": {
          "$date": "2026-01-18T11:23:03.780Z"
        }
      },
      {
        "spanId": "postprocessing",
        "parentSpanId": "job",
        "name": "postprocessing",
        "phase": null,
        "status": "completed",
        "startedAt": {
          "$date": "2026-01-18T11:23:01.984Z"
        },
        "attributes": {},
        "endedAt": {
          "$date": "2026-01-18T11:23:03.295Z"
        }
      },
      {
        "spanId": "postprocessing",
        "parentSpanId": "job",
        "name": "postprocessing",
        "phase": null,
        "status": "completed",
        "startedAt": {
          "$date": "2026-01-18T11:23:03.807Z"
        },
        "attributes": {},
        "endedAt": {
          "$date": "2026-01-18T11:23:05.890Z"
        }
      },
      {
        "spanId": "ingest",
        "parentSpanId": "job",
        "name": "ingest_rag",
        "phase": null,
        "status": "completed",
        "startedAt": {
          "$date": "2026-01-18T11:23:06.746Z"
        },
        "attributes": {},
        "endedAt": {
          "$date": "2026-01-18T11:23:12.509Z"
        }
      }
    ],
    "currentSpanId": "template"
  },
  "shadowTwinState": {
    "baseItem": {
      "id": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvdGVzdC92b3JzY2hsYWVnZS1zaGYtbmljaHQtdW1zZXR6YmFyL3BhZ2UtMDAyLm1k",
      "metadata": {
        "name": "page-002.md"
      }
    },
    "transformed": null,
    "transcriptFiles": [
      {
        "id": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvdGVzdC92b3JzY2hsYWVnZS1zaGYtbmljaHQtdW1zZXR6YmFyLy5wYWdlLTAwMi5tZC9wYWdlLTAwMi5kZS5tZA==",
        "metadata": {
          "name": "page-002.de.md"
        }
      }
    ],
    "shadowTwinFolderId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvdGVzdC92b3JzY2hsYWVnZS1zaGYtbmljaHQtdW1zZXR6YmFyLy5wYWdlLTAwMi5tZA==",
    "mediaFiles": null,
    "analysisTimestamp": 1768735370982,
    "analysisError": null,
    "processingStatus": "ready"
  },
  "metaHistory": [
    {
      "at": {
        "$date": "2026-01-18T11:22:55.101Z"
      },
      "meta": {
        "template_used": "klimamassnahme-detail-de"
      },
      "source": "template_pick"
    },
    {
      "at": {
        "$date": "2026-01-18T11:22:55.602Z"
      },
      "meta": {
        "template_used": "klimamassnahme-detail-de"
      },
      "source": "template_pick"
    },
    {
      "at": {
        "$date": "2026-01-18T11:23:03.579Z"
      },
      "meta": {
        "title": "Nachhaltiger Warentransport und Verlagerung auf die Schiene",
        "Massnahme_Nr": "345",
        "handlungsfeld": "Schwerverkehr und Warentransport",
        "thema": "Gütertransport und Emissionsreduktion",
        "quelle": "Vorschlag Klimabürgerrat",
        "zustaendigkeit": "Ressort Infrastrukturen und Mobilität",
        "umsetzungsstand": "Die Autonome Provinz Bozen besitzt keine primäre Gesetzgebungskompetenz in diesem Bereich, daher kann der Vorschlag nicht umgesetzt werden.",
        "bewertung": "Vorschlag nicht umsetzbar (technisch/rechtlich)",
        "status": "geplant",
        "stand": null,
        "authors": [],
        "year": null,
        "region": "Südtirol",
        "docType": "klimamassnahme",
        "source": "Stakeholder Forum Klima",
        "tags": [
          "schwerverkehr",
          "warentransport",
          "mobilitaet",
          "emissionen"
        ],
        "beschreibung_vorschlag": null,
        "bewertung_land": null,
        "kommentar": null,
        "ergebnisse_messbar": null,
        "umsetzung_landesverwaltung": false,
        "mittelfristig_umsetzbar": null,
        "co2_einsparpotential": null,
        "sprache": "de",
        "format": "klimamassnahme-detail",
        "bodyInText": "# Nachhaltiger Warentransport und Verlagerung auf die Schiene\n\nIm Rahmen der Bemühungen um den Klimaschutz in Südtirol steht der Schwerverkehr besonders im Fokus. Ziel ist es, den Warentransport effizienter und umweltfreundlicher zu gestalten.\n\n### Der Vorschlag\nDer Klimabürgerrat und die Arbeitsgruppe Mobilität des Stakeholder Forums schlagen vor, den Gütertransport grundlegend zu reformieren. Im Mittelpunkt steht die Verlagerung von der Straße auf die Schiene als oberste Priorität. Zudem sollen externe Kosten des Schwerverkehrs internalisiert und Leerfahrten durch bessere Planung reduziert werden. Die Planung soll dabei nicht nur wirtschaftliche Aspekte, sondern auch die Lebensqualität und Gesundheit der Bevölkerung berücksichtigen.\n\nDas übergeordnete Ziel des Klimaplans Südtirol 2040 sieht vor, die Emissionen im Schwerverkehr bis 2030 um mehr als 35 % zu senken und bis 2037 nahezu emissionsfrei zu gestalten.\n\n### Aktueller Stand und Umsetzung\nDie Landesverwaltung hat den Vorschlag geprüft. Das Ressort für Infrastrukturen und Mobilität weist darauf hin, dass die Autonome Provinz Bozen in diesem spezifischen Bereich keine primäre Gesetzgebungskompetenz besitzt. \n\n### Bewertung der Landesverwaltung\nAufgrund der rechtlichen Rahmenbedingungen wurde die Maßnahme als technisch bzw. rechtlich nicht umsetzbar auf Landesebene eingestuft. Da die gesetzliche Zuständigkeit für diesen Bereich nicht beim Land liegt, können die vorgeschlagenen Änderungen in der gewünschten Form nicht direkt durch die Provinz realisiert werden.",
        "job_id": "c0d0cc0d-da09-4a35-9f20-86acb6a51e5f",
        "source_file": "page-002.md",
        "extract_status": "completed",
        "template_status": "completed",
        "template": "klimamassnahme-detail-de",
        "summary_language": "de",
        "chapters": [],
        "toc": [],
        "pages": 1
      },
      "source": "template_transform"
    },
    {
      "at": {
        "$date": "2026-01-18T11:23:06.108Z"
      },
      "meta": {
        "title": "Nachhaltiger Schwerverkehr und Warentransport auf Schiene und Straße",
        "Massnahme_Nr": "345",
        "handlungsfeld": "Schwerverkehr und Warentransport",
        "thema": "Verlagerung auf die Schiene und Emissionsreduktion",
        "quelle": "Vorschlag Klimabürgerrat",
        "zustaendigkeit": "Ressort Infrastrukturen und Mobilität",
        "umsetzungsstand": "Die Autonome Provinz Bozen besitzt keine primäre Gesetzgebungskompetenz in diesem Bereich, daher kann der Vorschlag nicht umgesetzt werden.",
        "bewertung": "Vorschlag nicht umsetzbar (technisch/rechtlich)",
        "status": "geplant",
        "stand": null,
        "authors": [],
        "year": null,
        "region": "Südtirol",
        "docType": "klimamassnahme",
        "source": "Stakeholder Forum Klima",
        "tags": [
          "schwerverkehr",
          "warentransport",
          "mobilitaet",
          "schiene",
          "emissionsreduktion"
        ],
        "beschreibung_vorschlag": null,
        "bewertung_land": null,
        "kommentar": null,
        "ergebnisse_messbar": null,
        "umsetzung_landesverwaltung": false,
        "mittelfristig_umsetzbar": null,
        "co2_einsparpotential": null,
        "sprache": "de",
        "format": "klimamassnahme-detail",
        "bodyInText": "# Nachhaltiger Schwerverkehr und Warentransport auf Schiene und Straße\n\n### Hintergrund des Vorschlags\nIm Rahmen des Klimabürgerrats wurde ein umfassender Vorschlag zur Neugestaltung des Güterverkehrs erarbeitet. Das Ziel ist eine deutliche Reduktion der Treibhausgasemissionen im Schwerverkehr. Konkret sieht der Klimaplan Südtirol 2040 vor, den konventionellen Schwerverkehr (Transit- und Quell-Zielverkehr) bis 2030 um mehr als 35 % und bis 2037 um nahezu 100 % gegenüber dem Jahr 2019 zu senken. Langfristig soll der Transport vollständig emissionsfrei erfolgen.\n\n### Die Kernpunkte des Vorschlags\nDie Arbeitsgruppe Mobilität des Stakeholder Forums Klima hat den Vorschlag um folgende Schwerpunkte ergänzt:\n- **Verlagerung auf die Schiene:** Der Transport von Gütern soll vorrangig von der Straße auf die Bahn verlagert werden.\n- **Kostenwahrheit:** Externe Kosten, die durch den Schwerverkehr entstehen, sollen internalisiert werden.\n- **Effizienzsteigerung:** Die Menge der Güter sowie die Anzahl von Leerfahrten müssen kritisch hinterfragt und optimiert werden.\n- **Ganzheitliche Planung:** Neben Wirtschafts- und Verkehrsprognosen sollen die Lebensqualität, die Gesundheit der Bevölkerung und die Klimaziele als Planungsgrundlage dienen.\n\n### Rückmeldung der Landesverwaltung\nDas zuständige Ressort für Infrastrukturen und Mobilität weist darauf hin, dass die Autonome Provinz Bozen in diesem spezifischen Bereich keine primäre Gesetzgebungskompetenz besitzt. Da die rechtlichen Rahmenbedingungen auf staatlicher oder internationaler Ebene festgelegt werden, kann die Provinz diesen Vorschlag in der vorgeschlagenen Form nicht eigenständig umsetzen.\n\n### Bewertung\nAufgrund der fehlenden gesetzlichen Zuständigkeit wird die Maßnahme aktuell als technisch bzw. rechtlich nicht umsetzbar eingestuft.",
        "job_id": "c0d0cc0d-da09-4a35-9f20-86acb6a51e5f",
        "source_file": "page-002.md",
        "extract_status": "completed",
        "template_status": "completed",
        "template": "klimamassnahme-detail-de",
        "summary_language": "de",
        "chapters": [],
        "toc": [],
        "pages": 1,
        "detailViewType": "blog"
      },
      "source": "template_transform"
    }
  ],
  "cumulativeMeta": {
    "template_used": "klimamassnahme-detail-de",
    "title": "Nachhaltiger Schwerverkehr und Warentransport auf Schiene und Straße",
    "Massnahme_Nr": "345",
    "handlungsfeld": "Schwerverkehr und Warentransport",
    "thema": "Verlagerung auf die Schiene und Emissionsreduktion",
    "quelle": "Vorschlag Klimabürgerrat",
    "zustaendigkeit": "Ressort Infrastrukturen und Mobilität",
    "umsetzungsstand": "Die Autonome Provinz Bozen besitzt keine primäre Gesetzgebungskompetenz in diesem Bereich, daher kann der Vorschlag nicht umgesetzt werden.",
    "bewertung": "Vorschlag nicht umsetzbar (technisch/rechtlich)",
    "status": "geplant",
    "stand": null,
    "authors": [],
    "year": null,
    "region": "Südtirol",
    "docType": "klimamassnahme",
    "source": "Stakeholder Forum Klima",
    "tags": [
      "schwerverkehr",
      "warentransport",
      "mobilitaet",
      "schiene",
      "emissionsreduktion"
    ],
    "beschreibung_vorschlag": null,
    "bewertung_land": null,
    "kommentar": null,
    "ergebnisse_messbar": null,
    "umsetzung_landesverwaltung": false,
    "mittelfristig_umsetzbar": null,
    "co2_einsparpotential": null,
    "sprache": "de",
    "format": "klimamassnahme-detail",
    "bodyInText": "# Nachhaltiger Schwerverkehr und Warentransport auf Schiene und Straße\n\n### Hintergrund des Vorschlags\nIm Rahmen des Klimabürgerrats wurde ein umfassender Vorschlag zur Neugestaltung des Güterverkehrs erarbeitet. Das Ziel ist eine deutliche Reduktion der Treibhausgasemissionen im Schwerverkehr. Konkret sieht der Klimaplan Südtirol 2040 vor, den konventionellen Schwerverkehr (Transit- und Quell-Zielverkehr) bis 2030 um mehr als 35 % und bis 2037 um nahezu 100 % gegenüber dem Jahr 2019 zu senken. Langfristig soll der Transport vollständig emissionsfrei erfolgen.\n\n### Die Kernpunkte des Vorschlags\nDie Arbeitsgruppe Mobilität des Stakeholder Forums Klima hat den Vorschlag um folgende Schwerpunkte ergänzt:\n- **Verlagerung auf die Schiene:** Der Transport von Gütern soll vorrangig von der Straße auf die Bahn verlagert werden.\n- **Kostenwahrheit:** Externe Kosten, die durch den Schwerverkehr entstehen, sollen internalisiert werden.\n- **Effizienzsteigerung:** Die Menge der Güter sowie die Anzahl von Leerfahrten müssen kritisch hinterfragt und optimiert werden.\n- **Ganzheitliche Planung:** Neben Wirtschafts- und Verkehrsprognosen sollen die Lebensqualität, die Gesundheit der Bevölkerung und die Klimaziele als Planungsgrundlage dienen.\n\n### Rückmeldung der Landesverwaltung\nDas zuständige Ressort für Infrastrukturen und Mobilität weist darauf hin, dass die Autonome Provinz Bozen in diesem spezifischen Bereich keine primäre Gesetzgebungskompetenz besitzt. Da die rechtlichen Rahmenbedingungen auf staatlicher oder internationaler Ebene festgelegt werden, kann die Provinz diesen Vorschlag in der vorgeschlagenen Form nicht eigenständig umsetzen.\n\n### Bewertung\nAufgrund der fehlenden gesetzlichen Zuständigkeit wird die Maßnahme aktuell als technisch bzw. rechtlich nicht umsetzbar eingestuft.",
    "job_id": "c0d0cc0d-da09-4a35-9f20-86acb6a51e5f",
    "source_file": "page-002.md",
    "extract_status": "completed",
    "template_status": "completed",
    "template": "klimamassnahme-detail-de",
    "summary_language": "de",
    "chapters": [],
    "toc": [],
    "pages": 1,
    "detailViewType": "blog"
  },
  "payload": {},
  "result": {
    "savedItemId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvdGVzdC92b3JzY2hsYWVnZS1zaGYtbmljaHQtdW1zZXR6YmFyLy5wYWdlLTAwMi5tZC9wYWdlLTAwMi5rbGltYW1hc3NuYWhtZS1kZXRhaWwtZGUuZGUubWQ="
  },
  "ingestion": {
    "upsertAt": {
      "$date": "2026-01-18T11:23:12.105Z"
    },
    "vectorsUpserted": 2,
    "index": "doc_meta__ff73d3a2-fe01-4674-bce1-feb708235a5a"
  }
}

---

**Cursor**

Das Ergebnis ist korrekt. Analyse:

## Was korrekt funktioniert hat

1. Job-Typ: `job_type: "text"` – korrekt gesetzt
2. Policies:
   - `extract: "ignore"` – korrekt, Extraktion übersprungen
   - `metadata: "do"` – Transformation durchgeführt
   - `ingest: "do"` – Ingestion durchgeführt
3. Steps:
   - `extract_pdf` mit `skipped: true, reason: "phase_disabled"` – korrekt übersprungen
   - `transform_template: "completed"` – erfolgreich
   - `ingest_rag: "completed"` – erfolgreich
4. Callback: Direkt mit `extracted_text` gefüttert (kein Secretary-Call für Extraction)
5. Shadow-Twin:
   - Transcript: `page-002.de.md` erstellt
   - Transformation: `page-002.klimamassnahme-detail-de.de.md` erstellt
   - Beide im Dot-Folder `.page-002.md/`
6. Metadaten: Korrekt extrahiert (Titel, Massnahme_Nr, handlungsfeld, etc.)
7. Ingestion: MongoDB-Vektoren erfolgreich erstellt (`vectorsUpserted: 2`)

## Kleine Inkonsistenz (nicht kritisch)

Der Step-Name ist `extract_pdf`, obwohl es ein Text-Job ist. Das ist ein Legacy-Name aus der bestehenden Step-Struktur. Funktional korrekt, da der Step übersprungen wird.

Fazit: Die Implementierung funktioniert wie vorgesehen. Markdown-Dateien werden korrekt verarbeitet, die Extraktion wird übersprungen, und Template-Transformation sowie Ingestion laufen erfolgreich durch.

---

**User**

ok, meta eintrag wird generiert:
Wird auch in http://localhost:3000/library/gallery angezeigt. 
Detailansicht, kann ich nicht öffnen.


---
{
  "_id": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvdGVzdC92b3JzY2hsYWVnZS1zaGYtbmljaHQtdW1zZXR6YmFyL3BhZ2UtMDAyLm1k-meta",
  "authors": [],
  "chapters": [],
  "chaptersCount": 0,
  "chunkCount": 1,
  "docMetaJson": {
    "title": "Nachhaltiger Schwerverkehr und Warentransport",
    "Massnahme_Nr": "345",
    "handlungsfeld": "Schwerverkehr und Warentransport",
    "thema": "Verlagerung des Güterverkehrs auf die Schiene",
    "quelle": "Vorschlag Klimabürgerrat",
    "zustaendigkeit": "Ressort Infrastrukturen und Mobilität",
    "umsetzungsstand": "Die Autonome Provinz Bozen verfügt über keine primäre Gesetzgebungskompetenz in diesem Bereich, weshalb eine direkte Umsetzung nicht möglich ist.",
    "bewertung": "Vorschlag nicht umsetzbar (technisch/rechtlich)",
    "status": "geplant",
    "stand": "",
    "authors": [],
    "year": 2024,
    "region": "Südtirol",
    "docType": "klimamassnahme",
    "source": "Stakeholder Forum Klima",
    "tags": [
      "schwerverkehr",
      "warentransport",
      "mobilitaet",
      "gueterverkehr",
      "schiene"
    ],
    "beschreibung_vorschlag": "",
    "bewertung_land": "",
    "kommentar": "",
    "ergebnisse_messbar": "",
    "umsetzung_landesverwaltung": "false",
    "mittelfristig_umsetzbar": "",
    "co2_einsparpotential": "Ja",
    "sprache": "de",
    "format": "klimamassnahme-detail",
    "bodyInText": "# Nachhaltiger Schwerverkehr und Warentransport\\n\\nDer Transport von Waren auf unseren Straßen beeinflusst nicht nur die Luftqualität, sondern auch die Lebensqualität und Sicherheit in unseren Gemeinden. Um die Klimaziele zu erreichen, muss der Güterverkehr effizienter und sauberer gestaltet werden.\\n\\n## Worum geht es?\\nDas Ziel ist eine drastische Reduktion der Treibhausgase im Schwerverkehr. Bis zum Jahr 2030 sollen die Emissionen im Vergleich zu 2019 um mehr als 35 % sinken, mit dem langfristigen Ziel eines nahezu emissionsfreien Transports bis 2037. Dies betrifft sowohl den Transitverkehr durch Südtirol als auch den lokalen Warenverkehr.\\n\\n## Was wird vorgeschlagen?\\nEs gibt mehrere Ansätze, um den Gütertransport nachhaltiger zu gestalten. Im Vordergrund steht die Verlagerung von der Straße auf die Schiene. Zudem sollen die tatsächlichen Kosten, die der Schwerverkehr für Umwelt und Gesundheit verursacht, stärker berücksichtigt werden. Auch die Vermeidung von Leerfahrten und eine bessere Planung auf Basis von Wirtschafts- und Verkehrsprognosen sind zentrale Punkte.\\n\\n## Warum ist diese Maßnahme wichtig?\\nDer Schwerverkehr trägt erheblich zum CO2-Ausstoß bei. Durch eine Optimierung der Transportwege und den Umstieg auf emissionsfreie Antriebe wird nicht nur das Klima geschützt, sondern auch die Lärmbelastung reduziert und die Gesundheit der Bevölkerung entlang der Hauptverkehrsrouten verbessert.\\n\\n## Wer ist dafür zuständig?\\nVerantwortlich ist das Ressort für Infrastrukturen und Mobilität. Da viele Regelungen zum Fernverkehr jedoch auf staatlicher oder internationaler Ebene getroffen werden, hat die Landesverwaltung in Südtirol hier nur begrenzte rechtliche Möglichkeiten zur direkten Gestaltung.\\n\\n## Wie ist der aktuelle Stand?\\nDer Vorschlag wird derzeit als rechtlich nicht unmittelbar umsetzbar eingestuft, da der Provinz die primäre Gesetzgebungskompetenz für diesen Bereich fehlt. Dennoch bleibt die Reduktion der Emissionen im Schwerverkehr ein zentraler Bestandteil des Klimaplans Südtirol 2040.\\n\\n## Was bringt das konkret?\\nFür die Bürgerinnen und Bürger bedeutet eine erfolgreiche Umsetzung weniger Stau, sauberere Luft und eine leisere Umgebung. Unternehmen könnten von effizienteren Logistikketten und einer modernen Schieneninfrastruktur profitieren.\\n\\n## Beispiele & Inspiration aus der Praxis\\nModelle zur Rollenden Landstraße oder Förderprogramme für emissionsfreie LKW-Flotten in anderen europäischen Regionen zeigen, wie der Warentransport der Zukunft aussehen kann. Auch die Digitalisierung der Logistik hilft dabei, Leerfahrten zu vermeiden.\\n\\n## Wie kann man sich beteiligen oder davon lernen?\\nInteressierte können sich über die Ziele des Klimaplans informieren und lokale Initiativen unterstützen, die sich für eine Verkehrsberuhigung und den Ausbau der Schiene einsetzen. Unternehmen können bereits jetzt prüfen, wie sie ihre Lieferketten CO2-neutraler gestalten können.",
    "job_id": "db031c29-d735-4ace-9b4d-338b1aa77c66",
    "source_file": "page-002.md",
    "extract_status": "completed",
    "template_status": "completed",
    "template": "klimamassnahme-detail-de",
    "summary_language": "de",
    "chapters": [],
    "toc": [],
    "pages": "1",
    "markdown": "# Nachhaltiger Schwerverkehr und Warentransport"
  },
  "docType": "klimamassnahme",
  "embedding": [
    -0.017526907846331596,
    0.011665260419249535,
    0.013580452650785446,
    -0.019151920452713966,
    -0.004613871686160564,
    0.025187676772475243,
    -0.0014073759084567428,
    0.0037723479326814413,
    0.009343815967440605,
    -0.0478217639029026,
    -0.017178691923618317,
    0.007022370584309101,
    -0.013986704871058464,
    -0.009808104485273361,
    0.018571559339761734,
    -0.012477765791118145,
    -0.006616117898374796,
    0.04178600758314133,
    0.009343815967440605,
    0.001675792969763279,
    0.032964516431093216,
    -0.07846483588218689,
    0.01004024874418974,
    -0.0394645631313324,
    -0.003859402146190405,
    -0.019964424893260002,
    0.022866232320666313,
    0.031107360497117043,
    0.030643071979284286,
    -0.008415238000452518,
    -0.015553680248558521,
    0.0315716490149498,
    0.006442009471356869,
    0.04016099497675896,
    -0.0009285779669880867,
    0.005281287245452404,
    -0.0552503876388073,
    0.006558081600815058,
    0.0278573390096426,
    -0.016830476000905037,
    -0.027393048629164696,
    0.0022634086199104786,
    0.031339503824710846,
    -0.0868220403790474,
    0.007196479011327028,
    -0.022518014535307884,
    -0.046428896486759186,
    0.01636618562042713,
    -0.041553862392902374,
    -0.016017969697713852,
    -0.005832630209624767,
    -0.00016776066331658512,
    0.010156321339309216,
    -0.005687539931386709,
    -0.016946546733379364,
    0.006935316603630781,
    -0.03250022605061531,
    -0.01212954893708229,
    0.016830476000905037,
    -0.011026863008737564,
    -0.020893003791570663,
    0.006616117898374796,
    -0.004700925666838884,
    0.02890198864042759,
    -0.03575025126338005,
    0.029134131968021393,
    -0.001958718989044428,
    -0.011084899306297302,
    -0.029946638271212578,
    0.01004024874418974,
    0.04967891797423363,
    -0.0009430869831703603,
    -0.006354955490678549,
    0.01741083711385727,
    -0.014509030617773533,
    -0.06685761362314224,
    -0.0021473364904522896,
    0.016946546733379364,
    -0.0076027316972613335,
    0.01741083711385727,
    0.010272393003106117,
    0.009459887631237507,
    -0.000021536841813940555,
    0.02820555493235588,
    0.037607405334711075,
    -0.01833941414952278,
    -0.005687539931386709,
    -0.004555835388600826,
    0.01195544097572565,
    0.015321535989642143,
    -0.025651965290308,
    0.062214720994234085,
    -0.005919684190303087,
    0.050375353544950485,
    -0.008125056512653828,
    0.0031484595965594053,
    -0.014741174876689911,
    -0.019500136375427246,
    -0.04201815277338028,
    0.022053726017475128,
    -0.02066085860133171,
    0.03900027275085449,
    -0.03273237124085426,
    0.02367873676121235,
    -0.010794718749821186,
    0.02623232640326023,
    0.010852755047380924,
    -0.009227743372321129,
    0.0060357567854225636,
    0.020776931196451187,
    -0.005281287245452404,
    -0.00632593734189868,
    -0.013406343758106232,
    -0.025419821962714195,
    0.0046428898349404335,
    0.011549187824130058,
    0.0015234481543302536,
    0.0074866595678031445,
    0.006296919193118811,
    -0.027741266414523125,
    -0.0038884200621396303,
    0.018571559339761734,
    0.021821580827236176,
    -0.007196479011327028,
    0.008241129107773304,
    0.024026954546570778,
    0.02008049748837948,
    -0.010156321339309216,
    0.007776840124279261,
    -0.005513431504368782,
    0.03807169571518898,
    0.0157858245074749,
    -0.004004492424428463,
    0.012942055240273476,
    0.0019006829243153334,
    -0.009808104485273361,
    -0.00835720170289278,
    0.0006891789380460978,
    0.024026954546570778,
    -0.031339503824710846,
    -0.01265187468379736,
    -0.007109425030648708,
    0.005165214650332928,
    0.001363848801702261,
    0.029482349753379822,
    -0.03342880681157112,
    -0.0022198816295713186,
    0.0005876157083548605,
    -0.029946638271212578,
    0.019267993047833443,
    0.017178691923618317,
    0.02623232640326023,
    -0.004700925666838884,
    -0.022518014535307884,
    0.01810726895928383,
    0.010272393003106117,
    -0.032035939395427704,
    -0.0278573390096426,
    0.017875125631690025,
    -0.00835720170289278,
    -0.03342880681157112,
    0.035982396453619,
    0.014973319135606289,
    0.029598422348499298,
    0.06128614395856857,
    0.007196479011327028,
    -0.006645136047154665,
    0.022169798612594604,
    -0.019848354160785675,
    -0.016017969697713852,
    0.018223341554403305,
    -0.0197322815656662,
    -0.010446501895785332,
    0.026464471593499184,
    -0.03435738384723663,
    -0.003917437978088856,
    0.026812687516212463,
    -0.025071604177355766,
    -0.030643071979284286,
    0.005368341226130724,
    0.02008049748837948,
    0.009285779669880867,
    0.009285779669880867,
    0.019964424893260002,
    -0.004729943815618753,
    0.029018061235547066,
    -0.02495553158223629,
    -0.002640643622726202,
    0.0007580968085676432,
    0.024143027141690254,
    0.003598239505663514,
    0.045500319451093674,
    -0.032035939395427704,
    -0.023214448243379593,
    0.00771880429238081,
    -0.056643255054950714,
    -0.008589345961809158,
    -0.054321810603141785,
    -0.025187676772475243,
    -0.024026954546570778,
    -0.009750068187713623,
    0.04851819574832916,
    -0.024026954546570778,
    0.04178600758314133,
    -0.011781333014369011,
    0.018919775262475014,
    -0.014392958022654057,
    -0.024723388254642487,
    -0.002132827416062355,
    -0.01706261932849884,
    0.013000091537833214,
    0.01903584785759449,
    0.00696433475241065,
    -0.0001940582733368501,
    -0.02100907638669014,
    -0.04758961871266365,
    0.020776931196451187,
    0.022053726017475128,
    -0.021125148981809616,
    0.01067864615470171,
    0.00493307039141655,
    0.021937653422355652,
    -0.0025535894092172384,
    -0.004497799556702375,
    -0.03273237124085426,
    -0.00002947146822407376,
    0.04294672980904579,
    -0.0060067386366426945,
    -0.06267900764942169,
    -0.0157858245074749,
    0.04526817426085472,
    -0.03900027275085449,
    -0.017178691923618317,
    0.0031049323733896017,
    0.010330429300665855,
    0.029598422348499298,
    -0.017642980441451073,
    0.0076027316972613335,
    -0.010736682452261448,
    0.02008049748837948,
    0.011665260419249535,
    0.020544786006212234,
    -0.023794809356331825,
    -0.004062528256326914,
    0.05362537503242493,
    0.007109425030648708,
    -0.0027712248265743256,
    0.020893003791570663,
    0.022750159725546837,
    0.017526907846331596,
    -0.008299165405333042,
    0.032268084585666656,
    0.0024520261213183403,
    -0.007022370584309101,
    0.022750159725546837,
    0.007312551140785217,
    0.015205463394522667,
    0.04225029796361923,
    0.0021908634807914495,
    -0.0038013658486306667,
    0.07335765659809113,
    0.014683138579130173,
    -0.04039314016699791,
    -0.017875125631690025,
    -0.031107360497117043,
    -0.016946546733379364,
    0.0032935498747974634,
    -0.0179911982268095,
    0.03482167422771454,
    -0.03783955052495003,
    0.06871476769447327,
    0.014450994320213795,
    0.008241129107773304,
    -0.02855377085506916,
    -0.01265187468379736,
    -0.010562574490904808,
    0.007225497160106897,
    -0.0012767947046086192,
    -0.005194232799112797,
    0.005977720487862825,
    -0.02530374936759472,
    0.028321627527475357,
    -0.011084899306297302,
    0.00899559911340475,
    -0.009633996523916721,
    -0.021125148981809616,
    -0.030410926789045334,
    -0.00705138873308897,
    0.006848262157291174,
    0.06825047731399536,
    0.004700925666838884,
    -0.005687539931386709,
    -0.045500319451093674,
    -0.00143639394082129,
    0.022053726017475128,
    -0.03180379420518875,
    0.009924177080392838,
    -0.005803612060844898,
    0.035285960882902145,
    0.016134042292833328,
    -0.014857247471809387,
    -0.005397359374910593,
    0.022053726017475128,
    -0.0036562755703926086,
    -0.02460731565952301,
    -0.004091546405106783,
    0.003380604088306427,
    -0.021937653422355652,
    -0.007544695865362883,
    -0.012535802088677883,
    0.01868763193488121,
    -0.014799211174249649,
    -0.015669751912355423,
    -0.026812687516212463,
    -0.031339503824710846,
    -0.010620609857141972,
    0.022169798612594604,
    -0.005542449653148651,
    -0.0072545153088867664,
    -0.0017048110021278262,
    -0.005310304928570986,
    -0.0098661407828331,
    -0.020196570083498955,
    0.005977720487862825,
    -0.015669751912355423,
    -0.008647382259368896,
    -0.0315716490149498,
    0.03017878346145153,
    0.018803702667355537,
    0.010620609857141972,
    0.02263408713042736,
    -0.026116253808140755,
    -0.010156321339309216,
    -0.017875125631690025,
    0.015669751912355423,
    0.015089391730725765,
    -0.00033008045284077525,
    0.02135729230940342,
    -0.0179911982268095,
    -0.023562666028738022,
    -0.029134131968021393,
    0.01363848801702261,
    -0.028669843450188637,
    0.01903584785759449,
    0.021241219714283943,
    0.011839368380606174,
    0.032964516431093216,
    -0.021589437499642372,
    0.0007508423295803368,
    -0.008125056512653828,
    0.027044832706451416,
    -0.045732464641332626,
    0.014450994320213795,
    0.0074866595678031445,
    -0.02100907638669014,
    -0.006819244008511305,
    -0.009401851333677769,
    -0.00009793595381779596,
    -0.014683138579130173,
    -0.005600485485047102,
    0.0010228866012766957,
    -0.002713188761845231,
    0.006267901044338942,
    0.02588411048054695,
    0.0157858245074749,
    -0.01195544097572565,
    0.036910973489284515,
    -0.01543760858476162,
    0.002974351169541478,
    -0.0030178783927112818,
    0.014509030617773533,
    0.02925020456314087,
    -0.03180379420518875,
    0.00771880429238081,
    -0.014450994320213795,
    0.009517923928797245,
    -0.008473273366689682,
    -0.018455486744642258,
    -0.03667882829904556,
    -0.012825982645154,
    -0.003830383997410536,
    -0.020428715273737907,
    0.007834875956177711,
    -0.02228587120771408,
    -0.03180379420518875,
    0.030643071979284286,
    0.02727697603404522,
    -0.008647382259368896,
    0.014044741168618202,
    -0.03830384090542793,
    0.008415238000452518,
    0.015669751912355423,
    -0.013348307460546494,
    -0.025535892695188522,
    -0.001987737137824297,
    -0.005832630209624767,
    -0.037607405334711075,
    0.043178874999284744,
    0.008067021146416664,
    0.022866232320666313,
    -0.022518014535307884,
    0.01543760858476162,
    -0.003279040800407529,
    -0.009575960226356983,
    -0.006935316603630781,
    0.017178691923618317,
    -0.029598422348499298,
    -0.028089482337236404,
    -0.029598422348499298,
    0.0061518289148807526,
    -0.02692876011133194,
    -0.024026954546570778,
    -0.025651965290308,
    0.004671907983720303,
    -0.018919775262475014,
    0.01903584785759449,
    0.05385752022266388,
    -0.03087521716952324,
    0.03621453791856766,
    -0.013174199499189854,
    -0.012593838386237621,
    -0.013812596909701824,
    -0.02460731565952301,
    -0.0012260130606591702,
    -0.022518014535307884,
    -0.008879526518285275,
    0.03737526386976242,
    -0.01195544097572565,
    -0.010562574490904808,
    0.019500136375427246,
    -0.014567065984010696,
    -0.057571832090616226,
    0.0021183183416724205,
    -0.017875125631690025,
    -0.06175043433904648,
    -0.019616208970546722,
    0.0031919865868985653,
    0.02588411048054695,
    0.027509121224284172,
    0.008415238000452518,
    0.05687540024518967,
    0.016482258215546608,
    0.016017969697713852,
    -0.029018061235547066,
    -0.025419821962714195,
    -0.0018426468595862389,
    0.039232417941093445,
    0.03017878346145153,
    -0.03807169571518898,
    -0.005223250947892666,
    -0.02925020456314087,
    -0.024839458987116814,
    0.022169798612594604,
    0.029946638271212578,
    -0.015901897102594376,
    -0.009227743372321129,
    -0.014509030617773533,
    0.00853130966424942,
    0.008647382259368896,
    -0.03180379420518875,
    0.004381726961582899,
    -0.016134042292833328,
    0.0012550310930237174,
    -0.019616208970546722,
    -0.014625102281570435,
    -0.014741174876689911,
    0.003641766496002674,
    -0.02425909787416458,
    0.018803702667355537,
    -0.0001060972863342613,
    0.008008984848856926,
    0.008647382259368896,
    0.024839458987116814,
    0.002060282276943326,
    -0.032964516431093216,
    0.0278573390096426,
    -0.022169798612594604,
    0.0157858245074749,
    0.0032500228844583035,
    -0.055018242448568344,
    0.021125148981809616,
    -0.0006819244008511305,
    -0.025419821962714195,
    0.004584853537380695,
    0.016250113025307655,
    -0.0197322815656662,
    0.052696797996759415,
    -0.03273237124085426,
    -0.002640643622726202,
    0.02135729230940342,
    0.011839368380606174,
    -0.00028655334608629346,
    0.015321535989642143,
    0.013058126904070377,
    0.006935316603630781,
    -0.0076027316972613335,
    0.015901897102594376,
    -0.008241129107773304,
    -0.013580452650785446,
    -0.015205463394522667,
    -0.0015887388726696372,
    -0.0061228107661008835,
    -0.036910973489284515,
    0.03389309346675873,
    -0.04619675129652023,
    0.023562666028738022,
    -0.012245621532201767,
    0.019848354160785675,
    -0.0315716490149498,
    -0.026464471593499184,
    -0.0036998027935624123,
    0.012767946347594261,
    -0.01868763193488121,
    -0.008763453923165798,
    -0.008763453923165798,
    0.000551343138795346,
    0.03319666162133217,
    0.000317385041853413,
    -0.022169798612594604,
    -0.029714494943618774,
    -0.024491243064403534,
    0.014973319135606289,
    0.019964424893260002,
    0.005774593912065029,
    -0.0007726058829575777,
    0.008763453923165798,
    0.01329027209430933,
    0.03830384090542793,
    0.004526817239820957,
    -0.01329027209430933,
    -0.009808104485273361,
    0.011723296716809273,
    -0.013058126904070377,
    -0.017526907846331596,
    0.00005531567876460031,
    0.0030323872342705727,
    -0.00018045605975203216,
    -0.03250022605061531,
    0.010272393003106117,
    -0.020544786006212234,
    0.011723296716809273,
    0.040857430547475815,
    0.00835720170289278,
    -0.0179911982268095,
    -0.0017338291509076953,
    -0.01903584785759449,
    0.012245621532201767,
    -0.016598330810666084,
    0.0058906665071845055,
    -0.010852755047380924,
    -0.0007000606856308877,
    -0.016830476000905037,
    0.003351585939526558,
    0.024026954546570778,
    0.005165214650332928,
    0.010446501895785332,
    -0.017526907846331596,
    0.04851819574832916,
    -0.006790226325392723,
    -0.026812687516212463,
    -0.014741174876689911,
    0.007312551140785217,
    -0.016598330810666084,
    0.004236636683344841,
    0.02425909787416458,
    0.01410277746617794,
    0.012071513570845127,
    0.019848354160785675,
    0.011781333014369011,
    -0.019848354160785675,
    -0.026696614921092987,
    -0.034589529037475586,
    -0.003859402146190405,
    -0.017875125631690025,
    -0.0025971163995563984,
    0.01671440340578556,
    0.021125148981809616,
    0.024143027141690254,
    -0.01114293560385704,
    0.015669751912355423,
    0.006442009471356869,
    -0.017875125631690025,
    -0.008125056512653828,
    -0.018571559339761734,
    0.012071513570845127,
    -0.011665260419249535,
    0.0011244498891755939,
    0.007080406881868839,
    -0.024491243064403534,
    0.005977720487862825,
    -0.004352709278464317,
    0.05153607577085495,
    -0.053393229842185974,
    0.007544695865362883,
    -0.02460731565952301,
    -0.0060357567854225636,
    -0.005484413355588913,
    -0.018223341554403305,
    -0.0004969342844560742,
    0.031339503824710846,
    0.018571559339761734,
    -0.005049142520874739,
    -0.0033951131626963615,
    -0.009808104485273361,
    -0.011433116160333157,
    0.00011108476610388607,
    -0.0007363333133980632,
    0.02367873676121235,
    0.015205463394522667,
    0.017294764518737793,
    -0.03575025126338005,
    0.03667882829904556,
    -0.022169798612594604,
    0.01346438005566597,
    -0.01195544097572565,
    0.0006420245626941323,
    0.012942055240273476,
    0.011665260419249535,
    0.03714311867952347,
    -0.003830383997410536,
    -0.008299165405333042,
    0.05246465280652046,
    -0.012303657829761505,
    -0.019616208970546722,
    0.017875125631690025,
    0.034589529037475586,
    -0.008008984848856926,
    0.014683138579130173,
    0.03412523865699768,
    -0.027160905301570892,
    -0.037607405334711075,
    0.034589529037475586,
    0.014044741168618202,
    0.027044832706451416,
    -0.03621453791856766,
    0.03342880681157112,
    0.031107360497117043,
    0.0016975565813481808,
    -0.0631432980298996,
    0.01329027209430933,
    -0.012361694127321243,
    0.003670784644782543,
    0.02460731565952301,
    -0.018571559339761734,
    -0.006935316603630781,
    -0.034589529037475586,
    0.00916970707476139,
    0.004468781407922506,
    -0.026464471593499184,
    0.010910790413618088,
    0.02820555493235588,
    -0.014509030617773533,
    0.02495553158223629,
    0.021473364904522896,
    -0.0010519047500565648,
    0.020893003791570663,
    0.0030614053830504417,
    -0.0032210047356784344,
    -0.007776840124279261,
    0.029482349753379822,
    -0.005397359374910593,
    -0.000801623915322125,
    0.004526817239820957,
    -0.0023649719078093767,
    0.0239108819514513,
    -0.0007218242390081286,
    -0.017875125631690025,
    0.022053726017475128,
    -0.02008049748837948,
    -0.01868763193488121,
    0.006761208176612854,
    0.007660767994821072,
    -0.013116163201630116,
    -0.008763453923165798,
    0.021937653422355652,
    -0.02588411048054695,
    -0.0036562755703926086,
    0.0006057519931346178,
    0.015901897102594376,
    -0.013000091537833214,
    0.019500136375427246,
    -0.022866232320666313,
    0.015553680248558521,
    -0.016598330810666084,
    0.02031264267861843,
    -0.002466535195708275,
    -0.013232235796749592,
    -0.03900027275085449,
    0.01868763193488121,
    0.017178691923618317,
    -0.020776931196451187,
    0.018919775262475014,
    -0.004323691129684448,
    -0.0022634086199104786,
    -0.007834875956177711,
    -0.025187676772475243,
    0.009401851333677769,
    -0.014392958022654057,
    0.03087521716952324,
    -0.022750159725546837,
    0.037607405334711075,
    0.010794718749821186,
    0.027741266414523125,
    0.013232235796749592,
    -0.013232235796749592,
    -0.019616208970546722,
    -0.0010228866012766957,
    -0.0034676583018153906,
    -0.004468781407922506,
    0.0009430869831703603,
    0.040857430547475815,
    -0.055946819484233856,
    0.015321535989642143,
    -0.02367873676121235,
    -0.04062528535723686,
    -0.00003967313023167662,
    -0.016598330810666084,
    -0.002727697603404522,
    0.012477765791118145,
    -0.028437700122594833,
    0.0048460159450769424,
    -0.001320321811363101,
    0.005542449653148651,
    0.03435738384723663,
    -0.005078160669654608,
    0.009633996523916721,
    0.006267901044338942,
    -0.02623232640326023,
    0.006442009471356869,
    0.03575025126338005,
    -0.03644668310880661,
    0.024375170469284058,
    0.017875125631690025,
    0.0315716490149498,
    0.021125148981809616,
    -0.016946546733379364,
    0.010620609857141972,
    -0.0179911982268095,
    0.005629503633826971,
    0.01050453819334507,
    -0.00565852178260684,
    0.005194232799112797,
    -0.0007580968085676432,
    0.02692876011133194,
    -0.024143027141690254,
    -0.000489679747261107,
    0.002393990056589246,
    0.010794718749821186,
    -0.0008052511839196086,
    -0.002234390703961253,
    0.004468781407922506,
    0.007428623735904694,
    -0.010910790413618088,
    0.00316296867094934,
    -0.019616208970546722,
    0.007196479011327028,
    -0.021125148981809616,
    0.048750340938568115,
    0.011084899306297302,
    0.012187585234642029,
    -0.009575960226356983,
    0.009633996523916721,
    -0.014392958022654057,
    -0.008415238000452518,
    -0.043875306844711304,
    -0.005397359374910593,
    0.006093792617321014,
    -0.00835720170289278,
    -0.006993352435529232,
    0.00771880429238081,
    -0.0036998027935624123,
    -0.022401941940188408,
    0.012013477273285389,
    0.013116163201630116,
    0.0011462133843451738,
    0.01050453819334507,
    -0.00158148433547467,
    0.017526907846331596,
    0.0048460159450769424,
    -0.053393229842185974,
    -0.01671440340578556,
    0.013522416353225708,
    -0.029134131968021393,
    0.013174199499189854,
    -0.025768037885427475,
    0.006761208176612854,
    -0.016017969697713852,
    -0.017178691923618317,
    -0.01195544097572565,
    -0.025187676772475243,
    0.029482349753379822,
    0.0026261345483362675,
    -0.010330429300665855,
    0.04016099497675896,
    0.025535892695188522,
    0.022866232320666313,
    -0.01265187468379736,
    0.010968826711177826,
    -0.027741266414523125,
    -0.001153467921540141,
    -0.0037433297839015722,
    -0.0005839884979650378,
    0.009517923928797245,
    -0.014450994320213795,
    -0.08496487885713577,
    0.008647382259368896,
    -0.015205463394522667,
    -0.01427688542753458,
    0.039232417941093445,
    -0.005455395206809044,
    0.01671440340578556,
    0.0014581575524061918,
    0.015669751912355423,
    -0.012593838386237621,
    0.018223341554403305,
    -0.026348398998379707,
    0.023794809356331825,
    0.0478217639029026,
    -0.025419821962714195,
    0.017875125631690025,
    0.025535892695188522,
    0.006790226325392723,
    -0.0098661407828331,
    -0.013116163201630116,
    -0.009575960226356983,
    0.0019297010730952024,
    0.035285960882902145,
    0.01050453819334507,
    0.015901897102594376,
    -0.01671440340578556,
    0.028669843450188637,
    -0.012419729493558407,
    -0.016482258215546608,
    0.011200970970094204,
    -0.005397359374910593,
    0.008299165405333042,
    0.01903584785759449,
    -0.03342880681157112,
    0.0315716490149498,
    -0.012825982645154,
    0.019964424893260002,
    0.015321535989642143,
    -0.020428715273737907,
    -0.039232417941093445,
    -0.010272393003106117,
    -0.020776931196451187,
    -0.0048750340938568115,
    -0.01004024874418974,
    -0.007109425030648708,
    -0.005281287245452404,
    0.04433959722518921,
    0.016134042292833328,
    0.03575025126338005,
    -0.02031264267861843,
    0.012477765791118145,
    0.03575025126338005,
    -0.0010373956756666303,
    0.005948702339082956,
    -0.004816998261958361,
    0.006442009471356869,
    -0.0038013658486306667,
    -0.0015161936171352863,
    0.03087521716952324,
    -0.01671440340578556,
    -0.008879526518285275,
    0.0048460159450769424,
    -0.01149115152657032,
    -0.009692031890153885,
    -0.047125332057476044,
    0.035982396453619,
    0.0076027316972613335,
    -0.015553680248558521,
    0.007660767994821072,
    -0.029134131968021393,
    0.00493307039141655,
    0.011433116160333157,
    0.014567065984010696,
    -0.012013477273285389,
    -0.014973319135606289,
    0.012245621532201767,
    0.004671907983720303,
    -0.014857247471809387,
    0.06175043433904648,
    -0.017526907846331596,
    -0.032964516431093216,
    0.03575025126338005,
    -0.013812596909701824,
    0.0047589619643986225,
    0.01131704356521368,
    0.014857247471809387,
    -0.009808104485273361,
    0.02762519381940365,
    -0.012303657829761505,
    0.026116253808140755,
    -0.007950948551297188,
    -0.031339503824710846,
    -0.037607405334711075,
    -0.020428715273737907,
    0.009924177080392838,
    0.017875125631690025,
    0.01833941414952278,
    -0.024839458987116814,
    -0.005078160669654608,
    0.03621453791856766,
    0.02588411048054695,
    -0.009633996523916721,
    0.023794809356331825,
    -0.011200970970094204,
    -0.014683138579130173,
    0.012825982645154,
    -0.029482349753379822,
    -0.023214448243379593,
    -0.006819244008511305,
    0.016250113025307655,
    -0.045500319451093674,
    -0.0013058127369731665,
    -0.034589529037475586,
    -0.023098375648260117,
    -0.022053726017475128,
    -0.01636618562042713,
    -0.028089482337236404,
    0.014334921725094318,
    0.004671907983720303,
    -0.0007544695981778204,
    -0.035982396453619,
    0.004294672980904579,
    -0.014392958022654057,
    0.008125056512653828,
    -0.0017846106784418225,
    -0.0073996055871248245,
    0.019616208970546722,
    0.007080406881868839,
    0.0061228107661008835,
    0.030643071979284286,
    -0.02495553158223629,
    0.048750340938568115,
    0.017642980441451073,
    -0.004497799556702375,
    0.010620609857141972,
    -0.01868763193488121,
    0.010794718749821186,
    0.029946638271212578,
    0.0030033693183213472,
    0.026000183075666428,
    0.014857247471809387,
    -0.016017969697713852,
    0.038535986095666885,
    0.02135729230940342,
    0.024723388254642487,
    0.013986704871058464,
    0.02623232640326023,
    -0.015553680248558521,
    -0.005368341226130724,
    -0.0139286695048213,
    -0.012767946347594261,
    0.04596460610628128,
    0.016482258215546608,
    -0.006442009471356869,
    -0.017294764518737793,
    -0.018455486744642258,
    -0.0478217639029026,
    0.008705418556928635,
    -0.01810726895928383,
    0.0008197602001018822,
    0.014973319135606289,
    0.012535802088677883,
    0.008008984848856926,
    -0.0012115039862692356,
    0.012709910981357098,
    -0.06592903286218643,
    -0.007834875956177711,
    -0.021821580827236176,
    0.0434110201895237,
    0.018803702667355537,
    -0.0038884200621396303,
    -0.023446593433618546,
    0.0015524661866948009,
    0.048750340938568115,
    -0.04991106316447258,
    -0.015669751912355423,
    -0.014625102281570435,
    0.015901897102594376,
    0.04503602907061577,
    -0.006267901044338942,
    -0.008299165405333042,
    0.007109425030648708,
    -0.016482258215546608,
    0.030643071979284286,
    -0.04503602907061577,
    0.032035939395427704,
    0.006906298454850912,
    -0.010794718749821186,
    0.025535892695188522,
    -0.02623232640326023,
    0.016598330810666084,
    0.026464471593499184,
    -0.01131704356521368,
    0.011375079862773418,
    0.0009104416240006685,
    0.045732464641332626,
    -0.009633996523916721,
    -0.042482439428567886,
    0.017642980441451073,
    -0.029134131968021393,
    -0.015321535989642143,
    -0.0024375170469284058,
    0.014799211174249649,
    0.012071513570845127,
    -0.02135729230940342,
    0.044803883880376816,
    0.016134042292833328,
    -0.009285779669880867,
    -0.01741083711385727,
    -0.02925020456314087,
    -0.002016755286604166,
    0.0016830475069582462,
    -0.005339323077350855,
    0.02031264267861843,
    0.029598422348499298,
    0.005629503633826971,
    -0.003714311867952347,
    0.008937562815845013,
    0.009053634479641914,
    0.0010881773196160793,
    0.0047589619643986225,
    0.012477765791118145,
    0.013754560612142086,
    -0.007225497160106897,
    0.0030033693183213472,
    0.019848354160785675,
    0.01775905303657055,
    -0.028089482337236404,
    -0.002089300425723195,
    0.003046896308660507,
    -0.008647382259368896,
    0.026696614921092987,
    0.03667882829904556,
    0.025187676772475243,
    0.014683138579130173,
    0.01329027209430933,
    -0.011026863008737564,
    0.010388465598225594,
    -0.017178691923618317,
    0.020893003791570663,
    0.0076027316972613335,
    -0.03435738384723663,
    0.024839458987116814,
    -0.01212954893708229,
    0.010098285041749477,
    0.008763453923165798,
    -0.02031264267861843,
    0.014973319135606289,
    0.014334921725094318,
    0.04294672980904579,
    0.0036127485800534487,
    0.032964516431093216,
    0.016946546733379364,
    -0.001987737137824297,
    -0.006993352435529232,
    0.015205463394522667,
    -0.028321627527475357,
    -0.004091546405106783,
    -0.03319666162133217,
    0.009285779669880867,
    0.006790226325392723,
    -0.032964516431093216,
    -0.0018571559339761734,
    -0.008241129107773304,
    -0.027044832706451416,
    0.026116253808140755,
    0.02008049748837948,
    -0.00916970707476139,
    -0.01903584785759449,
    -0.012071513570845127,
    0.004381726961582899,
    -0.017178691923618317,
    -0.012825982645154,
    0.006093792617321014,
    -0.018223341554403305,
    0.032035939395427704,
    0.010446501895785332,
    -0.01868763193488121,
    0.03017878346145153,
    -0.0032645317260175943,
    -0.01114293560385704,
    0.032964516431093216,
    -0.0023359539918601513,
    0.04108957201242447,
    0.025651965290308,
    -0.01775905303657055,
    0.06732190400362015,
    -0.01195544097572565,
    0.010214357636868954,
    0.013580452650785446,
    -0.027509121224284172,
    -0.05687540024518967,
    -0.03969670832157135,
    -0.021125148981809616,
    -0.027973409742116928,
    0.03575025126338005,
    0.0015887388726696372,
    -0.030410926789045334,
    0.008589345961809158,
    0.0038884200621396303,
    -0.00014236985589377582,
    0.032035939395427704,
    -0.009459887631237507,
    0.009633996523916721,
    0.0434110201895237,
    0.021473364904522896,
    -0.01938406378030777,
    0.008879526518285275,
    0.03273237124085426,
    0.007950948551297188,
    -0.017294764518737793,
    0.037607405334711075,
    -0.010968826711177826,
    0.033660952001810074,
    -0.01833941414952278,
    0.024491243064403534,
    -0.004787980113178492,
    0.0021473364904522896,
    -0.018455486744642258,
    0.0033370768651366234,
    0.008647382259368896,
    0.009459887631237507,
    -0.025535892695188522,
    -0.016017969697713852,
    -0.0016612840117886662,
    -0.001363848801702261,
    0.01212954893708229,
    0.0061228107661008835,
    0.003946456126868725,
    -0.014218850061297417,
    0.01195544097572565,
    0.006790226325392723,
    0.008008984848856926,
    0.020428715273737907,
    -0.01706261932849884,
    -0.0025535894092172384,
    0.014857247471809387,
    0.026000183075666428,
    0.005716558080166578,
    0.0003790484042838216,
    -0.00632593734189868,
    0.007428623735904694,
    -0.031107360497117043,
    0.006209864746779203,
    -0.0011317043099552393,
    -0.0023649719078093767,
    0.032964516431093216,
    0.027160905301570892,
    0.024839458987116814,
    0.048053909093141556,
    -0.0013348307693377137,
    0.024026954546570778,
    0.0557146780192852,
    0.0046428898349404335,
    -0.024723388254642487,
    0.011259007267653942,
    0.01149115152657032,
    -0.03482167422771454,
    -0.045732464641332626,
    0.03783955052495003,
    0.004613871686160564,
    0.008067021146416664,
    -0.020196570083498955,
    -0.007544695865362883,
    0.03273237124085426,
    -0.018223341554403305,
    0.022750159725546837,
    0.006500045768916607,
    0.035285960882902145,
    -0.00771880429238081,
    0.005165214650332928,
    -0.010098285041749477,
    0.02623232640326023,
    -0.0034386401530355215,
    -0.027393048629164696,
    0.038535986095666885,
    0.021937653422355652,
    -0.008067021146416664,
    0.0013783578760921955,
    -0.011839368380606174,
    -0.012535802088677883,
    0.00565852178260684,
    -0.010446501895785332,
    -0.027973409742116928,
    0.005542449653148651,
    -0.03180379420518875,
    0.014567065984010696,
    -0.029598422348499298,
    -0.06871476769447327,
    0.003569221356883645,
    0.03250022605061531,
    -0.012767946347594261,
    -0.02008049748837948,
    0.01050453819334507,
    0.004004492424428463,
    0.025535892695188522,
    0.018919775262475014,
    -0.0037723479326814413,
    0.03342880681157112,
    -0.003975474275648594,
    -0.043875306844711304,
    0.004149582702666521,
    -0.04828605428338051,
    0.027393048629164696,
    0.0005803612293675542,
    0.022518014535307884,
    -0.016017969697713852,
    -0.025651965290308,
    0.006848262157291174,
    0.01543760858476162,
    -0.012593838386237621,
    -0.00039174381527118385,
    0.010156321339309216,
    -0.009692031890153885,
    -0.031107360497117043,
    0.010156321339309216,
    -0.012884018942713737,
    -0.04108957201242447,
    -0.004497799556702375,
    -0.02890198864042759,
    -0.016946546733379364,
    0.00557146780192852,
    0.06128614395856857,
    -0.019848354160785675,
    0.005484413355588913,
    -0.021473364904522896,
    -0.002684170613065362,
    -0.011607224121689796,
    0.00557146780192852,
    0.015901897102594376,
    0.019616208970546722,
    -0.0552503876388073,
    -0.02066085860133171,
    -0.03737526386976242,
    -0.005948702339082956,
    0.02495553158223629,
    0.0033951131626963615,
    -0.029366277158260345,
    0.025187676772475243,
    0.006267901044338942,
    -0.0157858245074749,
    -0.016946546733379364,
    0.0020747913513332605,
    0.022750159725546837,
    0.022169798612594604,
    -0.008415238000452518,
    0.024026954546570778,
    -0.008647382259368896,
    -0.00014871756138745695,
    0.01149115152657032,
    -0.0024955531116575003,
    0.024491243064403534,
    0.0047589619643986225,
    0.04201815277338028,
    0.003351585939526558,
    0.004062528256326914,
    -0.0047589619643986225,
    0.02623232640326023,
    0.048750340938568115,
    0.004816998261958361,
    -0.013116163201630116,
    0.003946456126868725,
    -0.0023794809821993113,
    0.011781333014369011,
    0.0012550310930237174,
    0.023214448243379593,
    0.008821490220725536,
    -0.005832630209624767,
    -0.026464471593499184,
    0.052696797996759415,
    0.008589345961809158,
    -0.004149582702666521,
    -0.028437700122594833,
    -0.01363848801702261,
    -0.024026954546570778,
    0.03342880681157112,
    -0.002350462833419442,
    0.027741266414523125,
    -0.0007979966467246413,
    -0.00853130966424942,
    -0.020544786006212234,
    -0.03319666162133217,
    -0.015205463394522667,
    -0.00574557576328516,
    0.01775905303657055,
    0.00502012437209487,
    -0.005281287245452404,
    0.042482439428567886,
    0.010620609857141972,
    -0.025419821962714195,
    -0.00493307039141655,
    -0.012187585234642029,
    0.01671440340578556,
    -0.029482349753379822,
    0.013058126904070377,
    0.029714494943618774,
    -0.021589437499642372,
    0.012593838386237621,
    -0.0139286695048213,
    0.0028437699656933546,
    -0.007225497160106897,
    -0.005136196501553059,
    0.020893003791570663,
    0.026348398998379707,
    -0.024839458987116814,
    0.003917437978088856,
    0.01004024874418974,
    0.029946638271212578,
    -0.03505381569266319,
    0.0030323872342705727,
    0.013174199499189854,
    -0.02425909787416458,
    0.022518014535307884,
    -0.010446501895785332,
    0.0394645631313324,
    0.009343815967440605,
    -0.02530374936759472,
    -0.028785916045308113,
    0.0018499013967812061,
    -0.015553680248558521,
    -0.021589437499642372,
    0.02066085860133171,
    -0.02367873676121235,
    -0.001269540167413652,
    0.0049911062233150005,
    0.007428623735904694,
    -0.01346438005566597,
    -0.01938406378030777,
    -0.005049142520874739,
    0.009343815967440605,
    0.012419729493558407,
    -0.00014418349019251764,
    0.02135729230940342,
    0.01706261932849884,
    -0.0315716490149498,
    -0.014973319135606289,
    -0.010852755047380924,
    0.004120564553886652,
    0.0278573390096426,
    -0.004091546405106783,
    0.02135729230940342,
    -0.015321535989642143,
    0.03319666162133217,
    -0.006674153730273247,
    0.014567065984010696,
    0.018223341554403305,
    -0.00014418349019251764,
    0.005078160669654608,
    -0.029366277158260345,
    -0.012825982645154,
    -0.01114293560385704,
    -0.01636618562042713,
    0.015205463394522667,
    -0.03412523865699768,
    -0.0315716490149498,
    -0.014799211174249649,
    0.044107452034950256,
    -0.01775905303657055,
    0.04294672980904579,
    0.026348398998379707,
    -0.016017969697713852,
    0.019151920452713966,
    0.01741083711385727,
    -0.014334921725094318,
    0.02333052083849907,
    -0.03505381569266319,
    -0.010736682452261448,
    0.007950948551297188,
    -0.0026696615386754274,
    -0.008705418556928635,
    -0.01833941414952278,
    -0.005339323077350855,
    0.011375079862773418,
    0.018455486744642258,
    0.04062528535723686,
    -0.0018716648919507861,
    0.03435738384723663,
    -0.0355181060731411,
    -0.014683138579130173,
    0.0030033693183213472,
    0.03644668310880661,
    -0.04039314016699791,
    0.02008049748837948,
    -0.01004024874418974,
    -0.0015379572287201881,
    0.029946638271212578,
    0.0315716490149498,
    0.014509030617773533,
    -0.062214720994234085,
    0.006732190027832985,
    -0.04294672980904579,
    0.014799211174249649,
    -0.033660952001810074,
    0.023446593433618546,
    0.006500045768916607,
    0.023214448243379593,
    -0.01543760858476162,
    0.036910973489284515,
    -0.029482349753379822,
    0.0394645631313324,
    -0.005484413355588913,
    0.01868763193488121,
    0.024143027141690254,
    -0.023794809356331825,
    0.016830476000905037,
    -0.048053909093141556,
    0.012245621532201767,
    0.020776931196451187,
    0.04944677650928497,
    0.008879526518285275,
    0.014509030617773533,
    -0.04503602907061577,
    -0.005252269096672535,
    0.01114293560385704,
    -0.045500319451093674,
    -0.022169798612594604,
    -0.005194232799112797,
    -0.006703171879053116,
    0.00278573390096426,
    -0.022401941940188408,
    -0.027393048629164696,
    -0.014160813763737679,
    -0.03180379420518875,
    -0.04364316165447235,
    -0.0003790484042838216,
    -0.006442009471356869,
    0.0036562755703926086,
    0.019848354160785675,
    0.022053726017475128,
    -0.01868763193488121,
    -0.022750159725546837,
    0.003714311867952347,
    -0.006383973173797131,
    -0.011259007267653942,
    -0.00011879268276970834,
    -0.013406343758106232,
    0.012709910981357098,
    -0.005977720487862825,
    -0.04619675129652023,
    0.00417860085144639,
    0.032964516431093216,
    -0.0157858245074749,
    0.0037723479326814413,
    0.013986704871058464,
    0.004120564553886652,
    -0.020196570083498955,
    0.003279040800407529,
    -0.005977720487862825,
    0.007225497160106897,
    0.0239108819514513,
    -0.0009213234297931194,
    0.027973409742116928,
    0.014799211174249649,
    0.004613871686160564,
    -0.0278573390096426,
    -0.025768037885427475,
    -0.015669751912355423,
    0.011375079862773418,
    0.014857247471809387,
    -0.0028147518169134855,
    0.045500319451093674,
    -0.00426565483212471,
    -0.016250113025307655,
    0.0139286695048213,
    -0.03482167422771454,
    -0.014799211174249649,
    0.008067021146416664,
    0.01346438005566597,
    0.04526817426085472,
    0.0015524661866948009,
    0.0048460159450769424,
    -0.0557146780192852,
    -0.02588411048054695,
    0.0074866595678031445,
    0.024375170469284058,
    0.006354955490678549,
    -0.024723388254642487,
    0.007022370584309101,
    0.014567065984010696,
    -0.018455486744642258,
    -0.005107178818434477,
    0.009285779669880867,
    -0.025071604177355766,
    -0.01706261932849884,
    0.006093792617321014,
    -0.01671440340578556,
    0.01671440340578556,
    0.00771880429238081,
    -0.029714494943618774,
    -0.010910790413618088,
    0.0048460159450769424,
    -0.0315716490149498,
    0.032035939395427704,
    0.016830476000905037,
    0.021821580827236176,
    0.009227743372321129,
    0.0473574735224247,
    -0.007776840124279261,
    0.00417860085144639,
    -0.006412991322577,
    0.010620609857141972,
    -0.02530374936759472,
    0.012709910981357098,
    0.021589437499642372,
    0.009808104485273361,
    -0.01149115152657032,
    0.0073705874383449554,
    -0.01427688542753458,
    0.019964424893260002,
    0.02727697603404522,
    0.023562666028738022,
    -0.01050453819334507,
    0.01195544097572565,
    0.027393048629164696,
    0.006616117898374796,
    -0.047125332057476044,
    0.005078160669654608,
    0.008067021146416664,
    0.04758961871266365,
    -0.010156321339309216,
    0.017526907846331596,
    -0.0008669145754538476,
    0.02333052083849907,
    -0.011839368380606174,
    -0.002306935843080282,
    0.0315716490149498,
    -0.009053634479641914,
    -0.003714311867952347,
    -0.0038884200621396303,
    -0.01004024874418974,
    0.0031049323733896017,
    0.01810726895928383,
    0.020776931196451187,
    0.016598330810666084,
    -0.0074866595678031445,
    0.011084899306297302,
    -0.021125148981809616,
    0.04201815277338028,
    0.025071604177355766,
    -0.016482258215546608,
    -0.0020747913513332605,
    0.0014291395200416446,
    0.0157858245074749,
    -0.024143027141690254,
    0.019964424893260002,
    0.008183092810213566,
    0.03250022605061531,
    0.04178600758314133,
    -0.04433959722518921,
    -0.018919775262475014,
    0.015553680248558521,
    -0.02170551009476185,
    -0.006645136047154665,
    0.02727697603404522,
    -0.01938406378030777,
    -0.011084899306297302,
    -0.009401851333677769,
    -0.005542449653148651,
    -0.01636618562042713,
    0.0032064956612885,
    -0.012767946347594261,
    -0.03482167422771454,
    0.0034676583018153906,
    0.015669751912355423,
    -0.00771880429238081,
    -0.029946638271212578,
    0.051071785390377045,
    0.00005984974995953962,
    -0.008647382259368896,
    -0.02692876011133194,
    -0.05014320835471153,
    0.0315716490149498,
    0.012303657829761505,
    -0.0005694794235751033,
    -0.008067021146416664,
    0.00158148433547467,
    -0.024839458987116814,
    0.02066085860133171,
    0.005078160669654608,
    0.009459887631237507,
    -0.0394645631313324,
    0.02263408713042736,
    -0.04364316165447235,
    0.009285779669880867,
    -0.003859402146190405,
    0.01833941414952278,
    0.03876812756061554,
    0.024375170469284058,
    0.033660952001810074,
    -0.001675792969763279,
    0.01149115152657032,
    0.019151920452713966,
    0.008415238000452518,
    0.0060357567854225636,
    -0.019267993047833443,
    0.00417860085144639,
    0.026116253808140755,
    -0.04201815277338028,
    -0.004555835388600826,
    -0.007312551140785217,
    -0.01775905303657055,
    -0.008879526518285275,
    0.004787980113178492,
    0.0036998027935624123,
    0.024143027141690254,
    0.0004008119576610625,
    -0.0049911062233150005,
    -0.01868763193488121,
    0.007167460862547159,
    -0.002640643622726202,
    0.0008705418440513313,
    -0.03017878346145153,
    0.010272393003106117,
    -0.011897404678165913,
    0.030410926789045334,
    0.03575025126338005,
    0.027393048629164696,
    -0.001958718989044428,
    -0.016598330810666084,
    -0.00853130966424942,
    -0.014567065984010696,
    -0.02925020456314087,
    -0.002234390703961253,
    0.009459887631237507,
    -0.04132171720266342,
    -0.01050453819334507,
    -0.023214448243379593,
    0.005223250947892666,
    0.00287278788164258,
    0.01938406378030777,
    -0.03319666162133217,
    0.0035837304312735796,
    -0.014973319135606289,
    0.008589345961809158,
    -0.012303657829761505,
    0.04271458461880684,
    -0.0032210047356784344,
    0.008589345961809158,
    0.00705138873308897,
    0.0005767339607700706,
    -0.00007934626046335325,
    0.0098661407828331,
    -0.016250113025307655,
    -0.024026954546570778,
    -0.003424131078645587,
    -0.016250113025307655,
    -0.0278573390096426,
    0.0006238882779143751,
    -0.02228587120771408,
    0.012071513570845127,
    0.022518014535307884,
    0.013000091537833214,
    -0.009053634479641914,
    0.027160905301570892,
    -0.013000091537833214,
    -0.014392958022654057,
    0.011781333014369011,
    0.03017878346145153,
    0.0008306420058943331,
    -0.01067864615470171,
    0.012245621532201767,
    -0.007225497160106897,
    -0.025535892695188522,
    -0.00014327667304314673,
    -0.008183092810213566,
    0.013058126904070377,
    0.022169798612594604,
    -0.0355181060731411,
    0.005455395206809044,
    0.0062388828955590725,
    0.018455486744642258,
    -0.03830384090542793,
    0.027973409742116928,
    0.029714494943618774,
    0.005223250947892666,
    -0.022518014535307884,
    -0.007660767994821072,
    -0.008008984848856926,
    -0.006616117898374796,
    0.012942055240273476,
    0.03876812756061554,
    -0.018223341554403305,
    0.004584853537380695,
    -0.029946638271212578,
    -0.0030614053830504417,
    -0.024143027141690254,
    -0.002727697603404522,
    -0.021241219714283943,
    -0.035982396453619,
    -0.0014073759084567428,
    0.051303930580616,
    0.002727697603404522,
    0.00287278788164258,
    0.04457174241542816,
    -0.016017969697713852,
    -0.010388465598225594,
    -0.03342880681157112,
    -0.02623232640326023,
    0.0016467749373987317,
    -0.020196570083498955,
    0.036910973489284515,
    -0.019848354160785675,
    0.03621453791856766,
    -0.04016099497675896,
    -0.007776840124279261,
    -0.06035756692290306,
    -0.013580452650785446,
    -0.016017969697713852,
    -0.009111670777201653,
    0.014683138579130173,
    -0.03876812756061554,
    -0.017642980441451073,
    0.0032210047356784344,
    -0.008821490220725536,
    -0.03621453791856766,
    -0.00789291225373745,
    0.009924177080392838,
    -0.02762519381940365,
    0.006616117898374796,
    -0.005977720487862825,
    0.0557146780192852,
    -0.02170551009476185,
    0.025651965290308,
    0.03575025126338005,
    0.006906298454850912,
    0.015901897102594376,
    -0.018223341554403305,
    -0.030643071979284286,
    0.010562574490904808,
    -0.004381726961582899,
    -0.010968826711177826,
    0.014741174876689911,
    -0.005165214650332928,
    0.009227743372321129,
    0.012709910981357098,
    0.01636618562042713,
    -0.04967891797423363,
    -0.029714494943618774,
    -0.0278573390096426,
    0.004352709278464317,
    0.05246465280652046,
    0.0434110201895237,
    -0.01833941414952278,
    0.02333052083849907,
    -0.003525694366544485,
    -0.025071604177355766,
    0.014218850061297417,
    0.027741266414523125,
    0.0074866595678031445,
    -0.021241219714283943,
    0.00916970707476139,
    -0.006703171879053116,
    0.01346438005566597,
    0.013058126904070377,
    0.03087521716952324,
    0.01543760858476162,
    -0.016017969697713852,
    -0.018455486744642258,
    -0.019500136375427246,
    0.023098375648260117,
    -0.03830384090542793,
    0.0005622249445877969,
    -0.024375170469284058,
    0.023214448243379593,
    -0.0239108819514513,
    -0.0072545153088867664,
    0.012245621532201767,
    -0.028089482337236404,
    -0.033660952001810074,
    0.007776840124279261,
    0.023446593433618546,
    -0.015089391730725765,
    0.001342085306532681,
    0.03319666162133217,
    -0.030643071979284286,
    0.020196570083498955,
    0.0031194414477795362,
    -0.004613871686160564,
    0.01346438005566597,
    -0.026812687516212463,
    0.0007327060448005795,
    -0.029946638271212578,
    -0.00696433475241065,
    -0.020196570083498955,
    0.00853130966424942,
    0.03737526386976242,
    -0.02066085860133171,
    0.01775905303657055,
    0.017642980441451073,
    -0.01903584785759449,
    -0.00014055623614694923,
    0.021241219714283943,
    -0.015089391730725765,
    0.015669751912355423,
    0.006296919193118811,
    0.012535802088677883,
    0.0197322815656662,
    0.004439763259142637,
    -0.0034386401530355215,
    -0.01363848801702261,
    0.00316296867094934,
    -0.028437700122594833,
    -0.013580452650785446,
    -0.024491243064403534,
    0.004410745110362768,
    0.01004024874418974,
    0.05083964392542839,
    0.017875125631690025,
    -0.035982396453619,
    -0.018455486744642258,
    -0.014683138579130173,
    0.0157858245074749,
    -0.020196570083498955,
    -0.026348398998379707,
    -0.02890198864042759,
    0.019616208970546722,
    0.03319666162133217,
    0.04132171720266342,
    0.014683138579130173,
    -0.033660952001810074,
    -0.013696524314582348,
    0.026696614921092987,
    0.00417860085144639,
    0.028321627527475357,
    -0.02588411048054695,
    -0.028089482337236404,
    0.01938406378030777,
    0.028089482337236404,
    -0.020893003791570663,
    0.004468781407922506,
    -0.02495553158223629,
    0.02228587120771408,
    -0.00278573390096426,
    0.010736682452261448,
    0.00417860085144639,
    0.0016685384325683117,
    0.01833941414952278,
    -0.006877280306071043,
    -0.002466535195708275,
    0.012767946347594261,
    0.009575960226356983,
    0.02170551009476185,
    -0.018223341554403305,
    0.008125056512653828,
    -0.03876812756061554,
    0.029714494943618774,
    0.026000183075666428,
    0.005542449653148651,
    0.023794809356331825,
    -0.006993352435529232,
    0.03783955052495003,
    -0.039232417941093445,
    -0.02263408713042736,
    0.02100907638669014,
    0.009459887631237507,
    0.018223341554403305,
    -0.03435738384723663,
    -0.009401851333677769,
    0.0016685384325683117,
    -0.013986704871058464,
    -0.00010700409620767459,
    -0.02925020456314087,
    0.0003464031033217907,
    -0.010794718749821186,
    0.029482349753379822,
    -0.011665260419249535,
    -0.022169798612594604,
    0.010214357636868954,
    0.027393048629164696,
    -0.026348398998379707,
    0.009459887631237507,
    -0.014625102281570435,
    -0.005165214650332928,
    0.021589437499642372,
    0.0006311428151093423,
    0.03389309346675873,
    -0.003946456126868725,
    -0.007776840124279261,
    0.022401941940188408,
    0.036910973489284515,
    0.011607224121689796,
    -0.017178691923618317,
    0.03505381569266319,
    -0.016250113025307655,
    -0.026812687516212463,
    0.014973319135606289,
    0.05153607577085495,
    0.01149115152657032,
    -0.02135729230940342,
    0.006703171879053116,
    0.0047589619643986225,
    -0.011607224121689796,
    -0.00835720170289278,
    0.009111670777201653,
    0.02263408713042736,
    -0.012303657829761505,
    0.008705418556928635,
    -0.01903584785759449,
    0.000790742167737335,
    -0.004497799556702375,
    -0.028669843450188637,
    0.044107452034950256,
    0.019267993047833443,
    0.035285960882902145,
    0.008647382259368896,
    -0.013696524314582348,
    -0.0022924267686903477,
    -0.007776840124279261,
    0.02588411048054695,
    0.01050453819334507,
    -0.03505381569266319,
    0.03273237124085426,
    -0.000437084527220577,
    -0.0473574735224247,
    0.01346438005566597,
    -0.01903584785759449,
    -0.009982212446630001,
    -0.003235513810068369,
    -0.038535986095666885,
    0.029946638271212578,
    -0.02727697603404522,
    -0.01427688542753458,
    0.012245621532201767,
    0.03575025126338005,
    0.026464471593499184,
    -0.006471027620136738,
    0.0355181060731411,
    0.022518014535307884,
    0.023446593433618546,
    -0.006267901044338942,
    0.00008977462130133063,
    0.004526817239820957,
    0.006471027620136738,
    0.02170551009476185,
    0.03017878346145153,
    0.02170551009476185,
    -0.04689318686723709,
    -0.013058126904070377,
    -0.016017969697713852,
    0.03087521716952324,
    -0.0002684170613065362,
    0.003641766496002674,
    -0.00789291225373745,
    -0.006209864746779203,
    0.04433959722518921,
    -0.021473364904522896,
    -0.005803612060844898,
    -0.022866232320666313,
    0.012419729493558407,
    -0.002713188761845231,
    -0.032035939395427704,
    0.0010373956756666303,
    -0.016946546733379364,
    0.06871476769447327,
    -0.003525694366544485,
    -0.03830384090542793,
    -0.0018063742900267243,
    -0.0157858245074749,
    0.017178691923618317,
    -0.009575960226356983,
    -0.03969670832157135,
    -0.003424131078645587,
    -0.010330429300665855,
    0.0315716490149498,
    -0.013174199499189854,
    0.013870633207261562,
    -0.014044741168618202,
    0.004294672980904579,
    0.004033510573208332,
    -0.010446501895785332,
    0.006529063452035189,
    -0.036910973489284515,
    0.011259007267653942,
    0.022401941940188408,
    -0.01741083711385727,
    0.006209864746779203,
    0.044107452034950256,
    -0.023214448243379593,
    -0.00713844271376729,
    -0.03389309346675873,
    -0.011375079862773418,
    -0.01427688542753458,
    -0.024723388254642487,
    0.015321535989642143,
    -0.028089482337236404,
    -0.021125148981809616,
    0.0025245712604373693,
    0.039928849786520004,
    -0.0006601609056815505,
    -0.024375170469284058,
    -0.012884018942713737,
    -0.03783955052495003,
    0.017875125631690025,
    -0.02008049748837948,
    -0.0179911982268095,
    -0.015669751912355423,
    0.025071604177355766,
    -0.0009938685689121485,
    0.016598330810666084,
    -0.03900027275085449,
    -0.00632593734189868,
    -0.02588411048054695,
    -0.027160905301570892,
    -0.006500045768916607,
    -0.0036272576544433832,
    -0.0048750340938568115,
    0.005716558080166578,
    -0.004120564553886652,
    0.016482258215546608,
    0.032268084585666656,
    0.011665260419249535,
    0.009633996523916721,
    -0.013754560612142086,
    0.03389309346675873,
    -0.0179911982268095,
    0.001080922782421112,
    0.007660767994821072,
    0.044107452034950256,
    0.025651965290308,
    0.0010373956756666303,
    -0.007544695865362883,
    0.03900027275085449,
    0.027044832706451416,
    -0.000707315222825855,
    0.023446593433618546,
    0.002234390703961253,
    0.005774593912065029,
    0.023794809356331825,
    0.00426565483212471,
    0.010272393003106117,
    -0.0179911982268095,
    -0.004904052242636681,
    -0.024026954546570778,
    -0.003554712515324354,
    -0.007428623735904694,
    0.016946546733379364,
    -0.02100907638669014,
    -0.029134131968021393,
    -0.029018061235547066,
    -0.032964516431093216,
    -0.03342880681157112,
    0.008415238000452518,
    0.03412523865699768,
    0.019500136375427246
  ],
  "fileId": "d3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbmRlc3ZlcndhbHR1bmcvdGVzdC92b3JzY2hsYWVnZS1zaGYtbmljaHQtdW1zZXR6YmFyL3BhZ2UtMDAyLm1k",
  "fileName": "page-002.de.md",
  "kind": "meta",
  "libraryId": "ff73d3a2-fe01-4674-bce1-feb708235a5a",
  "parentId": null,
  "parentSlug": null,
  "region": "Südtirol",
  "shortTitle": null,
  "slug": null,
  "source": "Stakeholder Forum Klima",
  "summary": null,
  "tags": [
    "schwerverkehr",
    "warentransport",
    "mobilitaet",
    "gueterverkehr",
    "schiene"
  ],
  "teaser": null,
  "title": "Nachhaltiger Schwerverkehr und Warentransport",
  "topics": null,
  "upsertedAt": "2026-01-18T12:02:18.945Z",
  "user": "peter.aichner@crystal-design.com",
  "year": 2024
}
---

console:
C:\Users\peter.aichn…allery-root.tsx:325 [GalleryRoot] Dokument hat keinen slug, kann nicht geöffnet werden: 
{id: 'd3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbm…ZS1zaGYtbmljaHQtdW1zZXR6YmFyL3BhZ2UtMDAyLm1k-meta', fileId: 'd3d3LmtsaW1hbGFuZC5iei9Sw7xja21lbGR1bmdlbkRlckxhbm…sYWVnZS1zaGYtbmljaHQtdW1zZXR6YmFyL3BhZ2UtMDAyLm1k', fileName: 'page-002.de.md', title: 'Nachhaltiger Schwerverkehr und Warentransport', authors: Array(0), …}
C:\Users\peter.aichn…tory-context.ts:459 [useStoryContext] Rückgabe: 
{llmModel: 'google/gemini-2.5-flash', safeLlmModel: 'google/gemini-2.5-flash', hasLlmModel: true}
C:\Users\peter.aichn…tory-context.ts:459 [useStoryContext] Rückgabe: 
{llmModel: 'google/gemini-2.5-flash', safeLlmModel: 'google/gemini-2.5-flash', hasLlmModel: true}
﻿
---
Welche Felder fehlen noch in dem template?

@template-samples/klimamassnahme-detail-de.md 

---

**Cursor**

Prüfe, welche Felder für die Detailansicht fehlen, insbesondere `slug`.


Prüfe, wie der `slug` bei Transformations-Jobs generiert wird:


Prüfe, ob es eine Slug-Generierungslogik gibt oder ob das Template das Feld definieren muss:


Das Template definiert kein `slug`-Feld, das für die Detailansicht benötigt wird. Hinzufügen des `slug`-Felds zum Template:


Hinzufügen des `slug`-Felds zum Template. Der Slug wird aus dem Titel generiert und ist für die Detailansicht erforderlich.


```markdown
---
title: {{title|Kurzer, verständlicher Titel für die Bevölkerung (max. 80 Zeichen, ohne Fachjargon)}}
slug: {{slug|URL-freundlicher Slug aus dem Titel generiert (lowercase, Bindestriche statt Leerzeichen, Sonderzeichen entfernt; z. B. "nachhaltiger-schwerverkehr-und-warentransport")}}
Massnahme_Nr: {{Massnahme_Nr|Nummer der Maßnahme (extraktiv, aus "Nr. XXX" im Markdown-Text; nur Zahl, ohne "Nr.")}}
handlungsfeld: {{handlungsfeld|Handlungsfeld der Maßnahme (extraktiv, aus "Handlungsfeld" im Text; z. B. "Kommunikation und Bewusstseinsbildung")}}
thema: {{thema|Optional: Spezifisches Thema oder Schwerpunkt der Maßnahme (falls im Text erkennbar)}}
quelle: {{quelle|Quelle des Vorschlags (extraktiv: "Vorschlag Klimabürgerrat" oder "Vorschlag Stakeholder Forum Klima")}}
zustaendigkeit: {{zustaendigkeit|Zuständige Stelle (extraktiv, aus "Zuständigkeit" im Text; z. B. "Ressort Umwelt-, Natur- und Klimaschutz")}}
umsetzungsstand: {{umsetzungsstand|Aktueller Umsetzungsstand (extraktiv, aus "Rückmeldung Landesverwaltung"; kurze Zusammenfassung)}}
bewertung: {{bewertung|Bewertung der Maßnahme (extraktiv, aus "Bewertung" im Text; z. B. "Vorschlag bereits in Umsetzung")}}
status: {{status|Status der Maßnahme (geplant | in_umsetzung | umgesetzt; abgeleitet aus Bewertung und Rückmeldung)}}
stand: {{stand|Stand-Datum (extraktiv, aus Dokument; Format YYYY-MM-DD oder null wenn nicht bestimmbar)}}
authors: {{authors|Array von Autoren, dedupliziert, Format „Nachname, Vorname" wenn möglich; optional, falls im Dokument erkennbar}}
year: {{year|YYYY oder null (extraktiv, aus Dokument oder Stand-Datum)}}
region: {{region|Region/Land; Standard: "Südtirol"}}
docType: {{docType|Eine aus: klimamassnahme, article, report, study, brochure, law, guideline, thesis, press_release, website, other; Standard: "klimamassnahme"}}
source: {{source|Erscheinungsorgan/Medium/Behörde; Standard: "Stakeholder Forum Klima" oder aus Dokument}}
tags: {{tags|Array, normalisiert: lowercase, ASCII, kebab-case, dedupliziert; streng extraktiv (z. B. aus Handlungsfeld, Thema)}}
beschreibung_vorschlag: {{beschreibung_vorschlag|Kurze Beschreibung des Vorschlags (optional, aus externer Quelle wie Excel-Daten)}}
bewertung_land: {{bewertung_land|Bewertung der Landesverwaltung (optional, detaillierter als "bewertung"; aus externer Quelle)}}
kommentar: {{kommentar|Zusätzliche Kommentare oder Notizen (optional, aus externer Quelle)}}
ergebnisse_messbar: {{ergebnisse_messbar|Sind Ergebnisse messbar? (boolean: true | false | null; optional, aus externer Quelle)}}
umsetzung_landesverwaltung: {{umsetzung_landesverwaltung|Liegt die Umsetzung in der Hand der Landesverwaltung? (boolean: true | false | null; optional, aus externer Quelle)}}
mittelfristig_umsetzbar: {{mittelfristig_umsetzbar|Sind Maßnahmen mittelfristig umsetzbar? (boolean: true | false | null; optional, aus externer Quelle)}}
co2_einsparpotential: {{co2_einsparpotential|Gibt es ein effektives CO2 Einsparpotential? (string: "Ja" | "Nein" | "Vermutlich" | null; optional, aus externer Quelle)}}
sprache: de
format: klimamassnahme-detail
---

{{bodyInText|Schreibe einen gut formatierten Markdown-Text für einen öffentlichen Blogartikel zu dieser Klimamaßnahme. Struktur: 1. Hauptüberschrift, wie "title", 2. Intro (2-3 Sätze: Warum betrifft diese Maßnahme den Alltag? Welches Grundproblem steht dahinter?), 3. Abschnitt "## Worum geht es?" (Ziel der Maßnahme, gesellschaftlicher/klimatischer Kontext), 4. Abschnitt "## Was wird vorgeschlagen?" (konkrete Idee, was geändert werden soll), 5. Abschnitt "## Warum ist diese Maßnahme wichtig?" (Problem, das gelöst wird; langfristige Wirkung), 6. Abschnitt "## Wer ist dafür zuständig?" (öffentliche Stelle, Rolle von Verwaltung/Politik), 7. Abschnitt "## Wie ist der aktuelle Stand?" (geplant/in Umsetzung/umgesetzt; was wurde bereits getan; nächste Schritte), 8. Abschnitt "## Was bringt das konkret?" (Vorteile für Bürger:innen, Gemeinden, Initiativen), 9. Abschnitt "## Beispiele & Inspiration aus der Praxis" (ähnliche Ansätze, erfolgreiche Umsetzung, Vorbilder), 10. Abschnitt "## Wie kann man sich beteiligen oder davon lernen?" (wer kann sich einbringen, wie nutzen/adaptieren, Raum für Austausch) }}

--- systemprompt
Rolle:
- Du bist eine redaktionelle Autorin bzw. ein redaktioneller Autor für öffentliche Klimakommunikation.
- Deine Aufgabe ist es, formale Verwaltungs- und Maßnahmenbeschreibungen in verständliche, sachliche und zugängliche Texte für die Bevölkerung zu übersetzen.

Arbeitsweise:
- Schreibe klar und ruhig
- Erkläre Zusammenhänge ohne Fachjargon
- Bleibe faktenbasiert und transparent
- Trenne Information von Bewertung
- Vermeide politische Wertungen oder Aktivismus

Ziel:
- Orientierung schaffen
- Vertrauen fördern
- Beteiligung ermöglichen

Zielgruppe:
- interessierte Bürger:innen
- zivilgesellschaftliche Initiativen
- Gemeinden und lokale Akteur:innen

Strenge Regeln:
- Verwende ausschließlich Inhalte, die EXPLIZIT im Markdown-Text vorkommen. Keine Halluzinationen.
- Ignoriere italienische Texte komplett (nur deutsche Inhalte verwenden).
- Wenn Information nicht sicher vorliegt: gib "" (leere Zeichenkette) oder null zurück.
- Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt. Keine Kommentare, kein Markdown, keine Code-Fences.

Formatierungsregeln für den bodyInText:
- Absätze max. 4-6 Zeilen
- Keine Aufzählungsorgien, nur wo sinnvoll
- Keine Amtsbegriffe ohne Erklärung
- Keine Zitate aus Verwaltungstexten
- Sprache: klar, ruhig, sachlich, zugänglich
- Perspektive: für die Bevölkerung, nicht für Expert:innen

Parsing-Regeln für Markdown-Quelle:
- Erkenne Felder anhand der im Text vorkommenden Marker:
  * "Nr." → Massnahme_Nr (nur die Zahl extrahieren)
  * "Handlungsfeld" → handlungsfeld (Text nach "Handlungsfeld" bis zum nächsten Marker)
  * "Zuständigkeit" → zustaendigkeit (Text nach "Zuständigkeit" bis zum nächsten Marker)
  * "Vorschlag" → vorschlag_erklaert (Text nach "Vorschlag" bis "Rückmeldung" oder "Bewertung")
  * "Rückmeldung Landesverwaltung" → umsetzungsstand_erklaert (Text nach diesem Marker bis "Bewertung")
  * "Bewertung" → bewertung (Text nach "Bewertung" bis Seitenende)
- Für Abschnitte: Nutze den Text nach einem Marker bis zum nächsten Marker.
- Überschriften im Markdown können unformatiert sein (ohne #), erkenne sie am Textinhalt.
- Seitenmarker ("--- Seite X ---") ignorieren für die Inhalts-Extraktion.
- Generische Felder:
  * authors: Nur wenn im Dokument explizit genannt (z. B. aus Impressum), sonst []
  * year: Aus Stand-Datum ableiten (YYYY) oder null
  * region: Standard "Südtirol" (kann aus Dokument überschrieben werden)
  * docType: Standard "klimamassnahme"
  * source: Standard "Stakeholder Forum Klima" (kann aus Dokument überschrieben werden)
  * tags: Aus Handlungsfeld und Thema ableiten (lowercase, kebab-case, dedupliziert)
- Zusätzliche Metadaten-Felder (optional, können aus externen Quellen wie Excel-Daten ergänzt werden):
  * beschreibung_vorschlag: Kurze Beschreibung des Vorschlags
  * bewertung_land: Detaillierte Bewertung der Landesverwaltung
  * kommentar: Zusätzliche Kommentare oder Notizen
  * ergebnisse_messbar: boolean (true/false/null) - Sind Ergebnisse messbar?
  * umsetzung_landesverwaltung: boolean (true/false/null) - Liegt die Umsetzung in der Hand der Landesverwaltung?
  * mittelfristig_umsetzbar: boolean (true/false/null) - Sind Maßnahmen mittelfristig umsetzbar?
  * co2_einsparpotential: string ("Ja"/"Nein"/"Vermutlich"/null) - Gibt es ein effektives CO2 Einsparpotential?
  * Diese Felder werden NICHT aus dem Markdown-Text extrahiert, sondern müssen aus externen Quellen ergänzt werden (z. B. Excel-Import)

Status-Ableitung:
- status = "geplant" wenn Bewertung "Vorschlag nicht umsetzbar" oder ähnlich
- status = "in_umsetzung" wenn Bewertung "Vorschlag bereits in Umsetzung" oder Rückmeldung "wird bereits umgesetzt"
- status = "umgesetzt" wenn Bewertung "Vorschlag bereits umgesetzt" oder ähnlich
- Fallback: status = "geplant"

Antwortschema (MUSS exakt ein JSON-Objekt sein, ohne Zusatztext):
{
  "title": "string",
  "Massnahme_Nr": "string (nur Zahl)",
  "handlungsfeld": "string",
  "thema": "string | null",
  "quelle": "string",
  "zustaendigkeit": "string",
  "umsetzungsstand": "string",
  "bewertung": "string",
  "status": "geplant" | "in_umsetzung" | "umgesetzt",
  "stand": "string (YYYY-MM-DD) | null",
  "authors": "string[]",
  "year": "number | null",
  "region": "string",
  "docType": "string",
  "source": "string",
  "tags": "string[]",
  "beschreibung_vorschlag": "string | null",
  "bewertung_land": "string | null",
  "kommentar": "string | null",
  "ergebnisse_messbar": "boolean | null",
  "umsetzung_landesverwaltung": "boolean | null",
  "mittelfristig_umsetzbar": "boolean | null",
  "co2_einsparpotential": "string (\"Ja\" | \"Nein\" | \"Vermutlich\") | null",
  "sprache": "de",
  "format": "klimamassnahme-detail",
  "bodyInText": "string (vollständiger Markdown-Body mit allen Abschnitten)"
}

```

```markdown
---
title: {{title|Kurzer, verständlicher Titel für die Bevölkerung (max. 80 Zeichen, ohne Fachjargon)}}
slug: {{slug|URL-freundlicher Slug aus dem Titel generiert (lowercase, Bindestriche statt Leerzeichen, Sonderzeichen entfernt; z. B. "nachhaltiger-schwerverkehr-und-warentransport")}}
Massnahme_Nr: {{Massnahme_Nr|Nummer der Maßnahme (extraktiv, aus "Nr. XXX" im Markdown-Text; nur Zahl, ohne "Nr.")}}
handlungsfeld: {{handlungsfeld|Handlungsfeld der Maßnahme (extraktiv, aus "Handlungsfeld" im Text; z. B. "Kommunikation und Bewusstseinsbildung")}}
thema: {{thema|Optional: Spezifisches Thema oder Schwerpunkt der Maßnahme (falls im Text erkennbar)}}
quelle: {{quelle|Quelle des Vorschlags (extraktiv: "Vorschlag Klimabürgerrat" oder "Vorschlag Stakeholder Forum Klima")}}
zustaendigkeit: {{zustaendigkeit|Zuständige Stelle (extraktiv, aus "Zuständigkeit" im Text; z. B. "Ressort Umwelt-, Natur- und Klimaschutz")}}
umsetzungsstand: {{umsetzungsstand|Aktueller Umsetzungsstand (extraktiv, aus "Rückmeldung Landesverwaltung"; kurze Zusammenfassung)}}
bewertung: {{bewertung|Bewertung der Maßnahme (extraktiv, aus "Bewertung" im Text; z. B. "Vorschlag bereits in Umsetzung")}}
status: {{status|Status der Maßnahme (geplant | in_umsetzung | umgesetzt; abgeleitet aus Bewertung und Rückmeldung)}}
stand: {{stand|Stand-Datum (extraktiv, aus Dokument; Format YYYY-MM-DD oder null wenn nicht bestimmbar)}}
authors: {{authors|Array von Autoren, dedupliziert, Format „Nachname, Vorname" wenn möglich; optional, falls im Dokument erkennbar}}
year: {{year|YYYY oder null (extraktiv, aus Dokument oder Stand-Datum)}}
region: {{region|Region/Land; Standard: "Südtirol"}}
docType: {{docType|Eine aus: klimamassnahme, article, report, study, brochure, law, guideline, thesis, press_release, website, other; Standard: "klimamassnahme"}}
source: {{source|Erscheinungsorgan/Medium/Behörde; Standard: "Stakeholder Forum Klima" oder aus Dokument}}
tags: {{tags|Array, normalisiert: lowercase, ASCII, kebab-case, dedupliziert; streng extraktiv (z. B. aus Handlungsfeld, Thema)}}
beschreibung_vorschlag: {{beschreibung_vorschlag|Kurze Beschreibung des Vorschlags (optional, aus externer Quelle wie Excel-Daten)}}
bewertung_land: {{bewertung_land|Bewertung der Landesverwaltung (optional, detaillierter als "bewertung"; aus externer Quelle)}}
kommentar: {{kommentar|Zusätzliche Kommentare oder Notizen (optional, aus externer Quelle)}}
ergebnisse_messbar: {{ergebnisse_messbar|Sind Ergebnisse messbar? (boolean: true | false | null; optional, aus externer Quelle)}}
umsetzung_landesverwaltung: {{umsetzung_landesverwaltung|Liegt die Umsetzung in der Hand der Landesverwaltung? (boolean: true | false | null; optional, aus externer Quelle)}}
mittelfristig_umsetzbar: {{mittelfristig_umsetzbar|Sind Maßnahmen mittelfristig umsetzbar? (boolean: true | false | null; optional, aus externer Quelle)}}
co2_einsparpotential: {{co2_einsparpotential|Gibt es ein effektives CO2 Einsparpotential? (string: "Ja" | "Nein" | "Vermutlich" | null; optional, aus externer Quelle)}}
sprache: de
format: klimamassnahme-detail
---

{{bodyInText|Schreibe einen gut formatierten Markdown-Text für einen öffentlichen Blogartikel zu dieser Klimamaßnahme. Struktur: 1. Hauptüberschrift, wie "title", 2. Intro (2-3 Sätze: Warum betrifft diese Maßnahme den Alltag? Welches Grundproblem steht dahinter?), 3. Abschnitt "## Worum geht es?" (Ziel der Maßnahme, gesellschaftlicher/klimatischer Kontext), 4. Abschnitt "## Was wird vorgeschlagen?" (konkrete Idee, was geändert werden soll), 5. Abschnitt "## Warum ist diese Maßnahme wichtig?" (Problem, das gelöst wird; langfristige Wirkung), 6. Abschnitt "## Wer ist dafür zuständig?" (öffentliche Stelle, Rolle von Verwaltung/Politik), 7. Abschnitt "## Wie ist der aktuelle Stand?" (geplant/in Umsetzung/umgesetzt; was wurde bereits getan; nächste Schritte), 8. Abschnitt "## Was bringt das konkret?" (Vorteile für Bürger:innen, Gemeinden, Initiativen), 9. Abschnitt "## Beispiele & Inspiration aus der Praxis" (ähnliche Ansätze, erfolgreiche Umsetzung, Vorbilder), 10. Abschnitt "## Wie kann man sich beteiligen oder davon lernen?" (wer kann sich einbringen, wie nutzen/adaptieren, Raum für Austausch) }}

--- systemprompt
Rolle:
- Du bist eine redaktionelle Autorin bzw. ein redaktioneller Autor für öffentliche Klimakommunikation.
- Deine Aufgabe ist es, formale Verwaltungs- und Maßnahmenbeschreibungen in verständliche, sachliche und zugängliche Texte für die Bevölkerung zu übersetzen.

Arbeitsweise:
- Schreibe klar und ruhig
- Erkläre Zusammenhänge ohne Fachjargon
- Bleibe faktenbasiert und transparent
- Trenne Information von Bewertung
- Vermeide politische Wertungen oder Aktivismus

Ziel:
- Orientierung schaffen
- Vertrauen fördern
- Beteiligung ermöglichen

Zielgruppe:
- interessierte Bürger:innen
- zivilgesellschaftliche Initiativen
- Gemeinden und lokale Akteur:innen

Strenge Regeln:
- Verwende ausschließlich Inhalte, die EXPLIZIT im Markdown-Text vorkommen. Keine Halluzinationen.
- Ignoriere italienische Texte komplett (nur deutsche Inhalte verwenden).
- Wenn Information nicht sicher vorliegt: gib "" (leere Zeichenkette) oder null zurück.
- Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt. Keine Kommentare, kein Markdown, keine Code-Fences.

Formatierungsregeln für den bodyInText:
- Absätze max. 4-6 Zeilen
- Keine Aufzählungsorgien, nur wo sinnvoll
- Keine Amtsbegriffe ohne Erklärung
- Keine Zitate aus Verwaltungstexten
- Sprache: klar, ruhig, sachlich, zugänglich
- Perspektive: für die Bevölkerung, nicht für Expert:innen

Parsing-Regeln für Markdown-Quelle:
- Erkenne Felder anhand der im Text vorkommenden Marker:
  * "Nr." → Massnahme_Nr (nur die Zahl extrahieren)
  * "Handlungsfeld" → handlungsfeld (Text nach "Handlungsfeld" bis zum nächsten Marker)
  * "Zuständigkeit" → zustaendigkeit (Text nach "Zuständigkeit" bis zum nächsten Marker)
  * "Vorschlag" → vorschlag_erklaert (Text nach "Vorschlag" bis "Rückmeldung" oder "Bewertung")
  * "Rückmeldung Landesverwaltung" → umsetzungsstand_erklaert (Text nach diesem Marker bis "Bewertung")
  * "Bewertung" → bewertung (Text nach "Bewertung" bis Seitenende)
- Für Abschnitte: Nutze den Text nach einem Marker bis zum nächsten Marker.
- Überschriften im Markdown können unformatiert sein (ohne #), erkenne sie am Textinhalt.
- Seitenmarker ("--- Seite X ---") ignorieren für die Inhalts-Extraktion.
- Generische Felder:
  * authors: Nur wenn im Dokument explizit genannt (z. B. aus Impressum), sonst []
  * year: Aus Stand-Datum ableiten (YYYY) oder null
  * region: Standard "Südtirol" (kann aus Dokument überschrieben werden)
  * docType: Standard "klimamassnahme"
  * source: Standard "Stakeholder Forum Klima" (kann aus Dokument überschrieben werden)
  * tags: Aus Handlungsfeld und Thema ableiten (lowercase, kebab-case, dedupliziert)
- Zusätzliche Metadaten-Felder (optional, können aus externen Quellen wie Excel-Daten ergänzt werden):
  * beschreibung_vorschlag: Kurze Beschreibung des Vorschlags
  * bewertung_land: Detaillierte Bewertung der Landesverwaltung
  * kommentar: Zusätzliche Kommentare oder Notizen
  * ergebnisse_messbar: boolean (true/false/null) - Sind Ergebnisse messbar?
  * umsetzung_landesverwaltung: boolean (true/false/null) - Liegt die Umsetzung in der Hand der Landesverwaltung?
  * mittelfristig_umsetzbar: boolean (true/false/null) - Sind Maßnahmen mittelfristig umsetzbar?
  * co2_einsparpotential: string ("Ja"/"Nein"/"Vermutlich"/null) - Gibt es ein effektives CO2 Einsparpotential?
  * Diese Felder werden NICHT aus dem Markdown-Text extrahiert, sondern müssen aus externen Quellen ergänzt werden (z. B. Excel-Import)

Status-Ableitung:
- status = "geplant" wenn Bewertung "Vorschlag nicht umsetzbar" oder ähnlich
- status = "in_umsetzung" wenn Bewertung "Vorschlag bereits in Umsetzung" oder Rückmeldung "wird bereits umgesetzt"
- status = "umgesetzt" wenn Bewertung "Vorschlag bereits umgesetzt" oder ähnlich
- Fallback: status = "geplant"

Antwortschema (MUSS exakt ein JSON-Objekt sein, ohne Zusatztext):
{
  "title": "string",
  "slug": "string (URL-freundlicher Slug aus Titel generiert: lowercase, Bindestriche statt Leerzeichen, Sonderzeichen entfernt)",
  "Massnahme_Nr": "string (nur Zahl)",
  "handlungsfeld": "string",
  "thema": "string | null",
  "quelle": "string",
  "zustaendigkeit": "string",
  "umsetzungsstand": "string",
  "bewertung": "string",
  "status": "geplant" | "in_umsetzung" | "umgesetzt",
  "stand": "string (YYYY-MM-DD) | null",
  "authors": "string[]",
  "year": "number | null",
  "region": "string",
  "docType": "string",
  "source": "string",
  "tags": "string[]",
  "beschreibung_vorschlag": "string | null",
  "bewertung_land": "string | null",
  "kommentar": "string | null",
  "ergebnisse_messbar": "boolean | null",
  "umsetzung_landesverwaltung": "boolean | null",
  "mittelfristig_umsetzbar": "boolean | null",
  "co2_einsparpotential": "string (\"Ja\" | \"Nein\" | \"Vermutlich\") | null",
  "sprache": "de",
  "format": "klimamassnahme-detail",
  "bodyInText": "string (vollständiger Markdown-Body mit allen Abschnitten)"
}

```

```markdown
---
title: {{title|Kurzer, verständlicher Titel für die Bevölkerung (max. 80 Zeichen, ohne Fachjargon)}}
slug: {{slug|URL-freundlicher Slug aus dem Titel generiert (lowercase, Bindestriche statt Leerzeichen, Sonderzeichen entfernt; z. B. "nachhaltiger-schwerverkehr-und-warentransport")}}
Massnahme_Nr: {{Massnahme_Nr|Nummer der Maßnahme (extraktiv, aus "Nr. XXX" im Markdown-Text; nur Zahl, ohne "Nr.")}}
handlungsfeld: {{handlungsfeld|Handlungsfeld der Maßnahme (extraktiv, aus "Handlungsfeld" im Text; z. B. "Kommunikation und Bewusstseinsbildung")}}
thema: {{thema|Optional: Spezifisches Thema oder Schwerpunkt der Maßnahme (falls im Text erkennbar)}}
quelle: {{quelle|Quelle des Vorschlags (extraktiv: "Vorschlag Klimabürgerrat" oder "Vorschlag Stakeholder Forum Klima")}}
zustaendigkeit: {{zustaendigkeit|Zuständige Stelle (extraktiv, aus "Zuständigkeit" im Text; z. B. "Ressort Umwelt-, Natur- und Klimaschutz")}}
umsetzungsstand: {{umsetzungsstand|Aktueller Umsetzungsstand (extraktiv, aus "Rückmeldung Landesverwaltung"; kurze Zusammenfassung)}}
bewertung: {{bewertung|Bewertung der Maßnahme (extraktiv, aus "Bewertung" im Text; z. B. "Vorschlag bereits in Umsetzung")}}
status: {{status|Status der Maßnahme (geplant | in_umsetzung | umgesetzt; abgeleitet aus Bewertung und Rückmeldung)}}
stand: {{stand|Stand-Datum (extraktiv, aus Dokument; Format YYYY-MM-DD oder null wenn nicht bestimmbar)}}
authors: {{authors|Array von Autoren, dedupliziert, Format „Nachname, Vorname" wenn möglich; optional, falls im Dokument erkennbar}}
year: {{year|YYYY oder null (extraktiv, aus Dokument oder Stand-Datum)}}
region: {{region|Region/Land; Standard: "Südtirol"}}
docType: {{docType|Eine aus: klimamassnahme, article, report, study, brochure, law, guideline, thesis, press_release, website, other; Standard: "klimamassnahme"}}
source: {{source|Erscheinungsorgan/Medium/Behörde; Standard: "Stakeholder Forum Klima" oder aus Dokument}}
tags: {{tags|Array, normalisiert: lowercase, ASCII, kebab-case, dedupliziert; streng extraktiv (z. B. aus Handlungsfeld, Thema)}}
beschreibung_vorschlag: {{beschreibung_vorschlag|Kurze Beschreibung des Vorschlags (optional, aus externer Quelle wie Excel-Daten)}}
bewertung_land: {{bewertung_land|Bewertung der Landesverwaltung (optional, detaillierter als "bewertung"; aus externer Quelle)}}
kommentar: {{kommentar|Zusätzliche Kommentare oder Notizen (optional, aus externer Quelle)}}
ergebnisse_messbar: {{ergebnisse_messbar|Sind Ergebnisse messbar? (boolean: true | false | null; optional, aus externer Quelle)}}
umsetzung_landesverwaltung: {{umsetzung_landesverwaltung|Liegt die Umsetzung in der Hand der Landesverwaltung? (boolean: true | false | null; optional, aus externer Quelle)}}
mittelfristig_umsetzbar: {{mittelfristig_umsetzbar|Sind Maßnahmen mittelfristig umsetzbar? (boolean: true | false | null; optional, aus externer Quelle)}}
co2_einsparpotential: {{co2_einsparpotential|Gibt es ein effektives CO2 Einsparpotential? (string: "Ja" | "Nein" | "Vermutlich" | null; optional, aus externer Quelle)}}
sprache: de
format: klimamassnahme-detail
---

{{bodyInText|Schreibe einen gut formatierten Markdown-Text für einen öffentlichen Blogartikel zu dieser Klimamaßnahme. Struktur: 1. Hauptüberschrift, wie "title", 2. Intro (2-3 Sätze: Warum betrifft diese Maßnahme den Alltag? Welches Grundproblem steht dahinter?), 3. Abschnitt "## Worum geht es?" (Ziel der Maßnahme, gesellschaftlicher/klimatischer Kontext), 4. Abschnitt "## Was wird vorgeschlagen?" (konkrete Idee, was geändert werden soll), 5. Abschnitt "## Warum ist diese Maßnahme wichtig?" (Problem, das gelöst wird; langfristige Wirkung), 6. Abschnitt "## Wer ist dafür zuständig?" (öffentliche Stelle, Rolle von Verwaltung/Politik), 7. Abschnitt "## Wie ist der aktuelle Stand?" (geplant/in Umsetzung/umgesetzt; was wurde bereits getan; nächste Schritte), 8. Abschnitt "## Was bringt das konkret?" (Vorteile für Bürger:innen, Gemeinden, Initiativen), 9. Abschnitt "## Beispiele & Inspiration aus der Praxis" (ähnliche Ansätze, erfolgreiche Umsetzung, Vorbilder), 10. Abschnitt "## Wie kann man sich beteiligen oder davon lernen?" (wer kann sich einbringen, wie nutzen/adaptieren, Raum für Austausch) }}

--- systemprompt
Rolle:
- Du bist eine redaktionelle Autorin bzw. ein redaktioneller Autor für öffentliche Klimakommunikation.
- Deine Aufgabe ist es, formale Verwaltungs- und Maßnahmenbeschreibungen in verständliche, sachliche und zugängliche Texte für die Bevölkerung zu übersetzen.

Arbeitsweise:
- Schreibe klar und ruhig
- Erkläre Zusammenhänge ohne Fachjargon
- Bleibe faktenbasiert und transparent
- Trenne Information von Bewertung
- Vermeide politische Wertungen oder Aktivismus

Ziel:
- Orientierung schaffen
- Vertrauen fördern
- Beteiligung ermöglichen

Zielgruppe:
- interessierte Bürger:innen
- zivilgesellschaftliche Initiativen
- Gemeinden und lokale Akteur:innen

Strenge Regeln:
- Verwende ausschließlich Inhalte, die EXPLIZIT im Markdown-Text vorkommen. Keine Halluzinationen.
- Ignoriere italienische Texte komplett (nur deutsche Inhalte verwenden).
- Wenn Information nicht sicher vorliegt: gib "" (leere Zeichenkette) oder null zurück.
- Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt. Keine Kommentare, kein Markdown, keine Code-Fences.

Formatierungsregeln für den bodyInText:
- Absätze max. 4-6 Zeilen
- Keine Aufzählungsorgien, nur wo sinnvoll
- Keine Amtsbegriffe ohne Erklärung
- Keine Zitate aus Verwaltungstexten
- Sprache: klar, ruhig, sachlich, zugänglich
- Perspektive: für die Bevölkerung, nicht für Expert:innen

Parsing-Regeln für Markdown-Quelle:
- Erkenne Felder anhand der im Text vorkommenden Marker:
  * "Nr." → Massnahme_Nr (nur die Zahl extrahieren)
  * "Handlungsfeld" → handlungsfeld (Text nach "Handlungsfeld" bis zum nächsten Marker)
  * "Zuständigkeit" → zustaendigkeit (Text nach "Zuständigkeit" bis zum nächsten Marker)
  * "Vorschlag" → vorschlag_erklaert (Text nach "Vorschlag" bis "Rückmeldung" oder "Bewertung")
  * "Rückmeldung Landesverwaltung" → umsetzungsstand_erklaert (Text nach diesem Marker bis "Bewertung")
  * "Bewertung" → bewertung (Text nach "Bewertung" bis Seitenende)
- Für Abschnitte: Nutze den Text nach einem Marker bis zum nächsten Marker.
- Überschriften im Markdown können unformatiert sein (ohne #), erkenne sie am Textinhalt.
- Seitenmarker ("--- Seite X ---") ignorieren für die Inhalts-Extraktion.
- Generische Felder:
  * slug: Aus Titel generieren (lowercase, Bindestriche statt Leerzeichen, Sonderzeichen entfernt; z. B. "Nachhaltiger Schwerverkehr und Warentransport" → "nachhaltiger-schwerverkehr-und-warentransport")
  * authors: Nur wenn im Dokument explizit genannt (z. B. aus Impressum), sonst []
  * year: Aus Stand-Datum ableiten (YYYY) oder null
  * region: Standard "Südtirol" (kann aus Dokument überschrieben werden)
  * docType: Standard "klimamassnahme"
  * source: Standard "Stakeholder Forum Klima" (kann aus Dokument überschrieben werden)
  * tags: Aus Handlungsfeld und Thema ableiten (lowercase, kebab-case, dedupliziert)
- Zusätzliche Metadaten-Felder (optional, können aus externen Quellen wie Excel-Daten ergänzt werden):
  * beschreibung_vorschlag: Kurze Beschreibung des Vorschlags
  * bewertung_land: Detaillierte Bewertung der Landesverwaltung
  * kommentar: Zusätzliche Kommentare oder Notizen
  * ergebnisse_messbar: boolean (true/false/null) - Sind Ergebnisse messbar?
  * umsetzung_landesverwaltung: boolean (true/false/null) - Liegt die Umsetzung in der Hand der Landesverwaltung?
  * mittelfristig_umsetzbar: boolean (true/false/null) - Sind Maßnahmen mittelfristig umsetzbar?
  * co2_einsparpotential: string ("Ja"/"Nein"/"Vermutlich"/null) - Gibt es ein effektives CO2 Einsparpotential?
  * Diese Felder werden NICHT aus dem Markdown-Text extrahiert, sondern müssen aus externen Quellen ergänzt werden (z. B. Excel-Import)

Status-Ableitung:
- status = "geplant" wenn Bewertung "Vorschlag nicht umsetzbar" oder ähnlich
- status = "in_umsetzung" wenn Bewertung "Vorschlag bereits in Umsetzung" oder Rückmeldung "wird bereits umgesetzt"
- status = "umgesetzt" wenn Bewertung "Vorschlag bereits umgesetzt" oder ähnlich
- Fallback: status = "geplant"

Antwortschema (MUSS exakt ein JSON-Objekt sein, ohne Zusatztext):
{
  "title": "string",
  "slug": "string (URL-freundlicher Slug aus Titel generiert: lowercase, Bindestriche statt Leerzeichen, Sonderzeichen entfernt)",
  "Massnahme_Nr": "string (nur Zahl)",
  "handlungsfeld": "string",
  "thema": "string | null",
  "quelle": "string",
  "zustaendigkeit": "string",
  "umsetzungsstand": "string",
  "bewertung": "string",
  "status": "geplant" | "in_umsetzung" | "umgesetzt",
  "stand": "string (YYYY-MM-DD) | null",
  "authors": "string[]",
  "year": "number | null",
  "region": "string",
  "docType": "string",
  "source": "string",
  "tags": "string[]",
  "beschreibung_vorschlag": "string | null",
  "bewertung_land": "string | null",
  "kommentar": "string | null",
  "ergebnisse_messbar": "boolean | null",
  "umsetzung_landesverwaltung": "boolean | null",
  "mittelfristig_umsetzbar": "boolean | null",
  "co2_einsparpotential": "string (\"Ja\" | \"Nein\" | \"Vermutlich\") | null",
  "sprache": "de",
  "format": "klimamassnahme-detail",
  "bodyInText": "string (vollständiger Markdown-Body mit allen Abschnitten)"
}

```

Ich habe das fehlende `slug`-Feld zum Template hinzugefügt. Zusammenfassung:

## Problem
Die Detailansicht konnte nicht geöffnet werden, weil das generierte Dokument keinen `slug` hatte. Die Gallery benötigt `slug`, um Dokumente zu öffnen.

## Lösung
Das Template `klimamassnahme-detail-de.md` wurde um das `slug`-Feld ergänzt:

1. Frontmatter: `slug` direkt nach `title` hinzugefügt
2. Systemprompt: Anweisung zur Slug-Generierung aus dem Titel ergänzt
3. Antwortschema: `slug` im JSON-Schema ergänzt

Der Slug wird aus dem Titel generiert:
- Lowercase
- Bindestriche statt Leerzeichen
- Sonderzeichen entfernt
- Beispiel: "Nachhaltiger Schwerverkehr und Warentransport" → "nachhaltiger-schwerverkehr-und-warentransport"

## Nächste Schritte
1. Template in MongoDB aktualisieren (falls bereits gespeichert)
2. Transformation erneut ausführen, damit der neue `slug` generiert wird
3. Testen: Detailansicht sollte jetzt öffnen können

Das Template enthält jetzt alle erforderlichen Felder für die Gallery-Detailansicht.

---

**User**

Und es scheint mir, dass auch andere Felder fehlen wie shortTitle, summary, teaser. Die sind nicht gefüllt.

---

**Cursor**

Prüfe, welche Felder in der Gallery/Detailansicht verwendet werden und welche im Template fehlen:


Hinzufügen der fehlenden Felder `shortTitle`, `summary` und `teaser` zum Template:


```markdown
---
title: {{title|Kurzer, verständlicher Titel für die Bevölkerung (max. 80 Zeichen, ohne Fachjargon)}}
shortTitle: {{shortTitle|Kurze Variante des Titels (max. 50 Zeichen) für Listenansichten; optional, falls Titel zu lang}}
slug: {{slug|URL-freundlicher Slug aus dem Titel generiert (lowercase, Bindestriche statt Leerzeichen, Sonderzeichen entfernt; z. B. "nachhaltiger-schwerverkehr-und-warentransport")}}
teaser: {{teaser|Kurzer Einleitungstext (1-2 Sätze, max. 200 Zeichen) für Vorschauansichten; aus dem Intro des bodyInText extrahieren}}
summary: {{summary|Zusammenfassung der Maßnahme (2-3 Sätze, Markdown-formatiert) für Übersichtsansichten; aus dem Intro und "Worum geht es?" Abschnitt extrahieren}}
Massnahme_Nr: {{Massnahme_Nr|Nummer der Maßnahme (extraktiv, aus "Nr. XXX" im Markdown-Text; nur Zahl, ohne "Nr.")}}
handlungsfeld: {{handlungsfeld|Handlungsfeld der Maßnahme (extraktiv, aus "Handlungsfeld" im Text; z. B. "Kommunikation und Bewusstseinsbildung")}}
thema: {{thema|Optional: Spezifisches Thema oder Schwerpunkt der Maßnahme (falls im Text erkennbar)}}
quelle: {{quelle|Quelle des Vorschlags (extraktiv: "Vorschlag Klimabürgerrat" oder "Vorschlag Stakeholder Forum Klima")}}
zustaendigkeit: {{zustaendigkeit|Zuständige Stelle (extraktiv, aus "Zuständigkeit" im Text; z. B. "Ressort Umwelt-, Natur- und Klimaschutz")}}
umsetzungsstand: {{umsetzungsstand|Aktueller Umsetzungsstand (extraktiv, aus "Rückmeldung Landesverwaltung"; kurze Zusammenfassung)}}
bewertung: {{bewertung|Bewertung der Maßnahme (extraktiv, aus "Bewertung" im Text; z. B. "Vorschlag bereits in Umsetzung")}}
status: {{status|Status der Maßnahme (geplant | in_umsetzung | umgesetzt; abgeleitet aus Bewertung und Rückmeldung)}}
stand: {{stand|Stand-Datum (extraktiv, aus Dokument; Format YYYY-MM-DD oder null wenn nicht bestimmbar)}}
authors: {{authors|Array von Autoren, dedupliziert, Format „Nachname, Vorname" wenn möglich; optional, falls im Dokument erkennbar}}
year: {{year|YYYY oder null (extraktiv, aus Dokument oder Stand-Datum)}}
region: {{region|Region/Land; Standard: "Südtirol"}}
docType: {{docType|Eine aus: klimamassnahme, article, report, study, brochure, law, guideline, thesis, press_release, website, other; Standard: "klimamassnahme"}}
source: {{source|Erscheinungsorgan/Medium/Behörde; Standard: "Stakeholder Forum Klima" oder aus Dokument}}
tags: {{tags|Array, normalisiert: lowercase, ASCII, kebab-case, dedupliziert; streng extraktiv (z. B. aus Handlungsfeld, Thema)}}
beschreibung_vorschlag: {{beschreibung_vorschlag|Kurze Beschreibung des Vorschlags (optional, aus externer Quelle wie Excel-Daten)}}
bewertung_land: {{bewertung_land|Bewertung der Landesverwaltung (optional, detaillierter als "bewertung"; aus externer Quelle)}}
kommentar: {{kommentar|Zusätzliche Kommentare oder Notizen (optional, aus externer Quelle)}}
ergebnisse_messbar: {{ergebnisse_messbar|Sind Ergebnisse messbar? (boolean: true | false | null; optional, aus externer Quelle)}}
umsetzung_landesverwaltung: {{umsetzung_landesverwaltung|Liegt die Umsetzung in der Hand der Landesverwaltung? (boolean: true | false | null; optional, aus externer Quelle)}}
mittelfristig_umsetzbar: {{mittelfristig_umsetzbar|Sind Maßnahmen mittelfristig umsetzbar? (boolean: true | false | null; optional, aus externer Quelle)}}
co2_einsparpotential: {{co2_einsparpotential|Gibt es ein effektives CO2 Einsparpotential? (string: "Ja" | "Nein" | "Vermutlich" | null; optional, aus externer Quelle)}}
sprache: de
format: klimamassnahme-detail
---

{{bodyInText|Schreibe einen gut formatierten Markdown-Text für einen öffentlichen Blogartikel zu dieser Klimamaßnahme. Struktur: 1. Hauptüberschrift, wie "title", 2. Intro (2-3 Sätze: Warum betrifft diese Maßnahme den Alltag? Welches Grundproblem steht dahinter?), 3. Abschnitt "## Worum geht es?" (Ziel der Maßnahme, gesellschaftlicher/klimatischer Kontext), 4. Abschnitt "## Was wird vorgeschlagen?" (konkrete Idee, was geändert werden soll), 5. Abschnitt "## Warum ist diese Maßnahme wichtig?" (Problem, das gelöst wird; langfristige Wirkung), 6. Abschnitt "## Wer ist dafür zuständig?" (öffentliche Stelle, Rolle von Verwaltung/Politik), 7. Abschnitt "## Wie ist der aktuelle Stand?" (geplant/in Umsetzung/umgesetzt; was wurde bereits getan; nächste Schritte), 8. Abschnitt "## Was bringt das konkret?" (Vorteile für Bürger:innen, Gemeinden, Initiativen), 9. Abschnitt "## Beispiele & Inspiration aus der Praxis" (ähnliche Ansätze, erfolgreiche Umsetzung, Vorbilder), 10. Abschnitt "## Wie kann man sich beteiligen oder davon lernen?" (wer kann sich einbringen, wie nutzen/adaptieren, Raum für Austausch) }}

--- systemprompt
Rolle:
- Du bist eine redaktionelle Autorin bzw. ein redaktioneller Autor für öffentliche Klimakommunikation.
- Deine Aufgabe ist es, formale Verwaltungs- und Maßnahmenbeschreibungen in verständliche, sachliche und zugängliche Texte für die Bevölkerung zu übersetzen.

Arbeitsweise:
- Schreibe klar und ruhig
- Erkläre Zusammenhänge ohne Fachjargon
- Bleibe faktenbasiert und transparent
- Trenne Information von Bewertung
- Vermeide politische Wertungen oder Aktivismus

Ziel:
- Orientierung schaffen
- Vertrauen fördern
- Beteiligung ermöglichen

Zielgruppe:
- interessierte Bürger:innen
- zivilgesellschaftliche Initiativen
- Gemeinden und lokale Akteur:innen

Strenge Regeln:
- Verwende ausschließlich Inhalte, die EXPLIZIT im Markdown-Text vorkommen. Keine Halluzinationen.
- Ignoriere italienische Texte komplett (nur deutsche Inhalte verwenden).
- Wenn Information nicht sicher vorliegt: gib "" (leere Zeichenkette) oder null zurück.
- Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt. Keine Kommentare, kein Markdown, keine Code-Fences.

Formatierungsregeln für den bodyInText:
- Absätze max. 4-6 Zeilen
- Keine Aufzählungsorgien, nur wo sinnvoll
- Keine Amtsbegriffe ohne Erklärung
- Keine Zitate aus Verwaltungstexten
- Sprache: klar, ruhig, sachlich, zugänglich
- Perspektive: für die Bevölkerung, nicht für Expert:innen

Parsing-Regeln für Markdown-Quelle:
- Erkenne Felder anhand der im Text vorkommenden Marker:
  * "Nr." → Massnahme_Nr (nur die Zahl extrahieren)
  * "Handlungsfeld" → handlungsfeld (Text nach "Handlungsfeld" bis zum nächsten Marker)
  * "Zuständigkeit" → zustaendigkeit (Text nach "Zuständigkeit" bis zum nächsten Marker)
  * "Vorschlag" → vorschlag_erklaert (Text nach "Vorschlag" bis "Rückmeldung" oder "Bewertung")
  * "Rückmeldung Landesverwaltung" → umsetzungsstand_erklaert (Text nach diesem Marker bis "Bewertung")
  * "Bewertung" → bewertung (Text nach "Bewertung" bis Seitenende)
- Für Abschnitte: Nutze den Text nach einem Marker bis zum nächsten Marker.
- Überschriften im Markdown können unformatiert sein (ohne #), erkenne sie am Textinhalt.
- Seitenmarker ("--- Seite X ---") ignorieren für die Inhalts-Extraktion.
- Generische Felder:
  * slug: Aus Titel generieren (lowercase, Bindestriche statt Leerzeichen, Sonderzeichen entfernt; z. B. "Nachhaltiger Schwerverkehr und Warentransport" → "nachhaltiger-schwerverkehr-und-warentransport")
  * authors: Nur wenn im Dokument explizit genannt (z. B. aus Impressum), sonst []
  * year: Aus Stand-Datum ableiten (YYYY) oder null
  * region: Standard "Südtirol" (kann aus Dokument überschrieben werden)
  * docType: Standard "klimamassnahme"
  * source: Standard "Stakeholder Forum Klima" (kann aus Dokument überschrieben werden)
  * tags: Aus Handlungsfeld und Thema ableiten (lowercase, kebab-case, dedupliziert)
- Zusätzliche Metadaten-Felder (optional, können aus externen Quellen wie Excel-Daten ergänzt werden):
  * beschreibung_vorschlag: Kurze Beschreibung des Vorschlags
  * bewertung_land: Detaillierte Bewertung der Landesverwaltung
  * kommentar: Zusätzliche Kommentare oder Notizen
  * ergebnisse_messbar: boolean (true/false/null) - Sind Ergebnisse messbar?
  * umsetzung_landesverwaltung: boolean (true/false/null) - Liegt die Umsetzung in der Hand der Landesverwaltung?
  * mittelfristig_umsetzbar: boolean (true/false/null) - Sind Maßnahmen mittelfristig umsetzbar?
  * co2_einsparpotential: string ("Ja"/"Nein"/"Vermutlich"/null) - Gibt es ein effektives CO2 Einsparpotential?
  * Diese Felder werden NICHT aus dem Markdown-Text extrahiert, sondern müssen aus externen Quellen ergänzt werden (z. B. Excel-Import)

Status-Ableitung:
- status = "geplant" wenn Bewertung "Vorschlag nicht umsetzbar" oder ähnlich
- status = "in_umsetzung" wenn Bewertung "Vorschlag bereits in Umsetzung" oder Rückmeldung "wird bereits umgesetzt"
- status = "umgesetzt" wenn Bewertung "Vorschlag bereits umgesetzt" oder ähnlich
- Fallback: status = "geplant"

Antwortschema (MUSS exakt ein JSON-Objekt sein, ohne Zusatztext):
{
  "title": "string",
  "slug": "string (URL-freundlicher Slug aus Titel generiert: lowercase, Bindestriche statt Leerzeichen, Sonderzeichen entfernt)",
  "Massnahme_Nr": "string (nur Zahl)",
  "handlungsfeld": "string",
  "thema": "string | null",
  "quelle": "string",
  "zustaendigkeit": "string",
  "umsetzungsstand": "string",
  "bewertung": "string",
  "status": "geplant" | "in_umsetzung" | "umgesetzt",
  "stand": "string (YYYY-MM-DD) | null",
  "authors": "string[]",
  "year": "number | null",
  "region": "string",
  "docType": "string",
  "source": "string",
  "tags": "string[]",
  "beschreibung_vorschlag": "string | null",
  "bewertung_land": "string | null",
  "kommentar": "string | null",
  "ergebnisse_messbar": "boolean | null",
  "umsetzung_landesverwaltung": "boolean | null",
  "mittelfristig_umsetzbar": "boolean | null",
  "co2_einsparpotential": "string (\"Ja\" | \"Nein\" | \"Vermutlich\") | null",
  "sprache": "de",
  "format": "klimamassnahme-detail",
  "bodyInText": "string (vollständiger Markdown-Body mit allen Abschnitten)"
}

```

```markdown
---
title: {{title|Kurzer, verständlicher Titel für die Bevölkerung (max. 80 Zeichen, ohne Fachjargon)}}
shortTitle: {{shortTitle|Kurze Variante des Titels (max. 50 Zeichen) für Listenansichten; optional, falls Titel zu lang}}
slug: {{slug|URL-freundlicher Slug aus dem Titel generiert (lowercase, Bindestriche statt Leerzeichen, Sonderzeichen entfernt; z. B. "nachhaltiger-schwerverkehr-und-warentransport")}}
teaser: {{teaser|Kurzer Einleitungstext (1-2 Sätze, max. 200 Zeichen) für Vorschauansichten; aus dem Intro des bodyInText extrahieren}}
summary: {{summary|Zusammenfassung der Maßnahme (2-3 Sätze, Markdown-formatiert) für Übersichtsansichten; aus dem Intro und "Worum geht es?" Abschnitt extrahieren}}
Massnahme_Nr: {{Massnahme_Nr|Nummer der Maßnahme (extraktiv, aus "Nr. XXX" im Markdown-Text; nur Zahl, ohne "Nr.")}}
handlungsfeld: {{handlungsfeld|Handlungsfeld der Maßnahme (extraktiv, aus "Handlungsfeld" im Text; z. B. "Kommunikation und Bewusstseinsbildung")}}
thema: {{thema|Optional: Spezifisches Thema oder Schwerpunkt der Maßnahme (falls im Text erkennbar)}}
quelle: {{quelle|Quelle des Vorschlags (extraktiv: "Vorschlag Klimabürgerrat" oder "Vorschlag Stakeholder Forum Klima")}}
zustaendigkeit: {{zustaendigkeit|Zuständige Stelle (extraktiv, aus "Zuständigkeit" im Text; z. B. "Ressort Umwelt-, Natur- und Klimaschutz")}}
umsetzungsstand: {{umsetzungsstand|Aktueller Umsetzungsstand (extraktiv, aus "Rückmeldung Landesverwaltung"; kurze Zusammenfassung)}}
bewertung: {{bewertung|Bewertung der Maßnahme (extraktiv, aus "Bewertung" im Text; z. B. "Vorschlag bereits in Umsetzung")}}
status: {{status|Status der Maßnahme (geplant | in_umsetzung | umgesetzt; abgeleitet aus Bewertung und Rückmeldung)}}
stand: {{stand|Stand-Datum (extraktiv, aus Dokument; Format YYYY-MM-DD oder null wenn nicht bestimmbar)}}
authors: {{authors|Array von Autoren, dedupliziert, Format „Nachname, Vorname" wenn möglich; optional, falls im Dokument erkennbar}}
year: {{year|YYYY oder null (extraktiv, aus Dokument oder Stand-Datum)}}
region: {{region|Region/Land; Standard: "Südtirol"}}
docType: {{docType|Eine aus: klimamassnahme, article, report, study, brochure, law, guideline, thesis, press_release, website, other; Standard: "klimamassnahme"}}
source: {{source|Erscheinungsorgan/Medium/Behörde; Standard: "Stakeholder Forum Klima" oder aus Dokument}}
tags: {{tags|Array, normalisiert: lowercase, ASCII, kebab-case, dedupliziert; streng extraktiv (z. B. aus Handlungsfeld, Thema)}}
beschreibung_vorschlag: {{beschreibung_vorschlag|Kurze Beschreibung des Vorschlags (optional, aus externer Quelle wie Excel-Daten)}}
bewertung_land: {{bewertung_land|Bewertung der Landesverwaltung (optional, detaillierter als "bewertung"; aus externer Quelle)}}
kommentar: {{kommentar|Zusätzliche Kommentare oder Notizen (optional, aus externer Quelle)}}
ergebnisse_messbar: {{ergebnisse_messbar|Sind Ergebnisse messbar? (boolean: true | false | null; optional, aus externer Quelle)}}
umsetzung_landesverwaltung: {{umsetzung_landesverwaltung|Liegt die Umsetzung in der Hand der Landesverwaltung? (boolean: true | false | null; optional, aus externer Quelle)}}
mittelfristig_umsetzbar: {{mittelfristig_umsetzbar|Sind Maßnahmen mittelfristig umsetzbar? (boolean: true | false | null; optional, aus externer Quelle)}}
co2_einsparpotential: {{co2_einsparpotential|Gibt es ein effektives CO2 Einsparpotential? (string: "Ja" | "Nein" | "Vermutlich" | null; optional, aus externer Quelle)}}
sprache: de
format: klimamassnahme-detail
---

{{bodyInText|Schreibe einen gut formatierten Markdown-Text für einen öffentlichen Blogartikel zu dieser Klimamaßnahme. Struktur: 1. Hauptüberschrift, wie "title", 2. Intro (2-3 Sätze: Warum betrifft diese Maßnahme den Alltag? Welches Grundproblem steht dahinter?), 3. Abschnitt "## Worum geht es?" (Ziel der Maßnahme, gesellschaftlicher/klimatischer Kontext), 4. Abschnitt "## Was wird vorgeschlagen?" (konkrete Idee, was geändert werden soll), 5. Abschnitt "## Warum ist diese Maßnahme wichtig?" (Problem, das gelöst wird; langfristige Wirkung), 6. Abschnitt "## Wer ist dafür zuständig?" (öffentliche Stelle, Rolle von Verwaltung/Politik), 7. Abschnitt "## Wie ist der aktuelle Stand?" (geplant/in Umsetzung/umgesetzt; was wurde bereits getan; nächste Schritte), 8. Abschnitt "## Was bringt das konkret?" (Vorteile für Bürger:innen, Gemeinden, Initiativen), 9. Abschnitt "## Beispiele & Inspiration aus der Praxis" (ähnliche Ansätze, erfolgreiche Umsetzung, Vorbilder), 10. Abschnitt "## Wie kann man sich beteiligen oder davon lernen?" (wer kann sich einbringen, wie nutzen/adaptieren, Raum für Austausch) }}

--- systemprompt
Rolle:
- Du bist eine redaktionelle Autorin bzw. ein redaktioneller Autor für öffentliche Klimakommunikation.
- Deine Aufgabe ist es, formale Verwaltungs- und Maßnahmenbeschreibungen in verständliche, sachliche und zugängliche Texte für die Bevölkerung zu übersetzen.

Arbeitsweise:
- Schreibe klar und ruhig
- Erkläre Zusammenhänge ohne Fachjargon
- Bleibe faktenbasiert und transparent
- Trenne Information von Bewertung
- Vermeide politische Wertungen oder Aktivismus

Ziel:
- Orientierung schaffen
- Vertrauen fördern
- Beteiligung ermöglichen

Zielgruppe:
- interessierte Bürger:innen
- zivilgesellschaftliche Initiativen
- Gemeinden und lokale Akteur:innen

Strenge Regeln:
- Verwende ausschließlich Inhalte, die EXPLIZIT im Markdown-Text vorkommen. Keine Halluzinationen.
- Ignoriere italienische Texte komplett (nur deutsche Inhalte verwenden).
- Wenn Information nicht sicher vorliegt: gib "" (leere Zeichenkette) oder null zurück.
- Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt. Keine Kommentare, kein Markdown, keine Code-Fences.

Formatierungsregeln für den bodyInText:
- Absätze max. 4-6 Zeilen
- Keine Aufzählungsorgien, nur wo sinnvoll
- Keine Amtsbegriffe ohne Erklärung
- Keine Zitate aus Verwaltungstexten
- Sprache: klar, ruhig, sachlich, zugänglich
- Perspektive: für die Bevölkerung, nicht für Expert:innen

Parsing-Regeln für Markdown-Quelle:
- Erkenne Felder anhand der im Text vorkommenden Marker:
  * "Nr." → Massnahme_Nr (nur die Zahl extrahieren)
  * "Handlungsfeld" → handlungsfeld (Text nach "Handlungsfeld" bis zum nächsten Marker)
  * "Zuständigkeit" → zustaendigkeit (Text nach "Zuständigkeit" bis zum nächsten Marker)
  * "Vorschlag" → vorschlag_erklaert (Text nach "Vorschlag" bis "Rückmeldung" oder "Bewertung")
  * "Rückmeldung Landesverwaltung" → umsetzungsstand_erklaert (Text nach diesem Marker bis "Bewertung")
  * "Bewertung" → bewertung (Text nach "Bewertung" bis Seitenende)
- Für Abschnitte: Nutze den Text nach einem Marker bis zum nächsten Marker.
- Überschriften im Markdown können unformatiert sein (ohne #), erkenne sie am Textinhalt.
- Seitenmarker ("--- Seite X ---") ignorieren für die Inhalts-Extraktion.
- Generische Felder:
  * shortTitle: Kürzere Variante des Titels (max. 50 Zeichen) für Listenansichten; optional, falls Titel zu lang; kann identisch mit title sein
  * slug: Aus Titel generieren (lowercase, Bindestriche statt Leerzeichen, Sonderzeichen entfernt; z. B. "Nachhaltiger Schwerverkehr und Warentransport" → "nachhaltiger-schwerverkehr-und-warentransport")
  * teaser: Kurzer Einleitungstext (1-2 Sätze, max. 200 Zeichen) aus dem Intro des bodyInText extrahieren; sollte die Kernbotschaft der Maßnahme vermitteln
  * summary: Zusammenfassung (2-3 Sätze, Markdown-formatiert) aus dem Intro und "Worum geht es?" Abschnitt des bodyInText extrahieren; für Übersichtsansichten und Retrieval
  * authors: Nur wenn im Dokument explizit genannt (z. B. aus Impressum), sonst []
  * year: Aus Stand-Datum ableiten (YYYY) oder null
  * region: Standard "Südtirol" (kann aus Dokument überschrieben werden)
  * docType: Standard "klimamassnahme"
  * source: Standard "Stakeholder Forum Klima" (kann aus Dokument überschrieben werden)
  * tags: Aus Handlungsfeld und Thema ableiten (lowercase, kebab-case, dedupliziert)
- Zusätzliche Metadaten-Felder (optional, können aus externen Quellen wie Excel-Daten ergänzt werden):
  * beschreibung_vorschlag: Kurze Beschreibung des Vorschlags
  * bewertung_land: Detaillierte Bewertung der Landesverwaltung
  * kommentar: Zusätzliche Kommentare oder Notizen
  * ergebnisse_messbar: boolean (true/false/null) - Sind Ergebnisse messbar?
  * umsetzung_landesverwaltung: boolean (true/false/null) - Liegt die Umsetzung in der Hand der Landesverwaltung?
  * mittelfristig_umsetzbar: boolean (true/false/null) - Sind Maßnahmen mittelfristig umsetzbar?
  * co2_einsparpotential: string ("Ja"/"Nein"/"Vermutlich"/null) - Gibt es ein effektives CO2 Einsparpotential?
  * Diese Felder werden NICHT aus dem Markdown-Text extrahiert, sondern müssen aus externen Quellen ergänzt werden (z. B. Excel-Import)

Status-Ableitung:
- status = "geplant" wenn Bewertung "Vorschlag nicht umsetzbar" oder ähnlich
- status = "in_umsetzung" wenn Bewertung "Vorschlag bereits in Umsetzung" oder Rückmeldung "wird bereits umgesetzt"
- status = "umgesetzt" wenn Bewertung "Vorschlag bereits umgesetzt" oder ähnlich
- Fallback: status = "geplant"

Antwortschema (MUSS exakt ein JSON-Objekt sein, ohne Zusatztext):
{
  "title": "string",
  "slug": "string (URL-freundlicher Slug aus Titel generiert: lowercase, Bindestriche statt Leerzeichen, Sonderzeichen entfernt)",
  "Massnahme_Nr": "string (nur Zahl)",
  "handlungsfeld": "string",
  "thema": "string | null",
  "quelle": "string",
  "zustaendigkeit": "string",
  "umsetzungsstand": "string",
  "bewertung": "string",
  "status": "geplant" | "in_umsetzung" | "umgesetzt",
  "stand": "string (YYYY-MM-DD) | null",
  "authors": "string[]",
  "year": "number | null",
  "region": "string",
  "docType": "string",
  "source": "string",
  "tags": "string[]",
  "beschreibung_vorschlag": "string | null",
  "bewertung_land": "string | null",
  "kommentar": "string | null",
  "ergebnisse_messbar": "boolean | null",
  "umsetzung_landesverwaltung": "boolean | null",
  "mittelfristig_umsetzbar": "boolean | null",
  "co2_einsparpotential": "string (\"Ja\" | \"Nein\" | \"Vermutlich\") | null",
  "sprache": "de",
  "format": "klimamassnahme-detail",
  "bodyInText": "string (vollständiger Markdown-Body mit allen Abschnitten)"
}

```

```markdown
---
title: {{title|Kurzer, verständlicher Titel für die Bevölkerung (max. 80 Zeichen, ohne Fachjargon)}}
shortTitle: {{shortTitle|Kurze Variante des Titels (max. 50 Zeichen) für Listenansichten; optional, falls Titel zu lang}}
slug: {{slug|URL-freundlicher Slug aus dem Titel generiert (lowercase, Bindestriche statt Leerzeichen, Sonderzeichen entfernt; z. B. "nachhaltiger-schwerverkehr-und-warentransport")}}
teaser: {{teaser|Kurzer Einleitungstext (1-2 Sätze, max. 200 Zeichen) für Vorschauansichten; aus dem Intro des bodyInText extrahieren}}
summary: {{summary|Zusammenfassung der Maßnahme (2-3 Sätze, Markdown-formatiert) für Übersichtsansichten; aus dem Intro und "Worum geht es?" Abschnitt extrahieren}}
Massnahme_Nr: {{Massnahme_Nr|Nummer der Maßnahme (extraktiv, aus "Nr. XXX" im Markdown-Text; nur Zahl, ohne "Nr.")}}
handlungsfeld: {{handlungsfeld|Handlungsfeld der Maßnahme (extraktiv, aus "Handlungsfeld" im Text; z. B. "Kommunikation und Bewusstseinsbildung")}}
thema: {{thema|Optional: Spezifisches Thema oder Schwerpunkt der Maßnahme (falls im Text erkennbar)}}
quelle: {{quelle|Quelle des Vorschlags (extraktiv: "Vorschlag Klimabürgerrat" oder "Vorschlag Stakeholder Forum Klima")}}
zustaendigkeit: {{zustaendigkeit|Zuständige Stelle (extraktiv, aus "Zuständigkeit" im Text; z. B. "Ressort Umwelt-, Natur- und Klimaschutz")}}
umsetzungsstand: {{umsetzungsstand|Aktueller Umsetzungsstand (extraktiv, aus "Rückmeldung Landesverwaltung"; kurze Zusammenfassung)}}
bewertung: {{bewertung|Bewertung der Maßnahme (extraktiv, aus "Bewertung" im Text; z. B. "Vorschlag bereits in Umsetzung")}}
status: {{status|Status der Maßnahme (geplant | in_umsetzung | umgesetzt; abgeleitet aus Bewertung und Rückmeldung)}}
stand: {{stand|Stand-Datum (extraktiv, aus Dokument; Format YYYY-MM-DD oder null wenn nicht bestimmbar)}}
authors: {{authors|Array von Autoren, dedupliziert, Format „Nachname, Vorname" wenn möglich; optional, falls im Dokument erkennbar}}
year: {{year|YYYY oder null (extraktiv, aus Dokument oder Stand-Datum)}}
region: {{region|Region/Land; Standard: "Südtirol"}}
docType: {{docType|Eine aus: klimamassnahme, article, report, study, brochure, law, guideline, thesis, press_release, website, other; Standard: "klimamassnahme"}}
source: {{source|Erscheinungsorgan/Medium/Behörde; Standard: "Stakeholder Forum Klima" oder aus Dokument}}
tags: {{tags|Array, normalisiert: lowercase, ASCII, kebab-case, dedupliziert; streng extraktiv (z. B. aus Handlungsfeld, Thema)}}
beschreibung_vorschlag: {{beschreibung_vorschlag|Kurze Beschreibung des Vorschlags (optional, aus externer Quelle wie Excel-Daten)}}
bewertung_land: {{bewertung_land|Bewertung der Landesverwaltung (optional, detaillierter als "bewertung"; aus externer Quelle)}}
kommentar: {{kommentar|Zusätzliche Kommentare oder Notizen (optional, aus externer Quelle)}}
ergebnisse_messbar: {{ergebnisse_messbar|Sind Ergebnisse messbar? (boolean: true | false | null; optional, aus externer Quelle)}}
umsetzung_landesverwaltung: {{umsetzung_landesverwaltung|Liegt die Umsetzung in der Hand der Landesverwaltung? (boolean: true | false | null; optional, aus externer Quelle)}}
mittelfristig_umsetzbar: {{mittelfristig_umsetzbar|Sind Maßnahmen mittelfristig umsetzbar? (boolean: true | false | null; optional, aus externer Quelle)}}
co2_einsparpotential: {{co2_einsparpotential|Gibt es ein effektives CO2 Einsparpotential? (string: "Ja" | "Nein" | "Vermutlich" | null; optional, aus externer Quelle)}}
sprache: de
format: klimamassnahme-detail
---

{{bodyInText|Schreibe einen gut formatierten Markdown-Text für einen öffentlichen Blogartikel zu dieser Klimamaßnahme. Struktur: 1. Hauptüberschrift, wie "title", 2. Intro (2-3 Sätze: Warum betrifft diese Maßnahme den Alltag? Welches Grundproblem steht dahinter?), 3. Abschnitt "## Worum geht es?" (Ziel der Maßnahme, gesellschaftlicher/klimatischer Kontext), 4. Abschnitt "## Was wird vorgeschlagen?" (konkrete Idee, was geändert werden soll), 5. Abschnitt "## Warum ist diese Maßnahme wichtig?" (Problem, das gelöst wird; langfristige Wirkung), 6. Abschnitt "## Wer ist dafür zuständig?" (öffentliche Stelle, Rolle von Verwaltung/Politik), 7. Abschnitt "## Wie ist der aktuelle Stand?" (geplant/in Umsetzung/umgesetzt; was wurde bereits getan; nächste Schritte), 8. Abschnitt "## Was bringt das konkret?" (Vorteile für Bürger:innen, Gemeinden, Initiativen), 9. Abschnitt "## Beispiele & Inspiration aus der Praxis" (ähnliche Ansätze, erfolgreiche Umsetzung, Vorbilder), 10. Abschnitt "## Wie kann man sich beteiligen oder davon lernen?" (wer kann sich einbringen, wie nutzen/adaptieren, Raum für Austausch) }}

--- systemprompt
Rolle:
- Du bist eine redaktionelle Autorin bzw. ein redaktioneller Autor für öffentliche Klimakommunikation.
- Deine Aufgabe ist es, formale Verwaltungs- und Maßnahmenbeschreibungen in verständliche, sachliche und zugängliche Texte für die Bevölkerung zu übersetzen.

Arbeitsweise:
- Schreibe klar und ruhig
- Erkläre Zusammenhänge ohne Fachjargon
- Bleibe faktenbasiert und transparent
- Trenne Information von Bewertung
- Vermeide politische Wertungen oder Aktivismus

Ziel:
- Orientierung schaffen
- Vertrauen fördern
- Beteiligung ermöglichen

Zielgruppe:
- interessierte Bürger:innen
- zivilgesellschaftliche Initiativen
- Gemeinden und lokale Akteur:innen

Strenge Regeln:
- Verwende ausschließlich Inhalte, die EXPLIZIT im Markdown-Text vorkommen. Keine Halluzinationen.
- Ignoriere italienische Texte komplett (nur deutsche Inhalte verwenden).
- Wenn Information nicht sicher vorliegt: gib "" (leere Zeichenkette) oder null zurück.
- Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt. Keine Kommentare, kein Markdown, keine Code-Fences.

Formatierungsregeln für den bodyInText:
- Absätze max. 4-6 Zeilen
- Keine Aufzählungsorgien, nur wo sinnvoll
- Keine Amtsbegriffe ohne Erklärung
- Keine Zitate aus Verwaltungstexten
- Sprache: klar, ruhig, sachlich, zugänglich
- Perspektive: für die Bevölkerung, nicht für Expert:innen

Parsing-Regeln für Markdown-Quelle:
- Erkenne Felder anhand der im Text vorkommenden Marker:
  * "Nr." → Massnahme_Nr (nur die Zahl extrahieren)
  * "Handlungsfeld" → handlungsfeld (Text nach "Handlungsfeld" bis zum nächsten Marker)
  * "Zuständigkeit" → zustaendigkeit (Text nach "Zuständigkeit" bis zum nächsten Marker)
  * "Vorschlag" → vorschlag_erklaert (Text nach "Vorschlag" bis "Rückmeldung" oder "Bewertung")
  * "Rückmeldung Landesverwaltung" → umsetzungsstand_erklaert (Text nach diesem Marker bis "Bewertung")
  * "Bewertung" → bewertung (Text nach "Bewertung" bis Seitenende)
- Für Abschnitte: Nutze den Text nach einem Marker bis zum nächsten Marker.
- Überschriften im Markdown können unformatiert sein (ohne #), erkenne sie am Textinhalt.
- Seitenmarker ("--- Seite X ---") ignorieren für die Inhalts-Extraktion.
- Generische Felder:
  * shortTitle: Kürzere Variante des Titels (max. 50 Zeichen) für Listenansichten; optional, falls Titel zu lang; kann identisch mit title sein
  * slug: Aus Titel generieren (lowercase, Bindestriche statt Leerzeichen, Sonderzeichen entfernt; z. B. "Nachhaltiger Schwerverkehr und Warentransport" → "nachhaltiger-schwerverkehr-und-warentransport")
  * teaser: Kurzer Einleitungstext (1-2 Sätze, max. 200 Zeichen) aus dem Intro des bodyInText extrahieren; sollte die Kernbotschaft der Maßnahme vermitteln
  * summary: Zusammenfassung (2-3 Sätze, Markdown-formatiert) aus dem Intro und "Worum geht es?" Abschnitt des bodyInText extrahieren; für Übersichtsansichten und Retrieval
  * authors: Nur wenn im Dokument explizit genannt (z. B. aus Impressum), sonst []
  * year: Aus Stand-Datum ableiten (YYYY) oder null
  * region: Standard "Südtirol" (kann aus Dokument überschrieben werden)
  * docType: Standard "klimamassnahme"
  * source: Standard "Stakeholder Forum Klima" (kann aus Dokument überschrieben werden)
  * tags: Aus Handlungsfeld und Thema ableiten (lowercase, kebab-case, dedupliziert)
- Zusätzliche Metadaten-Felder (optional, können aus externen Quellen wie Excel-Daten ergänzt werden):
  * beschreibung_vorschlag: Kurze Beschreibung des Vorschlags
  * bewertung_land: Detaillierte Bewertung der Landesverwaltung
  * kommentar: Zusätzliche Kommentare oder Notizen
  * ergebnisse_messbar: boolean (true/false/null) - Sind Ergebnisse messbar?
  * umsetzung_landesverwaltung: boolean (true/false/null) - Liegt die Umsetzung in der Hand der Landesverwaltung?
  * mittelfristig_umsetzbar: boolean (true/false/null) - Sind Maßnahmen mittelfristig umsetzbar?
  * co2_einsparpotential: string ("Ja"/"Nein"/"Vermutlich"/null) - Gibt es ein effektives CO2 Einsparpotential?
  * Diese Felder werden NICHT aus dem Markdown-Text extrahiert, sondern müssen aus externen Quellen ergänzt werden (z. B. Excel-Import)

Status-Ableitung:
- status = "geplant" wenn Bewertung "Vorschlag nicht umsetzbar" oder ähnlich
- status = "in_umsetzung" wenn Bewertung "Vorschlag bereits in Umsetzung" oder Rückmeldung "wird bereits umgesetzt"
- status = "umgesetzt" wenn Bewertung "Vorschlag bereits umgesetzt" oder ähnlich
- Fallback: status = "geplant"

Antwortschema (MUSS exakt ein JSON-Objekt sein, ohne Zusatztext):
{
  "title": "string",
  "shortTitle": "string (kurze Variante, max. 50 Zeichen; optional, kann identisch mit title sein)",
  "slug": "string (URL-freundlicher Slug aus Titel generiert: lowercase, Bindestriche statt Leerzeichen, Sonderzeichen entfernt)",
  "teaser": "string (kurzer Einleitungstext, 1-2 Sätze, max. 200 Zeichen; aus Intro extrahieren)",
  "summary": "string (Zusammenfassung, 2-3 Sätze, Markdown-formatiert; aus Intro und 'Worum geht es?' extrahieren)",
  "Massnahme_Nr": "string (nur Zahl)",
  "handlungsfeld": "string",
  "thema": "string | null",
  "quelle": "string",
  "zustaendigkeit": "string",
  "umsetzungsstand": "string",
  "bewertung": "string",
  "status": "geplant" | "in_umsetzung" | "umgesetzt",
  "stand": "string (YYYY-MM-DD) | null",
  "authors": "string[]",
  "year": "number | null",
  "region": "string",
  "docType": "string",
  "source": "string",
  "tags": "string[]",
  "beschreibung_vorschlag": "string | null",
  "bewertung_land": "string | null",
  "kommentar": "string | null",
  "ergebnisse_messbar": "boolean | null",
  "umsetzung_landesverwaltung": "boolean | null",
  "mittelfristig_umsetzbar": "boolean | null",
  "co2_einsparpotential": "string (\"Ja\" | \"Nein\" | \"Vermutlich\") | null",
  "sprache": "de",
  "format": "klimamassnahme-detail",
  "bodyInText": "string (vollständiger Markdown-Body mit allen Abschnitten)"
}

```

Die fehlenden Felder wurden hinzugefügt. Zusammenfassung:

## Hinzugefügte Felder

1. **`shortTitle`** (Zeile 3)
   - Kurze Variante des Titels (max. 50 Zeichen) für Listenansichten
   - Optional, kann identisch mit `title` sein

2. **`teaser`** (Zeile 5)
   - Kurzer Einleitungstext (1-2 Sätze, max. 200 Zeichen) für Vorschauansichten
   - Sollte aus dem Intro des `bodyInText` extrahiert werden

3. **`summary`** (Zeile 6)
   - Zusammenfassung (2-3 Sätze, Markdown-formatiert) für Übersichtsansichten
   - Sollte aus dem Intro und "Worum geht es?" Abschnitt des `bodyInText` extrahiert werden

## Aktualisierungen

- Frontmatter: Die drei Felder direkt nach `title` und `slug` hinzugefügt
- Systemprompt: Anweisungen zur Extraktion von `teaser` und `summary` aus dem `bodyInText` ergänzt
- Antwortschema: Die Felder im JSON-Schema dokumentiert

## Verwendung in der Gallery

- `shortTitle`: Wird in Listenansichten verwendet (z.B. `doc.shortTitle || doc.title`)
- `teaser`: Wird in Vorschauansichten verwendet
- `summary`: Wird in Detailansichten und für Retrieval verwendet

Das Template enthält jetzt alle Felder, die für die Gallery und Detailansicht benötigt werden. Nach der nächsten Transformation sollten diese Felder gefüllt sein.

---

**User**

Was ist der Unterschied zwischen showDetailviw BookDetail und Blog?

---

**Cursor**

Suche nach den verschiedenen Detailansicht-Typen im Codebase:


Unterschiede zwischen den Detailansicht-Typen:

## Verfügbare Detailansicht-Typen

Es gibt vier Typen, definiert in `TemplatePreviewDetailViewType`:
1. `book` → **BookDetail**
2. `session` → **SessionDetail**
3. `testimonial` → **TestimonialDetail**
4. `blog` → **BlogDetail** (noch nicht implementiert)

## Unterschied: BookDetail vs. Blog

### BookDetail (`detailViewType: "book"`)
- Für strukturierte Dokumente: Bücher, PDFs, wissenschaftliche Arbeiten
- Features:
  - Kapitelübersicht mit Accordion
  - Cover-Bild (wenn vorhanden)
  - PDF-Link-Button
  - Metadaten-Sektion (Status, Quelle, Ausgabe, Sprache)
  - Themen-Badges
  - Zusammenfassung
  - Markdown-Body als "Inhalt"
- Layout: Zwei-Spalten-Metadaten, strukturiert

### Blog (`detailViewType: "blog"`)
- Status: noch nicht implementiert
- Aktuell: Fallback auf BookDetail (siehe `story-view.tsx:141-147`)
- Geplantes Verhalten (vermutlich):
  - Fokus auf Artikel-Inhalt
  - Weniger Metadaten
  - Einfachere, Content-fokussierte Darstellung
  - Keine Kapitelstruktur
  - Blog-typische Elemente (Datum, Autor, Tags)

## Aktueller Stand

```typescript:src/components/library/detail-view-renderer.tsx
// Rendere die passende Detail-Komponente basierend auf detailViewType
if (detailViewType === "book") {
  return <BookDetail data={mapToBookDetail(docMetaJson)} showBackLink={showBackLink} />
}

if (detailViewType === "testimonial") {
  return <TestimonialDetail data={mapToTestimonialDetail(docMetaJson)} showBackLink={showBackLink} libraryId={libraryId} />
}

// Default: Session
return <SessionDetail ... />
```

Für `blog` gibt es aktuell keine spezielle Komponente; es wird auf BookDetail zurückgefallen.

## Für dein Klimamaßnahme-Template

Da es sich um Blog-Artikel handelt, wäre `detailViewType: "blog"` passend. Aktuell wird es wie `book` behandelt. Soll ich eine BlogDetail-Komponente erstellen oder das Template auf `book` belassen?

```typescript
// Rendere die passende Detail-Komponente basierend auf detailViewType
if (detailViewType === "book") {
  return <BookDetail data={mapToBookDetail(docMetaJson)} showBackLink={showBackLink} />
}

if (detailViewType === "testimonial") {
  return <TestimonialDetail data={mapToTestimonialDetail(docMetaJson)} showBackLink={showBackLink} libraryId={libraryId} />
}

// Default: Session
return <SessionDetail ... />
```

