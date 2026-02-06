"use client"

import { useState, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Trash2, Upload, Copy, Check, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { getRequiredFields, getOptionalFields, isValidDetailViewType } from '@/lib/detail-view-types'

export interface FacetDefUi {
  metaKey: string
  label?: string
  type: 'string' | 'number' | 'boolean' | 'string[]' | 'date' | 'integer-range'
  multi: boolean
  visible: boolean
  /** Wenn true, wird diese Facette als Spalte in der Galerie-Tabellenansicht angezeigt */
  showInTable: boolean
  sort?: 'alpha' | 'count'
  max?: number
  columns?: number
}

export interface FacetDefsEditorProps {
  value: FacetDefUi[]
  onChange: (v: FacetDefUi[]) => void
  /** Optional: Der gewählte DetailViewType für Validierung gegen Registry */
  detailViewType?: string
}

export function FacetDefsEditor({ value, onChange, detailViewType }: FacetDefsEditorProps) {
  const defs: FacetDefUi[] = (value || []).map(d => ({
    ...d,
    multi: d?.multi ?? true,
    visible: d?.visible ?? true,
    showInTable: d?.showInTable ?? false,
    type: d?.type ?? 'string',
    sort: ((d as { sort?: unknown }).sort === 'count' ? 'count' : 'alpha') as 'alpha' | 'count',
    max: typeof (d as { max?: unknown }).max === 'number' ? (d as { max: number }).max : undefined,
    columns: typeof (d as { columns?: unknown }).columns === 'number' ? (d as { columns: number }).columns : 1,
  }))
  const types: FacetDefUi['type'][] = ['string','number','boolean','string[]','date','integer-range']
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // VALIDIERUNG GEGEN REGISTRY
  // Prüft ob die Facetten-metaKeys in der Registry für den ViewType definiert sind
  // ═══════════════════════════════════════════════════════════════════════════════
  const knownFields = useMemo(() => {
    if (!detailViewType || !isValidDetailViewType(detailViewType)) return null
    const required = getRequiredFields(detailViewType)
    const optional = getOptionalFields(detailViewType)
    return new Set([...required, ...optional])
  }, [detailViewType])
  
  // Prüfe welche Facetten-Keys nicht in der Registry sind
  const unknownFacets = useMemo(() => {
    if (!knownFields) return []
    return defs
      .map((d, index) => ({ metaKey: d.metaKey, index }))
      .filter(({ metaKey }) => metaKey && !knownFields.has(metaKey))
  }, [defs, knownFields])

  function update(index: number, patch: Partial<FacetDefUi>) {
    const next = defs.map((d, i) => (i === index ? { ...d, ...patch } : d))
    onChange(next)
  }
  function add() {
    onChange([ ...defs, { metaKey: '', label: '', type: 'string', multi: true, visible: true, showInTable: false } ])
  }
  function remove(index: number) {
    onChange(defs.filter((_, i) => i !== index))
  }
  function move(index: number, dir: -1 | 1) {
    const j = index + dir
    if (j < 0 || j >= defs.length) return
    const next = defs.slice()
    const [it] = next.splice(index, 1)
    next.splice(j, 0, it)
    onChange(next)
  }

  // Export/Import State
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Export: JSON in Zwischenablage kopieren
  const handleExport = useCallback(() => {
    const json = JSON.stringify(defs, null, 2)
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true)
      toast.success('Facetten in Zwischenablage kopiert')
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      toast.error('Fehler beim Kopieren')
    })
  }, [defs])

  // Import: JSON parsen und ersetzen
  const handleImport = useCallback(() => {
    try {
      const parsed = JSON.parse(importJson)
      if (!Array.isArray(parsed)) {
        setImportError('JSON muss ein Array sein')
        return
      }
      // Validiere jedes Element
      const validated: FacetDefUi[] = parsed.map((item: unknown) => {
        if (!item || typeof item !== 'object') {
          throw new Error('Ungültiges Element im Array')
        }
        const obj = item as Record<string, unknown>
        if (typeof obj.metaKey !== 'string') {
          throw new Error('Jedes Element benötigt "metaKey" (string)')
        }
        return {
          metaKey: obj.metaKey,
          label: typeof obj.label === 'string' ? obj.label : undefined,
          type: (types.includes(obj.type as FacetDefUi['type']) ? obj.type : 'string') as FacetDefUi['type'],
          multi: typeof obj.multi === 'boolean' ? obj.multi : true,
          visible: typeof obj.visible === 'boolean' ? obj.visible : true,
          showInTable: typeof obj.showInTable === 'boolean' ? obj.showInTable : false,
          sort: obj.sort === 'count' ? 'count' : 'alpha',
          max: typeof obj.max === 'number' ? obj.max : undefined,
          columns: typeof obj.columns === 'number' ? obj.columns : 1,
        }
      })
      onChange(validated)
      setShowImportDialog(false)
      setImportJson('')
      setImportError(null)
      toast.success(`${validated.length} Facetten importiert`)
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Ungültiges JSON')
    }
  }, [importJson, onChange, types])

  // Hilfsfunktion: Prüft ob ein metaKey in der Registry ist
  const isKnownField = useCallback((metaKey: string): boolean | null => {
    if (!knownFields) return null // Keine Validierung möglich
    if (!metaKey) return null // Leerer Key, keine Validierung
    return knownFields.has(metaKey)
  }, [knownFields])
  
  return (
    <div className="space-y-3">
      {/* Validierungs-Hinweis wenn ViewType gesetzt */}
      {detailViewType && knownFields && (
        <div className={`flex items-start gap-2 p-3 rounded-md border ${
          unknownFacets.length > 0 
            ? 'border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20' 
            : 'border-green-500/50 bg-green-50 dark:bg-green-950/20'
        }`}>
          {unknownFacets.length > 0 ? (
            <>
              <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-medium text-yellow-800 dark:text-yellow-300">
                  {unknownFacets.length} Facette{unknownFacets.length !== 1 ? 'n' : ''} nicht in Registry für {detailViewType}
                </p>
                <p className="text-yellow-700 dark:text-yellow-400 mt-1">
                  Diese Felder sind nicht in der Detail-View-Registry definiert: {unknownFacets.map(f => f.metaKey).join(', ')}
                </p>
              </div>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-medium text-green-800 dark:text-green-300">
                  Alle Facetten sind für {detailViewType} bekannt
                </p>
              </div>
            </>
          )}
        </div>
      )}
      
      <div className="overflow-auto rounded border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-1 py-2 w-[28%]">metaKey</th>
              <th className="px-1 py-2 w-[28%]">Label</th>
              <th className="px-1 py-2 w-[18%]">Typ</th>
              <th className="px-1 py-2 w-[10%]">Sort.</th>
              <th className="px-1 py-2 w-[18%]">Max</th>
              <th className="px-1 py-2 w-[10%]">Spalten</th>
              <th className="px-1 py-2 w-[10%]">Multi</th>
              <th className="px-1 py-2 w-[10%]">Sichtbar</th>
              <th className="px-1 py-2 w-[10%]" title="Spalte in der Tabellenansicht anzeigen">In Tabelle</th>
              <th className="px-1 py-2 w-[100px]">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {defs.map((d, i) => {
              const fieldStatus = isKnownField(d.metaKey)
              return (
              <tr key={i} className="border-t">
                <td className="px-0 py-2 align-middle">
                  <div className="flex items-center gap-1">
                    <Input 
                      placeholder="metaKey" 
                      value={d.metaKey} 
                      onChange={e => update(i, { metaKey: e.target.value })} 
                      className={`w-full ${
                        fieldStatus === false 
                          ? 'border-yellow-500 focus-visible:ring-yellow-500' 
                          : fieldStatus === true 
                            ? 'border-green-500 focus-visible:ring-green-500' 
                            : ''
                      }`} 
                    />
                    {fieldStatus === true && (
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" aria-label="In Registry bekannt" />
                    )}
                    {fieldStatus === false && (
                      <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" aria-label="Nicht in Registry" />
                    )}
                  </div>
                </td>
                <td className="px-0 py-2 align-middle">
                  <Input placeholder="Label" value={d.label || ''} onChange={e => update(i, { label: e.target.value })} className="w-full" />
                </td>
                <td className="px-0 py-2 align-middle">
                  <Select 
                    value={d.type || 'string'} 
                    onValueChange={(v) => {
                      // NUR valide Typen akzeptieren (leere Strings ignorieren!)
                      if (v && types.includes(v as FacetDefUi['type'])) {
                        update(i, { type: v as FacetDefUi['type'] });
                      }
                    }}
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-0 py-2 align-middle">
                  <Select 
                    value={d.sort || 'alpha'} 
                    onValueChange={(v) => {
                      // NUR valide Sort-Werte akzeptieren
                      if (v === 'alpha' || v === 'count') {
                        update(i, { sort: v });
                      }
                    }}
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alpha">alpha</SelectItem>
                      <SelectItem value="count">count</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-0 py-2 align-middle">
                  <Input type="number" min={1} placeholder="alle" value={typeof d.max === 'number' ? String(d.max) : ''} onChange={e => update(i, { max: e.target.value ? Number(e.target.value) : undefined })} className="w-full" />
                </td>
                <td className="px-0 py-2 align-middle">
                  <Select 
                    value={String(d.columns || 1)} 
                    onValueChange={(v) => {
                      // NUR valide Spalten-Werte akzeptieren
                      const num = Number(v);
                      if (num === 1 || num === 2) {
                        update(i, { columns: num });
                      }
                    }}
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-1 py-2 align-middle">
                  <Switch checked={!!d.multi} onCheckedChange={(v) => update(i, { multi: v })} />
                </td>
                <td className="px-1 py-2 align-middle">
                  <Switch checked={!!d.visible} onCheckedChange={(v) => update(i, { visible: v })} />
                </td>
                <td className="px-1 py-2 align-middle" title="Als Spalte in der Galerie-Tabellenansicht anzeigen">
                  <Switch checked={!!d.showInTable} onCheckedChange={(v) => update(i, { showInTable: v })} />
                </td>
                <td className="px-0 py-2 align-middle">
                  <div className="flex items-center gap-0">
                    <Button type="button" variant="outline" size="sm" onClick={() => move(i, -1)} disabled={i === 0} className="h-8 w-8 p-0">↑</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => move(i, +1)} disabled={i === defs.length - 1} className="h-8 w-8 p-0">↓</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)} className="h-8 w-8 p-0" title="Entfernen">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            )})}
            
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={add}>Facette hinzufügen</Button>
        <Button type="button" variant="outline" onClick={handleExport} className="gap-2">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          Facetten exportieren
        </Button>
        <Button type="button" variant="outline" onClick={() => setShowImportDialog(true)} className="gap-2">
          <Upload className="h-4 w-4" />
          Facetten importieren
        </Button>
      </div>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Facetten importieren</DialogTitle>
            <DialogDescription>
              Fügen Sie ein JSON-Array mit Facetten-Definitionen ein. Bestehende Facetten werden ersetzt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              placeholder={`[\n  {\n    "metaKey": "arbeitsgruppe",\n    "label": "Arbeitsgruppe",\n    "type": "string",\n    "multi": true,\n    "visible": true,\n    "showInTable": false\n  }\n]`}
              value={importJson}
              onChange={(e) => {
                setImportJson(e.target.value)
                setImportError(null)
              }}
              rows={12}
              className="font-mono text-xs"
            />
            {importError && (
              <p className="text-sm text-destructive">{importError}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setShowImportDialog(false)}>
              Abbrechen
            </Button>
            <Button type="button" onClick={handleImport} disabled={!importJson.trim()}>
              Importieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


