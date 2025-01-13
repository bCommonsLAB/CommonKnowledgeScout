'use client';

import * as React from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TreeProps {
  children?: React.ReactNode;
  className?: string;
}

interface TreeItemProps {
  label: string;
  icon?: React.ReactNode;
  isExpanded?: boolean;
  isSelected?: boolean;
  hasChildren?: boolean;
  level?: number;
  onClick?: () => void;
  children?: React.ReactNode;
}

function TreeItem({
  label,
  icon,
  isExpanded,
  isSelected,
  hasChildren,
  level = 0,
  onClick,
  children
}: TreeItemProps) {
  return (
    <div>
      <button
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2 py-1 hover:bg-accent text-sm",
          isSelected && "bg-accent",
          level > 0 && "ml-6"
        )}
      >
        {hasChildren && (
          <div className="flex w-4 h-4 items-center justify-center">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </div>
        )}
        {!hasChildren && <div className="w-4" />}
        {icon && <div className="flex w-4 h-4 items-center justify-center">{icon}</div>}
        <span className="truncate">{label}</span>
      </button>
      {isExpanded && children && (
        <div className="ml-2">{children}</div>
      )}
    </div>
  );
}

function TreeRoot({ children, className }: TreeProps) {
  return (
    <div className={cn("h-[calc(100vh-105px)] overflow-y-auto px-2 py-2", className)}>
      {children}
    </div>
  );
}

export const Tree = {
  Root: TreeRoot,
  Item: TreeItem,
}; 