"use client";

import * as React from "react";
import { useAtomValue } from "jotai";
import { activeLibraryIdAtom } from "@/atoms/library-atom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { loadPdfDefaults } from "@/lib/pdf-defaults";
import { useStorage } from "@/contexts/storage-context";
import { useAtom } from "jotai";
import { pdfOverridesAtom } from "@/atoms/pdf-defaults";
import type { PdfTransformOptions } from "@/lib/transform/transform-service";
import {
  TARGET_LANGUAGE_VALUES,
  TARGET_LANGUAGE_LABELS,
  TARGET_LANGUAGE_DEFAULT,
  type TargetLanguage,
} from "@/lib/chat/constants";

interface PdfPhaseSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PdfPhaseSettings({ open, onOpenChange }: PdfPhaseSettingsProps) {
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const { provider, listItems } = useStorage();
  const [templates, setTemplates] = React.useState<string[]>([]);
  const [overrides, setOverrides] = useAtom(pdfOverridesAtom);
  const [values, setValues] = React.useState<Partial<PdfTransformOptions>>({});

  React.useEffect(() => {
    if (!activeLibraryId) return;
    const db = loadPdfDefaults(activeLibraryId);
    const ov = overrides[activeLibraryId] || {};
    setValues({ ...db, ...ov });
  }, [activeLibraryId, open, overrides]);

  React.useEffect(() => {
    let cancelled = false;
    async function loadTemplates() {
      try {
        if (!provider) return;
        const root = await listItems('root');
        const folder = root.find(it => it.type === 'folder' && it.metadata.name === 'templates');
        if (!folder) { setTemplates([]); return; }
        const items = await listItems(folder.id);
        const names = items.filter(it => it.type === 'file' && it.metadata.name.endsWith('.md')).map(it => it.metadata.name.replace(/\.md$/, ''));
        if (!cancelled) setTemplates(names);
      } catch {
        if (!cancelled) setTemplates([]);
      }
    }
    void loadTemplates();
    return () => { cancelled = true; };
  }, [provider, listItems, open]);

  function update(partial: Partial<PdfTransformOptions>) {
    setValues(prev => ({ ...prev, ...partial }));
  }

  function saveAndClose() {
    if (!activeLibraryId) return onOpenChange(false);
    const defaults: PdfTransformOptions = {
      targetLanguage: typeof values.targetLanguage === 'string' ? values.targetLanguage : TARGET_LANGUAGE_DEFAULT,
      fileName: '',
      createShadowTwin: true,
      fileExtension: 'md',
      extractionMethod: typeof values.extractionMethod === 'string' ? values.extractionMethod : 'native',
      useCache: values.useCache ?? true,
      includeImages: values.includeImages ?? false,
      useIngestionPipeline: values.useIngestionPipeline ?? false,
      template: typeof values.template === 'string' ? values.template : undefined,
    };
    // 1) DB-Defaults unverändert lassen (nur über Secretary-Settings editierbar)
    // 2) Temporäre Overrides für diese Session setzen
    setOverrides(prev => ({ ...prev, [activeLibraryId]: { extractionMethod: defaults.extractionMethod, template: defaults.template } }));
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>PDF Standardwerte</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Zielsprache</Label>
            <Select value={values.targetLanguage || TARGET_LANGUAGE_DEFAULT} onValueChange={(v) => update({ targetLanguage: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Sprache wählen" />
              </SelectTrigger>
              <SelectContent>
                {TARGET_LANGUAGE_VALUES.map((code) => (
                  <SelectItem key={code} value={code}>{TARGET_LANGUAGE_LABELS[code] || code.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Template</Label>
            <Select value={values.template || ''} onValueChange={(v) => update({ template: v || undefined })}>
              <SelectTrigger>
                <SelectValue placeholder="Template wählen" />
              </SelectTrigger>
              <SelectContent>
                {templates.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={!!values.useCache} onCheckedChange={(c) => update({ useCache: !!c })} />
              Cache verwenden
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={!!values.includeImages} onCheckedChange={(c) => update({ includeImages: !!c })} />
              Bilder extrahieren
            </label>
          </div>
          <div className="space-y-2">
            <Label>Extraktionsmethode</Label>
            <Select value={values.extractionMethod || 'native'} onValueChange={(v) => update({ extractionMethod: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Methode wählen" />
              </SelectTrigger>
              <SelectContent>
                {['native','ocr','both','preview','preview_and_native','llm','llm_and_ocr','mistral_ocr'].map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button onClick={saveAndClose}>Speichern</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


