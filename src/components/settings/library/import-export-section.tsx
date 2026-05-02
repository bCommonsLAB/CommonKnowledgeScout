"use client"

/**
 * @fileoverview Import/Export-Bereich für die Library-Einstellungen.
 *
 * @description
 * Extrahiert aus library-form.tsx (Welle 3-IV-a Modul-Split).
 * Enthält Buttons zum Exportieren und Importieren der Library-Konfiguration
 * als JSON-Datei. Zwei Varianten:
 * - isNew=false: Export + Import für bestehende Library
 * - isNew=true: Nur Import (als Ausgangspunkt für neue Library)
 */

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Download, Upload } from "lucide-react"

interface ImportExportSectionProps {
  isNew: boolean;
  isLoading: boolean;
  isImportDialogOpen: boolean;
  setIsImportDialogOpen: (v: boolean) => void;
  activeLibraryLabel?: string;
  handleExportLibrary: () => Promise<void>;
  handleImportLibrary: (file: File) => Promise<void>;
}

/**
 * Section-Komponente: Export/Import für Library-Konfiguration.
 */
export function ImportExportSection({
  isNew,
  isLoading,
  isImportDialogOpen,
  setIsImportDialogOpen,
  activeLibraryLabel,
  handleExportLibrary,
  handleImportLibrary,
}: ImportExportSectionProps) {
  /** Interner Import-Dialog — wiederverwendbar für beide Varianten */
  const ImportDialog = (
    <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={isLoading}
          className={isNew ? "w-full" : undefined}
        >
          <Upload className="h-4 w-4 mr-2" />
          {isNew ? "Bibliothek aus JSON importieren" : "Bibliothek importieren"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bibliothek importieren</DialogTitle>
          <DialogDescription>
            Wählen Sie eine JSON-Datei aus, die zuvor exportiert wurde. Die Bibliothek wird mit
            einer neuen ID erstellt.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <input
            type="file"
            accept=".json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                void handleImportLibrary(file);
              }
            }}
            className="w-full"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
            Abbrechen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (isNew) {
    // Nur Import-Option beim Erstellen neuer Bibliothek
    return (
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Bibliothek importieren</h3>
            <p className="text-sm text-muted-foreground">
              Importieren Sie eine zuvor exportierte Bibliothekskonfiguration als Ausgangspunkt für
              eine neue Bibliothek.
            </p>
          </div>
          {ImportDialog}
        </CardContent>
      </Card>
    );
  }

  // Export + Import für bestehende Library
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="space-y-2">
          <h3 className="text-lg font-medium">Bibliothek exportieren / importieren</h3>
          <p className="text-sm text-muted-foreground">
            Exportieren Sie die Bibliothekskonfiguration als JSON-Datei oder importieren Sie eine
            zuvor exportierte Bibliothek.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleExportLibrary()}
            disabled={isLoading}
          >
            <Download className="h-4 w-4 mr-2" />
            {activeLibraryLabel ? `"${activeLibraryLabel}" exportieren` : "Bibliothek exportieren"}
          </Button>
          {ImportDialog}
        </div>
      </CardContent>
    </Card>
  );
}
