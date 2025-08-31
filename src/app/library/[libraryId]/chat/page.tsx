import { ChatPanel } from '@/components/library/chat/chat-panel'

interface PageProps {
  params: Promise<{ libraryId: string }>
}

export default async function LibraryChatPage({ params }: PageProps) {
  const { libraryId } = await params
  return <ChatPanel libraryId={libraryId} />
}


