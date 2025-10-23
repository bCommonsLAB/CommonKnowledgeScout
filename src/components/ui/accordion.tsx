"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

type AccordionProps = React.HTMLAttributes<HTMLDivElement> & {
  type?: "single" | "multiple";
  collapsible?: boolean;
  value?: string;
  defaultValue?: string;
};

type AccordionItemProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: string;
  defaultOpen?: boolean;
};

const ItemContext = React.createContext<{ open: boolean; setOpen: (v: boolean) => void } | null>(null);
const GroupContext = React.createContext<{
  type: "single" | "multiple";
  collapsible: boolean;
  activeValue?: string;
  setActiveValue: (v?: string) => void;
} | null>(null);

export function Accordion({ className, children, type = "multiple", collapsible = true, value, defaultValue }: AccordionProps) {
  const [internal, setInternal] = React.useState<string | undefined>(defaultValue);
  const activeValue = value !== undefined ? value : internal;
  const setActiveValue = (v?: string) => setInternal(v);
  return (
    <GroupContext.Provider value={{ type, collapsible, activeValue, setActiveValue }}>
      <div className={cn(className)}>{children}</div>
    </GroupContext.Provider>
  );
}

export const AccordionItem = React.forwardRef<HTMLDivElement, AccordionItemProps>(function AccordionItem(
  { className, children, defaultOpen = false, value, ...rest },
  ref
) {
  const group = React.useContext(GroupContext);
  const isSingle = group?.type === "single" && value;
  const controlledOpen = isSingle ? group?.activeValue === value : undefined;
  const [localOpen, setLocalOpen] = React.useState<boolean>(defaultOpen);
  const open = controlledOpen !== undefined ? controlledOpen : localOpen;
  const setOpen = (v: boolean) => {
    if (isSingle) {
      if (v) group?.setActiveValue(value);
      else if (group?.collapsible) group?.setActiveValue(undefined);
    } else {
      setLocalOpen(v);
    }
  };
  return (
    <div ref={ref} className={cn("border-b", className)} {...rest} data-state={open ? "open" : "closed"}>
      <ItemContext.Provider value={{ open, setOpen }}>{children}</ItemContext.Provider>
    </div>
  );
});

export const AccordionTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(function AccordionTrigger(
  { className, children, ...rest },
  ref
) {
  const ctx = React.useContext(ItemContext);
  const open = !!ctx?.open;
  const toggle = () => ctx?.setOpen(!open);
  return (
    <div className="flex">
      <button
        ref={ref}
        type="button"
        onClick={toggle}
        className={cn(
          "flex flex-1 items-center justify-between py-2 text-sm font-medium transition-all",
          "hover:underline",
          className
        )}
        aria-expanded={open}
        data-state={open ? "open" : "closed"}
        {...rest}
      >
        {children}
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
      </button>
    </div>
  );
});

export const AccordionContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function AccordionContent(
  { className, children, ...rest },
  ref
) {
  const ctx = React.useContext(ItemContext);
  const open = !!ctx?.open;
  return (
    <div
      ref={ref}
      className={cn(
        "overflow-hidden text-sm",
        open ? "data-[state=open]:animate-accordion-down" : "data-[state=closed]:animate-accordion-up",
        className
      )}
      hidden={!open}
      data-state={open ? "open" : "closed"}
      {...rest}
    >
      <div className="pb-2 pt-0">{children}</div>
    </div>
  );
});

export default Accordion;

