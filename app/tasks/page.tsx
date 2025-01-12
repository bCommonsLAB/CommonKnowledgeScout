import { Metadata } from "next"
import { DataTable } from "@/components/tasks/components/data-table"
import { columns } from "@/components/tasks/components/columns"
import { UserNav } from "@/components/tasks/components/user-nav"
import tasksData from "@/components/tasks/data/tasks.json"

export const metadata: Metadata = {
  title: "Tasks",
  description: "Task management and tracking interface.",
}

/**
 * TasksPage Component
 * 
 * This component renders the main tasks page with a data table showing all tasks.
 * It loads task data from a JSON file and displays it in a sortable, filterable table.
 * 
 * @returns {JSX.Element} The rendered tasks page with data table
 */
export default async function TasksPage() {
  return (
    <div className="hidden h-full flex-1 flex-col space-y-8 p-8 md:flex">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tasks</h2>
          <p className="text-muted-foreground">
            Here&apos;s a list of your tasks and their current status
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <UserNav />
        </div>
      </div>
      <DataTable data={tasksData} columns={columns} />
    </div>
  )
} 