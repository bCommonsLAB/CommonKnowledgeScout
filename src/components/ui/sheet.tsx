// Fassade (G2): Sheet-Primitives leben jetzt in @ks/ui (shadcn-Basis).
// Breite Importeure (`@/components/ui/sheet`) bleiben so unveraendert
// lauffaehig; eine Folgewelle kann sie nach und nach auf `@ks/ui` umstellen.
export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "@ks/ui"
