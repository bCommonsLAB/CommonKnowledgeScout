"use client";

import * as React from 'react'
// Button nicht mehr benötigt
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  GripVertical, Plus, Minus, Trash2, Mic, Link as LinkIcon, FileText, Upload, ChevronRight, Settings, Eye, EyeOff,
  Calendar, MessageSquare, Briefcase, BookOpen, Presentation, Users, Building2, Code2, Leaf, Globe, GraduationCap,
  Lightbulb, Library, Zap, Heart, Star, Target, Video, Image, File, Folder, Link
} from 'lucide-react'
import { Button } from '@/components/ui/button'
// removed Select imports after removing Typ-Spalte
import { MarkdownPreview } from '@/components/library/markdown-preview'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import type { TemplateCreationConfig, TemplateMetadataSchema, TemplateMetadataField } from '@/lib/templates/template-types'
import { buildCreationFileName } from '@/lib/creation/file-name'
import { injectCreationIntoFrontmatter } from '@/lib/templates/template-frontmatter-utils'
// Input entfällt nach UI-Verschlankung

export interface StructuredTemplateEditorProps {
  markdownBody: string
  metadata: TemplateMetadataSchema
  systemprompt: string
  creation?: TemplateCreationConfig | null
  onChange: (next: { markdownBody: string; metadata: TemplateMetadataSchema; systemprompt: string; creation?: TemplateCreationConfig | null }) => void
  magicMode?: boolean
  magicValues?: { body: string; frontmatter: string; system: string }
  onMagicChange?: (next: { body?: string; frontmatter?: string; system?: string }) => void
}

// LineKind nicht mehr verwendet

export function StructuredTemplateEditor({ markdownBody, metadata, systemprompt, creation, onChange, magicMode, magicValues, onMagicChange }: StructuredTemplateEditorProps) {
  const lines = React.useMemo(() => (typeof markdownBody === 'string' ? markdownBody.split('\n') : []), [markdownBody])
  const [sysPrompt, setSysPrompt] = React.useState(systemprompt)
  const [tab, setTab] = React.useState<'body'|'frontmatter'|'system'|'creation'>('body')
  const [sysEditing, setSysEditing] = React.useState(false)

  React.useEffect(() => { setSysPrompt(systemprompt) }, [systemprompt])

  // Logische Zeilen: unterstützen Mehrzeilige Variable-Blöcke {{key|...}} ... }}
  interface BodyRow { hasVariable: boolean; varKey: string; content: string; start: number; end: number; pre: string; post: string }

  const parseBodyToRows = React.useCallback((raw: string): BodyRow[] => {
    const src = typeof raw === 'string' ? raw.split('\n') : []
    const rows: BodyRow[] = []
    let i = 0
    while (i < src.length) {
      const line = src[i]
      // Suche nach Beginn eines Tokens irgendwo in der Zeile
      const startRe = /\{\{([^}|]+)\|/g
      const m = startRe.exec(line)
      if (m) {
        const varKey = (m[1] || '').trim()
        const pre = line.slice(0, m.index)
        const afterStart = line.slice(m.index + m[0].length)
        // Prüfe, ob Abschluss in derselben Zeile ist
        const closeIdx = afterStart.indexOf('}}')
        if (closeIdx >= 0) {
          const content = afterStart.slice(0, closeIdx)
          const post = afterStart.slice(closeIdx + 2)
          rows.push({ hasVariable: true, varKey, content, pre, post, start: i, end: i })
          i += 1
          continue
        }
        // Mehrzeilig bis '}}'
        let content = afterStart
        let j = i + 1
        let endFound = false
        while (j < src.length) {
          const l = src[j]
          const ci = l.indexOf('}}')
          if (ci >= 0) {
            content += `\n${l.slice(0, ci)}`
            const post = l.slice(ci + 2)
            rows.push({ hasVariable: true, varKey, content, pre, post, start: i, end: j })
            i = j + 1
            endFound = true
            break
          }
          content += `\n${l}`
          j += 1
        }
        if (!endFound) {
          // Kein Abschluss gefunden, behandle als reine Zeile
          rows.push({ hasVariable: false, varKey: '', content: line, pre: '', post: '', start: i, end: i })
          i += 1
        }
        continue
      }
      // Keine Variable, ganze Zeile als Content
      rows.push({ hasVariable: false, varKey: '', content: line, pre: '', post: '', start: i, end: i })
      i += 1
    }
    return rows
  }, [])

  const rows = React.useMemo(() => parseBodyToRows(markdownBody || ''), [markdownBody, parseBodyToRows])

  function replaceRange(start: number, end: number, replacement: string) {
    const before = lines.slice(0, start)
    const repl = (replacement ?? '').split('\n')
    const after = lines.slice(end + 1)
    const next = before.concat(repl).concat(after)
    onChange({ markdownBody: next.join('\n'), metadata, systemprompt: sysPrompt, creation })
  }

  function buildVariable(pre: string, varKey: string, content: string, post: string): string {
    const text = content ?? ''
    const key = (varKey || '').trim()
    const token = key ? `{{${key}|${text}}}` : text
    return `${pre}${token}${post}`
  }

  // Zeilenbasierte Platzhalter-Erkennung (nur die betrachtete Zeile)
  // parseLine, buildLine, updateLineByIndex werden nicht mehr verwendet; bewusst entfernt

  

  

  function suggestVarKey(index: number, content: string): string {
    const base = (content || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    const trimmed = base.length >= 3 ? base.slice(0, 24) : ''
    return trimmed || `var_${index + 1}`
  }

  // kein Format mehr

  // updateRowVarKey wird aktuell nicht verwendet

  function updateRowContent(rowIndex: number, nextContent: string) {
    const row = rows[rowIndex]
    if (!row) return
    if (row.hasVariable) {
      replaceRange(row.start, row.end, buildVariable(row.pre, row.varKey, nextContent, row.post))
    } else {
      replaceRange(row.start, row.end, nextContent)
    }
  }

  function addVariableToRow(rowIndex: number) {
    const row = rows[rowIndex]
    if (!row || row.hasVariable) return
    const key = suggestVarKey(row.start, row.content)
    // Füge Token an den Anfang der Zeile ein
    replaceRange(row.start, row.end, buildVariable('', key, row.content, ''))
  }

  function removeVariableFromRow(rowIndex: number) {
    const row = rows[rowIndex]
    if (!row || !row.hasVariable) return
    replaceRange(row.start, row.end, `${row.pre}${row.content}${row.post}`)
  }

  function moveRow(fromRowIndex: number, toRowIndex: number) {
    if (fromRowIndex === toRowIndex) return
    const from = rows[fromRowIndex]
    const to = rows[toRowIndex]
    if (!from || !to) return
    const blockLen = from.end - from.start + 1
    const segment = lines.slice(from.start, from.end + 1)
    const without = lines.slice(0, from.start).concat(lines.slice(from.end + 1))
    // Zielindex im ohne-Array bestimmen
    const insertAt = from.start < to.start ? Math.max(0, to.start - blockLen) : to.start
    const next = without.slice(0, insertAt).concat(segment).concat(without.slice(insertAt))
    onChange({ markdownBody: next.join('\n'), metadata, systemprompt: sysPrompt, creation })
  }

  // Drag & Drop für Zeilenreihenfolge
  function handleDragStart(e: React.DragEvent, fromRowIndex: number) {
    e.dataTransfer.setData('text/plain', String(fromRowIndex))
    e.dataTransfer.effectAllowed = 'move'
  }
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }
  function handleDrop(e: React.DragEvent, toRowIndex: number) {
    e.preventDefault()
    const fromStr = e.dataTransfer.getData('text/plain')
    const fromRowIndex = Number.isInteger(Number(fromStr)) ? parseInt(fromStr, 10) : -1
    if (fromRowIndex < 0 || fromRowIndex === toRowIndex) return
    moveRow(fromRowIndex, toRowIndex)
  }

  function addLineAfter(index: number) {
    const arr = lines.slice()
    arr.splice(index + 1, 0, '')
    onChange({ markdownBody: arr.join('\n'), metadata, systemprompt: sysPrompt, creation })
  }

  function deleteRow(rowIndex: number) {
    const row = rows[rowIndex]
    if (!row) return
    const next = lines.slice(0, row.start).concat(lines.slice(row.end + 1))
    onChange({ markdownBody: next.join('\n'), metadata, systemprompt: sysPrompt, creation })
  }

  const updateFrontmatterQuestion = (entryKey: string, question: string) => {
    const fieldIndex = metadata.fields.findIndex(f => f.key === entryKey)
    if (fieldIndex >= 0) {
      const field = metadata.fields[fieldIndex]
      const updatedFields = [...metadata.fields]
      // Variable ist immer gleich dem Key
      updatedFields[fieldIndex] = {
        ...field,
        description: question,
        variable: field.key, // Stelle sicher, dass Variable = Key
        rawValue: `{{${field.key}|${question}}}`
      }
      const updatedMetadata: TemplateMetadataSchema = {
        ...metadata,
        fields: updatedFields,
        rawFrontmatter: buildFrontmatterFromFields(updatedFields, metadata.rawFrontmatter)
      }
      onChange({ markdownBody, metadata: updatedMetadata, systemprompt: sysPrompt, creation })
    }
  }

  const addMetadataField = () => {
    const newKey = `field_${Date.now()}`
    const newField: TemplateMetadataField = {
      key: newKey,
      variable: newKey,
      description: '',
      rawValue: `{{${newKey}|}}`
    }
    const updatedFields = [...metadata.fields, newField]
    const updatedMetadata: TemplateMetadataSchema = {
      ...metadata,
      fields: updatedFields,
      rawFrontmatter: buildFrontmatterFromFields(updatedFields, metadata.rawFrontmatter)
    }
    onChange({ markdownBody, metadata: updatedMetadata, systemprompt: sysPrompt, creation })
  }

  const removeMetadataField = (entryKey: string) => {
    const updatedFields = metadata.fields.filter(f => f.key !== entryKey)
    const updatedMetadata: TemplateMetadataSchema = {
      ...metadata,
      fields: updatedFields,
      rawFrontmatter: buildFrontmatterFromFields(updatedFields, metadata.rawFrontmatter)
    }
    onChange({ markdownBody, metadata: updatedMetadata, systemprompt: sysPrompt, creation })
  }

  const updateMetadataFieldKey = (oldKey: string, newKey: string) => {
    if (!newKey.trim() || newKey === oldKey) return
    
    // Prüfe, ob der neue Key bereits existiert
    if (metadata.fields.some(f => f.key === newKey && f.key !== oldKey)) {
      // Key existiert bereits - nicht ändern
      return
    }
    
    const fieldIndex = metadata.fields.findIndex(f => f.key === oldKey)
    if (fieldIndex >= 0) {
      const field = metadata.fields[fieldIndex]
      const updatedFields = [...metadata.fields]
      const description = field.description || ''
      // Variable ist immer gleich dem Key
      updatedFields[fieldIndex] = {
        ...field,
        key: newKey,
        variable: newKey, // Variable immer gleich Key
        rawValue: `{{${newKey}|${description}}}`
      }
      const updatedMetadata: TemplateMetadataSchema = {
        ...metadata,
        fields: updatedFields,
        rawFrontmatter: buildFrontmatterFromFields(updatedFields, metadata.rawFrontmatter)
      }
      onChange({ markdownBody, metadata: updatedMetadata, systemprompt: sysPrompt, creation })
    }
  }

  /**
   * Baut Frontmatter-String aus Feldern neu auf
   * Behält den creation-Block aus dem bestehenden Frontmatter bei
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function buildFrontmatterFromFields(fields: TemplateMetadataField[], _existingFrontmatter: string): string {
    // Baue neue Frontmatter-Zeilen aus Feldern
    const frontmatterLines: string[] = []
    for (const field of fields) {
      frontmatterLines.push(`${field.key}: ${field.rawValue || `{{${field.variable}|${field.description}}}`}`)
    }
    
    // Erstelle neues Frontmatter ohne creation-Block
    let frontmatter = `---\n${frontmatterLines.join('\n')}\n---`
    
    // Füge creation-Block wieder hinzu, falls vorhanden
    // Verwende injectCreationIntoFrontmatter, um sicherzustellen, dass der Block korrekt eingefügt wird
    if (creation) {
      frontmatter = injectCreationIntoFrontmatter(frontmatter, creation)
    }
    
    return frontmatter
  }

  const handleSysPromptChange = (v: string) => {
    setSysPrompt(v)
    onChange({ markdownBody, metadata, systemprompt: v, creation })
  }

  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="frontmatter">Metadaten</TabsTrigger>
          <TabsTrigger value="system">Rollenanweisung</TabsTrigger>
          <TabsTrigger value="body">Struktur</TabsTrigger>
          <TabsTrigger value="creation">Creation Flow</TabsTrigger>
        </TabsList>

        <TabsContent value="body">
          <div className="mb-2 text-xs text-muted-foreground">
            Hier legst du fest, wie der fertige Text aufgebaut ist – also Abschnitte, Reihenfolge und Formulierungen.
          </div>
          {magicMode ? (
            <div className="mb-3 space-y-1">
              <Label>Änderungswunsch (Struktur)</Label>
              <Textarea
                value={magicValues?.body ?? ''}
                onChange={(e) => onMagicChange?.({ body: e.target.value })}
                placeholder="Was möchtest du hier ändern?"
                className="w-full min-h-[90px] bg-pink-50 dark:bg-pink-950/20 border-pink-300"
              />
            </div>
          ) : null}
          <div className="overflow-auto">
            <Table className="text-[11px] w-full border-collapse">
              <TableHeader>
                <TableRow className="[&>*]:py-1">
                  <TableHead className="w-10 px-1" />
                  <TableHead className="px-1">Text / Frage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.length === 0 ? (
                  <TableRow><TableCell colSpan={2} className="text-muted-foreground">Keine Zeilen im Body.</TableCell></TableRow>
                ) : rows.map((row, i) => {
                  return (
                    <TableRow key={`line-${i}`} className="align-top" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, row.start)}>
                      <TableCell className="align-top w-10 py-1 px-1">
                        <div className="flex items-center gap-1">
                          <span
                            draggable
                            onDragStart={(e) => handleDragStart(e, row.start)}
                            className="inline-flex h-4 w-4 items-center justify-center text-muted-foreground cursor-grab hover:text-foreground"
                            title="Ziehen zum Verschieben"
                            aria-label="Ziehen zum Verschieben"
                          >
                            <GripVertical className="h-3 w-3" />
                          </span>
                          <button
                            type="button"
                            className="inline-flex h-4 w-4 items-center justify-center text-muted-foreground hover:text-foreground"
                            title="Zeile darunter einfügen"
                            aria-label="Zeile darunter einfügen"
                            onClick={() => addLineAfter(row.end)}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-4 w-4 items-center justify-center text-muted-foreground hover:text-destructive"
                            title="Zeile löschen"
                            aria-label="Zeile löschen"
                            onClick={() => deleteRow(i)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="align-top py-1 px-1">
                        <RowHeader
                          hasVariable={row.hasVariable}
                          varKey={row.varKey}
                          onAdd={() => addVariableToRow(i)}
                          onRemove={() => removeVariableFromRow(i)}
                        />
                        <InlineMarkdownCell
                          displayValue={row.hasVariable ? `${row.pre}${row.content}${row.post}` : row.content}
                          editValue={row.content}
                          onChange={(val) => updateRowContent(i, val)}
                          placeholder={row.hasVariable ? 'Frage/Beschreibung (Markdown)' : 'Markdown-Text'}
                          compact
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="frontmatter">
          <div className="mb-2 text-xs text-muted-foreground">
            Hier bestimmst du, welche Felder es gibt (z.&nbsp;B. Titel, Datum, Tags) und wie sie beschrieben sind.
          </div>
          {magicMode ? (
            <div className="mb-3 space-y-1">
              <Label>Änderungswunsch (Metadaten)</Label>
              <Textarea
                value={magicValues?.frontmatter ?? ''}
                onChange={(e) => onMagicChange?.({ frontmatter: e.target.value })}
                placeholder="Was möchtest du hier ändern?"
                className="w-full min-h-[90px] bg-pink-50 dark:bg-pink-950/20 border-pink-300"
              />
            </div>
          ) : null}
          <div className="mb-2 flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addMetadataField}
            >
              <Plus className="w-4 h-4 mr-2" />
              Feld hinzufügen
            </Button>
          </div>
          <div className="max-h-[50vh] overflow-auto rounded border">
            <table className="w-full text-[11px] border-collapse">
              <thead className="sticky top-0 bg-background">
                <tr>
                  <th className="w-40 text-left px-2 py-1">Feld</th>
                  <th className="text-left px-2 py-1">Hinweis</th>
                  <th className="w-10 px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {metadata.fields.length === 0 ? (
                  <tr><td colSpan={3} className="px-2 py-1 text-muted-foreground">Keine Felder im Frontmatter.</td></tr>
                ) : metadata.fields.map((field, i) => {
                  return (
                    <tr key={`${field.key}-${i}`} className="align-top">
                      <td className="px-2 py-1 align-top">
                        <InlineEditableCell
                          value={field.key}
                          onChange={(val) => updateMetadataFieldKey(field.key, val)}
                          placeholder="Feldname"
                          className="font-mono"
                        />
                      </td>
                      <td className="px-2 py-1 align-top">
                        <InlineEditableCell
                          value={field.description}
                          onChange={(val) => updateFrontmatterQuestion(field.key, val)}
                          placeholder="Klicken zum Bearbeiten"
                        />
                      </td>
                      <td className="px-2 py-1 align-top">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMetadataField(field.key)}
                          className="h-6 w-6 p-0"
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="system">
          <div className="mb-2 text-xs text-muted-foreground">
            Hier definierst du, in welcher Rolle und Tonalität das Modell schreiben soll.
          </div>
          {magicMode ? (
            <div className="mb-3 space-y-1">
              <Label>Änderungswunsch (Rollenanweisung)</Label>
              <Textarea
                value={magicValues?.system ?? ''}
                onChange={(e) => onMagicChange?.({ system: e.target.value })}
                placeholder="Was möchtest du hier ändern?"
                className="w-full min-h-[90px] bg-pink-50 dark:bg-pink-950/20 border-pink-300"
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>Rollenanweisung</Label>
            {!sysEditing ? (
              <div role="button" onClick={() => setSysEditing(true)} className="border rounded-md">
                <MarkdownPreview content={sysPrompt || ''} />
              </div>
            ) : (
              <EditableTextarea
                value={sysPrompt}
                onChange={handleSysPromptChange}
                onBlur={() => setSysEditing(false)}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="creation">
          <div className="mb-3 text-xs text-muted-foreground">
            Der Creation Flow steuert, wie Menschen ihre Eingaben Schritt für Schritt liefern.
            Die eigentliche LLM-Transformation kannst du rechts unter <span className="font-semibold">„Transformation testen“</span> ausprobieren.
          </div>
          <CreationFlowEditor
            creation={creation || null}
            metadata={metadata}
            onChange={(newCreation) => {
              onChange({ markdownBody, metadata, systemprompt: sysPrompt, creation: newCreation })
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/**
 * Komponente zur Bearbeitung des Creation-Flow-Blocks
 * Split-View Design: Kompakte Liste links, Detail-Panel rechts
 */
function CreationFlowEditor({
  creation,
  metadata,
  onChange
}: {
  creation: TemplateCreationConfig | null
  metadata: TemplateMetadataSchema
  onChange: (creation: TemplateCreationConfig | null) => void
}) {
  const [localCreation, setLocalCreation] = React.useState<TemplateCreationConfig | null>(
    creation || {
      supportedSources: [],
      flow: { steps: [] }
    }
  )

  const [selectedSourceId, setSelectedSourceId] = React.useState<string | null>(null)
  const [selectedStepId, setSelectedStepId] = React.useState<string | null>(null)
  const [showSourceDetails, setShowSourceDetails] = React.useState(true)
  const [showStepDetails, setShowStepDetails] = React.useState(true)

  React.useEffect(() => {
    // Aktualisiere localCreation immer, auch wenn creation null ist
    if (creation) {
      // Bereinige ungültige Felder aus Steps mit `fields`
      const availableFieldKeys = new Set(metadata.fields.map(f => f.key))
      const cleanedCreation: TemplateCreationConfig = {
        ...creation,
        flow: {
          ...creation.flow,
          steps: creation.flow.steps.map(step => {
            if (step.preset === 'editDraft' && step.fields) {
              // Entferne Felder, die nicht mehr in den Metadaten existieren
              const validFields = step.fields.filter(field => availableFieldKeys.has(field))
              return {
                ...step,
                fields: validFields.length > 0 ? validFields : undefined
              }
            }
            return step
          })
        }
      }
      setLocalCreation(cleanedCreation)
    } else {
      // Wenn creation null ist, setze auf leeres Objekt (für UI-Metadaten)
      setLocalCreation({
        supportedSources: [],
        flow: { steps: [] }
      })
    }
  }, [creation, metadata])

  const updateCreation = (updater: (c: TemplateCreationConfig) => TemplateCreationConfig) => {
    if (!localCreation) {
      // Wenn localCreation null ist, erstelle ein neues Objekt
      const newCreation: TemplateCreationConfig = {
        supportedSources: [],
        flow: { steps: [] }
      }
      const updated = updater(newCreation)
      setLocalCreation(updated)
      onChange(updated)
      return
    }
    const updated = updater(localCreation)
    setLocalCreation(updated)
    onChange(updated)
  }

  const sources = localCreation?.supportedSources || []
  const steps = localCreation?.flow.steps || []
  const selectedSource = sources.find(s => s.id === selectedSourceId)
  const selectedStep = steps.find(s => s.id === selectedStepId)

  const SOURCE_TYPE_ICONS = {
    spoken: Mic,
    url: LinkIcon,
    text: FileText,
    file: Upload,
  }

  const SOURCE_TYPE_COLORS = {
    spoken: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/30",
    url: "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950/30",
    text: "text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-950/30",
    file: "text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-950/30",
  }

  const addSource = () => {
    const newId = `source_${Date.now()}`
    updateCreation((c) => ({
      ...c,
      supportedSources: [
        ...c.supportedSources,
        { id: newId, type: 'text', label: 'Text (tippen oder diktieren)', helpText: 'Tippe deinen Text ein oder diktiere ihn. Du siehst das Ergebnis, bevor es verarbeitet wird.' }
      ]
    }))
    setSelectedSourceId(newId)
  }

  const updateSourceById = (id: string, updates: Partial<TemplateCreationConfig['supportedSources'][0]>) => {
    updateCreation((c) => ({
      ...c,
      supportedSources: c.supportedSources.map(s => s.id === id ? { ...s, ...updates } : s)
    }))
  }

  const removeSourceById = (id: string) => {
    updateCreation((c) => ({
      ...c,
      supportedSources: c.supportedSources.filter(s => s.id !== id)
    }))
    if (selectedSourceId === id) setSelectedSourceId(null)
  }

  const addStep = () => {
    const newId = `step_${Date.now()}`
    updateCreation((c) => ({
      ...c,
      flow: {
        steps: [
          ...c.flow.steps,
          { id: newId, preset: 'chooseSource' }
        ]
      }
    }))
    setSelectedStepId(newId)
  }

  const updateStepById = (id: string, updates: Partial<TemplateCreationConfig['flow']['steps'][0]>) => {
    updateCreation((c) => ({
      ...c,
      flow: {
        steps: c.flow.steps.map(s => s.id === id ? { ...s, ...updates } : s)
      }
    }))
  }

  const removeStepById = (id: string) => {
    updateCreation((c) => ({
      ...c,
      flow: {
        steps: c.flow.steps.filter(s => s.id !== id)
      }
    }))
    if (selectedStepId === id) setSelectedStepId(null)
  }

  // Drag & Drop für Step-Reihenfolge
  const [draggedStepIndex, setDraggedStepIndex] = React.useState<number | null>(null)

  const handleStepDragStart = (e: React.DragEvent, stepIndex: number) => {
    setDraggedStepIndex(stepIndex)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(stepIndex))
    // Visuelles Feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5'
    }
  }

  const handleStepDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleStepDragEnd = (e: React.DragEvent) => {
    // Stelle Opacity wieder her
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1'
    }
    setDraggedStepIndex(null)
  }

  const handleStepDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    const sourceIndexStr = e.dataTransfer.getData('text/plain')
    const sourceIndex = Number.isInteger(Number(sourceIndexStr)) ? parseInt(sourceIndexStr, 10) : -1
    
    if (sourceIndex < 0 || sourceIndex === targetIndex || !localCreation) return

    const newSteps = [...localCreation.flow.steps]
    const [removed] = newSteps.splice(sourceIndex, 1)
    newSteps.splice(targetIndex, 0, removed)

    updateCreation((c) => ({
      ...c,
      flow: {
        ...c.flow,
        steps: newSteps,
      },
    }))

    setDraggedStepIndex(null)
  }

  const availablePresets = ['welcome', 'briefing', 'chooseSource', 'collectSource', 'generateDraft', 'previewDetail', 'editDraft', 'uploadImages', 'selectRelatedTestimonials']
  
  // Verfügbare Feldnamen aus Metadaten extrahieren
  const availableFieldKeys = metadata.fields.map(f => f.key)

  // UI-Metadaten aktualisieren
  const updateUIMetadata = (updates: Partial<NonNullable<TemplateCreationConfig['ui']>>) => {
    // Stelle sicher, dass localCreation existiert
    if (!localCreation) {
      const newCreation: TemplateCreationConfig = {
        supportedSources: [],
        flow: { steps: [] },
        ui: updates
      }
      setLocalCreation(newCreation)
      onChange(newCreation)
      return
    }
    
    updateCreation((c) => ({
      ...c,
      ui: {
        ...c.ui,
        ...updates
      }
    }))
  }

  // Welcome-Seite (Markdown) aktualisieren
  const updateWelcomeMarkdown = (markdown: string) => {
    updateCreation((c) => ({
      ...c,
      welcome: {
        markdown
      }
    }))
  }

  const updatePreviewConfig = (updates: Partial<NonNullable<TemplateCreationConfig['preview']>>) => {
    updateCreation((c) => ({
      ...c,
      preview: {
        detailViewType: c.preview?.detailViewType || 'session',
        ...updates,
      },
    }))
  }

  const updateOutputFileNameConfig = (updates: Partial<NonNullable<NonNullable<TemplateCreationConfig['output']>['fileName']>>) => {
    updateCreation((c) => ({
      ...c,
      output: {
        ...c.output,
        fileName: {
          ...c.output?.fileName,
          ...updates,
        },
      },
    }))
  }

  async function handleWelcomeImageUpload(file: File): Promise<void> {
    // Speichere das Bild als Data-URL im Markdown.
    // Hinweis: Data-URLs können groß werden (MongoDB Dokument-Limit beachten).
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('Bild konnte nicht gelesen werden.'))
      reader.onload = () => {
        const result = reader.result
        if (typeof result !== 'string') reject(new Error('Ungültiges Bildformat.'))
        else resolve(result)
      }
      reader.readAsDataURL(file)
    })

    const currentMarkdown = localCreation?.welcome?.markdown || ''
    const imageSnippet = `\n\n---\n\n## Beispiel\n\n![Beispiel-Screenshot](${dataUrl})\n`
    updateWelcomeMarkdown(`${currentMarkdown}${imageSnippet}`.trimStart())
  }

  // Gängige Lucide React Icons für die Auswahl mit Icon-Komponenten
  const COMMON_ICONS = [
    { value: "FileText", label: "Dokument", icon: FileText },
    { value: "Calendar", label: "Kalender", icon: Calendar },
    { value: "MessageSquare", label: "Nachricht", icon: MessageSquare },
    { value: "Briefcase", label: "Aktentasche", icon: Briefcase },
    { value: "BookOpen", label: "Buch", icon: BookOpen },
    { value: "Presentation", label: "Präsentation", icon: Presentation },
    { value: "Users", label: "Benutzer", icon: Users },
    { value: "Building2", label: "Gebäude", icon: Building2 },
    { value: "Code2", label: "Code", icon: Code2 },
    { value: "Leaf", label: "Blatt", icon: Leaf },
    { value: "Globe", label: "Globus", icon: Globe },
    { value: "GraduationCap", label: "Abschlusskappe", icon: GraduationCap },
    { value: "Lightbulb", label: "Glühbirne", icon: Lightbulb },
    { value: "Library", label: "Bibliothek", icon: Library },
    { value: "Zap", label: "Blitz", icon: Zap },
    { value: "Heart", label: "Herz", icon: Heart },
    { value: "Star", label: "Stern", icon: Star },
    { value: "Target", label: "Ziel", icon: Target },
    { value: "Mic", label: "Mikrofon", icon: Mic },
    { value: "Video", label: "Video", icon: Video },
    { value: "Image", label: "Bild", icon: Image },
    { value: "File", label: "Datei", icon: File },
    { value: "Folder", label: "Ordner", icon: Folder },
    { value: "Link", label: "Link", icon: Link },
    { value: "Upload", label: "Hochladen", icon: Upload },
  ] as const

  return (
    <div className="space-y-8">
      {/* UI-Metadaten Section */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Anzeige-Einstellungen</h3>
          <p className="text-sm text-muted-foreground">
            Konfiguriere, wie dieser Creation-Typ auf der Create-Seite angezeigt wird
          </p>
        </div>
        <Card className="p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Anzeigename (optional)
              </label>
              <Input
                value={localCreation?.ui?.displayName || ''}
                onChange={(e) => updateUIMetadata({ displayName: e.target.value || undefined })}
                placeholder="z.B. Session erstellen"
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Falls leer, wird der Name aus dem ersten Step oder Template-Namen abgeleitet
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Icon (optional)
              </label>
              <Select
                value={localCreation?.ui?.icon || '__auto__'}
                onValueChange={(value) => updateUIMetadata({ icon: value === '__auto__' ? undefined : value })}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Icon auswählen...">
                    {localCreation?.ui?.icon ? (() => {
                      const selectedIcon = COMMON_ICONS.find(i => i.value === localCreation?.ui?.icon)
                      const IconComponent = selectedIcon?.icon || FileText
                      return (
                        <div className="flex items-center gap-2">
                          <IconComponent className="w-4 h-4" />
                          <span>{selectedIcon?.label || localCreation.ui.icon}</span>
                        </div>
                      )
                    })() : (
                      <span>Kein Icon (automatisch ableiten)</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto__">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 opacity-50" />
                      <span>Kein Icon (automatisch ableiten)</span>
                    </div>
                  </SelectItem>
                  {COMMON_ICONS.map((icon) => {
                    const IconComponent = icon.icon
                    return (
                      <SelectItem key={icon.value} value={icon.value}>
                        <div className="flex items-center gap-2">
                          <IconComponent className="w-4 h-4" />
                          <span>{icon.label}</span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Falls nicht ausgewählt, wird das Icon automatisch aus dem Template-Namen abgeleitet.
              </p>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Beschreibung (optional)
            </label>
            <Textarea
              value={localCreation?.ui?.description || ''}
              onChange={(e) => updateUIMetadata({ description: e.target.value || undefined })}
              placeholder="z.B. Erstelle eine neue Session mit allen relevanten Informationen"
              rows={2}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Falls leer, wird die Beschreibung aus dem ersten Step abgeleitet
            </p>
          </div>
        </Card>
      </div>

      {/* NOTE: Welcome/Preview werden als Presets in Step Details konfiguriert (nicht global). */}

      {/* Speichern / Output */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Speichern</h3>
          <p className="text-sm text-muted-foreground">
            Lege fest, wie der Dateiname beim Speichern erzeugt wird.
          </p>
        </div>

        <Card className="p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Metafeld für Dateiname (optional)
              </label>
              <Select
                value={localCreation?.output?.fileName?.metadataFieldKey || '__auto__'}
                onValueChange={(value) =>
                  updateOutputFileNameConfig({
                    metadataFieldKey: value === '__auto__' ? undefined : value,
                  })
                }
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto__">Automatisch (Titel/Fallback)</SelectItem>
                  {availableFieldKeys.map((k) => (
                    <SelectItem key={k} value={k}>
                      <span className="font-mono">{k}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Wenn gesetzt, wird der Wert dieses Metafelds als Basis für den Dateinamen genutzt (slugifiziert).
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Dateiendung
              </label>
              <Input
                value={localCreation?.output?.fileName?.extension || 'md'}
                onChange={(e) => updateOutputFileNameConfig({ extension: e.target.value || undefined })}
                placeholder="md"
                className="text-sm font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Ohne Punkt, z.B. <span className="font-mono">md</span> oder <span className="font-mono">txt</span>.
              </p>
            </div>
          </div>

          {localCreation?.output?.fileName?.metadataFieldKey ? (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={localCreation.output?.fileName?.autoFillMetadataField === true}
                onCheckedChange={(checked) =>
                  updateOutputFileNameConfig({ autoFillMetadataField: checked === true })
                }
                id="autofill-filename-field"
              />
              <Label htmlFor="autofill-filename-field" className="text-sm">
                Metafeld automatisch füllen, wenn es leer ist
              </Label>
            </div>
          ) : null}

          <div className="text-xs text-muted-foreground">
            Beispiel:{" "}
            <span className="font-mono">
              {(() => {
                const example = buildCreationFileName({
                  typeId: 'example',
                  metadata: { title: 'Beispiel Titel' },
                  config: localCreation?.output?.fileName,
                  now: new Date('2025-01-02T12:00:00Z'),
                })
                return example.fileName
              })()}
            </span>
          </div>
        </Card>
      </div>

      {/* Input-Quellen Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Unterstützte Input-Quellen</h3>
            <p className="text-sm text-muted-foreground">Wie können Nutzer Daten eingeben?</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowSourceDetails(!showSourceDetails)}>
              {showSourceDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={addSource}>
              <Plus className="w-4 h-4 mr-2" />
              Quelle hinzufügen
            </Button>
          </div>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: showSourceDetails && selectedSource ? "1fr 400px" : "1fr" }}>
          {/* Kompakte Liste */}
          <div className="space-y-2">
            {sources.map((source) => {
              const Icon = SOURCE_TYPE_ICONS[source.type]
              const colorClass = SOURCE_TYPE_COLORS[source.type]
              const isSelected = selectedSourceId === source.id

              return (
                <div
                  key={source.id}
                  onClick={() => setSelectedSourceId(source.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/50 hover:bg-accent/50"
                  }`}
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />

                  <div className={`p-2 rounded ${colorClass} flex-shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{source.label || source.id}</div>
                    <div className="text-xs text-muted-foreground truncate">{source.helpText || 'Kein Hilfetext'}</div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-muted-foreground font-mono">{source.type}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeSourceById(source.id)
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              )
            })}

            {sources.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Noch keine Input-Quellen definiert</p>
              </div>
            )}
          </div>

          {/* Detail-Panel */}
          {showSourceDetails && selectedSource && (
            <Card className="p-4 space-y-4 sticky top-4 h-fit">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Details bearbeiten</h4>
                <Button variant="ghost" size="sm" onClick={() => setSelectedSourceId(null)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">ID (technisch)</label>
                  <Input
                    value={selectedSource.id}
                    onChange={(e) => {
                      const newId = e.target.value
                      updateSourceById(selectedSource.id, { id: newId })
                      setSelectedSourceId(newId)
                    }}
                    className="text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Typ</label>
                  <Select
                    value={selectedSource.type}
                    onValueChange={(value) => updateSourceById(selectedSource.id, { type: value as TemplateCreationConfig['supportedSources'][0]['type'] })}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text (tippen oder diktieren)</SelectItem>
                      <SelectItem value="url">URL</SelectItem>
                      <SelectItem value="file">Datei</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Label (Nutzer sieht dies)
                  </label>
                  <Input
                    value={selectedSource.label}
                    onChange={(e) => updateSourceById(selectedSource.id, { label: e.target.value })}
                    placeholder="z.B. Ich erzähle kurz..."
                    className="text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Hilfetext</label>
                  <Textarea
                    value={selectedSource.helpText || ''}
                    onChange={(e) => updateSourceById(selectedSource.id, { helpText: e.target.value })}
                    placeholder="Erkläre, wie diese Quelle funktioniert..."
                    rows={3}
                    className="text-sm"
                  />
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Flow Steps Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Flow Steps</h3>
            <p className="text-sm text-muted-foreground">Schritte im Creation-Wizard</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowStepDetails(!showStepDetails)}>
              {showStepDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={addStep}>
              <Plus className="w-4 h-4 mr-2" />
              Step hinzufügen
            </Button>
          </div>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: showStepDetails && selectedStep ? "1fr 400px" : "1fr" }}>
          {/* Kompakte Liste */}
          <div className="space-y-2">
            {steps.map((step, index) => {
              const isSelected = selectedStepId === step.id

              return (
                <div
                  key={step.id}
                  draggable
                  onDragStart={(e) => handleStepDragStart(e, index)}
                  onDragOver={handleStepDragOver}
                  onDragEnd={handleStepDragEnd}
                  onDrop={(e) => handleStepDrop(e, index)}
                  onClick={() => setSelectedStepId(step.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/50 hover:bg-accent/50"
                  } ${
                    draggedStepIndex === index ? "opacity-50" : ""
                  }`}
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0 cursor-grab active:cursor-grabbing" />

                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-semibold flex-shrink-0">
                    {index + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{step.title || step.id}</div>
                    <div className="text-xs text-muted-foreground">
                      Preset: <span className="font-mono">{step.preset}</span>
                      {step.fields && ` • ${step.fields.length} Felder`}
                      {step.description && ` • ${step.description.substring(0, 30)}...`}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeStepById(step.id)
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              )
            })}

            {steps.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Settings className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Noch keine Flow Steps definiert</p>
              </div>
            )}
          </div>

          {/* Detail-Panel */}
          {showStepDetails && selectedStep && (
            <Card className="p-4 space-y-4 sticky top-4 h-fit">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Step Details</h4>
                <Button variant="ghost" size="sm" onClick={() => setSelectedStepId(null)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Step ID</label>
                  <Input
                    value={selectedStep.id}
                    onChange={(e) => {
                      const newId = e.target.value
                      updateStepById(selectedStep.id, { id: newId })
                      setSelectedStepId(newId)
                    }}
                    className="text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Preset</label>
                  <Select
                    value={selectedStep.preset}
                    onValueChange={(value) => updateStepById(selectedStep.id, { preset: value as (typeof selectedStep.preset) })}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePresets.map((preset) => (
                        <SelectItem key={preset} value={preset}>{preset}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Titel (optional)</label>
                  <Input
                    value={selectedStep.title || ''}
                    onChange={(e) => updateStepById(selectedStep.id, { title: e.target.value || undefined })}
                    placeholder="z.B. Wie möchtest du die Session-Informationen eingeben?"
                    className="text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Beschreibung (optional)</label>
                  <Textarea
                    value={selectedStep.description || ''}
                    onChange={(e) => updateStepById(selectedStep.id, { description: e.target.value || undefined })}
                    placeholder="Beschreibe, was in diesem Step passiert..."
                    rows={2}
                    className="text-sm"
                  />
                </div>

                {selectedStep.preset === 'welcome' && (
                  <div className="space-y-3 pt-2 border-t">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                        Willkommensseite (Markdown)
                      </label>
                      <Textarea
                        value={localCreation?.welcome?.markdown || ''}
                        onChange={(e) => updateWelcomeMarkdown(e.target.value)}
                        placeholder={"## Willkommen\\n\\nHier erklären wir kurz, was als nächstes passiert.\\n\\n- Methode wählen\\n- Infos eingeben\\n- Kurz prüfen\\n- Speichern"}
                        rows={10}
                        className="text-sm font-mono"
                      />
                      <div className="flex items-center justify-between gap-3 mt-2">
                        <div className="text-xs text-muted-foreground">
                          Optional: Screenshot hochladen (wird als Data‑URL im Markdown eingebettet).
                        </div>
                        <Input
                          type="file"
                          accept="image/*"
                          className="max-w-[240px] text-xs"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            void handleWelcomeImageUpload(file)
                            e.currentTarget.value = ''
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                        Vorschau
                      </label>
                      <div className="border rounded-md p-2 bg-background max-h-[240px] overflow-auto">
                        <MarkdownPreview content={localCreation?.welcome?.markdown || ''} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Die Vorschau nutzt denselben Markdown‑Viewer wie der Wizard.
                      </p>
                    </div>
                  </div>
                )}

                {selectedStep.preset === 'previewDetail' && (
                  <div className="space-y-2 pt-2 border-t">
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Detailansicht‑Typ
                    </label>
                    <Select
                      value={localCreation?.preview?.detailViewType || 'session'}
                      onValueChange={(value) => {
                        // Validiere, dass value ein gültiger TemplatePreviewDetailViewType ist
                        if (value === 'book' || value === 'session' || value === 'testimonial') {
                          updatePreviewConfig({ detailViewType: value as 'book' | 'session' | 'testimonial' })
                        }
                      }}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="session">Event/Session (Detailseite)</SelectItem>
                        <SelectItem value="book">Buch/Dokument (Detailseite)</SelectItem>
                        <SelectItem value="testimonial">Testimonial (Detailseite)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Diese Einstellung wirkt sich auf den Preset‑Step <code className="font-mono">previewDetail</code> im Wizard aus.
                    </p>
                  </div>
                )}

                {selectedStep.preset === 'editDraft' && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                        Felder auswählen (für Anwender)
                      </label>
                      {availableFieldKeys.length === 0 ? (
                        <div className="text-xs text-muted-foreground p-2 border rounded-md bg-muted/50">
                          Keine Felder in den Metadaten definiert. Bitte zuerst Felder unter &quot;Metadaten&quot; hinzufügen.
                        </div>
                      ) : (
                        <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-2">
                          {availableFieldKeys.map((fieldKey) => {
                            const isSelected = selectedStep.fields?.includes(fieldKey) || false
                            const fieldMeta = metadata.fields.find(f => f.key === fieldKey)
                            
                            return (
                              <div key={fieldKey} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`field-${selectedStep.id}-${fieldKey}`}
                                  checked={isSelected}
                                  onCheckedChange={(checked) => {
                                    const currentFields = selectedStep.fields || []
                                    if (checked) {
                                      updateStepById(selectedStep.id, { 
                                        fields: [...currentFields, fieldKey] 
                                      })
                                    } else {
                                      // Entferne auch aus imageFieldKeys, wenn Feld entfernt wird
                                      const currentImageFields = selectedStep.imageFieldKeys || []
                                      updateStepById(selectedStep.id, { 
                                        fields: currentFields.filter(f => f !== fieldKey),
                                        imageFieldKeys: currentImageFields.filter(f => f !== fieldKey)
                                      })
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={`field-${selectedStep.id}-${fieldKey}`}
                                  className="text-sm font-mono cursor-pointer flex-1"
                                >
                                  {fieldKey}
                                </label>
                                {fieldMeta?.description && (
                                  <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={fieldMeta.description}>
                                    {fieldMeta.description}
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {selectedStep.fields && selectedStep.fields.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {selectedStep.fields.length} Feld{selectedStep.fields.length !== 1 ? 'er' : ''} ausgewählt
                        </div>
                      )}
                    </div>

                    {/* Bildfelder-Auswahl */}
                    {selectedStep.fields && selectedStep.fields.length > 0 && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                          Bildfelder auswählen (Upload statt Textfeld)
                        </label>
                        <p className="text-xs text-muted-foreground mb-2">
                          Wähle Felder aus, die als Bild-Upload gerendert werden sollen. Diese müssen auch in den Feldern oben ausgewählt sein.
                        </p>
                        <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-2">
                          {selectedStep.fields.map((fieldKey) => {
                            const isImageField = selectedStep.imageFieldKeys?.includes(fieldKey) || false
                            const fieldMeta = metadata.fields.find(f => f.key === fieldKey)
                            
                            return (
                              <div key={fieldKey} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`imageField-${selectedStep.id}-${fieldKey}`}
                                  checked={isImageField}
                                  onCheckedChange={(checked) => {
                                    const currentImageFields = selectedStep.imageFieldKeys || []
                                    if (checked) {
                                      updateStepById(selectedStep.id, { 
                                        imageFieldKeys: [...currentImageFields, fieldKey] 
                                      })
                                    } else {
                                      updateStepById(selectedStep.id, { 
                                        imageFieldKeys: currentImageFields.filter(f => f !== fieldKey) 
                                      })
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={`imageField-${selectedStep.id}-${fieldKey}`}
                                  className="text-sm font-mono cursor-pointer flex-1"
                                >
                                  {fieldKey}
                                </label>
                                {fieldMeta?.description && (
                                  <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={fieldMeta.description}>
                                    {fieldMeta.description}
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                        {selectedStep.imageFieldKeys && selectedStep.imageFieldKeys.length > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            {selectedStep.imageFieldKeys.length} Bildfeld{selectedStep.imageFieldKeys.length !== 1 ? 'er' : ''} ausgewählt
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {selectedStep.preset === 'briefing' && (
                  <div className="text-xs text-muted-foreground p-2 border rounded-md bg-muted/50">
                    Dieser Step zeigt automatisch einen Spickzettel der im <code className="font-mono">editDraft</code>-Step ausgewählten Felder an.
                    Keine zusätzliche Konfiguration erforderlich.
                  </div>
                )}

                {selectedStep.preset === 'welcome' && (
                  <div className="text-xs text-muted-foreground p-2 border rounded-md bg-muted/50">
                    Dieser Step zeigt die optionale Willkommensseite aus <code className="font-mono">creation.welcome.markdown</code>.
                    Den Inhalt bearbeitest du hier in den Step‑Details.
                  </div>
                )}

                {selectedStep.preset === 'previewDetail' && (
                  <div className="text-xs text-muted-foreground p-2 border rounded-md bg-muted/50">
                    Dieser Step zeigt eine Vorschau der fertigen Detailseite (Book/Session).
                    Den Typ wählst du hier in den Step‑Details.
                  </div>
                )}


                {selectedStep.preset === 'uploadImages' && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Bildfelder auswählen
                    </label>
                    {availableFieldKeys.length === 0 ? (
                      <div className="text-xs text-muted-foreground p-2 border rounded-md bg-muted/50">
                        Keine Felder in den Metadaten definiert. Bitte zuerst Felder unter &quot;Metadaten&quot; hinzufügen.
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-2">
                        {availableFieldKeys.map((fieldKey) => {
                          const isSelected = selectedStep.fields?.includes(fieldKey) || false
                          const fieldMeta = metadata.fields.find(f => f.key === fieldKey)
                          
                          return (
                            <div key={fieldKey} className="flex items-center space-x-2">
                              <Checkbox
                                id={`imageField-${selectedStep.id}-${fieldKey}`}
                                checked={isSelected}
                                onCheckedChange={(checked) => {
                                  const currentFields = selectedStep.fields || []
                                  if (checked) {
                                    updateStepById(selectedStep.id, { 
                                      fields: [...currentFields, fieldKey] 
                                    })
                                  } else {
                                    updateStepById(selectedStep.id, { 
                                      fields: currentFields.filter(f => f !== fieldKey) 
                                    })
                                  }
                                }}
                              />
                              <label
                                htmlFor={`imageField-${selectedStep.id}-${fieldKey}`}
                                className="text-sm font-mono cursor-pointer flex-1"
                              >
                                {fieldKey}
                              </label>
                              {fieldMeta?.description && (
                                <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={fieldMeta.description}>
                                  {fieldMeta.description}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {selectedStep.fields && selectedStep.fields.length > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        {selectedStep.fields.length} Bildfeld{selectedStep.fields.length !== 1 ? 'er' : ''} ausgewählt
                      </div>
                    )}
                    <div className="mt-2 text-xs text-muted-foreground p-2 border rounded-md bg-muted/50">
                      Wähle die Metadaten-Felder aus, die als Bilder hochgeladen werden können. Diese Felder werden im Wizard als Upload-Felder angezeigt.
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

// Inline-Edit Textarea, wächst dynamisch, aktiviert Edit bei Fokus/Klick
function EditableTextarea({ value, onChange, onBlur, onKeyDown }: { value: string; onChange: (v: string) => void; onBlur?: () => void; onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void }) {
  const [local, setLocal] = React.useState(value)
  const ref = React.useRef<HTMLTextAreaElement | null>(null)

  const autosize = React.useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  React.useEffect(() => { setLocal(value); requestAnimationFrame(autosize) }, [value, autosize])

  return (
    <textarea
      ref={ref}
      value={local}
      onChange={(e) => { setLocal(e.target.value); onChange(e.target.value); autosize() }}
      onInput={autosize}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className="w-full min-h-[2.5rem] rounded-md border bg-background px-2 py-1 text-[11px] leading-snug overflow-hidden"
      style={{ resize: 'none' }}
    />
  )
}

// Zelle, die erst beim Klick in den Editiermodus wechselt und Anzeige als Markdown rendert
function InlineEditableCell({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  const [editing, setEditing] = React.useState(false)
  const [local, setLocal] = React.useState(value)
  
  // Synchronisiere lokalen State mit value-Prop, aber nur wenn nicht im Edit-Modus
  React.useEffect(() => {
    if (!editing) {
      setLocal(value)
    }
  }, [value, editing])

  const handleSave = () => {
    onChange(local)
    setEditing(false)
  }

  const handleCancel = () => {
    setLocal(value) // Zurücksetzen auf ursprünglichen Wert
    setEditing(false)
  }

  if (!editing) {
    return (
      <div
        role="button"
        onClick={() => setEditing(true)}
        className={`cursor-text whitespace-pre-wrap break-words rounded-md px-2 py-1 min-h-[2.5rem] ${className || ''}`}
      >
        {value ? value : <span className="text-muted-foreground">{placeholder || 'Klicken zum Bearbeiten'}</span>}
      </div>
    )
  }

  return (
    <EditableTextarea
      value={local}
      onChange={(v) => setLocal(v)}
      onBlur={handleSave}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          handleCancel()
        } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          e.stopPropagation()
          handleSave()
        }
      }}
    />
  )
}

function InlineMarkdownCell({ displayValue, editValue, onChange, placeholder, compact }: { displayValue: string; editValue: string; onChange: (v: string) => void; placeholder?: string; compact?: boolean }) {
  const [editing, setEditing] = React.useState(false)
  const [local, setLocal] = React.useState(editValue)
  React.useEffect(() => { if (!editing) setLocal(editValue) }, [editValue, editing])
  if (!editing) {
    const heading = /^(#{1,6})\s+(.*)$/.exec(displayValue.trim())
    if (heading) {
      const level = Math.min(6, Math.max(1, heading[1].length)) as 1|2|3|4|5|6
      const text = heading[2]
      const Tag = (`h${level}` as unknown) as keyof JSX.IntrinsicElements
      return (
        <div role="button" onClick={() => setEditing(true)} className="cursor-text rounded-md px-1 py-1 min-h-[2.5rem] border">
          <div className="prose dark:prose-invert max-w-none w-full p-1">
            <Tag className={level === 1 ? 'text-2xl font-bold' : level === 2 ? 'text-xl font-semibold' : level === 3 ? 'text-lg font-semibold' : 'text-base font-medium'}>{text}</Tag>
          </div>
        </div>
      )
    }
    return (
      <div role="button" onClick={() => setEditing(true)} className="cursor-text rounded-md px-1 py-1 min-h-[2.5rem] border">
        {displayValue ? <MarkdownPreview content={displayValue} compact={compact} /> : <span className="text-muted-foreground">{placeholder || 'Klicken zum Bearbeiten'}</span>}
      </div>
    )
  }
  return (
    <EditableTextarea
      value={local}
      onChange={(v) => { setLocal(v); onChange(v) }}
      onBlur={() => setEditing(false)}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setEditing(false) } }}
    />
  )
}

// Sehr dezenter Zeilen-Header mit Variablenname und Plus/Minus als kleine Buttons
function RowHeader({ hasVariable, varKey, onAdd, onRemove }: { hasVariable: boolean; varKey: string; onAdd: () => void; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between bg-muted/40 text-[10px] text-muted-foreground rounded-sm px-1 py-0.5 mb-1">
      <div className="flex items-center gap-2">
        <span className="font-mono truncate max-w-[12rem]" title={hasVariable ? varKey : 'keine Variable'}>
          {hasVariable ? varKey || 'variable' : '—'}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {hasVariable ? (
          <button
            type="button"
            className="inline-flex h-4 w-4 items-center justify-center rounded-sm hover:bg-muted text-muted-foreground border"
            aria-label="Variable entfernen"
            title="Variable entfernen"
            onClick={onRemove}
          >
            <Minus className="h-3 w-3" />
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex h-4 w-4 items-center justify-center rounded-sm hover:bg-muted text-muted-foreground border"
            aria-label="Variable hinzufügen"
            title="Variable hinzufügen"
            onClick={onAdd}
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  )
}

