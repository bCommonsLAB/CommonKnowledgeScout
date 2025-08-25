'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { FileAudio, FileText, File, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAtom } from 'jotai';
import { fileCategoryFilterAtom, FileCategory } from '@/atoms/transcription-options';

interface FileCategoryFilterProps {
  className?: string;
  iconOnly?: boolean;
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

export function FileCategoryFilter({ className, iconOnly = false }: FileCategoryFilterProps) {
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
            size={iconOnly ? "icon" : "sm"}
            onClick={() => setActiveFilter(option.value)}
            className={cn(
              iconOnly ? "h-8 w-8" : "h-8 px-3 text-xs",
              isActive && "bg-primary text-primary-foreground"
            )}
            title={option.description}
          >
            <Icon className={cn("h-4 w-4", !iconOnly && "mr-1") } />
            {!iconOnly && option.label}
          </Button>
        );
      })}
    </div>
  );
} 