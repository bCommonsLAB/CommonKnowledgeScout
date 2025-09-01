import ChatClient from './client'

export default async function ChatPage() {
  return (
    <div className="p-6">
      <div className="text-xl font-semibold mb-4">Chat</div>
      <ChatClient />
    </div>
  )
}




