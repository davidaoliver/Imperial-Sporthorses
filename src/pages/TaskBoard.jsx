import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  Clock,
  CheckCircle2,
  Circle,
  Pencil,
  RefreshCw,
  Trash2,
  X,
  ListChecks,
  Target,
} from 'lucide-react'
import { format } from 'date-fns'

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

const FILTER_TABS = [
  { key: 'active', label: 'Active' },
  { key: 'done', label: 'Completed' },
  { key: 'all', label: 'All' },
]

export default function TaskBoard() {
  const { profile, isAdmin } = useAuth()
  const [tasks, setTasks] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingTask, setEditingTask] = useState(null)
  const [filterTab, setFilterTab] = useState('active')

  const fetchTasks = useCallback(async () => {
    try {
      console.log('[TaskBoard] Fetching board tasks...')
      // Try with join first
      const { data, error } = await supabase
        .from('tasks')
        .select('*, assigned_user:users!tasks_assigned_to_fkey(display_name)')
        .is('shift', null)
        .order('sort_order', { ascending: true })

      if (error) {
        console.warn('[TaskBoard] Join query failed:', error.message)
        // Fallback without join
        const { data: fallbackData, error: fbErr } = await supabase
          .from('tasks')
          .select('*')
          .is('shift', null)
          .order('sort_order', { ascending: true })
        console.log('[TaskBoard] Fallback result:', fallbackData?.length, fbErr?.message)
        setTasks(fallbackData || [])
      } else {
        console.log('[TaskBoard] Loaded', data?.length, 'board tasks')
        setTasks(data || [])
      }
    } catch (err) {
      console.error('[TaskBoard] fetchTasks exception:', err)
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

    const channel = supabase
      .channel('board-tasks-realtime')
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
    let updates
    if (task.status === 'Pending') {
      updates = {
        status: 'In Progress',
        assigned_to: task.assigned_to || profile.id,
      }
    } else if (task.status === 'In Progress') {
      updates = {
        status: 'Done',
        completed_at: new Date().toISOString(),
      }
    } else if (task.status === 'Done') {
      // Undo — revert back to In Progress
      updates = {
        status: 'In Progress',
        completed_at: null,
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

  async function handleDeleteTask(taskId) {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (error) console.error('Error deleting task:', error)
  }

  function getAssigneeName(task) {
    if (task.assigned_user?.display_name) return task.assigned_user.display_name
    if (task.assigned_to) {
      const user = users.find((u) => u.id === task.assigned_to)
      return user?.display_name || 'Unknown'
    }
    return null
  }

  const now = new Date()
  const filtered = tasks.filter((t) => {
    if (filterTab === 'active') {
      // Show active tasks + done tasks completed within last 24 hours
      if (t.status !== 'Done') return true
      if (t.completed_at) {
        const completedAt = new Date(t.completed_at)
        return (now - completedAt) < 24 * 60 * 60 * 1000
      }
      return false
    }
    if (filterTab === 'done') return t.status === 'Done'
    return true
  })

  const activeCount = tasks.filter((t) => t.status !== 'Done').length
  const doneCount = tasks.filter((t) => t.status === 'Done').length

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
            Overarching goals &amp; assignments
          </p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
          <Target className="w-3.5 h-3.5 text-amber-500" />
          <span><span className="text-amber-400 font-bold">{activeCount}</span> active</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
          <span><span className="text-green-400 font-bold">{doneCount}</span> done</span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-4">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterTab(tab.key)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition ${
              filterTab === tab.key
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-neutral-800 text-neutral-400 hover:text-neutral-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Task list grouped by assignee */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-neutral-500">
          <ListChecks className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">
            {filterTab === 'done' ? 'No completed tasks yet' : 'No active tasks'}
          </p>
          <p className="text-xs mt-1">
            {isAdmin
              ? 'Add tasks from Admin Settings → Board Tasks.'
              : 'Tasks will appear when assigned by an admin.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {(() => {
            // Group tasks by assignee
            const groups = {}
            filtered.forEach((task) => {
              const name = getAssigneeName(task) || '_unassigned'
              if (!groups[name]) groups[name] = []
              groups[name].push(task)
            })
            // Sort: assigned people first (alphabetical), unassigned last
            const sortedKeys = Object.keys(groups).sort((a, b) => {
              if (a === '_unassigned') return 1
              if (b === '_unassigned') return -1
              return a.localeCompare(b)
            })
            return sortedKeys.map((groupName) => (
              <div key={groupName}>
                <div className={`flex items-center gap-2 mb-2 px-1 ${
                  groupName !== '_unassigned' ? 'border-l-2 border-amber-500 pl-2' : 'pl-3'
                }`}>
                  <span className={`text-xs font-bold uppercase tracking-wide ${
                    groupName !== '_unassigned' ? 'text-amber-400' : 'text-neutral-600'
                  }`}>
                    {groupName === '_unassigned' ? 'Unassigned' : groupName}
                  </span>
                  <span className="text-[10px] text-neutral-600">{groups[groupName].length}</span>
                </div>
                <div className="space-y-2">
                  {groups[groupName].map((task) => {
                    const style = STATUS_STYLES[task.status]
                    const StatusIcon = style.icon
                    const isMyTask = task.assigned_to === profile?.id

                    return (
                      <div
                        key={task.id}
                        onClick={() => handleTaskTap(task)}
                        className={`${style.bg} border ${style.border} rounded-xl p-3 flex items-center gap-3 transition-all active:scale-[0.98] cursor-pointer ${
                          isMyTask ? 'ring-1 ring-amber-500/30' : ''
                        }`}
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
                            {isMyTask && (
                              <span className="text-amber-500/70">You</span>
                            )}
                            {task.completed_at &&
                              `${isMyTask ? ' · ' : ''}Done ${format(new Date(task.completed_at), 'MMM d, h:mm a')}`}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${style.badge}`}
                        >
                          {task.status}
                        </span>
                        {isAdmin && (
                          <div className="flex items-center gap-0.5">
                            {task.status !== 'Done' && (
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
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                if (confirm('Delete this task?')) handleDeleteTask(task.id)
                              }}
                              className="p-1 rounded-lg hover:bg-neutral-700 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-neutral-500" />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          })()}
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
              <span className="font-medium">{editingTask.title}</span>
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
