'use client';

import * as React from 'react';
import { StorageItem, StorageProvider } from "@/lib/storage/types";

interface DocumentPreviewProps {
  item: StorageItem;
  provider: StorageProvider | null;
  activeLibraryId: string;
}

export function DocumentPreview({ item }: DocumentPreviewProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-muted-foreground">Dokumentvorschau für {item.metadata.name} (noch nicht implementiert)</p>
    </div>
  );
} 