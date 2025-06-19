"use client";

import { useAtom } from 'jotai';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import {
  selectedBatchItemsAtom,
  transcriptionDialogOpenAtom
} from '@/atoms/transcription-options';

export function TranscriptionDialog() {
  const [isOpen, setIsOpen] = useAtom(transcriptionDialogOpenAtom);
  const [selectedItems] = useAtom(selectedBatchItemsAtom);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dateien transkribieren</DialogTitle>
        </DialogHeader>
        <div className="py-6">
          <h4 className="mb-4 text-sm font-medium">Ausgewählte Dateien ({selectedItems.length})</h4>
          <div className="space-y-4">
            {selectedItems.map(({ item }) => (
              <div key={item.id} className="flex items-center justify-between">
                <span className="text-sm">{item.metadata.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Abbrechen
          </Button>
          <Button onClick={() => {
            // TODO: Implement batch transcription
            setIsOpen(false);
          }}>
            Transkription starten
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 