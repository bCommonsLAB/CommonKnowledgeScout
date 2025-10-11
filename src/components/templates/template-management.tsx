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
import { useToast } from "@/hooks/use-toast"
import { Loader2, Save, Eye, Play, FolderOpen, Info } from "lucide-react"
import { useAtom, useAtomValue } from "jotai"
import { activeLibraryAtom, libraryStatusAtom } from "@/atoms/library-atom"
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
import { Checkbox } from "@/components/ui/checkbox"
import { MarkdownPreview } from "@/components/library/markdown-preview"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { JobReportTab } from "@/components/library/job-report-tab"
import { Textarea } from "@/components/ui/textarea"
// Separator ungenutzt entfernt

// Schema für Template-Daten
const templateSchema = z.object({
  name: z.string().min(1, "Prompt-Name ist erforderlich"),
  yamlFrontmatter: z.string(),
  markdownBody: z.string(),
  systemPrompt: z.string(),
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
  // Magic Design
  const [magicMode, setMagicMode] = useState<boolean>(false)
  const [magicBody, setMagicBody] = useState<string>("")
  const [magicFrontmatter, setMagicFrontmatter] = useState<string>("")
  const [magicSystem, setMagicSystem] = useState<string>("")
  const [magicRunning, setMagicRunning] = useState<boolean>(false)
  // Magic-Diff/SavedId aktuell ungenutzt im UI – wir speichern nur per Setter
  const [, setMagicLastDiff] = useState<string>("")
  const [, setMagicSavedItemId] = useState<string | null>(null)
  const { toast } = useToast()

  // Atoms
  const [templates, setTemplates] = useAtom(templatesAtom)
  const [selectedTemplateName, setSelectedTemplateName] = useAtom(selectedTemplateNameAtom)
  const [selectedTemplate] = useAtom(selectedTemplateAtom)
  const [templatesFolderId, setTemplatesFolderId] = useAtom(templatesFolderIdAtom)
  const [isLoading, setIsLoading] = useAtom(templateLoadingAtom)
  const [error, setError] = useAtom(templateErrorAtom)

  // Library und Storage
  const activeLibrary = useAtomValue(activeLibraryAtom)
  const libraryStatus = useAtomValue(libraryStatusAtom)
  const { 
    provider: providerInstance, 
    listItems
  } = useStorage()
  const contextDocs = useAtomValue(templateContextDocsAtom)

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: "",
      yamlFrontmatter: `---
title: {{title|Titel des Dokuments}}
tags: {{tags|Relevante Tags}}
date: {{date|Datum im Format yyyy-mm-dd}}
---`,
      markdownBody: `# {{title}}

## Zusammenfassung
{{summary|Kurze Zusammenfassung des Inhalts}}

## Details
{{details|Detaillierte Beschreibung}}`,
      systemPrompt: `You are a specialized assistant that processes and structures information clearly and concisely.

IMPORTANT: Your response must be a valid JSON object where each key corresponds to a template variable.`,
    },
  })

  // Helper zum Erzeugen von Default-Werten
  function getDefaultTemplateValues(name: string): TemplateFormValues {
    return {
      name,
      yamlFrontmatter: `---\n` +
        `title: {{title|Titel des Dokuments}}\n` +
        `tags: {{tags|Relevante Tags}}\n` +
        `date: {{date|Datum im Format yyyy-mm-dd}}\n` +
        `---`,
      markdownBody: `# {{title}}\n\n## Zusammenfassung\n{{summary|Kurze Zusammenfassung des Inhalts}}\n\n## Details\n{{details|Detaillierte Beschreibung}}`,
      systemPrompt: `You are a specialized assistant that processes and structures information clearly and concisely.\n\nIMPORTANT: Your response must be a valid JSON object where each key corresponds to a template variable.`,
    }
  }

  // Template-Daten laden wenn sich die Auswahl ändert
  useEffect(() => {
    if (selectedTemplate) {
      form.reset({
        name: selectedTemplate.name,
        yamlFrontmatter: selectedTemplate.yamlFrontmatter,
        markdownBody: selectedTemplate.markdownBody,
        systemPrompt: selectedTemplate.systemPrompt,
      })
    }
  }, [selectedTemplate, form])

  // Ordner-Erstellung/Suche memoisiert, damit als Dep verwendbar
  const ensureTemplatesFolder = useCallback(async (): Promise<string> => {
    if (!providerInstance || !activeLibrary) {
      throw new Error("Keine aktive Bibliothek oder Provider verfügbar");
    }

    try {
      console.log('[TemplateManagement] Suche nach Templates-Ordner...');
      const rootItems = await listItems('root');
      const templatesFolder = rootItems.find(item => 
        item.type === 'folder' && item.metadata.name === 'templates'
      );
      if (templatesFolder) {
        console.log('[TemplateManagement] Templates-Ordner gefunden:', templatesFolder.id);
        return templatesFolder.id;
      }
      console.log('[TemplateManagement] Templates-Ordner nicht gefunden, erstelle neuen...');
      const newFolder = await providerInstance.createFolder('root', 'templates');
      console.log('[TemplateManagement] Neuer Templates-Ordner erstellt:', newFolder.id);
      return newFolder.id;
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
  }, [providerInstance, activeLibrary, listItems]);

  // Templates laden mit der gleichen Logik wie Library-Komponente
  const loadTemplates = useCallback(async () => {
    if (!providerInstance || libraryStatus !== 'ready' || !activeLibrary) {
      console.log('[TemplateManagement] loadTemplates übersprungen:', {
        hasProvider: !!providerInstance,
        libraryStatus,
        hasActiveLibrary: !!activeLibrary
      });
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('[TemplateManagement] Starte Prompt-Loading:', {
        libraryId: activeLibrary.id,
        libraryPath: activeLibrary.path,
        providerName: providerInstance.name
      });

      // 1. Templates-Ordner finden oder erstellen
      const folderId = await ensureTemplatesFolder();
      setTemplatesFolderId(folderId);

      console.log('[TemplateManagement] Templates-Ordner gefunden/erstellt:', folderId);

      // 2. Alle Template-Dateien im Ordner auflisten
      const items = await listItems(folderId);
      const templateFiles = items.filter(item => 
        item.type === 'file' && 
        item.metadata.name.endsWith('.md')
      );

      console.log('[TemplateManagement] Prompt-Dateien gefunden:', templateFiles.length);

      // 3. Template-Inhalte laden
      const templatePromises = templateFiles.map(async (file) => {
        try {
          const { blob } = await providerInstance.getBinary(file.id);
          const content = await blob.text();
          const template = parseTemplateContent(content, file.metadata.name.replace('.md', ''));
          
          return {
            ...template,
            fileId: file.id,
            lastModified: typeof file.metadata.modifiedAt === 'string' 
              ? file.metadata.modifiedAt 
              : file.metadata.modifiedAt instanceof Date 
                ? file.metadata.modifiedAt.toISOString()
                : new Date().toISOString()
          } as Template;
        } catch (error) {
          console.error(`Fehler beim Parsen von ${file.metadata.name}:`, error);
          return null;
        }
      });

      const loadedTemplates = await Promise.all(templatePromises);
      const validTemplates = loadedTemplates.filter((t): t is Template => t !== null);
      
      setTemplates(validTemplates);
      
      console.log('[TemplateManagement] Prompts erfolgreich geladen:', validTemplates.length);
      
      if (validTemplates.length === 0) {
        toast({
          title: "Keine Prompts gefunden",
          description: "Erstellen Sie Ihren ersten Prompt im Verzeichnis '/templates'.",
        });
      }
    } catch (error) {
      console.error('Fehler beim Laden der Prompts:', {
        error: error instanceof Error ? {
          message: error.message,
          name: error.name,
          stack: error.stack?.split('\n').slice(0, 3)
        } : error,
        libraryId: activeLibrary?.id,
        libraryPath: activeLibrary?.path,
        providerName: providerInstance?.name
      });

      let errorMessage = 'Unbekannter Fehler beim Laden der Prompts';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Spezifische Fehlermeldungen für häufige Probleme
        if (error.message.includes('Nicht authentifiziert')) {
          errorMessage = 'Bitte authentifizieren Sie sich bei Ihrem Cloud-Speicher, um Prompts zu laden.';
        } else if (error.message.includes('Bibliothek nicht gefunden')) {
          errorMessage = 'Die ausgewählte Bibliothek wurde nicht gefunden. Bitte überprüfen Sie die Bibliothekskonfiguration.';
        } else if (error.message.includes('Server-Fehler')) {
          errorMessage = 'Server-Fehler beim Laden der Prompts. Bitte überprüfen Sie, ob der Bibliothekspfad existiert und zugänglich ist.';
        } else if (error.message.includes('Keine aktive Bibliothek')) {
          errorMessage = 'Keine aktive Bibliothek verfügbar. Bitte wählen Sie eine Bibliothek aus.';
        }
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
  }, [providerInstance, libraryStatus, activeLibrary, listItems, setTemplates, setTemplatesFolderId, setIsLoading, setError, toast, ensureTemplatesFolder]);

  // Effect für Template Loading (wie Library-Komponente)
  useEffect(() => {
    const isReady = providerInstance && libraryStatus === 'ready' && activeLibrary
    
    if (!isReady) {
      return
    }

    // Templates laden wenn noch nicht geladen
    if (!templatesFolderId) {
      loadTemplates()
    }
  }, [providerInstance, libraryStatus, activeLibrary, templatesFolderId, loadTemplates])

  // Reset wenn sich die Library ändert
  useEffect(() => {
    setSelectedTemplateName(null)
    setTemplatesFolderId(null)
    setTemplates([])
    setError(null)
  }, [libraryStatus, setSelectedTemplateName, setTemplatesFolderId, setTemplates, setError])

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

  function parseTemplateContent(content: string, fileName: string): Template {
    // Template in drei Bereiche aufteilen
    const parts = content.split('--- systemprompt')
    
    let yamlFrontmatter = ""
    let markdownBody = ""
    let systemPrompt = ""
    
    if (parts.length >= 2) {
      const mainContent = parts[0].trim()
      systemPrompt = parts[1].trim()
      
      // YAML Frontmatter extrahieren
      const yamlMatch = mainContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
      if (yamlMatch) {
        yamlFrontmatter = `---\n${yamlMatch[1]}\n---`
        markdownBody = yamlMatch[2].trim()
      } else {
        // Kein YAML Frontmatter gefunden
        markdownBody = mainContent
      }
    } else {
      // Kein Systemprompt gefunden
      const yamlMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
      if (yamlMatch) {
        yamlFrontmatter = `---\n${yamlMatch[1]}\n---`
        markdownBody = yamlMatch[2].trim()
      } else {
        markdownBody = content
      }
    }

    return {
      name: fileName,
      yamlFrontmatter,
      markdownBody,
      systemPrompt,
    }
  }

  function generateTemplateContent(values: TemplateFormValues): string {
    let content = ""
    
    // YAML Frontmatter hinzufügen
    if (values.yamlFrontmatter.trim()) {
      content += values.yamlFrontmatter + "\n\n"
    }
    
    // Markdown Body hinzufügen
    content += values.markdownBody
    
    // System Prompt hinzufügen
    if (values.systemPrompt.trim()) {
      content += "\n\n--- systemprompt\n" + values.systemPrompt
    }
    
    return content
  }

  async function onSubmit(data: TemplateFormValues) {
    if (!activeLibrary || !templatesFolderId || !providerInstance) {
      toast({
        title: "Fehler",
        description: "Keine aktive Bibliothek oder Templates-Ordner nicht gefunden.",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    try {
      const templateContent = generateTemplateContent(data)
      const fileName = `${data.name}.md`
      
      console.group('[TemplateManagement] Speichern')
      console.log('Library', { id: activeLibrary.id, label: activeLibrary.label, path: activeLibrary.path })
      console.log('TemplatesFolderId', templatesFolderId)
      console.log('Datei', { fileName, contentLen: templateContent.length })
      
      // Falls Datei mit gleichem Namen existiert: erst löschen, dann neu schreiben
      const existing = templates.find(t => t.name.toLowerCase() === data.name.toLowerCase())
      if (existing?.fileId) {
        console.log('Bestehende Datei gefunden, lösche', { fileId: existing.fileId })
        try {
          await providerInstance.deleteItem(existing.fileId)
          console.log('Löschen OK')
        } catch (e) {
          console.error('Löschen fehlgeschlagen', e)
          toast({ title: 'Löschen fehlgeschlagen', description: e instanceof Error ? e.message : String(e), variant: 'destructive' })
        }
      } else {
        console.log('Keine bestehende Datei mit gleichem Namen gefunden')
      }
      
      // Datei als Blob erstellen und hochladen (Neu-Anlage / Ersetzen)
      const blob = new Blob([templateContent], { type: 'text/markdown' })
      const file = new File([blob], fileName, { type: 'text/markdown' })
      const uploaded = await providerInstance.uploadFile(templatesFolderId, file)
      console.log('Upload Ergebnis', uploaded)
      
      // Direkt nach Upload erneut lesen (Bypass-Stale) und lokalen State aktualisieren
      try {
        const { blob: rbBlob } = await providerInstance.getBinary(uploaded.id)
        const rbText = await rbBlob.text()
        console.log('Read-Back Länge', rbText.length, 'Auszug', rbText.slice(0, 120))
        const parsed = parseTemplateContent(rbText, data.name)
        const updated: Template = {
          ...parsed,
          fileId: uploaded.id,
          lastModified: new Date().toISOString()
        }
        const nextTemplates = templates
          .filter((t) => t.name.toLowerCase() !== data.name.toLowerCase())
          .concat(updated)
        setTemplates(nextTemplates)
      } catch (e) {
        console.warn('Read-Back nach Upload fehlgeschlagen', e)
      }
      
      // Kurze Wartezeit, damit Remote-Provider (OneDrive) Index/Cache aktualisiert
      await new Promise(r => setTimeout(r, 500))
      
      // Templates neu laden (finaler Sync mit Remote)
      await loadTemplates()
      console.log('Templates neu geladen')
      
      // Auswahl auf das neue Template setzen
      setSelectedTemplateName(data.name)
      console.log('Auswahl gesetzt', data.name)
      
      toast({
        title: "Prompt gespeichert",
        description: `"${data.name}" wurde aktualisiert.`,
      })
      console.groupEnd()
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
    const current = selectedTemplateName ? templates.find(t => t.name === selectedTemplateName) : null
    if (!current || !current.fileId || !providerInstance) return
    const newName = (window.prompt('Neuen Namen eingeben:', current.name) || '').trim()
    if (!newName || newName === current.name) return
    if (/[^a-zA-Z0-9._\- ]/.test(newName)) { toast({ title: 'Ungültiger Name', description: 'Nur Buchstaben, Zahlen, Leerzeichen, . _ - sind erlaubt.', variant: 'destructive' }); return }
    if (templates.some(t => t.name.toLowerCase() === newName.toLowerCase())) { toast({ title: 'Bereits vorhanden', description: 'Bitte anderen Namen wählen.', variant: 'destructive' }); return }
    try {
      await providerInstance.renameItem(current.fileId, `${newName}.md`)
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
    if (!activeLibrary || !providerInstance) return

    try {
      const template = templates.find(t => t.name === templateName)
      if (!template?.fileId) {
        throw new Error("Template-Datei nicht gefunden")
      }

      // Datei löschen
      await providerInstance.deleteItem(template.fileId)

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
    const name = (window.prompt('Neuen Template‑Namen eingeben:') || '').trim()
    if (!name) return
    if (/[^a-zA-Z0-9._\- ]/.test(name)) { toast({ title: 'Ungültiger Name', description: 'Nur Buchstaben, Zahlen, Leerzeichen, . _ - sind erlaubt.', variant: 'destructive' }); return }
    if (templates.some(t => t.name.toLowerCase() === name.toLowerCase())) { toast({ title: 'Bereits vorhanden', description: 'Bitte anderen Namen wählen.', variant: 'destructive' }); return }
    if (!providerInstance) { toast({ title: 'Kein Provider' , variant: 'destructive' }); return }
    try {
      const folderId = await ensureTemplatesFolder()
      const values = getDefaultTemplateValues(name)
      const content = (values.yamlFrontmatter ? values.yamlFrontmatter + '\n\n' : '') + values.markdownBody + '\n\n--- systemprompt\n' + values.systemPrompt
      const file = new File([new Blob([content], { type: 'text/markdown' })], `${name}.md`, { type: 'text/markdown' })
      await providerInstance.uploadFile(folderId, file)
      await loadTemplates()
      setSelectedTemplateName(name)
      form.reset(values)
      toast({ title: 'Template angelegt', description: `"${name}" wurde erstellt.` })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
      toast({ title: 'Fehler beim Anlegen', description: msg, variant: 'destructive' })
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
    const roots = await listItems('root')
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
      const parsed = parseTemplateContent(corrected, selectedTemplateName)
      form.setValue('yamlFrontmatter', parsed.yamlFrontmatter, { shouldDirty: true })
      form.setValue('markdownBody', parsed.markdownBody, { shouldDirty: true })
      form.setValue('systemPrompt', parsed.systemPrompt, { shouldDirty: true })
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

  return (
    <div className="space-y-6">

      {/* Kompakte Toolbar oben */}
      <div className="flex items-center gap-2">
        <Select value={selectedTemplateName || ''} onValueChange={(v) => { setSelectedTemplateName(v); form.setValue('name', v, { shouldDirty: false }) }} disabled={isLoading}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Prompt auswählen..." />
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
        <Button type="button" variant="outline" size="sm" onClick={renameCurrentTemplate} disabled={!selectedTemplateName}>Umbenennen</Button>
        {selectedTemplateName && (
          <Button type="button" variant="destructive" size="sm" onClick={() => deleteTemplate(selectedTemplateName!)}>Löschen</Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Prompt Design</CardTitle>
            <CardDescription>
              Drei Bereiche: Aufgabe (was), Rollenanweisung (wie), Metadaten (Begleitinfos).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Template-Name Feld entfernt (oben verwaltet) */}

              {!selectedTemplateName ? (
                <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                  Bitte oben einen Prompt auswählen oder Neu anlegen.
                </div>
              ) : previewMode ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Prompt-Vorschau</h4>
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
                    yamlFrontmatter={form.watch('yamlFrontmatter')}
                    systemPrompt={form.watch('systemPrompt')}
                    magicMode={magicMode}
                    magicValues={{ body: magicBody, frontmatter: magicFrontmatter, system: magicSystem }}
                    onMagicChange={(next) => {
                      if (next.body !== undefined) setMagicBody(next.body)
                      if (next.frontmatter !== undefined) setMagicFrontmatter(next.frontmatter)
                      if (next.system !== undefined) setMagicSystem(next.system)
                    }}
                    onChange={({ markdownBody, yamlFrontmatter, systemPrompt }) => {
                      form.setValue('markdownBody', markdownBody, { shouldDirty: true })
                      form.setValue('yamlFrontmatter', yamlFrontmatter, { shouldDirty: true })
                      form.setValue('systemPrompt', systemPrompt, { shouldDirty: true })
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
                  disabled={!selectedTemplateName || isSaving || !form.formState.isDirty}
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

        <Card>
          <CardHeader>
            <CardTitle>Prompt testen</CardTitle>
            <CardDescription>
              Test mit Beispieltext. Nutzt Rollenanweisung, Aufgabe und Metadaten des Prompts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedTemplateName ? (
              <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                Bitte oben einen Prompt auswählen. Die Vorschau und Test‑Funktionen werden erst danach aktiviert.
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
                          Prompt testen
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
                          Prompt testen
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
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 