import { Mail as MailIcon, User2 } from "lucide-react"
import { Mail } from "@/components/mail/mail"
import { accounts, mails } from "@/components/mail/data/data"


export default function MailPage() {
  return (
    <div className="h-screen">
      <Mail 
        accounts={accounts} 
        mails={mails} 
        defaultLayout={[20, 32, 48]} 
        navCollapsedSize={4} 
      />
    </div>
  )
}