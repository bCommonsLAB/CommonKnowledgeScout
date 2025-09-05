"use client";

import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { SUPPORTED_LANGUAGES } from "@/lib/secretary/constants";

export interface TransformSaveOptions {
  [key: string]: unknown;
  targetLanguage: string;
  fileName: string;
  createShadowTwin: boolean;
  fileExtension: string;
  extractionMethod?: string; // Optional für PDF-Transformation
  useCache?: boolean; // Neu: Cache-Option für alle Transformationen
  includeImages?: boolean; // Neu: Bilder mit extrahieren und speichern
  context?: string; // Optionaler Kontext für LLM-Optimierung
}

interface TransformSaveOptionsProps {
  originalFileName: string;
  onOptionsChangeAction: (options: TransformSaveOptions) => void;
  defaultLanguage?: string;
  supportedLanguages?: Array<{ value: string; label: string }>;
  defaultExtension?: string;
  className?: string;
  showExtractionMethod?: boolean; // Neu: Zeigt Extraktionsmethode für PDFs
  defaultExtractionMethod?: string; // Neu: Standard-Extraktionsmethode
  showUseCache?: boolean; // Neu: Zeigt Cache-Option
  defaultUseCache?: boolean; // Neu: Standard-Cache-Einstellung
  showIncludeImages?: boolean; // Neu: Zeigt Bilder-Option
  defaultIncludeImages?: boolean; // Neu: Standard-Bilder-Einstellung
  showCreateShadowTwin?: boolean; // Neu: Checkbox für Shadow-Twin ein-/ausblenden
}

export function TransformSaveOptions({
  originalFileName,
  onOptionsChangeAction,
  defaultLanguage = "de",
  supportedLanguages = SUPPORTED_LANGUAGES.map(lang => ({ value: lang.code, label: lang.name })),
  defaultExtension = "md",
  className,
  showExtractionMethod = false,
  defaultExtractionMethod = "native",
  showUseCache = false,
  defaultUseCache = false,
  showIncludeImages = false,
  defaultIncludeImages = false,
  showCreateShadowTwin = true
}: TransformSaveOptionsProps) {
  // Hilfsfunktion zum Extrahieren des Basisnamens ohne Erweiterung
  function getBaseFileName(fileName: string): string {
    const lastDotIndex = fileName.lastIndexOf(".");
    return lastDotIndex === -1 ? fileName : fileName.substring(0, lastDotIndex);
  }

  // Generiere Shadow-Twin Dateinamen nach Konvention: {originalname}.{targetLanguage}.md
  function generateShadowTwinName(baseName: string, targetLanguage: string): string {
    return `${baseName}.${targetLanguage}`;
  }

  const [options, setOptions] = React.useState<TransformSaveOptions>(() => {
    const baseName = getBaseFileName(originalFileName);
    return {
      targetLanguage: defaultLanguage,
      fileName: generateShadowTwinName(baseName, defaultLanguage),
      createShadowTwin: true,
      fileExtension: defaultExtension,
      extractionMethod: defaultExtractionMethod,
      useCache: defaultUseCache,
      includeImages: defaultIncludeImages
    };
  });

  // Aktualisiert die Optionen und informiert den übergeordneten Component
  const updateOptions = React.useCallback((newOptions: Partial<TransformSaveOptions>) => {
    setOptions(prev => {
      const updated = { ...prev, ...newOptions };
      
      // Wenn sich die Zielsprache ändert und Shadow-Twin aktiviert ist, 
      // aktualisiere den Dateinamen entsprechend
      if (newOptions.targetLanguage && updated.createShadowTwin) {
        const baseName = getBaseFileName(originalFileName);
        updated.fileName = generateShadowTwinName(baseName, newOptions.targetLanguage);
      }
      
      // Wenn Shadow-Twin aktiviert wird, generiere den korrekten Namen
      if (newOptions.createShadowTwin === true) {
        const baseName = getBaseFileName(originalFileName);
        updated.fileName = generateShadowTwinName(baseName, updated.targetLanguage);
      }
      
      onOptionsChangeAction(updated);
      return updated;
    });
  }, [onOptionsChangeAction, originalFileName]);

  // Effekt, um die Optionen bei Änderung des Originalnamens zu aktualisieren
  React.useEffect(() => {
    const baseName = getBaseFileName(originalFileName);
    const expectedFileName = options.createShadowTwin 
      ? generateShadowTwinName(baseName, options.targetLanguage)
      : baseName;
      
    if (expectedFileName !== options.fileName) {
      // Verzögere das Update auf den nächsten Tick, um den Rendering-Zyklus zu verlassen
      const timer = setTimeout(() => {
        updateOptions({ fileName: expectedFileName });
      }, 0);
      
      return () => clearTimeout(timer);
    }
  }, [originalFileName, options.targetLanguage, options.createShadowTwin, updateOptions, options.fileName]);

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="target-language">Zielsprache</Label>
              <Select
                value={options.targetLanguage}
                onValueChange={(value) => updateOptions({ targetLanguage: value })}
              >
                <SelectTrigger id="target-language">
                  <SelectValue placeholder="Sprache auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {supportedLanguages.map(lang => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="file-extension">Dateierweiterung</Label>
              <Select
                value={options.fileExtension}
                onValueChange={(value) => updateOptions({ fileExtension: value })}
                disabled={options.createShadowTwin} // Deaktiviert wenn Shadow-Twin
              >
                <SelectTrigger id="file-extension">
                  <SelectValue placeholder="Erweiterung wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="md">Markdown (.md)</SelectItem>
                  <SelectItem value="txt">Text (.txt)</SelectItem>
                  <SelectItem value="json">JSON (.json)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {showExtractionMethod && (
            <div>
              <Label htmlFor="extraction-method">Extraktionsmethode</Label>
              <Select
                value={options.extractionMethod || defaultExtractionMethod}
                onValueChange={(value) => updateOptions({ extractionMethod: value })}
              >
                <SelectTrigger id="extraction-method">
                  <SelectValue placeholder="Methode auswählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="native">Native Analyse</SelectItem>
                  <SelectItem value="ocr">Tesseract OCR</SelectItem>
                  <SelectItem value="both">OCR + Native</SelectItem>
                  <SelectItem value="preview">Vorschaubilder</SelectItem>
                  <SelectItem value="preview_and_native">Vorschaubilder + Native</SelectItem>
                  <SelectItem value="llm">LLM-basierte OCR</SelectItem>
                  <SelectItem value="llm_and_ocr">LLM + OCR</SelectItem>
                  <SelectItem value="mistral_ocr">Mistral OCR (LLM)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Bestimmt, wie der Inhalt aus der PDF extrahiert wird. Native = Text-Extraktion, OCR = Bild-zu-Text, LLM/Mistral = KI-basierte Analyse
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="file-name">Dateiname</Label>
            <Input
              id="file-name"
              value={options.fileName}
              onChange={(e) => updateOptions({ fileName: e.target.value })}
              disabled={options.createShadowTwin} // Deaktiviert wenn Shadow-Twin
              placeholder={options.createShadowTwin ? "Automatisch generiert" : "Dateiname eingeben"}
            />
            {options.createShadowTwin && (
              <p className="text-xs text-muted-foreground mt-1">
                Shadow-Twin Format: {getBaseFileName(originalFileName)}.{options.targetLanguage}.md
              </p>
            )}
          </div>

          {showCreateShadowTwin && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="create-shadow-twin"
                checked={options.createShadowTwin}
                onCheckedChange={(checked) => updateOptions({ createShadowTwin: !!checked })}
              />
              <Label htmlFor="create-shadow-twin">Als Shadow-Twin speichern</Label>
            </div>
          )}

          {showUseCache && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="use-cache"
                checked={options.useCache || false}
                onCheckedChange={(checked) => updateOptions({ useCache: !!checked })}
              />
              <Label htmlFor="use-cache">Cache verwenden</Label>
              <p className="text-xs text-muted-foreground ml-6">
                Beschleunigt die Verarbeitung durch Wiederverwendung vorheriger Ergebnisse
              </p>
            </div>
          )}

          {showIncludeImages && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-images"
                checked={options.includeImages || false}
                onCheckedChange={(checked) => updateOptions({ includeImages: !!checked })}
              />
              <Label htmlFor="include-images">Bilder mit extrahieren</Label>
              <p className="text-xs text-muted-foreground ml-6">
                Speichert zusätzlich alle PDF-Seiten als Bilder für Qualitätskontrolle
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 