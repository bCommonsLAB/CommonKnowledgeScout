'use client';

import * as React from 'react';
import { StorageItem, StorageProvider } from "@/lib/storage/types";

interface ImagePreviewProps {
  item: StorageItem;
  provider: StorageProvider | null;
  activeLibraryId: string;
}

export function ImagePreview({ item }: ImagePreviewProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-muted-foreground">Bildvorschau für {item.metadata.name} (noch nicht implementiert)</p>
    </div>
  );
} 