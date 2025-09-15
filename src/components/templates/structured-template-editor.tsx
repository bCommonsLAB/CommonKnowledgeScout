"use client";

import * as React from 'react'
import { parseFrontmatterKeyValues } from '@/lib/markdown/frontmatter'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GripVertical, Plus } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export interface StructuredTemplateEditorProps {
  markdownBody: string
  yamlFrontmatter: string
  systemPrompt: string
  onChange: (next: { markdownBody: string; yamlFrontmatter: string; systemPrompt: string }) => void
}

type LineKind = 'text' | 'h1' | 'h2' | 'h3' | 'bold' | 'variable'

export function StructuredTemplateEditor({ markdownBody, yamlFrontmatter, systemPrompt, onChange }: StructuredTemplateEditorProps) {
  const lines = React.useMemo(() => (typeof markdownBody === 'string' ? markdownBody.split('\n') : []), [markdownBody])
  const fmEntries = React.useMemo(() => parseFrontmatterKeyValues(yamlFrontmatter || ''), [yamlFrontmatter])
  const [sysPrompt, setSysPrompt] = React.useState(systemPrompt)
  const [tab, setTab] = React.useState<'body'|'frontmatter'|'system'>('body')
  const dragFrom = React.useRef<number | null>(null)

  React.useEffect(() => { setSysPrompt(systemPrompt) }, [systemPrompt])

  function parseLine(line: string): { kind: LineKind; varKey: string; content: string } {
    const mVar = /^\s*\{\{([^}|]+)\|([^}]+)\}\}\s*$/.exec(line)
    if (mVar) return { kind: 'variable', varKey: (mVar[1] || '').trim(), content: (mVar[2] || '').trim() }
    if (/^\s*###\s+/.test(line)) return { kind: 'h3', varKey: '', content: line.replace(/^\s*###\s+/, '') }
    if (/^\s*##\s+/.test(line)) return { kind: 'h2', varKey: '', content: line.replace(/^\s*##\s+/, '') }
    if (/^\s*#\s+/.test(line)) return { kind: 'h1', varKey: '', content: line.replace(/^\s*#\s+/, '') }
    const mBold = /^\s*\*\*([\s\S]*?)\*\*\s*$/.exec(line)
    if (mBold) return { kind: 'bold', varKey: '', content: (mBold[1] || '') }
    return { kind: 'text', varKey: '', content: line }
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

  function updateLineKind(lineIndex: number, nextKind: LineKind) {
    if (lineIndex < 0 || lineIndex >= lines.length) return
    const { content, varKey } = parseLine(lines[lineIndex])
    if (nextKind === 'variable') {
      const key = varKey && varKey.trim().length > 0 ? varKey : suggestVarKey(lineIndex, content)
      updateLineByIndex(lineIndex, buildLine('variable', content, key))
      return
    }
    updateLineByIndex(lineIndex, buildLine(nextKind, content, varKey))
  }

  function updateVarKey(lineIndex: number, nextKey: string) {
    if (lineIndex < 0 || lineIndex >= lines.length) return
    const { content } = parseLine(lines[lineIndex])
    const realKind: LineKind = 'variable'
    updateLineByIndex(lineIndex, buildLine(realKind, content, nextKey))
  }

  function updateContent(lineIndex: number, nextContent: string) {
    if (lineIndex < 0 || lineIndex >= lines.length) return
    const { kind, varKey } = parseLine(lines[lineIndex])
    updateLineByIndex(lineIndex, buildLine(kind, nextContent, varKey))
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

  function handleDragStart(e: React.DragEvent, fromIndex: number) {
    dragFrom.current = fromIndex
    e.dataTransfer.setData('text/plain', String(fromIndex))
    e.dataTransfer.effectAllowed = 'move'
  }
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }
  function handleDrop(e: React.DragEvent, toIndex: number) {
    e.preventDefault()
    const fromStr = e.dataTransfer.getData('text/plain')
    const fromIndex = Number.isInteger(Number(fromStr)) ? parseInt(fromStr, 10) : dragFrom.current
    if (fromIndex === null || isNaN(fromIndex) || fromIndex === toIndex) return
    const arr = lines.slice()
    const [moved] = arr.splice(fromIndex, 1)
    arr.splice(toIndex, 0, moved)
    onChange({ markdownBody: arr.join('\n'), yamlFrontmatter, systemPrompt: sysPrompt })
    dragFrom.current = null
  }

  function addLineAfter(index: number) {
    const arr = lines.slice()
    arr.splice(index + 1, 0, '')
    onChange({ markdownBody: arr.join('\n'), yamlFrontmatter, systemPrompt: sysPrompt })
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
          <TabsTrigger value="system">Rollenanweisung</TabsTrigger>
          <TabsTrigger value="frontmatter">Metadaten</TabsTrigger>
        </TabsList>

        <TabsContent value="body">
          <div className="overflow-auto">
            <Table className="text-[11px] w-full border-collapse">
              <TableHeader>
                <TableRow className="[&>*]:py-1">
                  <TableHead className="w-8" />
                  <TableHead className="w-36">Typ/Variable</TableHead>
                  <TableHead>Text / Frage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-muted-foreground">Keine Zeilen im Body.</TableCell></TableRow>
                ) : lines.map((line, i) => {
                  const { kind, varKey, content } = parseLine(line)
                  return (
                    <TableRow key={`line-${i}`} className="align-top" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, i)}>
                      <TableCell className="align-top w-8 py-1">
                        <div className="flex items-center gap-1">
                          <span
                            draggable
                            onDragStart={(e) => handleDragStart(e, i)}
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
                            onClick={() => addLineAfter(i)}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="align-top w-36 py-1">
                        <div className="flex flex-col gap-1">
                          <Select value={kind} onValueChange={(v) => updateLineKind(i, v as LineKind)}>
                            <SelectTrigger className="h-7 text-[11px]">
                              <SelectValue placeholder="Text" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">Text</SelectItem>
                              <SelectItem value="h1">Heading 1</SelectItem>
                              <SelectItem value="h2">Heading 2</SelectItem>
                              <SelectItem value="h3">Heading 3</SelectItem>
                              <SelectItem value="bold">Bold</SelectItem>
                              <SelectItem value="variable">Variable</SelectItem>
                            </SelectContent>
                          </Select>
                          {kind === 'variable' ? (
                            <Input
                              value={varKey}
                              onChange={(e) => updateVarKey(i, e.target.value)}
                              placeholder="Variablenname"
                              className="h-7 text-[11px] font-mono"
                            />
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="align-top py-1">
                        <InlineEditableCell
                          value={content}
                          onChange={(val) => updateContent(i, val)}
                          placeholder={kind === 'variable' ? 'Frage/Beschreibung' : 'Markdown-Text'}
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
          <div className="space-y-1">
            <Label>Rollenanweisung</Label>
            <Input value={sysPrompt} onChange={(e) => handleSysPromptChange(e.target.value)} className="font-mono h-8 text-xs" />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

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

