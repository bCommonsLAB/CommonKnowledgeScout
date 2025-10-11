"use client";

import * as React from 'react'
// Hinweis: Body-Parsing erfolgt zeilenbasiert direkt in dieser Komponente
import { parseFrontmatterKeyValues } from '@/lib/markdown/frontmatter'
// Button nicht mehr benötigt
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GripVertical, Plus, Minus, Trash2 } from 'lucide-react'
// removed Select imports after removing Typ-Spalte
import { MarkdownPreview } from '@/components/library/markdown-preview'
import { Textarea } from '@/components/ui/textarea'
// Input entfällt nach UI-Verschlankung

export interface StructuredTemplateEditorProps {
  markdownBody: string
  yamlFrontmatter: string
  systemPrompt: string
  onChange: (next: { markdownBody: string; yamlFrontmatter: string; systemPrompt: string }) => void
  magicMode?: boolean
  magicValues?: { body: string; frontmatter: string; system: string }
  onMagicChange?: (next: { body?: string; frontmatter?: string; system?: string }) => void
}

type LineKind = 'text' | 'h1' | 'h2' | 'h3' | 'bold' | 'variable'

export function StructuredTemplateEditor({ markdownBody, yamlFrontmatter, systemPrompt, onChange, magicMode, magicValues, onMagicChange }: StructuredTemplateEditorProps) {
  const lines = React.useMemo(() => (typeof markdownBody === 'string' ? markdownBody.split('\n') : []), [markdownBody])
  const fmEntries = React.useMemo(() => parseFrontmatterKeyValues(yamlFrontmatter || ''), [yamlFrontmatter])
  const [sysPrompt, setSysPrompt] = React.useState(systemPrompt)
  const [tab, setTab] = React.useState<'body'|'frontmatter'|'system'>('body')
  const [sysEditing, setSysEditing] = React.useState(false)

  React.useEffect(() => { setSysPrompt(systemPrompt) }, [systemPrompt])

  // Logische Zeilen: unterstützen Mehrzeilige Variable-Blöcke {{key|...}} ... }}
  interface BodyRow { hasVariable: boolean; varKey: string; content: string; start: number; end: number; pre: string; post: string }

  function parseBodyToRows(raw: string): BodyRow[] {
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
  }

  const rows = React.useMemo(() => parseBodyToRows(markdownBody || ''), [markdownBody])

  function replaceRange(start: number, end: number, replacement: string) {
    const before = lines.slice(0, start)
    const repl = (replacement ?? '').split('\n')
    const after = lines.slice(end + 1)
    const next = before.concat(repl).concat(after)
    onChange({ markdownBody: next.join('\n'), yamlFrontmatter, systemPrompt: sysPrompt })
  }

  function buildVariable(pre: string, varKey: string, content: string, post: string): string {
    const text = content ?? ''
    const key = (varKey || '').trim()
    const token = key ? `{{${key}|${text}}}` : text
    return `${pre}${token}${post}`
  }

  // Zeilenbasierte Platzhalter-Erkennung (nur die betrachtete Zeile)
  /* eslint-disable @typescript-eslint/no-unused-vars */
  function parseLine(_line: string): { kind: LineKind; varKey: string; content: string } {
    // Funktion aktuell ungenutzt; behalten für zukünftige Einzelzeilen-Bearbeitung
    return { kind: 'text', varKey: '', content: '' }
  }

  function buildLine(kind: LineKind, content: string, varKey?: string): string {
    const text = content ?? ''
    switch (kind) {
      case 'variable': {
        const k = (varKey || '').trim()
        return k ? `{{${k}|${text}}}` : text
      }
      case 'h1': return `# ${text}`
      case 'h2': return `## ${text}`
      case 'h3': return `### ${text}`
      case 'bold': return `**${text}**`
      case 'text': default: return text
    }
  }

  function updateLineByIndex(lineIndex: number, nextLine: string) {
    const copy = lines.slice()
    if (lineIndex >= 0 && lineIndex < copy.length) copy[lineIndex] = nextLine
    onChange({ markdownBody: copy.join('\n'), yamlFrontmatter, systemPrompt: sysPrompt })
  }

  function suggestVarKey(index: number, content: string): string {
    const base = (content || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    const trimmed = base.length >= 3 ? base.slice(0, 24) : ''
    return trimmed || `var_${index + 1}`
  }

  // kein Format mehr

  function updateRowVarKey(rowIndex: number, nextKey: string) {
    const row = rows[rowIndex]
    if (!row) return
    if (!row.hasVariable) return
    const key = (nextKey || '').trim() || suggestVarKey(row.start, row.content)
    replaceRange(row.start, row.end, buildVariable(row.pre, key, row.content, row.post))
  }

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
    onChange({ markdownBody: next.join('\n'), yamlFrontmatter, systemPrompt: sysPrompt })
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
    onChange({ markdownBody: arr.join('\n'), yamlFrontmatter, systemPrompt: sysPrompt })
  }

  function deleteRow(rowIndex: number) {
    const row = rows[rowIndex]
    if (!row) return
    const next = lines.slice(0, row.start).concat(lines.slice(row.end + 1))
    onChange({ markdownBody: next.join('\n'), yamlFrontmatter, systemPrompt: sysPrompt })
  }

  const updateFrontmatterQuestion = (entryKey: string, question: string) => {
    const linesFM = (yamlFrontmatter || '').split('\n')
    const idx = linesFM.findIndex(l => new RegExp(`^${escapeRegExp(entryKey)}\\s*:`).test(l.trim()))
    if (idx >= 0) {
      const line = linesFM[idx]
      const m = /\{\{([^}|]+)\|([^}]+)\}\}/.exec(line)
      if (m) {
        linesFM[idx] = line.replace(m[0], `{{${m[1]}|${question}}}`)
      }
      onChange({ markdownBody, yamlFrontmatter: linesFM.join('\n'), systemPrompt: sysPrompt })
    }
  }

  const handleSysPromptChange = (v: string) => {
    setSysPrompt(v)
    onChange({ markdownBody, yamlFrontmatter, systemPrompt: v })
  }

  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="body">Aufgabe</TabsTrigger>
          <TabsTrigger value="frontmatter">Metadaten</TabsTrigger>
          <TabsTrigger value="system">Rollenanweisung</TabsTrigger>
        </TabsList>

        <TabsContent value="body">
          {magicMode ? (
            <div className="mb-3 space-y-1">
              <Label>Änderungswunsch (Aufgabe)</Label>
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
                          onChangeVar={(v) => updateRowVarKey(i, v)}
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
          <div className="max-h-[50vh] overflow-auto rounded border">
            <table className="w-full text-[11px] border-collapse">
              <thead className="sticky top-0 bg-background">
                <tr>
                  <th className="w-40 text-left px-2 py-1">Feld</th>
                  <th className="w-40 text-left px-2 py-1">Variable</th>
                  <th className="text-left px-2 py-1">Hinweis</th>
                </tr>
              </thead>
              <tbody>
                {fmEntries.length === 0 ? (
                  <tr><td colSpan={3} className="px-2 py-1 text-muted-foreground">Keine Felder im Frontmatter.</td></tr>
                ) : fmEntries.map((e, i) => {
                  const m = /\{\{([^}|]+)\|([^}]+)\}\}/.exec(e.rawValue)
                  const varKey = m ? m[1].trim() : ''
                  const varQ = m ? m[2].trim() : ''
                  return (
                    <tr key={`${e.key}-${i}`} className="align-top">
                      <td className="px-2 py-1 align-top font-mono">{e.key}</td>
                      <td className="px-2 py-1 align-top font-mono">{varKey}</td>
                      <td className="px-2 py-1 align-top">
                        <InlineEditableCell
                          value={varQ}
                          onChange={(val) => updateFrontmatterQuestion(e.key, val)}
                          placeholder="Klicken zum Bearbeiten"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="system">
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
      </Tabs>
    </div>
  )
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
function InlineEditableCell({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [editing, setEditing] = React.useState(false)

  if (!editing) {
    return (
      <div
        role="button"
        onClick={() => setEditing(true)}
        className="cursor-text whitespace-pre-wrap break-words rounded-md px-2 py-1 min-h-[2.5rem]"
      >
        {value ? value : <span className="text-muted-foreground">{placeholder || 'Klicken zum Bearbeiten'}</span>}
      </div>
    )
  }

  return (
    <EditableTextarea
      value={value}
      onChange={onChange}
      onBlur={() => setEditing(false)}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setEditing(false) } }}
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
function RowHeader({ hasVariable, varKey, onChangeVar, onAdd, onRemove }: { hasVariable: boolean; varKey: string; onChangeVar: (v: string) => void; onAdd: () => void; onRemove: () => void }) {
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

