import PageHeader from '../components/PageHeader'
import ChatWorkspace from '../components/chat/ChatWorkspace'

export default function Chat() {
  return (
    <div>
      <PageHeader title="Chat interno" subtitle="Comunicación del equipo en tiempo real" />
      <div className="h-[74vh]">
        <ChatWorkspace />
      </div>
    </div>
  )
}
