'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { FileAudio, FileVideo, FileText, File, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAtom } from 'jotai';
import { fileCategoryFilterAtom, FileCategory } from '@/atoms/transcription-options';

interface FileCategoryFilterProps {
  className?: string;
}

const filterOptions: Array<{
  value: FileCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}> = [
  {
    value: 'all',
    label: 'Alle',
    icon: FolderOpen,
    description: 'Alle Dateien anzeigen'
  },
  {
    value: 'media',
    label: 'Medien',
    icon: FileAudio,
    description: 'Audio- und Video-Dateien'
  },
  {
    value: 'text',
    label: 'Text',
    icon: FileText,
    description: 'Textdateien (Markdown, JSON, etc.) - werden kombiniert transformiert'
  },
  {
    value: 'documents',
    label: 'Dokumente',
    icon: File,
    description: 'PDF, Word, etc.'
  }
];

export function FileCategoryFilter({ className }: FileCategoryFilterProps) {
  const [activeFilter, setActiveFilter] = useAtom(fileCategoryFilterAtom);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {filterOptions.map((option) => {
        const Icon = option.icon;
        const isActive = activeFilter === option.value;
        
        return (
          <Button
            key={option.value}
            variant={isActive ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveFilter(option.value)}
            className={cn(
              "h-8 px-3 text-xs",
              isActive && "bg-primary text-primary-foreground"
            )}
            title={option.description}
          >
            <Icon className="h-3 w-3 mr-1" />
            {option.label}
          </Button>
        );
      })}
    </div>
  );
} 