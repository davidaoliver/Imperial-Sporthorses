import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  Users,
  MapPin,
  Beef,
  ClipboardList,
  Calendar,
  Plus,
  Trash2,
  Target,
  Circle,
  LogOut,
  ChevronDown,
  ChevronRight,
  MessageSquarePlus,
  ArrowUp,
  ArrowRight,
  ArrowDown,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SHIFTS = ['AM', 'Mid-Day', 'PM']

export default function AdminSettings() {
  const { profile, signOut } = useAuth()
  const [activeSection, setActiveSection] = useState(null)
  const [users, setUsers] = useState([])
  const [locations, setLocations] = useState([])
  const [horses, setHorses] = useState([])
  const [templates, setTemplates] = useState([])
  const [schedule, setSchedule] = useState([])
  const [boardTasks, setBoardTasks] = useState([])
  const [feedBowls, setFeedBowls] = useState([])
  const [appRequests, setAppRequests] = useState([])
  const [loading, setLoading] = useState(true)

  // Form states
  const [newLocation, setNewLocation] = useState({ name: '', type: 'Stall' })
  const [newHorse, setNewHorse] = useState({
    name: '',
    owner_info: '',
    home_stall: '',
    assigned_pasture: '',
    am_grain: '',
    pm_grain: '',
    hay_type: '',
    supplements: '',
    meds_notes: '',
  })
  const [newTemplate, setNewTemplate] = useState({ title: '', shift: 'AM', sort_order: 0 })
  const [newScheduleEntry, setNewScheduleEntry] = useState({
    user_id: '',
    day_of_week: 0,
    shift: 'AM',
  })
  const [newBoardTask, setNewBoardTask] = useState({ title: '', assigned_to: '' })
  const [newBowlHorse, setNewBowlHorse] = useState({})
  const [newRequest, setNewRequest] = useState({ title: '', description: '', priority: 'Mid' })

  const fetchAll = useCallback(async () => {
    try {
      const [uRes, lRes, hRes, tRes, sRes, bRes, bowlRes] = await Promise.all([
        supabase.from('users').select('*').order('display_name'),
        supabase.from('locations').select('*').order('type').order('name'),
        supabase.from('horses').select('*').order('name'),
        supabase.from('task_templates').select('*').order('shift').order('sort_order'),
        supabase.from('weekly_schedule').select('*, user:users!weekly_schedule_user_id_fkey(display_name)'),
        supabase.from('tasks').select('*, assigned_user:users!tasks_assigned_to_fkey(display_name)').is('shift', null).order('sort_order', { ascending: true }),
        supabase.from('feed_bowls').select('*').order('bowl_number', { ascending: true }),
      ])
      setUsers(uRes.data || [])
      setLocations(lRes.data || [])
      setHorses(hRes.data || [])
      setTemplates(tRes.data || [])
      setSchedule(sRes.data || [])
      setBoardTasks(bRes.data || [])
      setFeedBowls(bowlRes.data || [])
      // Fetch app_requests separately so it doesn't break if table doesn't exist yet
      try {
        const arRes = await supabase.from('app_requests').select('*, requester:users!app_requests_requested_by_fkey(display_name)').order('created_at', { ascending: false })
        setAppRequests(arRes.data || [])
      } catch { setAppRequests([]) }
    } catch (err) {
      console.error('fetchAll exception:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Auto-sync map locations after data loads
  useEffect(() => {
    if (locations.length === 0) return
    const needed = [
      ...Array.from({ length: 22 }, (_, i) => `Stall ${i + 1}`),
      'Pasture #1', 'Pasture #2', 'Pasture #3', 'Pasture #4', 'Pasture #5',
    ]
    const existing = locations.map((l) => l.name)
    const missing = needed.filter((n) => !existing.includes(n))
    if (missing.length > 0) syncMapLocations()
  }, [locations.length])

  // --- Users ---
  async function toggleUserRole(user) {
    const newRole = user.role === 'Admin' ? 'Staff' : 'Admin'
    await supabase.from('users').update({ role: newRole }).eq('id', user.id)
    fetchAll()
  }

  // --- Locations ---
  async function addLocation(e) {
    e.preventDefault()
    if (!newLocation.name.trim()) return
    await supabase.from('locations').insert({
      name: newLocation.name.trim(),
      type: newLocation.type,
    })
    setNewLocation({ name: '', type: 'Stall' })
    fetchAll()
  }

  async function deleteLocation(id) {
    if (!confirm('Delete this location?')) return
    await supabase.from('locations').delete().eq('id', id)
    fetchAll()
  }

  // All map locations that should always exist
  const MAP_STALLS = Array.from({ length: 22 }, (_, i) => `Stall ${i + 1}`)
  const MAP_PASTURES = ['Pasture #1', 'Pasture #2', 'Pasture #3', 'Pasture #4', 'Pasture #5']

  // Auto-create all stalls and pastures to match the facility map
  async function syncMapLocations() {
    const needed = [
      ...MAP_STALLS.map((name) => ({ name, type: 'Stall' })),
      ...MAP_PASTURES.map((name) => ({ name, type: 'Pasture' })),
    ]
    const existing = locations.map((l) => l.name)
    const toCreate = needed.filter((n) => !existing.includes(n.name))
    if (toCreate.length === 0) return
    const { error } = await supabase.from('locations').insert(toCreate)
    if (error) {
      console.error('Sync error:', error)
      alert('Failed to sync: ' + error.message)
    } else {
      fetchAll()
    }
  }

  // --- Horses ---
  async function addHorse(e) {
    e.preventDefault()
    if (!newHorse.name.trim()) return
    await supabase.from('horses').insert({
      name: newHorse.name.trim(),
      owner_info: newHorse.owner_info || null,
      home_stall: newHorse.home_stall || null,
      assigned_pasture: newHorse.assigned_pasture || null,
      current_location: newHorse.home_stall || null,
      am_grain: newHorse.am_grain || null,
      pm_grain: newHorse.pm_grain || null,
      hay_type: newHorse.hay_type || null,
      supplements: newHorse.supplements || null,
      meds_notes: newHorse.meds_notes || null,
    })
    setNewHorse({
      name: '', owner_info: '', home_stall: '', assigned_pasture: '',
      am_grain: '', pm_grain: '', hay_type: '', supplements: '', meds_notes: '',
    })
    fetchAll()
  }

  async function deleteHorse(id) {
    if (!confirm('Delete this horse?')) return
    await supabase.from('horses').delete().eq('id', id)
    fetchAll()
  }

  // --- Task Templates ---
  async function addTemplate(e) {
    e.preventDefault()
    if (!newTemplate.title.trim()) return
    await supabase.from('task_templates').insert({
      title: newTemplate.title.trim(),
      shift: newTemplate.shift,
      sort_order: newTemplate.sort_order,
    })
    setNewTemplate({ title: '', shift: 'AM', sort_order: 0 })
    fetchAll()
  }

  async function deleteTemplate(id) {
    await supabase.from('task_templates').delete().eq('id', id)
    fetchAll()
  }

  // --- Schedule ---
  async function addScheduleEntry(e) {
    e.preventDefault()
    if (!newScheduleEntry.user_id) return
    await supabase.from('weekly_schedule').insert({
      user_id: newScheduleEntry.user_id,
      day_of_week: parseInt(newScheduleEntry.day_of_week),
      shift: newScheduleEntry.shift,
    })
    setNewScheduleEntry({ user_id: '', day_of_week: 0, shift: 'AM' })
    fetchAll()
  }

  async function deleteScheduleEntry(id) {
    await supabase.from('weekly_schedule').delete().eq('id', id)
    fetchAll()
  }

  // --- Board Tasks ---
  async function addBoardTask(e) {
    e.preventDefault()
    if (!newBoardTask.title.trim()) return
    const { format } = await import('date-fns')
    const { error } = await supabase.from('tasks').insert({
      title: newBoardTask.title.trim(),
      shift: null,
      status: 'Pending',
      task_date: format(new Date(), 'yyyy-MM-dd'),
      assigned_to: newBoardTask.assigned_to || null,
      sort_order: 0,
    })
    if (error) {
      console.error('[Admin] Failed to create board task:', error)
      alert('Failed to create task: ' + error.message)
      return
    }
    setNewBoardTask({ title: '', assigned_to: '' })
    fetchAll()
  }

  async function deleteBoardTask(id) {
    if (!confirm('Delete this board task?')) return
    await supabase.from('tasks').delete().eq('id', id)
    fetchAll()
  }

  const stalls = locations.filter((l) => l.type === 'Stall')
  const pastures = locations.filter((l) => l.type === 'Pasture')

  const sections = [
    { id: 'users', label: 'Manage Users', icon: Users },
    { id: 'locations', label: 'Locations', icon: MapPin },
    { id: 'horses', label: 'Horses', icon: Beef },
    { id: 'templates', label: 'Task Templates', icon: ClipboardList },
    { id: 'schedule', label: 'Weekly Schedule', icon: Calendar },
    { id: 'board', label: 'Board Tasks', icon: Target },
    { id: 'feedorder', label: 'Feed Order', icon: Circle },
    { id: 'requests', label: 'App Requests', icon: MessageSquarePlus },
  ]

  return (
    <div className="px-4 pt-4 pb-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-amber-400">Admin Settings</h1>
          <p className="text-xs text-neutral-400">
            Signed in as {profile?.display_name}
          </p>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 text-xs text-red-400 bg-red-900/30 px-3 py-1.5 rounded-lg font-medium hover:bg-red-900/50 transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>

      {/* Section list */}
      <div className="space-y-1 mb-4">
        {sections.map((sec) => {
          const Icon = sec.icon
          const isOpen = activeSection === sec.id
          return (
            <button
              key={sec.id}
              onClick={() => setActiveSection(isOpen ? null : sec.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
                isOpen
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="flex-1 text-left">{sec.label}</span>
              {isOpen ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          )
        })}
      </div>

      {/* Section Content */}
      {activeSection === 'users' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-neutral-300 mb-3">Team Members</h3>
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-2 border-b border-neutral-800 last:border-0">
                <div>
                  <p className="text-sm font-medium text-neutral-100">
                    {u.display_name || 'No name'}
                  </p>
                  <p className="text-[10px] text-neutral-500">{u.email}</p>
                </div>
                <button
                  onClick={() => toggleUserRole(u)}
                  className={`text-[10px] font-medium px-2.5 py-1 rounded-full transition ${
                    u.role === 'Admin'
                      ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                >
                  {u.role === 'Admin' ? '⭐ Admin' : 'Staff'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSection === 'locations' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-neutral-300">Stalls & Pastures</h3>
            <button
              onClick={syncMapLocations}
              className="text-[10px] font-semibold bg-amber-500/20 text-amber-400 px-2.5 py-1 rounded-lg hover:bg-amber-500/30 transition"
            >
              Sync with Map
            </button>
          </div>

            {/* Stalls — always show all 22 */}
            <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide mb-2">Stalls (22)</p>
            <div className="space-y-1.5 mb-5">
              {MAP_STALLS.map((stallName) => {
                const loc = locations.find(l => l.name === stallName)
                const horseHere = loc ? horses.find(h => h.current_location === loc.id) : null
                return (
                  <div key={stallName} className="flex items-center gap-2 py-1.5 border-b border-neutral-800 last:border-0">
                    <span className="text-sm text-neutral-300 w-20 shrink-0 font-medium">{stallName}</span>
                    <select
                      value={horseHere?.id || ''}
                      disabled={!loc}
                      onChange={async (e) => {
                        if (!loc) return
                        if (horseHere) await supabase.from('horses').update({ current_location: null }).eq('id', horseHere.id)
                        if (e.target.value) await supabase.from('horses').update({ current_location: loc.id }).eq('id', e.target.value)
                        fetchAll()
                      }}
                      className={`flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                        horseHere ? 'text-amber-300' : 'text-neutral-500'
                      }`}
                    >
                      <option value="">— Empty —</option>
                      {horses.map(h => (
                        <option key={h.id} value={h.id}>{h.name}{h.current_location && h.current_location !== loc?.id ? ' (elsewhere)' : ''}</option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>

            {/* Pastures — always show all 5 */}
            <p className="text-[10px] font-semibold text-green-400 uppercase tracking-wide mb-2">Pastures (5)</p>
            <div className="space-y-2">
              {MAP_PASTURES.map((pastureName) => {
                const loc = locations.find(l => l.name === pastureName)
                const horsesHere = loc ? horses.filter(h => h.current_location === loc.id) : []
                return (
                  <div key={pastureName} className="bg-neutral-800/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-neutral-200 font-medium">{pastureName}</span>
                      <span className="text-[10px] text-neutral-500">{horsesHere.length} horse{horsesHere.length !== 1 ? 's' : ''}</span>
                    </div>
                    {horsesHere.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {horsesHere.map(h => (
                          <span key={h.id} className="text-[10px] bg-green-900/40 text-green-400 px-2 py-0.5 rounded-full font-medium">{h.name}</span>
                        ))}
                      </div>
                    )}
                    <select
                      value=""
                      disabled={!loc}
                      onChange={async (e) => {
                        if (!loc || !e.target.value) return
                        await supabase.from('horses').update({ current_location: loc.id }).eq('id', e.target.value)
                        fetchAll()
                      }}
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-xs text-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="">+ Add horse to pasture...</option>
                      {horses.filter(h => h.current_location !== loc?.id).map(h => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
        </div>
      )}

      {activeSection === 'horses' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-neutral-300 mb-3">Add Horse</h3>
          <form onSubmit={addHorse} className="space-y-2 mb-4">
            <input
              type="text"
              value={newHorse.name}
              onChange={(e) => setNewHorse({ ...newHorse, name: e.target.value })}
              placeholder="Horse Name *"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <input
              type="text"
              value={newHorse.owner_info}
              onChange={(e) => setNewHorse({ ...newHorse, owner_info: e.target.value })}
              placeholder="Owner Info"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newHorse.home_stall}
                onChange={(e) => setNewHorse({ ...newHorse, home_stall: e.target.value })}
                className="rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">Home Stall</option>
                {stalls.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <select
                value={newHorse.assigned_pasture}
                onChange={(e) => setNewHorse({ ...newHorse, assigned_pasture: e.target.value })}
                className="rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">Assigned Pasture</option>
                {pastures.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={newHorse.am_grain} onChange={(e) => setNewHorse({ ...newHorse, am_grain: e.target.value })} placeholder="AM Grain" className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
              <input type="text" value={newHorse.pm_grain} onChange={(e) => setNewHorse({ ...newHorse, pm_grain: e.target.value })} placeholder="PM Grain" className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={newHorse.hay_type} onChange={(e) => setNewHorse({ ...newHorse, hay_type: e.target.value })} placeholder="Hay Type" className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
              <input type="text" value={newHorse.supplements} onChange={(e) => setNewHorse({ ...newHorse, supplements: e.target.value })} placeholder="Supplements" className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            <textarea
              value={newHorse.meds_notes}
              onChange={(e) => setNewHorse({ ...newHorse, meds_notes: e.target.value })}
              placeholder="Meds / Notes"
              rows={2}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <button type="submit" className="w-full bg-amber-500 text-black rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-amber-400 transition">
              Add Horse
            </button>
          </form>

          <h3 className="text-sm font-semibold text-neutral-300 mb-2">Current Horses</h3>
          <div className="space-y-1">
            {horses.map((h) => (
              <div key={h.id} className="flex items-center justify-between py-1.5 text-sm">
                <div>
                  <span className="text-neutral-300 font-medium">{h.name}</span>
                  {h.owner_info && <span className="text-[10px] text-neutral-500 ml-1">({h.owner_info})</span>}
                </div>
                <button onClick={() => deleteHorse(h.id)} className="p-1 text-neutral-500 hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSection === 'templates' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-neutral-300 mb-3">Task Templates</h3>
          <form onSubmit={addTemplate} className="flex gap-2 mb-3">
            <input
              type="text"
              value={newTemplate.title}
              onChange={(e) => setNewTemplate({ ...newTemplate, title: e.target.value })}
              placeholder="Task title"
              className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <select
              value={newTemplate.shift}
              onChange={(e) => setNewTemplate({ ...newTemplate, shift: e.target.value })}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input
              type="number"
              value={newTemplate.sort_order}
              onChange={(e) => setNewTemplate({ ...newTemplate, sort_order: parseInt(e.target.value) || 0 })}
              placeholder="#"
              className="w-14 rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <button type="submit" className="bg-amber-500 text-black px-3 py-2 rounded-lg">
              <Plus className="w-4 h-4" />
            </button>
          </form>
          {SHIFTS.map((shift) => {
            const shiftTemplates = templates.filter((t) => t.shift === shift)
            if (shiftTemplates.length === 0) return null
            return (
              <div key={shift} className="mb-3">
                <p className="text-[10px] font-semibold text-neutral-400 uppercase mb-1">{shift}</p>
                {shiftTemplates.map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-1 text-sm">
                    <span className="text-neutral-300">{t.title} <span className="text-[10px] text-neutral-500">#{t.sort_order}</span></span>
                    <button onClick={() => deleteTemplate(t.id)} className="p-1 text-neutral-500 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {activeSection === 'schedule' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-neutral-300 mb-3">Weekly Schedule</h3>
          <form onSubmit={addScheduleEntry} className="flex gap-2 mb-3 flex-wrap">
            <select
              value={newScheduleEntry.user_id}
              onChange={(e) => setNewScheduleEntry({ ...newScheduleEntry, user_id: e.target.value })}
              className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Select Staff</option>
              {users.filter(u => u.display_name).map((u) => (
                <option key={u.id} value={u.id}>{u.display_name}</option>
              ))}
            </select>
            <select
              value={newScheduleEntry.day_of_week}
              onChange={(e) => setNewScheduleEntry({ ...newScheduleEntry, day_of_week: e.target.value })}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {DAYS.map((d, i) => <option key={i} value={i}>{d.slice(0, 3)}</option>)}
            </select>
            <select
              value={newScheduleEntry.shift}
              onChange={(e) => setNewScheduleEntry({ ...newScheduleEntry, shift: e.target.value })}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button type="submit" className="bg-amber-500 text-black px-3 py-2 rounded-lg">
              <Plus className="w-4 h-4" />
            </button>
          </form>
          {DAYS.map((day, dayIdx) => {
            const dayEntries = schedule.filter((s) => s.day_of_week === dayIdx)
            if (dayEntries.length === 0) return null
            return (
              <div key={dayIdx} className="mb-2">
                <p className="text-[10px] font-semibold text-neutral-400 uppercase mb-1">{day}</p>
                {dayEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between py-1 text-sm">
                    <span className="text-neutral-300">
                      {entry.user?.display_name || 'Unknown'}{' '}
                      <span className="text-[10px] text-neutral-500">— {entry.shift}</span>
                    </span>
                    <button onClick={() => deleteScheduleEntry(entry.id)} className="p-1 text-neutral-500 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )
          })}
          {schedule.length === 0 && (
            <p className="text-xs text-neutral-500 text-center py-4">No schedule entries yet.</p>
          )}
        </div>
      )}
      {activeSection === 'board' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-neutral-300 mb-3">Board Tasks</h3>
          <p className="text-[10px] text-neutral-500 mb-3">General goals &amp; assignments that appear on the Task Board.</p>
          <form onSubmit={addBoardTask} className="space-y-2 mb-4">
            <input
              type="text"
              value={newBoardTask.title}
              onChange={(e) => setNewBoardTask({ ...newBoardTask, title: e.target.value })}
              placeholder="What needs to get done?"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <div className="flex gap-2">
              <select
                value={newBoardTask.assigned_to}
                onChange={(e) => setNewBoardTask({ ...newBoardTask, assigned_to: e.target.value })}
                className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">Unassigned</option>
                {users.filter(u => u.display_name).map((u) => (
                  <option key={u.id} value={u.id}>{u.display_name}</option>
                ))}
              </select>
              <button type="submit" className="bg-amber-500 text-black px-4 py-2 rounded-lg text-sm font-semibold">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </form>
          <div className="space-y-2">
            {boardTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between py-2 border-b border-neutral-800 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${task.status === 'Done' ? 'text-neutral-500 line-through' : 'text-neutral-100'}`}>
                    {task.title}
                  </p>
                  <p className="text-[10px] text-neutral-500">
                    {task.assigned_user?.display_name || 'Unassigned'}
                    <span className={`ml-1.5 ${
                      task.status === 'Done' ? 'text-green-500' : task.status === 'In Progress' ? 'text-yellow-500' : 'text-red-500'
                    }`}>
                      · {task.status}
                    </span>
                  </p>
                </div>
                <button onClick={() => deleteBoardTask(task.id)} className="p-1 text-neutral-500 hover:text-red-400 shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {boardTasks.length === 0 && (
              <p className="text-xs text-neutral-500 text-center py-4">No board tasks yet. Add one above.</p>
            )}
          </div>
        </div>
      )}

      {activeSection === 'feedorder' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-neutral-300">Feed Bowls</h3>
            <button
              onClick={async () => {
                const nextNum = feedBowls.length + 1
                const col = ((nextNum - 1) % 4)
                const row = Math.floor((nextNum - 1) / 4)
                await supabase.from('feed_bowls').insert({
                  bowl_number: nextNum,
                  horse_id: null,
                  x: 60 + col * 90,
                  y: 60 + row * 80,
                })
                fetchAll()
              }}
              className="flex items-center gap-1.5 text-xs bg-amber-500/20 text-amber-400 px-3 py-1.5 rounded-lg font-medium hover:bg-amber-500/30 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Bowl
            </button>
          </div>

          <div className="space-y-2">
            {feedBowls.map((bowl) => {
              const horse = bowl.horse_id ? horses.find(h => h.id === bowl.horse_id) : null
              return (
                <div key={bowl.id} className="flex items-center gap-2 py-2 border-b border-neutral-800 last:border-0">
                  <span className="text-sm text-amber-400 font-semibold w-16 shrink-0">Bowl {bowl.bowl_number}</span>
                  <select
                    value={bowl.horse_id || ''}
                    onChange={async (e) => {
                      await supabase.from('feed_bowls').update({ horse_id: e.target.value || null }).eq('id', bowl.id)
                      fetchAll()
                    }}
                    className={`flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      horse ? 'text-amber-300' : 'text-neutral-500'
                    }`}
                  >
                    <option value="">— Empty —</option>
                    {horses.map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete Bowl ${bowl.bowl_number}?`)) return
                      await supabase.from('feed_bowls').delete().eq('id', bowl.id)
                      fetchAll()
                    }}
                    className="p-1 text-neutral-600 hover:text-red-400 transition shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
            {feedBowls.length === 0 && (
              <p className="text-xs text-neutral-500 text-center py-4">No bowls yet. Tap "Add Bowl" to create one.</p>
            )}
          </div>
        </div>
      )}
      {activeSection === 'requests' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-neutral-300 mb-3">Request App Changes</h3>
          <p className="text-[10px] text-neutral-500 mb-3">Submit feature requests, bug reports, or change requests for the app.</p>
          <form onSubmit={async (e) => {
            e.preventDefault()
            if (!newRequest.title.trim()) return
            const { error } = await supabase.from('app_requests').insert({
              title: newRequest.title.trim(),
              description: newRequest.description.trim() || null,
              priority: newRequest.priority,
              requested_by: profile?.id || null,
            })
            if (error) {
              console.error('[Admin] Failed to create request:', error)
              alert('Failed to submit: ' + error.message)
              return
            }
            setNewRequest({ title: '', description: '', priority: 'Mid' })
            fetchAll()
          }} className="space-y-2 mb-5">
            <input
              type="text"
              value={newRequest.title}
              onChange={(e) => setNewRequest({ ...newRequest, title: e.target.value })}
              placeholder="What would you like changed? *"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <textarea
              value={newRequest.description}
              onChange={(e) => setNewRequest({ ...newRequest, description: e.target.value })}
              placeholder="Details (optional)"
              rows={2}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <div className="flex gap-2">
              <div className="flex-1 flex gap-1">
                {['High', 'Mid', 'Low'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setNewRequest({ ...newRequest, priority: p })}
                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-semibold transition ${
                      newRequest.priority === p
                        ? p === 'High' ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/50'
                        : p === 'Mid' ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50'
                        : 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/50'
                        : 'bg-neutral-800 text-neutral-500 hover:bg-neutral-700'
                    }`}
                  >
                    {p === 'High' && <ArrowUp className="w-3 h-3" />}
                    {p === 'Mid' && <ArrowRight className="w-3 h-3" />}
                    {p === 'Low' && <ArrowDown className="w-3 h-3" />}
                    {p}
                  </button>
                ))}
              </div>
              <button type="submit" className="bg-amber-500 text-black px-4 py-2 rounded-lg text-sm font-semibold hover:bg-amber-400 transition">
                Submit
              </button>
            </div>
          </form>

          {['High', 'Mid', 'Low'].map((priority) => {
            const priorityRequests = appRequests.filter((r) => r.priority === priority)
            if (priorityRequests.length === 0) return null
            const colors = priority === 'High' ? { label: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-900/50' }
              : priority === 'Mid' ? { label: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-900/50' }
              : { label: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-900/50' }
            return (
              <div key={priority} className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  {priority === 'High' && <ArrowUp className={`w-3.5 h-3.5 ${colors.label}`} />}
                  {priority === 'Mid' && <ArrowRight className={`w-3.5 h-3.5 ${colors.label}`} />}
                  {priority === 'Low' && <ArrowDown className={`w-3.5 h-3.5 ${colors.label}`} />}
                  <p className={`text-[10px] font-semibold uppercase tracking-wide ${colors.label}`}>
                    {priority} Priority ({priorityRequests.length})
                  </p>
                </div>
                <div className="space-y-2">
                  {priorityRequests.map((req) => (
                    <div key={req.id} className={`${colors.bg} border ${colors.border} rounded-lg p-3`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${req.status === 'Done' ? 'text-neutral-500 line-through' : req.status === 'Dismissed' ? 'text-neutral-600 line-through' : 'text-neutral-100'}`}>
                            {req.title}
                          </p>
                          {req.description && (
                            <p className="text-[11px] text-neutral-400 mt-0.5">{req.description}</p>
                          )}
                          <p className="text-[10px] text-neutral-500 mt-1">
                            {req.requester?.display_name || 'Unknown'} · {new Date(req.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <select
                            value={req.status}
                            onChange={async (e) => {
                              await supabase.from('app_requests').update({ status: e.target.value }).eq('id', req.id)
                              fetchAll()
                            }}
                            className={`text-[10px] rounded-lg border border-neutral-700 bg-neutral-800 px-1.5 py-1 font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                              req.status === 'Open' ? 'text-amber-400' : req.status === 'In Progress' ? 'text-blue-400' : req.status === 'Done' ? 'text-green-400' : 'text-neutral-500'
                            }`}
                          >
                            <option value="Open">Open</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Done">Done</option>
                            <option value="Dismissed">Dismissed</option>
                          </select>
                          <button
                            onClick={async () => {
                              if (!confirm('Delete this request?')) return
                              await supabase.from('app_requests').delete().eq('id', req.id)
                              fetchAll()
                            }}
                            className="p-1 text-neutral-600 hover:text-red-400 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          {appRequests.length === 0 && (
            <p className="text-xs text-neutral-500 text-center py-4">No requests yet. Submit one above!</p>
          )}
        </div>
      )}
    </div>
  )
}
