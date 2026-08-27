// Fassade (G2): `Button` lebt jetzt in @ks/ui (shadcn-Basis). Breite
// Importeure (`@/components/ui/button`) bleiben so unveraendert lauffaehig;
// eine Folgewelle kann sie nach und nach auf `@ks/ui` umstellen.
export { Button, buttonVariants, type ButtonProps } from "@ks/ui"
