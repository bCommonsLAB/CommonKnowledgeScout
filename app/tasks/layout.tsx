interface TasksLayoutProps {
  children: React.ReactNode
}

export default function TasksLayout({ children }: TasksLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
} 