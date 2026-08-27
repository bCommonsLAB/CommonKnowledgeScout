// Fassade (G2): DropdownMenu-Primitives leben jetzt in @ks/ui (shadcn-Basis).
// Breite Importeure (`@/components/ui/dropdown-menu`) bleiben so unveraendert
// lauffaehig; eine Folgewelle kann sie nach und nach auf `@ks/ui` umstellen.
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from "@ks/ui"
