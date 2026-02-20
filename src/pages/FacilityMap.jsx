import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { MapPin, Home, TreePine, AlertTriangle, RefreshCw, X } from 'lucide-react'

export default function FacilityMap() {
  const { isAdmin } = useAuth()
  const [locations, setLocations] = useState([])
  const [horses, setHorses] = useState([])
  const [loading, setLoading] = useState(true)
  const [draggingHorse, setDraggingHorse] = useState(null)
  const [warningModal, setWarningModal] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      const [locRes, horseRes] = await Promise.all([
        supabase.from('locations').select('*').order('grid_row').order('grid_col'),
        supabase.from('horses').select('*'),
      ])
      setLocations(locRes.data || [])
      setHorses(horseRes.data || [])
    } catch (err) {
      console.error('fetchData exception:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()

    const channel = supabase
      .channel('horses-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'horses' }, () =>
        fetchData()
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchData])

  function getHorsesAtLocation(locationId) {
    return horses.filter((h) => h.current_location === locationId)
  }

  function getHorsesHomeStall(locationId) {
    return horses.filter((h) => h.home_stall === locationId)
  }

  function getHorsesAssignedPasture(locationId) {
    return horses.filter((h) => h.assigned_pasture === locationId)
  }

  async function moveHorse(horse, targetLocation) {
    // Check if target is a pasture and it's not the assigned pasture
    if (
      targetLocation.type === 'Pasture' &&
      horse.assigned_pasture &&
      horse.assigned_pasture !== targetLocation.id
    ) {
      const assignedPasture = locations.find((l) => l.id === horse.assigned_pasture)
      setWarningModal({
        horse,
        targetLocation,
        assignedPastureName: assignedPasture?.name || 'Unknown',
      })
      return
    }

    await confirmMove(horse, targetLocation)
  }

  async function confirmMove(horse, targetLocation) {
    const { error } = await supabase
      .from('horses')
      .update({ current_location: targetLocation.id })
      .eq('id', horse.id)

    if (error) console.error('Error moving horse:', error)
    setDraggingHorse(null)
    setWarningModal(null)
  }

  const stalls = locations.filter((l) => l.type === 'Stall')
  const pastures = locations.filter((l) => l.type === 'Pasture')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="px-4 pt-4 pb-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-amber-400">Facility Map</h1>
          <p className="text-xs text-neutral-400">Tap a horse to move them</p>
        </div>
        <div className="flex gap-3 text-[10px] text-neutral-500">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-400" /> In Stall
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-400" /> In Pasture
          </span>
        </div>
      </div>

      {/* Dragging indicator */}
      {draggingHorse && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-4 flex items-center justify-between">
          <p className="text-sm text-amber-400">
            Moving <span className="font-semibold">{draggingHorse.name}</span> — tap a
            destination
          </p>
          <button
            onClick={() => setDraggingHorse(null)}
            className="p-1 hover:bg-amber-500/20 rounded-lg"
          >
            <X className="w-4 h-4 text-amber-400" />
          </button>
        </div>
      )}

      {/* Stalls Section */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Home className="w-4 h-4 text-neutral-400" />
          <h2 className="text-sm font-semibold text-neutral-300">Stalls</h2>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {stalls.map((stall) => {
            const horsesHere = getHorsesAtLocation(stall.id)
            const homeHorses = getHorsesHomeStall(stall.id)
            const isDropTarget = draggingHorse !== null

            return (
              <div
                key={stall.id}
                onClick={() => {
                  if (draggingHorse && isAdmin) {
                    moveHorse(draggingHorse, stall)
                  }
                }}
                className={`bg-neutral-900 border rounded-xl p-3 min-h-[80px] transition-all ${
                  isDropTarget
                    ? 'border-amber-500/50 bg-amber-500/10 cursor-pointer hover:border-amber-400'
                    : 'border-neutral-800'
                }`}
              >
                <p className="text-[10px] font-medium text-neutral-400 mb-1">
                  {stall.name}
                </p>
                {/* Show home horse label */}
                {homeHorses.map((h) => (
                  <p
                    key={h.id}
                    className="text-[9px] text-neutral-500 italic mb-0.5"
                  >
                    Home: {h.name}
                  </p>
                ))}
                {/* Show horses currently here */}
                {horsesHere.map((h) => (
                  <button
                    key={h.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (isAdmin) setDraggingHorse(h)
                    }}
                    className={`block w-full text-left text-xs font-medium px-2 py-1 rounded-lg mt-0.5 transition ${
                      draggingHorse?.id === h.id
                        ? 'bg-amber-500/30 text-amber-300'
                        : 'bg-green-900/40 text-green-400 hover:bg-green-900/60'
                    }`}
                  >
                    {h.name}
                  </button>
                ))}
                {horsesHere.length === 0 && homeHorses.length === 0 && (
                  <p className="text-[10px] text-neutral-600 mt-1">Empty</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Pastures Section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TreePine className="w-4 h-4 text-green-400" />
          <h2 className="text-sm font-semibold text-neutral-300">Pastures</h2>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {pastures.map((pasture) => {
            const horsesHere = getHorsesAtLocation(pasture.id)
            const assignedHorses = getHorsesAssignedPasture(pasture.id)
            const isDropTarget = draggingHorse !== null

            return (
              <div
                key={pasture.id}
                onClick={() => {
                  if (draggingHorse && isAdmin) {
                    moveHorse(draggingHorse, pasture)
                  }
                }}
                className={`bg-neutral-900 border rounded-xl p-3 min-h-[80px] transition-all ${
                  isDropTarget
                    ? 'border-blue-500/50 bg-blue-500/10 cursor-pointer hover:border-blue-400'
                    : 'border-neutral-800'
                }`}
              >
                <p className="text-[10px] font-medium text-neutral-400 mb-1">
                  {pasture.name}
                </p>
                {/* Show assigned horses */}
                {assignedHorses.map((h) => (
                  <p
                    key={`assigned-${h.id}`}
                    className="text-[9px] text-neutral-500 italic mb-0.5"
                  >
                    Assigned: {h.name}
                  </p>
                ))}
                {/* Show horses currently here */}
                {horsesHere.map((h) => (
                  <button
                    key={h.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (isAdmin) setDraggingHorse(h)
                    }}
                    className={`block w-full text-left text-xs font-medium px-2 py-1 rounded-lg mt-0.5 transition ${
                      draggingHorse?.id === h.id
                        ? 'bg-amber-500/30 text-amber-300'
                        : 'bg-blue-900/40 text-blue-400 hover:bg-blue-900/60'
                    }`}
                  >
                    {h.name}
                  </button>
                ))}
                {horsesHere.length === 0 && assignedHorses.length === 0 && (
                  <p className="text-[10px] text-neutral-600 mt-1">Empty</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* No data state */}
      {locations.length === 0 && (
        <div className="text-center py-16 text-neutral-500">
          <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No locations configured</p>
          <p className="text-xs mt-1">Add stalls and pastures in the Admin panel.</p>
        </div>
      )}

      {/* Warning Modal */}
      {warningModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-6 animate-fade-in">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-5 w-full max-w-sm shadow-xl animate-scale-in">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="font-semibold text-neutral-100">Wrong Pasture</h3>
            </div>
            <p className="text-sm text-neutral-400 mb-4">
              Are you sure? <span className="font-semibold">{warningModal.horse.name}</span>{' '}
              is normally assigned to{' '}
              <span className="font-semibold">{warningModal.assignedPastureName}</span>.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setWarningModal(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-700 text-sm font-medium text-neutral-400 hover:bg-neutral-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  confirmMove(warningModal.horse, warningModal.targetLocation)
                }
                className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400 transition"
              >
                Move Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
