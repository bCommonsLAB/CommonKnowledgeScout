"use client";

import * as React from "react";
import { useAtomValue } from "jotai";
import { activeLibraryAtom, activeLibraryIdAtom } from "@/atoms/library-atom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { loadPdfDefaults, savePdfDefaults } from "@/lib/pdf-defaults";
import { useStorage } from "@/contexts/storage-context";
import { useAtom } from "jotai";
import { pdfOverridesAtom, getEffectivePdfDefaults } from "@/atoms/pdf-defaults";
import type { PdfTransformOptions } from "@/lib/transform/transform-service";
import {
  TARGET_LANGUAGE_VALUES,
  TARGET_LANGUAGE_DEFAULT,
} from "@/lib/chat/constants";
import { useTranslation } from "@/lib/i18n/hooks";

interface PdfPhaseSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PdfPhaseSettings({ open, onOpenChange }: PdfPhaseSettingsProps) {
  const { t } = useTranslation()
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const activeLibrary = useAtomValue(activeLibraryAtom);
  // provider wird aktuell nicht verwendet, aber für zukünftige Verwendung bereitgehalten
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { provider: _unused_provider } = useStorage();
  const [templates, setTemplates] = React.useState<string[]>([]);
  const [overrides, setOverrides] = useAtom(pdfOverridesAtom);
  const [values, setValues] = React.useState<Partial<PdfTransformOptions>>({});

  const libraryConfigChatTargetLanguage = activeLibrary?.config?.chat?.targetLanguage;
  const libraryConfigPdfTemplate = activeLibrary?.config?.secretaryService?.pdfDefaults?.template;

  React.useEffect(() => {
    if (!activeLibraryId) return;
    const db = loadPdfDefaults(activeLibraryId);
    const eff = getEffectivePdfDefaults(
      activeLibraryId,
      db,
      overrides,
      libraryConfigChatTargetLanguage,
      libraryConfigPdfTemplate
    );
    setValues(eff);
  }, [activeLibraryId, open, overrides, libraryConfigChatTargetLanguage, libraryConfigPdfTemplate]);

  React.useEffect(() => {
    let cancelled = false;
    async function loadTemplates() {
      try {
        if (!activeLibraryId) return;
        // Verwende zentrale Client-Library für MongoDB-Templates
        const { listAvailableTemplates } = await import('@/lib/templates/template-service-client')
        const templates = await listAvailableTemplates(activeLibraryId)
        if (!cancelled) setTemplates(templates);
      } catch {
        if (!cancelled) setTemplates([]);
      }
    }
    void loadTemplates();
    return () => { cancelled = true; };
  }, [activeLibraryId, open]);

  function update(partial: Partial<PdfTransformOptions>) {
    setValues(prev => ({ ...prev, ...partial }));
  }

  function saveAndClose() {
    if (!activeLibraryId) return onOpenChange(false);
    const effectiveTargetLanguage = typeof values.targetLanguage === 'string'
      ? values.targetLanguage
      : (libraryConfigChatTargetLanguage || TARGET_LANGUAGE_DEFAULT);
    const effectiveTemplate = typeof values.template === 'string'
      ? values.template
      : libraryConfigPdfTemplate;
    const defaults: PdfTransformOptions = {
      targetLanguage: effectiveTargetLanguage,
      fileName: '',
      createShadowTwin: true,
      fileExtension: 'md',
      extractionMethod: typeof values.extractionMethod === 'string' ? values.extractionMethod : 'mistral_ocr',
      useCache: values.useCache ?? true,
      // Für Mistral OCR: Beide Parameter standardmäßig true
      includeOcrImages: values.extractionMethod === 'mistral_ocr' ? (values.includeOcrImages ?? true) : undefined,
      includePageImages: values.extractionMethod === 'mistral_ocr' ? (values.includePageImages ?? true) : undefined,
      includeImages: values.includeImages ?? false, // Rückwärtskompatibilität
      useIngestionPipeline: values.useIngestionPipeline ?? false,
      template: effectiveTemplate,
    };
    // Speichere in localStorage (persistent)
    savePdfDefaults(activeLibraryId, defaults);
    // Setze auch Runtime-Overrides für diese Session (Vorrang vor DB-Defaults haben Vorrang)
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
            <Select
              value={values.targetLanguage || libraryConfigChatTargetLanguage || TARGET_LANGUAGE_DEFAULT}
              onValueChange={(v) => update({ targetLanguage: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sprache wählen" />
              </SelectTrigger>
              <SelectContent>
                {TARGET_LANGUAGE_VALUES.map((code) => (
                  <SelectItem key={code} value={code}>{t(`chat.languageLabels.${code}`) || code.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Template</Label>
            <Select
              value={values.template || libraryConfigPdfTemplate || ''}
              onValueChange={(v) => update({ template: v || undefined })}
            >
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
              <Checkbox 
                checked={values.extractionMethod === 'mistral_ocr' 
                  ? (values.includeOcrImages !== undefined ? values.includeOcrImages : true)
                  : (!!values.includeImages)} 
                onCheckedChange={(c) => {
                  if (values.extractionMethod === 'mistral_ocr') {
                    update({ includeOcrImages: !!c, includePageImages: !!c });
                  } else {
                    update({ includeImages: !!c });
                  }
                }} 
              />
              {values.extractionMethod === 'mistral_ocr' ? 'OCR & Seiten-Bilder extrahieren' : 'Bilder extrahieren'}
            </label>
          </div>
          <div className="space-y-2">
            <Label>Extraktionsmethode</Label>
            <Select value={values.extractionMethod || 'mistral_ocr'} onValueChange={(v) => update({ extractionMethod: v })}>
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


