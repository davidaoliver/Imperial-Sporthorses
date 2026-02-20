import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  Clock,
  CheckCircle2,
  Circle,
  Pencil,
  RefreshCw,
  Sun,
  Sunset,
  Moon,
  X,
} from 'lucide-react'
import { format } from 'date-fns'

const SHIFT_CONFIG = {
  AM: { icon: Sun, iconClass: 'text-amber-500', label: 'Morning' },
  'Mid-Day': { icon: Sunset, iconClass: 'text-orange-500', label: 'Mid-Day' },
  PM: { icon: Moon, iconClass: 'text-indigo-500', label: 'Evening' },
}

const STATUS_STYLES = {
  Pending: {
    bg: 'bg-neutral-900',
    border: 'border-red-900/50',
    badge: 'bg-red-900/40 text-red-400',
    icon: Circle,
    iconColor: 'text-red-400',
  },
  'In Progress': {
    bg: 'bg-neutral-900',
    border: 'border-yellow-900/50',
    badge: 'bg-yellow-900/40 text-yellow-400',
    icon: Clock,
    iconColor: 'text-yellow-400',
  },
  Done: {
    bg: 'bg-neutral-900',
    border: 'border-green-900/50',
    badge: 'bg-green-900/40 text-green-400',
    icon: CheckCircle2,
    iconColor: 'text-green-400',
  },
}

export default function TaskBoard() {
  const { profile, isAdmin } = useAuth()
  const [tasks, setTasks] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingTask, setEditingTask] = useState(null)

  const fetchTasks = useCallback(async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      const { data, error } = await supabase
        .from('tasks')
        .select('*, assigned_user:users!tasks_assigned_to_fkey(display_name)')
        .eq('task_date', today)
        .order('sort_order', { ascending: true })

      if (error) {
        console.error('Error fetching tasks:', error)
        const { data: fallbackData } = await supabase
          .from('tasks')
          .select('*')
          .eq('task_date', today)
          .order('sort_order', { ascending: true })
        setTasks(fallbackData || [])
      } else {
        setTasks(data || [])
      }
    } catch (err) {
      console.error('fetchTasks exception:', err)
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    const { data } = await supabase
      .from('users')
      .select('id, display_name')
      .not('display_name', 'is', null)
    setUsers(data || [])
  }, [])

  useEffect(() => {
    fetchTasks()
    fetchUsers()

    // Realtime subscription
    const channel = supabase
      .channel('tasks-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => fetchTasks()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchTasks, fetchUsers])

  async function handleTaskTap(task) {
    if (task.status === 'Done') return

    let newStatus, updates
    if (task.status === 'Pending') {
      newStatus = 'In Progress'
      updates = {
        status: newStatus,
        assigned_to: profile.id,
      }
    } else if (task.status === 'In Progress') {
      newStatus = 'Done'
      updates = {
        status: newStatus,
        completed_at: new Date().toISOString(),
      }
    }

    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', task.id)

    if (error) console.error('Error updating task:', error)
  }

  async function handleReassign(taskId, userId) {
    const { error } = await supabase
      .from('tasks')
      .update({ assigned_to: userId || null })
      .eq('id', taskId)

    if (error) console.error('Error reassigning task:', error)
    setEditingTask(null)
  }

  async function generateDailyTasks() {
    const { error } = await supabase.rpc('generate_daily_tasks')
    if (error) {
      console.error('Error generating tasks:', error)
      alert('Failed to generate tasks. Make sure the database function exists.')
    } else {
      fetchTasks()
    }
  }

  const grouped = {
    AM: tasks.filter((t) => t.shift === 'AM'),
    'Mid-Day': tasks.filter((t) => t.shift === 'Mid-Day'),
    PM: tasks.filter((t) => t.shift === 'PM'),
  }

  function getAssigneeName(task) {
    if (task.assigned_user?.display_name) return task.assigned_user.display_name
    if (task.assigned_to) {
      const user = users.find((u) => u.id === task.assigned_to)
      return user?.display_name || 'Unknown'
    }
    return 'Unassigned'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="px-4 pt-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-amber-400">Task Board</h1>
          <p className="text-xs text-neutral-400">
            {format(new Date(), 'EEEE, MMMM d')}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={generateDailyTasks}
            className="flex items-center gap-1.5 text-xs bg-amber-500/20 text-amber-400 px-3 py-1.5 rounded-lg font-medium hover:bg-amber-500/30 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Generate
          </button>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-16 text-neutral-500">
          <ClipboardListIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No tasks for today</p>
          <p className="text-xs mt-1">
            {isAdmin
              ? 'Tap "Generate" to create tasks from templates.'
              : 'Tasks will appear once generated by an admin.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([shift, shiftTasks]) => {
            if (shiftTasks.length === 0) return null
            const config = SHIFT_CONFIG[shift]
            const ShiftIcon = config.icon
            return (
              <div key={shift}>
                <div className="flex items-center gap-2 mb-2">
                  <ShiftIcon className={`w-4 h-4 ${config.iconClass}`} />
                  <h2 className="text-sm font-semibold text-neutral-300">
                    {config.label} Shift
                  </h2>
                  <span className="text-[10px] bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full">
                    {shiftTasks.filter((t) => t.status === 'Done').length}/
                    {shiftTasks.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {shiftTasks.map((task) => {
                    const style = STATUS_STYLES[task.status]
                    const StatusIcon = style.icon
                    return (
                      <div
                        key={task.id}
                        onClick={() => handleTaskTap(task)}
                        className={`${style.bg} border ${style.border} rounded-xl p-3 flex items-center gap-3 transition-all active:scale-[0.98] cursor-pointer`}
                      >
                        <StatusIcon className={`w-5 h-5 ${style.iconColor} shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-medium ${
                              task.status === 'Done'
                                ? 'text-neutral-500 line-through'
                                : 'text-neutral-100'
                            }`}
                          >
                            {task.title}
                          </p>
                          <p className="text-[10px] text-neutral-500 mt-0.5">
                            {getAssigneeName(task)}
                            {task.completed_at &&
                              ` · Done at ${format(new Date(task.completed_at), 'h:mm a')}`}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${style.badge}`}
                        >
                          {task.status}
                        </span>
                        {isAdmin && task.status !== 'Done' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingTask(task)
                            }}
                            className="p-1 rounded-lg hover:bg-neutral-700 transition"
                          >
                            <Pencil className="w-3.5 h-3.5 text-neutral-500" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Reassign Modal */}
      {editingTask && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center animate-fade-in">
          <div className="bg-neutral-900 border-t border-neutral-700 rounded-t-2xl w-full max-w-lg p-5 pb-8 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-neutral-100">Reassign Task</h3>
              <button onClick={() => setEditingTask(null)}>
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            <p className="text-sm text-neutral-400 mb-3">
              <span className="font-medium">{editingTask.title}</span> — {editingTask.shift} Shift
            </p>
            <div className="space-y-1">
              <button
                onClick={() => handleReassign(editingTask.id, null)}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-neutral-800 text-sm text-neutral-400 transition"
              >
                Unassigned
              </button>
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleReassign(editingTask.id, user.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl hover:bg-neutral-800 text-sm transition ${
                    editingTask.assigned_to === user.id
                      ? 'bg-amber-500/20 text-amber-400 font-medium'
                      : 'text-neutral-300'
                  }`}
                >
                  {user.display_name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ClipboardListIcon({ className }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    </svg>
  )
}
