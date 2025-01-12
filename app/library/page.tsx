import { Library } from "@/components/library/library"

import { accounts, mails } from "@/components/mail/data/data"

export default function MailPage() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <Library 
        accounts={accounts}
        mails={mails}
        defaultLayout={[20, 40, 40]}
        navCollapsedSize={4}
      />
    </div>
  )
} 