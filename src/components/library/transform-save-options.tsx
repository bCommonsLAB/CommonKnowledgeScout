"use client";

import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";

export interface TransformSaveOptions {
  targetLanguage: string;
  fileName: string;
  createShadowTwin: boolean;
  fileExtension: string;
}

interface TransformSaveOptionsProps {
  originalFileName: string;
  onOptionsChangeAction: (options: TransformSaveOptions) => void;
  defaultLanguage?: string;
  supportedLanguages?: Array<{ value: string; label: string }>;
  defaultExtension?: string;
  className?: string;
}

export function TransformSaveOptions({
  originalFileName,
  onOptionsChangeAction,
  defaultLanguage = "de",
  supportedLanguages = [
    { value: "de", label: "Deutsch" },
    { value: "en", label: "Englisch" },
    { value: "fr", label: "Französisch" },
    { value: "es", label: "Spanisch" },
    { value: "it", label: "Italienisch" }
  ],
  defaultExtension = "md",
  className
}: TransformSaveOptionsProps) {
  const [options, setOptions] = React.useState<TransformSaveOptions>({
    targetLanguage: defaultLanguage,
    fileName: getBaseFileName(originalFileName),
    createShadowTwin: true,
    fileExtension: defaultExtension
  });

  // Hilfsfunktion zum Extrahieren des Basisnamens ohne Erweiterung
  function getBaseFileName(fileName: string): string {
    const lastDotIndex = fileName.lastIndexOf(".");
    return lastDotIndex === -1 ? fileName : fileName.substring(0, lastDotIndex);
  }

  // Aktualisiert die Optionen und informiert den übergeordneten Component
  const updateOptions = React.useCallback((newOptions: Partial<TransformSaveOptions>) => {
    setOptions(prev => {
      const updated = { ...prev, ...newOptions };
      onOptionsChangeAction(updated);
      return updated;
    });
  }, [onOptionsChangeAction]);

  // Effekt, um die Optionen bei Änderung des Originalnamens zu aktualisieren
  React.useEffect(() => {
    // Verwenden wir eine Referenz, um zu prüfen, ob dies das erste Rendern ist
    const fileName = getBaseFileName(originalFileName);
    if (fileName !== options.fileName) {
      // Verzögere das Update auf den nächsten Tick, um den Rendering-Zyklus zu verlassen
      const timer = setTimeout(() => {
        updateOptions({ fileName });
      }, 0);
      
      return () => clearTimeout(timer);
    }
  }, [originalFileName, updateOptions, options.fileName]);

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

          <div>
            <Label htmlFor="file-name">Dateiname</Label>
            <Input
              id="file-name"
              value={options.fileName}
              onChange={(e) => updateOptions({ fileName: e.target.value })}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="create-shadow-twin"
              checked={options.createShadowTwin}
              onCheckedChange={(checked) => updateOptions({ createShadowTwin: !!checked })}
            />
            <Label htmlFor="create-shadow-twin">Als Shadow-Twin speichern</Label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 