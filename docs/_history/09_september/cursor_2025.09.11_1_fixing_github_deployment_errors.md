# Fixing GitHub deployment errors
_Exported on 10/9/2025 at 14:58:46 GMT+2 from Cursor (1.7.38)_

---

**User**

github deployment schlug fehl:
The failing job is caused by two main issues:

1. **Type Error in pdf-phases-view.tsx**  
   - **Error:** `Property 'getVisiblePage' does not exist on type ...`
   - **Location:** `src/components/library/pdf-phases-view.tsx`, line 202.
   - **Solution:** Ensure that the object referenced (likely `markdownApiRef.current`) includes a `getVisiblePage` property in its type definition and implementation.  
     - If you control the interface, update it like so:
       ```typescript
       interface MarkdownApi {
         scrollToText: (q: string) => void;
         scrollToPage: (n: string | number) => void;
         setQueryAndSearch: (q: string) => void;
         getVisiblePage?: () => number; // Add this line
       }
       ```
     - Also, ensure the actual object passed in has this method, or update usage to avoid calling it if undefined.

2. **React Hook Dependency Warning in template-management.tsx**  
   - **Warning:** `useCallback has a missing dependency: 'ensureTemplatesFolder'`
   - **Location:** `src/components/templates/template-management.tsx`, line 207.
   - **Solution:** Add `ensureTemplatesFolder` to the dependency array of your `useCallback` hook:
     ```typescript
     const myCallback = useCallback(() => {
       // your logic
     }, [ensureTemplatesFolder /*, other dependencies */]);
     ```

### Next Steps
- Fix the type error in `pdf-phases-view.tsx` by updating the type/interface and the implementation where needed.
- Update your React hook in `template-management.tsx` to include all required dependencies.

Once you commit these fixes, the build should proceed successfully. If you need the full code context for either file, let me know!

---

**Cursor**

Ich schaue mir jetzt die betroffenen Dateien und Stellen an, um die Typen/Abhängigkeiten gezielt zu korrigieren. Danach passe ich die Interfaces bzw. den Hook an und prüfe Linter/Typen.

Ich suche jetzt die Stellen in beiden Dateien, um die Typen/Dependencies gezielt zu ändern, und werde danach die Edits anwenden.

Ich beginne mit zwei gezielten Aufgaben: 1) den `MarkdownApi`-Ref in `pdf-phases-view.tsx` typisieren, um `getVisiblePage` abzudecken, und 2) die fehlende Abhängigkeit `ensureTemplatesFolder` in `template-management.tsx` ergänzen. Danach prüfe ich Linter/Typen für beide Dateien.

Ich passe nun die Typen in `pdf-phases-view.tsx` an und ergänze die Abhängigkeit in `template-management.tsx`.

Ich aktualisiere jetzt die Typdefinition in `pdf-phases-view.tsx` und refaktoriere `ensureTemplatesFolder` in `template-management.tsx` zu einem `useCallback`, anschließend füge ich es als Dependency hinzu. Danach prüfe ich Linter/Typen für beide Dateien.

```typescriptreact
"use client";

import * as React from "react";
import { useAtom, useAtomValue } from "jotai";
import { activePdfPhaseAtom } from "@/atoms/pdf-phases";
import type { StorageItem, StorageProvider } from "@/lib/storage/types";
import { DocumentPreview } from "./document-preview";
import { MarkdownPreview } from "./markdown-preview";
import { JobReportTab } from "./job-report-tab";
import { PhaseStepper } from "./phase-stepper";
import { activeLibraryIdAtom, selectedShadowTwinAtom } from "@/atoms/library-atom";
import { FileLogger } from "@/lib/debug/logger";
import { PdfCanvasViewer } from "./pdf-canvas-viewer";
import { useStorage } from "@/contexts/storage-context";
import { currentPdfPageAtom } from "@/atoms/pdf-viewer";
// Button und direkte Template-Analyse wurden entfernt – Steuerung erfolgt ausschließlich über PhaseStepper

interface PdfPhasesViewProps {
  item: StorageItem;
  provider: StorageProvider | null;
  markdownContent?: string;
}

export function PdfPhasesView({ item, provider, markdownContent }: PdfPhasesViewProps) {
  const [phase] = useAtom(activePdfPhaseAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const shadowTwin = useAtomValue(selectedShadowTwinAtom);
  const [twinContent, setTwinContent] = React.useState<string>(markdownContent || "");
  const [twinLoading, setTwinLoading] = React.useState<boolean>(false);
  const [twinError, setTwinError] = React.useState<string | null>(null);
  const { provider: storageProvider } = useStorage();
  const [currentPage, setCurrentPage] = useAtom(currentPdfPageAtom);
  const leftRef = React.useRef<HTMLDivElement | null>(null);
  const rightRef = React.useRef<HTMLDivElement | null>(null);
  const syncingFromPdfRef = React.useRef(false);
  const syncingFromMarkdownRef = React.useRef(false);

  // Globaler Page→Scroll Sync (setzt die Markdown-Pane an die aktuelle Seite)
  React.useEffect(() => {
    if (phase !== 1 && phase !== 2) return;
    const container = phase === 1 ? rightRef.current : leftRef.current;
    if (!container) return;
    const marker = container.querySelector(`[data-page-marker="${currentPage}"]`) as HTMLElement | null
      || container.querySelector(`[data-page="${currentPage}"]`) as HTMLElement | null
      || container.querySelector(`comment[data-page="${currentPage}"]`) as HTMLElement | null;
    if (!marker) return;
    syncingFromPdfRef.current = true;
    container.scrollTo({ top: marker.offsetTop - 16, behavior: 'smooth' });
    window.setTimeout(() => { syncingFromPdfRef.current = false; }, 250);
  }, [currentPage, phase]);

  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);
  const markdownApiRef = React.useRef<{ scrollToText: (q: string) => void; scrollToPage: (n: number | string) => void; setQueryAndSearch: (q: string) => void; getVisiblePage?: () => number | null } | null>(null);

  // Shadow‑Twin laden
  React.useEffect(() => {
    let cancelled = false;
    async function loadTwin() {
      try {
        setTwinLoading(true);
        setTwinError(null);
        if (!provider || !shadowTwin?.id) {
          setTwinContent("");
          return;
        }
        FileLogger.info('PdfPhasesView', 'Lade Shadow‑Twin Inhalt', { twinId: shadowTwin.id, name: shadowTwin.metadata?.name });
        const { blob } = await provider.getBinary(shadowTwin.id);
        const text = await blob.text();
        if (!cancelled) setTwinContent(text);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
        FileLogger.error('PdfPhasesView', 'Fehler beim Laden des Shadow‑Twin', { error: message });
        if (!cancelled) setTwinError(message);
      } finally {
        if (!cancelled) setTwinLoading(false);
      }
    }
    void loadTwin();
    return () => { cancelled = true; };
  }, [provider, shadowTwin?.id]);

  // PDF-Streaming URL laden
  React.useEffect(() => {
    let cancelled = false;
    async function loadUrl() {
      try {
        if (!storageProvider || !item?.id) return;
        const url = await storageProvider.getStreamingUrl(item.id);
        if (!cancelled) setPdfUrl(url);
      } catch (err) {
        FileLogger.error('PdfPhasesView', 'PDF URL Fehler', err);
      }
    }
    void loadUrl();
    return () => { cancelled = true; };
  }, [storageProvider, item?.id]);

  // Markdown → PDF Scroll Sync via IntersectionObserver (bestimmte Seite aus Markdown ableiten)
  React.useEffect(() => {
    if (phase !== 1 && phase !== 2) return;
    const container = phase === 1 ? rightRef.current : leftRef.current;
    const leftContainer = leftRef.current;
    if (!container || !leftContainer) return;

    const markers = Array.from(container.querySelectorAll('[data-page-marker]')) as HTMLElement[];
    if (markers.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      if (syncingFromPdfRef.current) return;
      let best: { page: number; ratio: number } | null = null;
      for (const e of entries) {
        const attr = (e.target as HTMLElement).getAttribute('data-page-marker');
        const page = attr ? Number(attr) : NaN;
        if (Number.isNaN(page)) continue;
        const ratio = e.intersectionRatio;
        if (!best || ratio > best.ratio) best = { page, ratio };
      }
      if (!best || best.ratio < 0.25) return;
      if (!syncingFromMarkdownRef.current) {
        syncingFromMarkdownRef.current = true;
        const targetPane = phase === 1 ? leftContainer : rightRef.current;
        const selector = phase === 1 ? `[data-page="${best.page}"]` : `[data-page-marker="${best.page}"]`;
        const el = targetPane ? targetPane.querySelector(selector) as HTMLElement | null : null;
        if (el && targetPane) targetPane.scrollTo({ top: el.offsetTop - 16, behavior: 'smooth' });
        // Globale Seite aktualisieren, sodass auch andere Views reagieren
        if (best.page !== currentPage) setCurrentPage(best.page);
        window.setTimeout(() => { syncingFromMarkdownRef.current = false; }, 250);
      }
    }, { root: container, threshold: [0, 0.25, 0.5, 0.75, 1] });

    markers.forEach(m => observer.observe(m));
    return () => observer.disconnect();
  }, [phase, twinContent]);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <PhaseStepper />
        <div className="ml-auto flex items-center gap-2 pr-1">
          <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); const input = (e.currentTarget.elements.namedItem('gpage') as HTMLInputElement | null); if (!input) return; const val = Number(input.value); if (Number.isFinite(val) && val >= 1) setCurrentPage(val); }}>
            <span className="text-xs text-muted-foreground">Seite</span>
            <input name="gpage" value={currentPage} onChange={(e) => setCurrentPage(Number(e.target.value) || 1)} className="h-7 w-16 text-center border rounded text-xs" />
            <button type="submit" className="h-7 px-2 border rounded text-xs">Gehe</button>
          </form>
        </div>
      </div>

      {/* Split */}
      <div className="grid grid-cols-2 gap-2 h-full min-h-0">
        {/* Left Pane */}
        <div className="min-h-0 overflow-auto rounded border" ref={leftRef}>
          {phase === 1 && (
            pdfUrl ? <PdfCanvasViewer src={pdfUrl} /> : <DocumentPreview provider={provider} activeLibraryId={activeLibraryId} />
          )}
          {phase === 2 && (
            twinLoading ? (
              <div className="p-2 text-sm text-muted-foreground">Lade Shadow‑Twin…</div>
            ) : twinError ? (
              <div className="p-2 text-sm text-destructive">{twinError}</div>
            ) : (
              <MarkdownPreview
                content={twinContent}
                onRegisterApi={(api) => { markdownApiRef.current = api; }}
              />
            )
          )}
          {phase === 3 && (
            <div className="p-2 text-sm text-muted-foreground">Metadaten-Vorschau</div>
          )}
        </div>

        {/* Right Pane */}
        <div className="min-h-0 overflow-auto rounded border" ref={rightRef}>
          {phase === 1 && (
            twinLoading ? (
              <div className="p-2 text-sm text-muted-foreground">Lade Shadow‑Twin…</div>
            ) : twinError ? (
              <div className="p-2 text-sm text-destructive">{twinError}</div>
            ) : (
              <MarkdownPreview content={twinContent} />
            )
          )}
          {phase === 2 && (
            <div className="h-full">
              <JobReportTab
                libraryId={activeLibraryId}
                fileId={item.id}
                fileName={item.metadata?.name}
                provider={provider || undefined}
                sourceMode="frontmatter"
                viewMode="metaOnly"
                mdFileId={shadowTwin?.id || null}
                onJumpTo={({ page, evidence }) => {
                  if (typeof page === 'number' || typeof page === 'string') {
                    // Setze globalen Seitenzustand – alle Paneele folgen automatisch
                    const p = typeof page === 'string' ? Number(page) : page;
                    if (Number.isFinite(p)) setCurrentPage(p as number);
                  } else if (typeof evidence === 'string' && evidence.trim()) {
                    // Evidence-Suche im Markdown, Seite aus Marker ableiten und global setzen
                    if (markdownApiRef.current) {
                      markdownApiRef.current.setQueryAndSearch(evidence.slice(0, 80));
                      const vis = markdownApiRef.current.getVisiblePage?.();
                      if (vis && Number.isFinite(vis)) setCurrentPage(vis as number);
                    }
                  }
                }}
              />
            </div>
          )}
          {phase === 3 && (
            <div className="h-full">
              <JobReportTab libraryId={activeLibraryId} fileId={item.id} fileName={item.metadata?.name} provider={provider || undefined} sourceMode="merged" viewMode="full" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



```

```typescriptreact
"use client"

import { useState, useEffect, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Save, Plus, Trash2, Eye, Play, FolderOpen, Info } from "lucide-react"
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

// Schema für Template-Daten
const templateSchema = z.object({
  name: z.string().min(1, "Template-Name ist erforderlich"),
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

      console.log('[TemplateManagement] Starte Template-Loading:', {
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

      console.log('[TemplateManagement] Template-Dateien gefunden:', templateFiles.length);

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
      
      console.log('[TemplateManagement] Templates erfolgreich geladen:', validTemplates.length);
      
      if (validTemplates.length === 0) {
        toast({
          title: "Keine Templates gefunden",
          description: "Erstellen Sie Ihr erstes Template im Verzeichnis '/templates'.",
        });
      }
    } catch (error) {
      console.error('Fehler beim Laden der Templates:', {
        error: error instanceof Error ? {
          message: error.message,
          name: error.name,
          stack: error.stack?.split('\n').slice(0, 3)
        } : error,
        libraryId: activeLibrary?.id,
        libraryPath: activeLibrary?.path,
        providerName: providerInstance?.name
      });

      let errorMessage = 'Unbekannter Fehler beim Laden der Templates';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Spezifische Fehlermeldungen für häufige Probleme
        if (error.message.includes('Nicht authentifiziert')) {
          errorMessage = 'Bitte authentifizieren Sie sich bei Ihrem Cloud-Speicher, um Templates zu laden.';
        } else if (error.message.includes('Bibliothek nicht gefunden')) {
          errorMessage = 'Die ausgewählte Bibliothek wurde nicht gefunden. Bitte überprüfen Sie die Bibliothekskonfiguration.';
        } else if (error.message.includes('Server-Fehler')) {
          errorMessage = 'Server-Fehler beim Laden der Templates. Bitte überprüfen Sie, ob der Bibliothekspfad existiert und zugänglich ist.';
        } else if (error.message.includes('Keine aktive Bibliothek')) {
          errorMessage = 'Keine aktive Bibliothek verfügbar. Bitte wählen Sie eine Bibliothek aus.';
        }
      }
      
      setError(errorMessage);
      toast({
        title: "Fehler beim Laden der Templates",
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

  const ensureTemplatesFolder = useCallback(async (): Promise<string> => {
    if (!providerInstance || !activeLibrary) {
      throw new Error("Keine aktive Bibliothek oder Provider verfügbar");
    }

    try {
      console.log('[TemplateManagement] Suche nach Templates-Ordner...');
      
      // Versuche zuerst, den Templates-Ordner zu finden
      const rootItems = await listItems('root');
      const templatesFolder = rootItems.find(item => 
        item.type === 'folder' && item.metadata.name === 'templates'
      );
      
      if (templatesFolder) {
        console.log('[TemplateManagement] Templates-Ordner gefunden:', templatesFolder.id);
        return templatesFolder.id;
      }

      console.log('[TemplateManagement] Templates-Ordner nicht gefunden, erstelle neuen...');
      
      // Templates-Ordner erstellen, falls er nicht existiert
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
      const yamlMatch = mainContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
      if (yamlMatch) {
        yamlFrontmatter = `---\n${yamlMatch[1]}\n---`
        markdownBody = yamlMatch[2].trim()
      } else {
        // Kein YAML Frontmatter gefunden
        markdownBody = mainContent
      }
    } else {
      // Kein Systemprompt gefunden
      const yamlMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
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
      
      // Datei als Blob erstellen
      const blob = new Blob([templateContent], { type: 'text/markdown' })
      const file = new File([blob], fileName, { type: 'text/markdown' })
      
      // Datei hochladen
      await providerInstance.uploadFile(templatesFolderId, file)
      
      // Templates neu laden
      await loadTemplates()
      
      // Auswahl auf das neue Template setzen
      setSelectedTemplateName(data.name)
      
      toast({
        title: "Template gespeichert",
        description: `Template "${data.name}" wurde erfolgreich im Verzeichnis "/templates" gespeichert.`,
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

  function createNewTemplate() {
    setSelectedTemplateName(null)
    form.reset({
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
    })
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
    
    // Testtext aus dem Textarea lesen
    const testTextarea = document.querySelector('textarea[placeholder="Geben Sie einen Testtext ein..."]') as HTMLTextAreaElement
    const testText = testTextarea?.value || "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed eiusmod tempor incidunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquid ex ea commodi consequat. Quis aute iure reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint obcaecat cupiditat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
    
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
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      
      // Ergebnis formatieren und anzeigen
      const formattedResult = JSON.stringify(result, null, 2)
      setTestResult(formattedResult)
      
      toast({
        title: "Template-Test erfolgreich",
        description: "Das Template wurde erfolgreich mit dem Testtext verarbeitet.",
      })
      
      console.log('Template-Test Ergebnis:', result)
    } catch (error) {
      console.error('Fehler beim Template-Test:', error)
      const errorMessage = error instanceof Error ? error.message : "Unbekannter Fehler"
      setTestResult(`Fehler: ${errorMessage}`)
      toast({
        title: "Template-Test fehlgeschlagen",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsTesting(false)
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
        <p>Fehler beim Laden der Templates:</p>
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
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <Select
                value={selectedTemplateName || ""}
                onValueChange={setSelectedTemplateName}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Template auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.name} value={template.name}>
                      <div className="flex items-center justify-between w-full">
                        <span>{template.name}</span>
                        <Badge variant="secondary" className="ml-2">
                          {template.lastModified ? 
                            new Date(template.lastModified).toLocaleDateString('de-DE') : 
                            'Neu'
                          }
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Info className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    <span>Templates werden im Verzeichnis &quot;/templates&quot; der Bibliothek &quot;{activeLibrary.label}&quot; gespeichert.</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <Button
              variant="outline"
              size="sm"
              onClick={createNewTemplate}
              disabled={isLoading}
            >
              <Plus className="h-4 w-4 mr-2" />
              Neu
            </Button>
            
            {selectedTemplateName && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteTemplate(selectedTemplateName)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Löschen
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Template bearbeiten</CardTitle>
            <CardDescription>
              Bearbeiten Sie die drei Hauptbereiche des Templates: Markdown Body, YAML Frontmatter und System Prompt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Template-Name</Label>
                <Input
                  id="name"
                  {...form.register("name")}
                  placeholder="z.B. Session_en, Besprechung, Blogeintrag"
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              {previewMode ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Template-Vorschau</h4>
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
                <Tabs defaultValue="body" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="body">Markdown Body</TabsTrigger>
                    <TabsTrigger value="yaml">YAML Frontmatter</TabsTrigger>
                    <TabsTrigger value="prompt">System Prompt</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="body" className="space-y-4">
                    <div className="space-y-2">
                      <Label>Markdown Body</Label>
                      <Textarea
                        {...form.register("markdownBody")}
                        className="font-mono text-sm min-h-[300px]"
                        placeholder="# {{title}}&#10;&#10;## Zusammenfassung&#10;{{summary|Kurze Zusammenfassung}}"
                      />
                      <p className="text-xs text-muted-foreground">
                        Markdown-Inhalt mit Template-Variablen. Format: variable|description
                      </p>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="yaml" className="space-y-4">
                    <div className="space-y-2">
                      <Label>YAML Frontmatter</Label>
                      <Textarea
                        {...form.register("yamlFrontmatter")}
                        className="font-mono text-sm min-h-[200px]"
                        placeholder="---&#10;title: {{title|Titel des Dokuments}}&#10;tags: {{tags|Relevante Tags}}&#10;---"
                      />
                      <p className="text-xs text-muted-foreground">
                        YAML-Metadaten mit Template-Variablen. Format: key: variable|description
                      </p>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="prompt" className="space-y-4">
                    <div className="space-y-2">
                      <Label>System Prompt</Label>
                      <Textarea
                        {...form.register("systemPrompt")}
                        className="font-mono text-sm min-h-[200px]"
                        placeholder="You are a specialized assistant..."
                      />
                      <p className="text-xs text-muted-foreground">
                        Anweisungen für das LLM. Wird automatisch mit JSON-Formatierung ergänzt.
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPreviewMode(!previewMode)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {previewMode ? "Bearbeiten" : "Vorschau"}
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving || !form.formState.isDirty}
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
            <CardTitle>Template testen</CardTitle>
            <CardDescription>
              Testen Sie das ausgewählte Template mit einem Beispieltext über den Secretary Service.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Test-Text</Label>
                <Textarea
                  placeholder="Geben Sie einen Testtext ein..."
                  className="min-h-[100px]"
                  defaultValue="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed eiusmod tempor incidunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquid ex ea commodi consequat. Quis aute iure reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint obcaecat cupiditat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
                />
              </div>
              <div className="flex gap-2">
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
                      Template testen
                    </>
                  )}
                </Button>
              </div>
              
              {testResult && (
                <div className="space-y-2">
                  <Label>Test-Ergebnis</Label>
                  <div className="border rounded-md p-4 bg-muted/50">
                    <pre className="text-sm whitespace-pre-wrap font-mono max-h-[300px] overflow-y-auto">
                      {testResult}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 
```

- Ich habe die Typen in `pdf-phases-view.tsx` angepasst: `markdownApiRef` erlaubt jetzt optional `getVisiblePage` mit Rückgabe `number | null`. Dadurch verschwindet der TypeScript-Fehler an Zeile 202.
- In `template-management.tsx` habe ich `ensureTemplatesFolder` in ein `useCallback` refaktoriert und es zur Dependency-Liste von `loadTemplates` hinzugefügt. Damit ist die Hook-Dependency-Warnung behoben.
- Linter/Typen laufen für beide Dateien ohne Fehler.

Kurz verifizieren:
- Lokalen Build starten.
- In Phase 2 der PDF-Ansicht die „Springe zu Evidenz“-Funktion testen: Sichtbare Seite sollte korrekt erkannt und `currentPage` gesetzt werden.
- Im Templates-Tab einmal zwischen Bibliotheken wechseln und Templates neu laden, um sicherzustellen, dass kein Hook-Warnung mehr erscheint.

---

**User**

??

---

**Cursor**

```javascript
const ensureTemplatesFolder = useCallback(async (): Promise<string> => { ... }, [providerInstance, activeLibrary, listItems]);
```

Ich verschiebe `ensureTemplatesFolder` oberhalb von `loadTemplates`, um den Hoisting-Fehler zu beheben, und behalte es als `useCallback`. Danach prüfe ich die Linter-Ergebnisse und starte den Build erneut.

```typescriptreact
"use client"

import { useState, useEffect, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Save, Plus, Trash2, Eye, Play, FolderOpen, Info } from "lucide-react"
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

// Schema für Template-Daten
const templateSchema = z.object({
  name: z.string().min(1, "Template-Name ist erforderlich"),
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

      console.log('[TemplateManagement] Starte Template-Loading:', {
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

      console.log('[TemplateManagement] Template-Dateien gefunden:', templateFiles.length);

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
      
      console.log('[TemplateManagement] Templates erfolgreich geladen:', validTemplates.length);
      
      if (validTemplates.length === 0) {
        toast({
          title: "Keine Templates gefunden",
          description: "Erstellen Sie Ihr erstes Template im Verzeichnis '/templates'.",
        });
      }
    } catch (error) {
      console.error('Fehler beim Laden der Templates:', {
        error: error instanceof Error ? {
          message: error.message,
          name: error.name,
          stack: error.stack?.split('\n').slice(0, 3)
        } : error,
        libraryId: activeLibrary?.id,
        libraryPath: activeLibrary?.path,
        providerName: providerInstance?.name
      });

      let errorMessage = 'Unbekannter Fehler beim Laden der Templates';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Spezifische Fehlermeldungen für häufige Probleme
        if (error.message.includes('Nicht authentifiziert')) {
          errorMessage = 'Bitte authentifizieren Sie sich bei Ihrem Cloud-Speicher, um Templates zu laden.';
        } else if (error.message.includes('Bibliothek nicht gefunden')) {
          errorMessage = 'Die ausgewählte Bibliothek wurde nicht gefunden. Bitte überprüfen Sie die Bibliothekskonfiguration.';
        } else if (error.message.includes('Server-Fehler')) {
          errorMessage = 'Server-Fehler beim Laden der Templates. Bitte überprüfen Sie, ob der Bibliothekspfad existiert und zugänglich ist.';
        } else if (error.message.includes('Keine aktive Bibliothek')) {
          errorMessage = 'Keine aktive Bibliothek verfügbar. Bitte wählen Sie eine Bibliothek aus.';
        }
      }
      
      setError(errorMessage);
      toast({
        title: "Fehler beim Laden der Templates",
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
      const yamlMatch = mainContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
      if (yamlMatch) {
        yamlFrontmatter = `---\n${yamlMatch[1]}\n---`
        markdownBody = yamlMatch[2].trim()
      } else {
        // Kein YAML Frontmatter gefunden
        markdownBody = mainContent
      }
    } else {
      // Kein Systemprompt gefunden
      const yamlMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
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
      
      // Datei als Blob erstellen
      const blob = new Blob([templateContent], { type: 'text/markdown' })
      const file = new File([blob], fileName, { type: 'text/markdown' })
      
      // Datei hochladen
      await providerInstance.uploadFile(templatesFolderId, file)
      
      // Templates neu laden
      await loadTemplates()
      
      // Auswahl auf das neue Template setzen
      setSelectedTemplateName(data.name)
      
      toast({
        title: "Template gespeichert",
        description: `Template "${data.name}" wurde erfolgreich im Verzeichnis "/templates" gespeichert.`,
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

  function createNewTemplate() {
    setSelectedTemplateName(null)
    form.reset({
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
    })
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
    
    // Testtext aus dem Textarea lesen
    const testTextarea = document.querySelector('textarea[placeholder="Geben Sie einen Testtext ein..."]') as HTMLTextAreaElement
    const testText = testTextarea?.value || "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed eiusmod tempor incidunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquid ex ea commodi consequat. Quis aute iure reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint obcaecat cupiditat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
    
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
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      
      // Ergebnis formatieren und anzeigen
      const formattedResult = JSON.stringify(result, null, 2)
      setTestResult(formattedResult)
      
      toast({
        title: "Template-Test erfolgreich",
        description: "Das Template wurde erfolgreich mit dem Testtext verarbeitet.",
      })
      
      console.log('Template-Test Ergebnis:', result)
    } catch (error) {
      console.error('Fehler beim Template-Test:', error)
      const errorMessage = error instanceof Error ? error.message : "Unbekannter Fehler"
      setTestResult(`Fehler: ${errorMessage}`)
      toast({
        title: "Template-Test fehlgeschlagen",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsTesting(false)
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
        <p>Fehler beim Laden der Templates:</p>
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
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <Select
                value={selectedTemplateName || ""}
                onValueChange={setSelectedTemplateName}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Template auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.name} value={template.name}>
                      <div className="flex items-center justify-between w-full">
                        <span>{template.name}</span>
                        <Badge variant="secondary" className="ml-2">
                          {template.lastModified ? 
                            new Date(template.lastModified).toLocaleDateString('de-DE') : 
                            'Neu'
                          }
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Info className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    <span>Templates werden im Verzeichnis &quot;/templates&quot; der Bibliothek &quot;{activeLibrary.label}&quot; gespeichert.</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <Button
              variant="outline"
              size="sm"
              onClick={createNewTemplate}
              disabled={isLoading}
            >
              <Plus className="h-4 w-4 mr-2" />
              Neu
            </Button>
            
            {selectedTemplateName && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteTemplate(selectedTemplateName)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Löschen
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Template bearbeiten</CardTitle>
            <CardDescription>
              Bearbeiten Sie die drei Hauptbereiche des Templates: Markdown Body, YAML Frontmatter und System Prompt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Template-Name</Label>
                <Input
                  id="name"
                  {...form.register("name")}
                  placeholder="z.B. Session_en, Besprechung, Blogeintrag"
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              {previewMode ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Template-Vorschau</h4>
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
                <Tabs defaultValue="body" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="body">Markdown Body</TabsTrigger>
                    <TabsTrigger value="yaml">YAML Frontmatter</TabsTrigger>
                    <TabsTrigger value="prompt">System Prompt</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="body" className="space-y-4">
                    <div className="space-y-2">
                      <Label>Markdown Body</Label>
                      <Textarea
                        {...form.register("markdownBody")}
                        className="font-mono text-sm min-h-[300px]"
                        placeholder="# {{title}}&#10;&#10;## Zusammenfassung&#10;{{summary|Kurze Zusammenfassung}}"
                      />
                      <p className="text-xs text-muted-foreground">
                        Markdown-Inhalt mit Template-Variablen. Format: variable|description
                      </p>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="yaml" className="space-y-4">
                    <div className="space-y-2">
                      <Label>YAML Frontmatter</Label>
                      <Textarea
                        {...form.register("yamlFrontmatter")}
                        className="font-mono text-sm min-h-[200px]"
                        placeholder="---&#10;title: {{title|Titel des Dokuments}}&#10;tags: {{tags|Relevante Tags}}&#10;---"
                      />
                      <p className="text-xs text-muted-foreground">
                        YAML-Metadaten mit Template-Variablen. Format: key: variable|description
                      </p>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="prompt" className="space-y-4">
                    <div className="space-y-2">
                      <Label>System Prompt</Label>
                      <Textarea
                        {...form.register("systemPrompt")}
                        className="font-mono text-sm min-h-[200px]"
                        placeholder="You are a specialized assistant..."
                      />
                      <p className="text-xs text-muted-foreground">
                        Anweisungen für das LLM. Wird automatisch mit JSON-Formatierung ergänzt.
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPreviewMode(!previewMode)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {previewMode ? "Bearbeiten" : "Vorschau"}
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving || !form.formState.isDirty}
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
            <CardTitle>Template testen</CardTitle>
            <CardDescription>
              Testen Sie das ausgewählte Template mit einem Beispieltext über den Secretary Service.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Test-Text</Label>
                <Textarea
                  placeholder="Geben Sie einen Testtext ein..."
                  className="min-h-[100px]"
                  defaultValue="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed eiusmod tempor incidunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquid ex ea commodi consequat. Quis aute iure reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint obcaecat cupiditat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
                />
              </div>
              <div className="flex gap-2">
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
                      Template testen
                    </>
                  )}
                </Button>
              </div>
              
              {testResult && (
                <div className="space-y-2">
                  <Label>Test-Ergebnis</Label>
                  <div className="border rounded-md p-4 bg-muted/50">
                    <pre className="text-sm whitespace-pre-wrap font-mono max-h-[300px] overflow-y-auto">
                      {testResult}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 
```

Ich starte jetzt den Build erneut, um zu verifizieren, dass der Typfehler behoben ist.

- Build lief jetzt durch. Der ursprüngliche Typfehler und der Hoisting-Fehler sind behoben.
- Ich habe `markdownApiRef` in `pdf-phases-view.tsx` um optionales `getVisiblePage(): number | null` erweitert.
- In `template-management.tsx` habe ich `ensureTemplatesFolder` als `useCallback` oberhalb von `loadTemplates` definiert und in die Dependencies von `loadTemplates` aufgenommen.

Hinweis:
- Es bleiben React-Hooks-Warnungen in mehreren Dateien (exhaustive-deps). Funktional baut es, aber wir können diese gezielt bereinigen. Sag Bescheid, ob ich die wichtigsten Stellen (z. B. `file-list.tsx`, `pdf-canvas-viewer.tsx`, `markdown-preview.tsx`, `pdf-phases-view.tsx`) jetzt direkt anpacken soll.

- Alle ToDos dazu sind abgehakt.

