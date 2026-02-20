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
  LogOut,
  ChevronDown,
  ChevronRight,
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

  const fetchAll = useCallback(async () => {
    const [uRes, lRes, hRes, tRes, sRes] = await Promise.all([
      supabase.from('users').select('*').order('display_name'),
      supabase.from('locations').select('*').order('type').order('name'),
      supabase.from('horses').select('*').order('name'),
      supabase.from('task_templates').select('*').order('shift').order('sort_order'),
      supabase.from('weekly_schedule').select('*, user:users!weekly_schedule_user_id_fkey(display_name)'),
    ])
    setUsers(uRes.data || [])
    setLocations(lRes.data || [])
    setHorses(hRes.data || [])
    setTemplates(tRes.data || [])
    setSchedule(sRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

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

  const stalls = locations.filter((l) => l.type === 'Stall')
  const pastures = locations.filter((l) => l.type === 'Pasture')

  const sections = [
    { id: 'users', label: 'Manage Users', icon: Users },
    { id: 'locations', label: 'Locations', icon: MapPin },
    { id: 'horses', label: 'Horses', icon: Beef },
    { id: 'templates', label: 'Task Templates', icon: ClipboardList },
    { id: 'schedule', label: 'Weekly Schedule', icon: Calendar },
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
          <h3 className="text-sm font-semibold text-neutral-300 mb-3">
            Stalls & Pastures
          </h3>
          <form onSubmit={addLocation} className="flex gap-2 mb-3">
            <input
              type="text"
              value={newLocation.name}
              onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
              placeholder="Name"
              className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <select
              value={newLocation.type}
              onChange={(e) => setNewLocation({ ...newLocation, type: e.target.value })}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="Stall">Stall</option>
              <option value="Pasture">Pasture</option>
            </select>
            <button type="submit" className="bg-amber-500 text-black px-3 py-2 rounded-lg">
              <Plus className="w-4 h-4" />
            </button>
          </form>
          <div className="space-y-1">
            {locations.map((loc) => (
              <div key={loc.id} className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-neutral-300">
                  {loc.name}{' '}
                  <span className="text-[10px] text-neutral-500">({loc.type})</span>
                </span>
                <button onClick={() => deleteLocation(loc.id)} className="p-1 text-neutral-500 hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
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
    </div>
  )
}
