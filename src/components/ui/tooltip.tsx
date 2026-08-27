// Fassade (G2): Tooltip-Primitives leben jetzt in @ks/ui (shadcn-Basis).
// Breite Importeure (`@/components/ui/tooltip`) bleiben so unveraendert
// lauffaehig; eine Folgewelle kann sie nach und nach auf `@ks/ui` umstellen.
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@ks/ui"
