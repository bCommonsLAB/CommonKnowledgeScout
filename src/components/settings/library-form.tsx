"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { Textarea } from "../ui/textarea"

const libraryFormSchema = z.object({
    name: z.string({
        required_error: "Bitte geben Sie einen Namen ein.",
      }),
    description: z.string({
        required_error: "Bitte geben Sie eine Beschreibung ein.",
    }),
    url: z.string({
        required_error: "Bitte geben Sie eine URL ein.",
    }),
    language: z.string({
        required_error: "Bitte wählen Sie eine Sprache.",
    }),
    image: z.instanceof(FileList).optional().transform(file => {
      if (!file || file.length === 0) return undefined;
      return file.item(0) || undefined;
    })
})

type LibraryFormValues = z.infer<typeof libraryFormSchema>

const defaultValues: Partial<LibraryFormValues> = {
    name: "",
    description: "",
    url: "",
    language: "de"
}

export function LibraryForm() {
  const form = useForm<LibraryFormValues>({
    resolver: zodResolver(libraryFormSchema),
    defaultValues,
  })

  function onSubmit(data: LibraryFormValues) {
    toast({
      title: "Sie haben die folgenden Werte eingegeben:",
      description: (
        <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
          <code className="text-white">{JSON.stringify({...data, image: data.image?.name}, null, 2)}</code>
        </pre>
      ),
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>
                Geben sie ihrer Bibliothek einen treffenden Namen.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Url-Kurzname</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>
                Geben sie ihrer Bibliothek eine URL.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Über diese Bibliothek</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Erzählen Sie etwas über diese Bibliothek"
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Sie können andere Bibliotheken mit @erwähnen, um sie zu verlinken.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="image"
          render={({ field: { onChange, value, ...field } }) => (
            <FormItem>
              <FormLabel>Bibliotheks-Icon</FormLabel>
              <FormControl>
                <div className="flex items-center gap-4">
                  {value && (
                    <div className="relative h-20 w-20 rounded-md border">
                      <img
                        src={value instanceof File ? URL.createObjectURL(value) : undefined}
                        alt="Vorschau"
                        className="object-cover rounded-md"
                        onLoad={(e) => {
                          if (value instanceof File) {
                            URL.revokeObjectURL(e.currentTarget.src);
                          }
                        }}
                      />
                    </div>
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        onChange(e.target.files);
                      }
                    }}
                    {...field}
                  />
                </div>
              </FormControl>
              <FormDescription>
                Wählen Sie ein Icon oder Logo für Ihre Bibliothek. Empfohlene Größe: 256x256 Pixel.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="language"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sprache</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Sprache auswählen" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="fr">Französisch</SelectItem>
                  <SelectItem value="es">Spanisch</SelectItem>
                  <SelectItem value="it">Italienisch</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Dies ist die Sprache, die in der Bibliothek vorwiegend verwendet wird.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type="submit">Einstellungen speichern</Button>
      </form>
    </Form>
  )
}
