"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel
} from "@/components/ui/form"
import { toast } from "@/components/ui/use-toast"

const notificationsFormSchema = z.object({
  emailNotifications: z.boolean().default(true).optional(),
  pushNotifications: z.boolean().default(true).optional(),
  marketingEmails: z.boolean().default(false).optional(),
  securityAlerts: z.boolean().default(true).optional(),
})

type NotificationsFormValues = z.infer<typeof notificationsFormSchema>

const defaultValues: Partial<NotificationsFormValues> = {
  emailNotifications: true,
  pushNotifications: true,
  marketingEmails: false,
  securityAlerts: true,
}

export function NotificationsForm() {
  const form = useForm<NotificationsFormValues>({
    resolver: zodResolver(notificationsFormSchema),
    defaultValues,
  })

  function onSubmit(data: NotificationsFormValues) {
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
          name="emailNotifications"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>E-Mail Benachrichtigungen</FormLabel>
                <FormDescription>
                  Erhalten Sie E-Mail Benachrichtigungen, wenn wichtige Ereignisse auftreten.
                </FormDescription>
              </div>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="pushNotifications"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Push Benachrichtigungen</FormLabel>
                <FormDescription>
                  Erhalten Sie Push Benachrichtigungen auf Ihren Geräten.
                </FormDescription>
              </div>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="marketingEmails"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Marketing Emails</FormLabel>
                <FormDescription>
                  Erhalten Sie E-Mails über neue Funktionen und Updates.
                </FormDescription>
              </div>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="securityAlerts"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Security Alerts</FormLabel>
                <FormDescription>
                  Erhalten Sie Alerts über Sicherheitsvorfälle und Updates.
                </FormDescription>
              </div>
            </FormItem>
          )}
        />
        <Button type="submit">Benachrichtigungen aktualisieren</Button>
      </form>
    </Form>
  )
}
