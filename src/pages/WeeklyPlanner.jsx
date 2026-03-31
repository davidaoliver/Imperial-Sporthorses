import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  Clock,
  CheckCircle2,
  Circle,
  ChevronLeft,
  ChevronRight,
  Sun,
  Sunset,
  Moon,
  RefreshCw,
  User,
  ArrowRightLeft,
} from 'lucide-react'
import useHandoffs from '../hooks/useHandoffs'
import HandOffModal from '../components/HandOffModal'
import {
  format,
  startOfWeek,
  endOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  isToday,
  isSameDay,
} from 'date-fns'

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

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function WeeklyPlanner() {
  const { profile, isAdmin } = useAuth()
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [weekTasks, setWeekTasks] = useState({})
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // 'all' or 'mine'
  const [schedule, setSchedule] = useState([])
  const [templates, setTemplates] = useState([])
  const [handOffTarget, setHandOffTarget] = useState(null) // { dateStr, shift, fromUserId }
  const { getHandoff, createHandoff, acceptHandoff } = useHandoffs()

  const twoWeekEnd = endOfWeek(addWeeks(weekStart, 1), { weekStartsOn: 1 })
  const allDays = Array.from({ length: 14 }, (_, i) => addDays(weekStart, i))
  const week1Days = allDays.slice(0, 7)
  const week2Days = allDays.slice(7, 14)

  const fetchWeekTasks = useCallback(async () => {
    setLoading(true)
    try {
      const startStr = format(weekStart, 'yyyy-MM-dd')
      const endStr = format(twoWeekEnd, 'yyyy-MM-dd')

      const { data, error } = await supabase
        .from('tasks')
        .select('*, assigned_user:users!tasks_assigned_to_fkey(display_name)')
        .gte('task_date', startStr)
        .lte('task_date', endStr)
        .order('sort_order', { ascending: true })

      if (error) {
        console.error('Error fetching week tasks:', error)
        // Fallback without join
        const { data: fallback } = await supabase
          .from('tasks')
          .select('*')
          .gte('task_date', startStr)
          .lte('task_date', endStr)
          .order('sort_order', { ascending: true })
        groupByDate(fallback || [])
      } else {
        groupByDate(data || [])
      }
    } catch (err) {
      console.error('fetchWeekTasks exception:', err)
      setWeekTasks({})
    } finally {
      setLoading(false)
    }
  }, [weekStart])

  function groupByDate(tasks) {
    const grouped = {}
    for (const day of allDays) {
      const key = format(day, 'yyyy-MM-dd')
      grouped[key] = []
    }
    for (const task of tasks) {
      if (grouped[task.task_date]) {
        grouped[task.task_date].push(task)
      }
    }
    setWeekTasks(grouped)
  }

  const fetchUsers = useCallback(async () => {
    const { data } = await supabase
      .from('users')
      .select('id, display_name')
      .not('display_name', 'is', null)
    setUsers(data || [])
  }, [])

  const fetchSchedule = useCallback(async () => {
    const { data, error } = await supabase
      .from('weekly_schedule')
      .select('*, user:users!weekly_schedule_user_id_fkey(display_name)')
    if (error) {
      console.error('Error fetching schedule:', error)
      const { data: fallback } = await supabase
        .from('weekly_schedule')
        .select('*')
      setSchedule(fallback || [])
    } else {
      setSchedule(data || [])
    }
  }, [])

  const fetchTemplates = useCallback(async () => {
    const { data } = await supabase
      .from('task_templates')
      .select('*')
      .order('shift')
      .order('sort_order', { ascending: true })
    setTemplates(data || [])
  }, [])

  useEffect(() => {
    fetchWeekTasks()
    fetchUsers()
    fetchSchedule()
    fetchTemplates()
  }, [fetchWeekTasks, fetchUsers, fetchSchedule, fetchTemplates])

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('weekly-tasks-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => fetchWeekTasks()
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchWeekTasks])

  // Auto-generate real tasks from templates for a given date
  async function generateTasksForDate(dateStr) {
    if (templates.length === 0) return false
    // Check if tasks already exist for this date
    const { data: existing } = await supabase
      .from('tasks')
      .select('id')
      .eq('task_date', dateStr)
      .not('shift', 'is', null)
      .limit(1)
    if (existing && existing.length > 0) return false

    // Look up scheduled staff for this day
    const date = new Date(dateStr + 'T12:00:00')
    const dayOfWeek = date.getDay()
    const staffByShift = {}
    for (const entry of schedule) {
      if (entry.day_of_week === dayOfWeek) {
        if (!staffByShift[entry.shift]) staffByShift[entry.shift] = []
        staffByShift[entry.shift].push(entry.user_id)
      }
    }

    const rows = templates.map((t) => ({
      title: t.title,
      shift: t.shift,
      sort_order: t.sort_order,
      status: 'Pending',
      task_date: dateStr,
      assigned_to: staffByShift[t.shift]?.[0] || null,
    }))

    const { error } = await supabase.from('tasks').insert(rows)
    if (error) {
      console.error('Error generating tasks:', error)
      return false
    }
    return true
  }

  // Auto-generate today's tasks if past 3 AM and none exist
  useEffect(() => {
    if (loading || templates.length === 0) return
    const now = new Date()
    if (now.getHours() < 3) return // not yet 3 AM
    const todayStr = format(now, 'yyyy-MM-dd')
    const todayTasks = weekTasks[todayStr] || []
    const hasShiftTasks = todayTasks.some(t => t.shift !== null)
    if (hasShiftTasks) return // already generated

    generateTasksForDate(todayStr).then((created) => {
      if (created) fetchWeekTasks()
    })
  }, [loading, templates.length, weekTasks, schedule])

  async function handleTaskTap(task) {
    let updates
    if (task.status === 'Pending') {
      updates = { status: 'In Progress', assigned_to: profile.id }
    } else if (task.status === 'In Progress') {
      updates = { status: 'Done', completed_at: new Date().toISOString() }
    } else if (task.status === 'Done') {
      updates = { status: 'Pending', assigned_to: null, completed_at: null }
    }

    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', task.id)

    if (error) console.error('Error updating task:', error)
  }

  function getAssigneeName(task) {
    if (task.assigned_user?.display_name) return task.assigned_user.display_name
    if (task.assigned_to) {
      const user = users.find((u) => u.id === task.assigned_to)
      return user?.display_name || 'Unknown'
    }
    return null
  }

  // Get staff scheduled for a specific day + shift from the weekly_schedule table
  function getScheduledStaff(date, shift) {
    const dayOfWeek = date.getDay()
    return schedule
      .filter((s) => s.day_of_week === dayOfWeek && s.shift === shift)
      .map((s) => {
        const name = s.user?.display_name ||
          users.find((u) => u.id === s.user_id)?.display_name || 'Unknown'
        return { id: s.user_id, name }
      })
  }

  function getDayStats(dateStr, date) {
    const dayTasks = weekTasks[dateStr] || []
    const total = dayTasks.length
    const done = dayTasks.filter((t) => t.status === 'Done').length
    const myTasks = dayTasks.filter((t) => t.assigned_to === profile?.id).length

    // For days without generated tasks, check if user is scheduled via weekly_schedule
    let myScheduled = false
    if (total === 0 && date) {
      const dayOfWeek = date.getDay()
      myScheduled = schedule.some(
        (s) => s.day_of_week === dayOfWeek && s.user_id === profile?.id
      )
    }

    // Also check if templates exist (means future days will have tasks)
    const hasTemplates = total === 0 && templates.length > 0

    return { total, done, myTasks, myScheduled, hasTemplates }
  }

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd')
  const realTasks = weekTasks[selectedDateStr] || []
  const hasRealTasks = realTasks.some(t => t.shift !== null)

  // For future days that haven't been generated yet, show template previews
  const scheduledByShift = {}
  if (!hasRealTasks) {
    const dayOfWeek = selectedDate.getDay()
    for (const entry of schedule) {
      if (entry.day_of_week === dayOfWeek) {
        if (!scheduledByShift[entry.shift]) scheduledByShift[entry.shift] = []
        const name = entry.user?.display_name ||
          users.find((u) => u.id === entry.user_id)?.display_name || 'Unknown'
        scheduledByShift[entry.shift].push(name)
      }
    }
  }

  let selectedDayTasks = hasRealTasks
    ? realTasks
    : templates.map((t) => ({
        id: `template-${t.id}`,
        title: t.title,
        shift: t.shift,
        sort_order: t.sort_order,
        status: 'Pending',
        assigned_to: null,
        assigned_user: null,
        completed_at: null,
        _isPreview: true,
        _scheduledNames: scheduledByShift[t.shift] || [],
      }))

  if (filter === 'mine') {
    selectedDayTasks = selectedDayTasks.filter((t) => {
      if (t._isPreview) {
        return t._scheduledNames?.includes(profile?.display_name)
      }
      return t.assigned_to === profile?.id
    })
  }

  const groupedByShift = {
    AM: selectedDayTasks.filter((t) => t.shift === 'AM'),
    'Mid-Day': selectedDayTasks.filter((t) => t.shift === 'Mid-Day'),
    PM: selectedDayTasks.filter((t) => t.shift === 'PM'),
  }

  return (
    <div className="px-4 pt-4 pb-4">
      {/* Week Navigation Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-amber-400">Weekly Planner</h1>
          <p className="text-xs text-neutral-400">
            {format(weekStart, 'MMM d')} – {format(twoWeekEnd, 'MMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              const prev = subWeeks(weekStart, 1)
              setWeekStart(prev)
              setSelectedDate(addDays(prev, selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1))
            }}
            className="p-2 rounded-lg hover:bg-neutral-800 transition text-neutral-400"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              const now = new Date()
              setWeekStart(startOfWeek(now, { weekStartsOn: 1 }))
              setSelectedDate(now)
            }}
            className="text-[10px] font-medium px-2.5 py-1 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition"
          >
            Today
          </button>
          <button
            onClick={() => {
              const next = addWeeks(weekStart, 1)
              setWeekStart(next)
              setSelectedDate(addDays(next, selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1))
            }}
            className="p-2 rounded-lg hover:bg-neutral-800 transition text-neutral-400"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Day Pills — 2 Weeks */}
      {[{ label: 'This Week', days: week1Days }, { label: 'Next Week', days: week2Days }].map(
        ({ label, days }) => (
          <div key={label} className="mb-3">
            <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">
              {label}
            </p>
            <div className="grid grid-cols-7 gap-1.5">
              {days.map((day, i) => {
                const dateStr = format(day, 'yyyy-MM-dd')
                const stats = getDayStats(dateStr, day)
                const selected = isSameDay(day, selectedDate)
                const today = isToday(day)
                const completionPct =
                  stats.total > 0 ? stats.done / stats.total : 0
                const hasWork = stats.myTasks > 0 || stats.myScheduled

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(day)}
                    className={`flex flex-col items-center py-2 px-1 rounded-xl transition-all relative ${
                      selected
                        ? 'bg-amber-500/20 border border-amber-500/50'
                        : hasWork
                        ? 'bg-amber-900/20 border border-amber-700/40'
                        : today
                        ? 'bg-neutral-800/80 border border-neutral-700'
                        : 'bg-neutral-900 border border-transparent hover:border-neutral-700'
                    }`}
                  >
                    <span
                      className={`text-[10px] font-medium ${
                        selected ? 'text-amber-400' : hasWork ? 'text-amber-500' : 'text-neutral-500'
                      }`}
                    >
                      {DAY_LABELS[i]}
                    </span>
                    <span
                      className={`text-sm font-bold mt-0.5 ${
                        selected
                          ? 'text-amber-400'
                          : hasWork
                          ? 'text-amber-300'
                          : today
                          ? 'text-neutral-100'
                          : 'text-neutral-300'
                      }`}
                    >
                      {format(day, 'd')}
                    </span>
                    {/* Completion dot for days with real tasks */}
                    {stats.total > 0 && (
                      <div className="mt-1 flex gap-0.5">
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${
                            completionPct === 1
                              ? 'bg-green-500'
                              : completionPct > 0
                              ? 'bg-yellow-500'
                              : 'bg-red-500/60'
                          }`}
                        />
                      </div>
                    )}
                    {/* "You're working" indicator */}
                    {hasWork && (
                      <span className="text-[8px] text-amber-400 font-semibold mt-0.5">
                        {stats.myTasks > 0 ? `${stats.myTasks} mine` : 'Scheduled'}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      )}

      {/* Filter Toggle */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setFilter('all')}
          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition ${
            filter === 'all'
              ? 'bg-amber-500/20 text-amber-400'
              : 'bg-neutral-800 text-neutral-400 hover:text-neutral-300'
          }`}
        >
          All Tasks
        </button>
        <button
          onClick={() => setFilter('mine')}
          className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition ${
            filter === 'mine'
              ? 'bg-amber-500/20 text-amber-400'
              : 'bg-neutral-800 text-neutral-400 hover:text-neutral-300'
          }`}
        >
          <User className="w-3 h-3" />
          My Tasks
        </button>
        {/* Day stats */}
        <div className="ml-auto text-[10px] text-neutral-500">
          {getDayStats(selectedDateStr).done}/{getDayStats(selectedDateStr).total} done
        </div>
      </div>

      {/* Selected Day Header */}
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-neutral-200">
          {isToday(selectedDate)
            ? 'Today'
            : format(selectedDate, 'EEEE')}{' '}
          <span className="text-neutral-500 font-normal">
            — {format(selectedDate, 'MMMM d')}
          </span>
        </h2>
      </div>

      {/* Future day preview hint */}
      {!hasRealTasks && selectedDayTasks.length > 0 && !loading && (
        <div className="flex items-center gap-2 mb-3 px-1">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-[10px] text-blue-400 font-medium">
            Upcoming — tasks will be generated at 3:00 AM
          </span>
        </div>
      )}

      {/* Tasks for selected day */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" />
        </div>
      ) : selectedDayTasks.length === 0 ? (
        <div className="text-center py-12 text-neutral-500">
          <Circle className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">No tasks or templates found</p>
          <p className="text-xs mt-1">
            {isAdmin
              ? 'Add task templates in Admin Settings to populate the planner.'
              : 'No tasks are scheduled yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(groupedByShift).map(([shift, shiftTasks]) => {
            if (shiftTasks.length === 0) return null
            const config = SHIFT_CONFIG[shift]
            const ShiftIcon = config.icon
            const doneCount = shiftTasks.filter((t) => t.status === 'Done').length
            const staff = getScheduledStaff(selectedDate, shift)

            return (
              <div key={shift}>
                <div className="flex items-center gap-2 mb-2">
                  <ShiftIcon className={`w-4 h-4 ${config.iconClass}`} />
                  <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                    {config.label}
                  </h3>
                  <span className="text-[10px] bg-neutral-800 text-neutral-500 px-2 py-0.5 rounded-full">
                    {doneCount}/{shiftTasks.length}
                  </span>
                </div>

                {/* Scheduled staff with hand-off buttons */}
                {staff.length > 0 && (
                  <div className="ml-6 mb-2 space-y-1">
                    {staff.map((person) => {
                      const handoff = getHandoff(selectedDateStr, shift, person.id)
                      const isMe = person.id === profile?.id
                      const canAccept = handoff && handoff.status === 'pending' && (handoff.to_user_id === profile?.id || isAdmin)

                      return (
                        <div key={person.id} className="flex items-center gap-1.5 flex-wrap">
                          <User className="w-3 h-3 text-amber-500/60 shrink-0" />
                          <span className={`text-[11px] font-medium ${isMe ? 'text-amber-400' : 'text-amber-500/80'}`}>
                            {person.name}{isMe ? ' (You)' : ''}
                          </span>

                          {/* Hand-off chain visible to everyone */}
                          {handoff && (
                            <>
                              <ArrowRightLeft className="w-3 h-3 text-amber-400 shrink-0" />
                              <span className="text-[11px] font-medium text-amber-400">
                                {handoff.to_user?.display_name || users.find(u => u.id === handoff.to_user_id)?.display_name || 'Unknown'}
                              </span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                                handoff.status === 'accepted'
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-amber-500/20 text-amber-400'
                              }`}>
                                {handoff.status === 'accepted' ? '✓ accepted' : 'pending'}
                              </span>
                            </>
                          )}

                          {/* Hand Off button — only visible to the person themselves */}
                          {isMe && !handoff && (
                            <button
                              onClick={() => setHandOffTarget({ dateStr: selectedDateStr, shift, fromUserId: person.id })}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-400 text-[10px] font-semibold active:scale-95 transition ml-1"
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                              Hand Off
                            </button>
                          )}

                          {/* Accept button — only visible to the target user */}
                          {canAccept && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                acceptHandoff(handoff.id)
                              }}
                              className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-amber-500 text-black active:scale-95 transition ml-1"
                            >
                              Accept
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="space-y-1.5">
                  {shiftTasks.map((task) => {
                    const style = STATUS_STYLES[task.status]
                    const StatusIcon = style.icon
                    const isMyTask = task.assigned_to === profile?.id ||
                      (task._isPreview && task._scheduledNames?.includes(profile?.display_name))

                    return (
                      <div
                        key={task.id}
                        onClick={() => !task._isPreview && handleTaskTap(task)}
                        className={`${style.bg} border ${style.border} rounded-xl p-3 flex items-center gap-3 transition-all ${task._isPreview ? 'opacity-60' : 'active:scale-[0.98] cursor-pointer'} ${
                          isMyTask ? 'ring-1 ring-amber-500/30' : ''
                        }`}
                      >
                        <StatusIcon
                          className={`w-4 h-4 ${style.iconColor} shrink-0`}
                        />
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
                            {getAssigneeName(task) ||
                              (task._scheduledNames?.length > 0
                                ? task._scheduledNames.join(', ')
                                : <span className="text-neutral-600 italic">Unassigned</span>
                              )}
                            {isMyTask && (
                              <span className="text-amber-500/70"> · You</span>
                            )}
                            {task.completed_at &&
                              ` · ${format(
                                new Date(task.completed_at),
                                'h:mm a'
                              )}`}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${style.badge}`}
                        >
                          {task.status}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Hand-Off Modal */}
      {handOffTarget && (
        <HandOffModal
          shift={handOffTarget.shift}
          dateStr={handOffTarget.dateStr}
          users={users}
          currentUserId={profile?.id}
          onClose={() => setHandOffTarget(null)}
          onSubmit={async (toUserId) => {
            await createHandoff(handOffTarget.dateStr, handOffTarget.shift, handOffTarget.fromUserId, toUserId)
            setHandOffTarget(null)
          }}
        />
      )}
    </div>
  )
}
