import React, { useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from "@/lib/utils"

export interface TreeItem {
  id: string
  name: string
  icon?: React.ReactNode
  children?: TreeItem[]
}

interface TreeProps {
  data: TreeItem[]
  onSelectItem: (item: TreeItem) => void
}

export function Tree({ data, onSelectItem }: TreeProps) {
  return (
    <div className="px-1 py-2">
      <ul className="space-y-1">
        {data.map((item) => (
          <TreeNode key={item.id} item={item} onSelectItem={onSelectItem} />
        ))}
      </ul>
    </div>
  )
}

interface TreeNodeProps {
  item: TreeItem
  onSelectItem: (item: TreeItem) => void
}

function TreeNode({ item, onSelectItem }: TreeNodeProps) {
  const [isOpen, setIsOpen] = useState(false)
  const hasChildren = item.children && item.children.length > 0

  return (
    <li>
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm",
          "hover:bg-accent hover:text-accent-foreground",
          "cursor-pointer select-none",
          hasChildren && "font-medium"
        )}
        onClick={() => {
          if (hasChildren) {
            setIsOpen(!isOpen)
          } else {
            onSelectItem(item)
          }
        }}
      >
        <div className="flex items-center gap-2 flex-1">
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsOpen(!isOpen)
              }}
              className="h-4 w-4 shrink-0"
            >
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <div className="w-4" />
          )}
          {item.icon && <span className="shrink-0">{item.icon}</span>}
          <span className="truncate">{item.name}</span>
        </div>
      </div>
      {hasChildren && isOpen && item.children && (
        <ul className="ml-4 mt-1 space-y-1">
          {item.children.map((child) => (
            <TreeNode key={child.id} item={child} onSelectItem={onSelectItem} />
          ))}
        </ul>
      )}
    </li>
  )
}

