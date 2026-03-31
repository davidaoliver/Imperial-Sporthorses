import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  ClipboardList,
  Map,
  MessageSquare,
  Wheat,
  Settings,
  CalendarDays,
  ListChecks,
} from 'lucide-react'
import TaskBoard from '../pages/TaskBoard'
import WeeklyPlanner from '../pages/WeeklyPlanner'
import FacilityMap from '../pages/FacilityMap'
import Chat from '../pages/Chat'
import FeedRoom from '../pages/FeedRoom'
import AdminSettings from '../pages/AdminSettings'

const TABS = [
  { id: 'tasks', label: 'Tasks', icon: ClipboardList },
  { id: 'map', label: 'Map', icon: Map },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'feed', label: 'Feed Room', icon: Wheat },
]

export default function Layout() {
  const [activeTab, setActiveTab] = useState('tasks')
  const [tasksView, setTasksView] = useState('weekly') // 'weekly' or 'board'
  const { isAdmin } = useAuth()

  function renderTab() {
    switch (activeTab) {
      case 'tasks':
        return (
          <div>
            {/* Sub-tabs for Tasks */}
            <div className="flex items-center gap-1 px-4 pt-3 pb-1">
              <button
                onClick={() => setTasksView('weekly')}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition ${
                  tasksView === 'weekly'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-neutral-800/60 text-neutral-400 hover:text-neutral-300'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                Weekly
              </button>
              <button
                onClick={() => setTasksView('board')}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition ${
                  tasksView === 'board'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-neutral-800/60 text-neutral-400 hover:text-neutral-300'
                }`}
              >
                <ListChecks className="w-3.5 h-3.5" />
                Board
              </button>
            </div>
            {tasksView === 'weekly' ? <WeeklyPlanner /> : <TaskBoard />}
          </div>
        )
      case 'map':
        return <FacilityMap />
      case 'chat':
        return <Chat />
      case 'feed':
        return <FeedRoom />
      case 'admin':
        return <AdminSettings />
      default:
        return <TaskBoard />
    }
  }

  return (
    <div className="flex flex-col h-screen bg-neutral-950">
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto hide-scrollbar pb-20 safe-area-top">
        {renderTab()}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-800 safe-area-bottom z-50">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-lg transition-colors ${
                  isActive
                    ? 'text-amber-400'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            )
          })}

          {/* Admin gear icon - only visible to admins */}
          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-lg transition-colors ${
                activeTab === 'admin'
                  ? 'text-amber-400'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <Settings
                className={`w-5 h-5 ${activeTab === 'admin' ? 'stroke-[2.5]' : ''}`}
              />
              <span className="text-[10px] font-medium">Admin</span>
            </button>
          )}
        </div>
      </nav>
    </div>
  )
}
