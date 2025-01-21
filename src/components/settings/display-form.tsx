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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"

const displayFormSchema = z.object({
  layout: z.string({
    required_error: "Please select a layout.",
  }),
  density: z.string({
    required_error: "Please select a density.",
  }),
})

type DisplayFormValues = z.infer<typeof displayFormSchema>

const defaultValues: Partial<DisplayFormValues> = {
  layout: "default",
  density: "comfortable",
}

export function DisplayForm() {
  const form = useForm<DisplayFormValues>({
    resolver: zodResolver(displayFormSchema),
    defaultValues,
  })

  function onSubmit(data: DisplayFormValues) {
    toast({
      title: "Sie haben die folgenden Werte eingegeben:",
      description: (
        <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
          <code className="text-white">{JSON.stringify(data, null, 2)}</code>
        </pre>
      ),
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="layout"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Layout</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a layout" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="default">Standard</SelectItem>
                  <SelectItem value="compact">Kompakt</SelectItem>
                  <SelectItem value="wide">Breit</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Wählen Sie, wie Ihre Inhalte angezeigt werden sollen.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="density"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Anzeigedichte</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select display density" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="comfortable">Komfortabel</SelectItem>
                  <SelectItem value="compact">Kompakt</SelectItem>
                  <SelectItem value="spacious">Weit</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Passen Sie den Abstand zwischen Elementen an.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Anzeige aktualisieren</Button>
      </form>
    </Form>
  )
}
