import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { AlertTriangle, RefreshCw, X, Pencil, Save, ZoomIn, ZoomOut, Maximize } from 'lucide-react'

// Generate Main Barn stalls: 8 bottom, 4 top-left (Stalls 1-12)
function generateMainBarnStalls() {
  const stalls = []
  const bx = 200, by = 340, sw = 27, sh = 35, gap = 2
  for (let i = 0; i < 8; i++) {
    stalls.push({ id: `mb-b${i+1}`, label: `${i+1}`, type: 'stall', x: bx+10+i*(sw+gap), y: by+170-sh-6, w: sw, h: sh, parent: 'main-barn', dbName: `Stall ${i+1}` })
  }
  for (let i = 0; i < 4; i++) {
    stalls.push({ id: `mb-t${i+1}`, label: `${i+9}`, type: 'stall', x: bx+10+i*(sw+gap), y: by+22, w: sw, h: sh, parent: 'main-barn', dbName: `Stall ${i+9}` })
  }
  return stalls
}

// Generate 6 Stall Barn stalls: 3 top, 3 bottom (Stalls 13-18)
function generateSixStallBarnStalls() {
  const stalls = []
  const bx = 10, by = 170, sw = 40, sh = 35, gap = 3
  for (let i = 0; i < 3; i++) {
    stalls.push({ id: `sb-t${i+1}`, label: `${i+13}`, type: 'stall', x: bx+10+i*(sw+gap), y: by+22, w: sw, h: sh, parent: '6stall', dbName: `Stall ${i+13}` })
  }
  for (let i = 0; i < 3; i++) {
    stalls.push({ id: `sb-b${i+1}`, label: `${i+16}`, type: 'stall', x: bx+10+i*(sw+gap), y: by+130-sh-6, w: sw, h: sh, parent: '6stall', dbName: `Stall ${i+16}` })
  }
  return stalls
}

// Generate 4 Stall Barn stalls: 2 top, 2 bottom (Stalls 19-22)
function generateFourStallBarnStalls() {
  const stalls = []
  const bx = 310, by = 130, sw = 38, sh = 32, gap = 3
  for (let i = 0; i < 2; i++) {
    stalls.push({ id: `fb-t${i+1}`, label: `${i+19}`, type: 'stall', x: bx+10+i*(sw+gap), y: by+22, w: sw, h: sh, parent: '4stall', dbName: `Stall ${i+19}` })
  }
  for (let i = 0; i < 2; i++) {
    stalls.push({ id: `fb-b${i+1}`, label: `${i+21}`, type: 'stall', x: bx+10+i*(sw+gap), y: by+110-sh-6, w: sw, h: sh, parent: '4stall', dbName: `Stall ${i+21}` })
  }
  return stalls
}

const DEFAULT_AREAS = [
  { id: 'pasture-1', label: 'Pasture #1', type: 'pasture', x: 10, y: 10, w: 150, h: 100, dbName: 'Pasture #1' },
  { id: 'xc', label: 'Cross Country Course', type: 'field', x: 170, y: 10, w: 380, h: 60 },
  { id: 'pasture-2', label: 'Pasture #2', type: 'pasture', x: 560, y: 10, w: 180, h: 100, dbName: 'Pasture #2' },
  { id: 'pasture-3', label: 'Pasture #3', type: 'pasture', x: 750, y: 10, w: 240, h: 130, dbName: 'Pasture #3' },
  { id: 'shed', label: 'Shed', type: 'building', x: 170, y: 140, w: 130, h: 80 },
  { id: '4stall', label: '4 Stall Barn', type: 'barn', x: 310, y: 130, w: 100, h: 110, dbName: '4 Stall Barn' },
  ...generateFourStallBarnStalls(),
  { id: 'covered-arena', label: 'Covered Arena', type: 'arena', x: 420, y: 120, w: 200, h: 180 },
  { id: '6stall', label: '6 Stall Barn', type: 'barn', x: 10, y: 170, w: 150, h: 130, dbName: '6 Stall Barn' },
  ...generateSixStallBarnStalls(),
  { id: 'house', label: 'House', type: 'building', x: 640, y: 150, w: 100, h: 280 },
  { id: 'pasture-4', label: 'Pasture #4', type: 'pasture', x: 750, y: 200, w: 240, h: 200, dbName: 'Pasture #4' },
  { id: 'outdoor-arena', label: 'Outdoor Arena', type: 'arena', x: 10, y: 380, w: 180, h: 130 },
  { id: 'main-barn', label: 'Main Barn', type: 'barn', x: 200, y: 340, w: 250, h: 170 },
  ...generateMainBarnStalls(),
  { id: 'pasture-5', label: 'Pasture #5', type: 'pasture', x: 200, y: 520, w: 250, h: 90, dbName: 'Pasture #5' },
  { id: 'feed-room', label: 'Feed Room', type: 'building', x: 460, y: 340, w: 80, h: 50 },
  { id: 'parking', label: 'Parking', type: 'road', x: 460, y: 400, w: 80, h: 260 },
  { id: 'entrance', label: 'Entrance', type: 'road', x: 550, y: 610, w: 120, h: 40 },
]

const AREA_STYLES = {
  pasture: { fill: '#14532d', stroke: '#22c55e', strokeW: 1.5, textColor: '#4ade80' },
  barn: { fill: '#78350f', stroke: '#d97706', strokeW: 1.5, textColor: '#fbbf24' },
  stall: { fill: '#451a03', stroke: '#92400e', strokeW: 1, textColor: '#d97706' },
  building: { fill: '#1c1917', stroke: '#57534e', strokeW: 1, textColor: '#a8a29e' },
  arena: { fill: '#1e1b4b', stroke: '#6366f1', strokeW: 1.5, textColor: '#a5b4fc' },
  field: { fill: '#052e16', stroke: '#166534', strokeW: 1, textColor: '#4ade80' },
  road: { fill: '#292524', stroke: '#57534e', strokeW: 1, textColor: '#78716c' },
}

export default function FacilityMap() {
  const { isAdmin } = useAuth()
  const svgRef = useRef(null)
  const [mapAreas, setMapAreas] = useState(DEFAULT_AREAS)
  const [locations, setLocations] = useState([])
  const [horses, setHorses] = useState([])
  const [loading, setLoading] = useState(true)
  const [draggingHorse, setDraggingHorse] = useState(null)
  const [warningModal, setWarningModal] = useState(null)
  const [selectedArea, setSelectedArea] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [dragInfo, setDragInfo] = useState(null)
  const [editLabel, setEditLabel] = useState('')
  const [editLocationId, setEditLocationId] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  // Zoom & pan state
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 1000, h: 700 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState(null)
  const lastTouchDist = useRef(null)
  const lastTouchCenter = useRef(null)
  const mapContainerRef = useRef(null)

  const MIN_ZOOM_W = 250 // max zoom in
  const MAX_ZOOM_W = 1000 // max zoom out (original)

  function resetZoom() {
    setViewBox({ x: 0, y: 0, w: 1000, h: 700 })
  }

  function zoomBy(factor) {
    setViewBox((v) => {
      const newW = Math.min(MAX_ZOOM_W, Math.max(MIN_ZOOM_W, v.w * factor))
      const newH = newW * 0.7
      const cx = v.x + v.w / 2
      const cy = v.y + v.h / 2
      return {
        x: Math.max(0, Math.min(1000 - newW, cx - newW / 2)),
        y: Math.max(0, Math.min(700 - newH, cy - newH / 2)),
        w: newW, h: newH,
      }
    })
  }

  function getTouchDist(t1, t2) {
    return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
  }

  function getTouchCenter(t1, t2) {
    return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 }
  }

  function handleTouchStart(e) {
    if (editMode) return
    if (e.touches.length === 2) {
      e.preventDefault()
      lastTouchDist.current = getTouchDist(e.touches[0], e.touches[1])
      lastTouchCenter.current = getTouchCenter(e.touches[0], e.touches[1])
    } else if (e.touches.length === 1 && viewBox.w < MAX_ZOOM_W) {
      setIsPanning(true)
      setPanStart({ x: e.touches[0].clientX, y: e.touches[0].clientY, vx: viewBox.x, vy: viewBox.y })
    }
  }

  function handleTouchMove(e) {
    if (editMode) return
    if (e.touches.length === 2 && lastTouchDist.current) {
      e.preventDefault()
      const newDist = getTouchDist(e.touches[0], e.touches[1])
      const scale = lastTouchDist.current / newDist
      lastTouchDist.current = newDist
      setViewBox((v) => {
        const newW = Math.min(MAX_ZOOM_W, Math.max(MIN_ZOOM_W, v.w * scale))
        const newH = newW * 0.7
        const cx = v.x + v.w / 2
        const cy = v.y + v.h / 2
        return {
          x: Math.max(0, Math.min(1000 - newW, cx - newW / 2)),
          y: Math.max(0, Math.min(700 - newH, cy - newH / 2)),
          w: newW, h: newH,
        }
      })
    } else if (e.touches.length === 1 && isPanning && panStart) {
      const container = mapContainerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const scaleX = viewBox.w / rect.width
      const scaleY = viewBox.h / rect.height
      const dx = (panStart.x - e.touches[0].clientX) * scaleX
      const dy = (panStart.y - e.touches[0].clientY) * scaleY
      setViewBox((v) => ({
        ...v,
        x: Math.max(0, Math.min(1000 - v.w, panStart.vx + dx)),
        y: Math.max(0, Math.min(700 - v.h, panStart.vy + dy)),
      }))
    }
  }

  function handleTouchEnd(e) {
    if (e.touches.length < 2) {
      lastTouchDist.current = null
      lastTouchCenter.current = null
    }
    if (e.touches.length === 0) {
      setIsPanning(false)
      setPanStart(null)
    }
  }

  const fetchData = useCallback(async () => {
    try {
      const [locRes, horseRes] = await Promise.all([
        supabase.from('locations').select('*'),
        supabase.from('horses').select('*'),
      ])
      setLocations(locRes.data || [])
      setHorses(horseRes.data || [])
      // Try loading saved layout
      const { data: mapData, error: mapErr } = await supabase
        .from('map_areas').select('*').order('sort_order')
      if (!mapErr && mapData && mapData.length > 0) {
        setMapAreas(mapData.map((r) => ({
          id: r.area_key, label: r.label, type: r.area_type,
          x: r.x, y: r.y, w: r.w, h: r.h,
          locationId: r.location_id, parent: r.parent_key, dbId: r.id,
        })))
      }
    } catch (err) {
      console.error('fetchData:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const ch = supabase.channel('map-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'horses' }, () => fetchData())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [fetchData])

  // SVG coordinate conversion
  function toSvg(cx, cy) {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = cx; pt.y = cy
    const p = pt.matrixTransform(svg.getScreenCTM().inverse())
    return { x: p.x, y: p.y }
  }

  // Edit mode: drag to move
  function onAreaPointerDown(e, idx) {
    if (!editMode) return
    e.stopPropagation(); e.preventDefault()
    const { x, y } = toSvg(e.clientX, e.clientY)
    const a = mapAreas[idx]
    setDragInfo({ idx, ox: x - a.x, oy: y - a.y, mode: 'move' })
  }

  // Edit mode: resize handles
  function onHandleDown(e, idx, handle) {
    if (!editMode) return
    e.stopPropagation(); e.preventDefault()
    const { x, y } = toSvg(e.clientX, e.clientY)
    setDragInfo({ idx, sx: x, sy: y, mode: 'resize', handle, orig: { ...mapAreas[idx] } })
  }

  function onPointerMove(e) {
    if (!dragInfo) return
    const { x, y } = toSvg(e.clientX, e.clientY)
    setMapAreas((prev) => {
      const next = [...prev]
      const a = { ...next[dragInfo.idx] }
      if (dragInfo.mode === 'move') {
        a.x = Math.round(x - dragInfo.ox)
        a.y = Math.round(y - dragInfo.oy)
      } else {
        const dx = x - dragInfo.sx, dy = y - dragInfo.sy, o = dragInfo.orig, h = dragInfo.handle
        if (h.includes('e')) a.w = Math.max(20, Math.round(o.w + dx))
        if (h.includes('w')) { a.x = Math.round(o.x + dx); a.w = Math.max(20, Math.round(o.w - dx)) }
        if (h.includes('s')) a.h = Math.max(15, Math.round(o.h + dy))
        if (h.includes('n')) { a.y = Math.round(o.y + dy); a.h = Math.max(15, Math.round(o.h - dy)) }
      }
      next[dragInfo.idx] = a
      return next
    })
    setHasChanges(true)
  }

  function onPointerUp() { setDragInfo(null) }

  // Save layout to DB
  async function saveLayout() {
    const rows = mapAreas.map((a, i) => ({
      area_key: a.id, label: a.label, area_type: a.type,
      x: a.x, y: a.y, w: a.w, h: a.h,
      location_id: a.locationId || null, parent_key: a.parent || null, sort_order: i,
    }))
    const { error } = await supabase.from('map_areas').upsert(rows, { onConflict: 'area_key' })
    if (error) {
      console.error('Save layout error:', error)
      alert('Failed to save: ' + error.message)
    } else {
      setHasChanges(false)
    }
  }

  // Horse helpers
  function findDbLocation(area) {
    if (area.locationId) return locations.find((l) => l.id === area.locationId)
    if (area.dbName) return locations.find((l) => l.name === area.dbName)
    return null
  }

  function getHorsesForArea(area) {
    const loc = findDbLocation(area)
    return loc ? horses.filter((h) => h.current_location === loc.id) : []
  }

  async function moveHorse(horse, targetLocation) {
    if (targetLocation.type === 'Pasture' && horse.assigned_pasture && horse.assigned_pasture !== targetLocation.id) {
      const ap = locations.find((l) => l.id === horse.assigned_pasture)
      setWarningModal({ horse, targetLocation, assignedPastureName: ap?.name || 'Unknown' })
      return
    }
    await confirmMove(horse, targetLocation)
  }

  async function confirmMove(horse, targetLocation) {
    const { error } = await supabase.from('horses').update({ current_location: targetLocation.id }).eq('id', horse.id)
    if (error) console.error('Move error:', error)
    setDraggingHorse(null); setWarningModal(null)
  }

  // Tap handling
  function handleAreaTap(area) {
    if (editMode) {
      setSelectedArea(area); setEditLabel(area.label); setEditLocationId(area.locationId || '')
      return
    }
    if (draggingHorse) {
      const loc = findDbLocation(area)
      if (loc && isAdmin) moveHorse(draggingHorse, loc)
      return
    }
    // Pastures always show horse names inline, no tap-to-expand
    if (area.type === 'pasture') return
    setSelectedArea(selectedArea?.id === area.id ? null : area)
  }

  function handleHorseTap(e, horse) {
    e.stopPropagation()
    if (isAdmin && !editMode) setDraggingHorse(horse)
  }

  // Edit: rename area
  function updateLabel(val) {
    setMapAreas((p) => p.map((a) => a.id === selectedArea.id ? { ...a, label: val } : a))
    setSelectedArea((p) => ({ ...p, label: val })); setEditLabel(val); setHasChanges(true)
  }

  // Edit: link area to location
  function linkLocation(locId) {
    setMapAreas((p) => p.map((a) => a.id === selectedArea.id ? { ...a, locationId: locId || null } : a))
    setSelectedArea((p) => ({ ...p, locationId: locId || null })); setEditLocationId(locId); setHasChanges(true)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 text-amber-400 animate-spin" /></div>
  }

  const parentAreas = mapAreas.filter((a) => !a.parent)
  const stallAreas = mapAreas.filter((a) => a.parent)

  return (
    <div className="px-2 pt-2 pb-2 flex flex-col" style={{ height: 'calc(100vh - 70px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-1 px-1">
        <div>
          <h1 className="text-lg font-bold text-amber-400 leading-tight">Facility Map</h1>
          <p className="text-[10px] text-neutral-400">
            {editMode ? 'Drag · resize · tap to edit' : 'Tap areas · pinch to zoom'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            {editMode && hasChanges && (
              <button onClick={saveLayout} className="flex items-center gap-1 text-[10px] bg-green-600 text-white px-2.5 py-1.5 rounded-lg font-semibold">
                <Save className="w-3 h-3" /> Save
              </button>
            )}
            <button
              onClick={() => { setEditMode(!editMode); setSelectedArea(null) }}
              className={`flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg font-semibold transition ${
                editMode ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400'
              }`}
            >
              {editMode ? <><X className="w-3 h-3" /> Done</> : <><Pencil className="w-3 h-3" /> Edit Map</>}
            </button>
          </div>
        )}
      </div>

      {/* Legend */}
      {!editMode && (
        <div className="flex gap-2 text-[9px] text-neutral-500 mb-1 px-1">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-700 border border-green-500 inline-block" /> Pasture</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-900 border border-amber-500 inline-block" /> Barn</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-indigo-900 border border-indigo-500 inline-block" /> Arena</span>
        </div>
      )}

      {/* Moving indicator */}
      {draggingHorse && !editMode && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-3 flex items-center justify-between">
          <p className="text-sm text-amber-400">Moving <span className="font-semibold">{draggingHorse.name}</span> — tap a destination</p>
          <button onClick={() => setDraggingHorse(null)} className="p-1 hover:bg-amber-500/20 rounded-lg"><X className="w-4 h-4 text-amber-400" /></button>
        </div>
      )}

      {/* SVG Map */}
      <div
        ref={mapContainerRef}
        className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden relative flex-1 min-h-0"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Zoom controls */}
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
          <button onClick={() => zoomBy(0.6)} className="bg-neutral-800/90 border border-neutral-700 rounded-lg p-1.5 text-amber-400 hover:bg-neutral-700 transition">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={() => zoomBy(1.5)} className="bg-neutral-800/90 border border-neutral-700 rounded-lg p-1.5 text-amber-400 hover:bg-neutral-700 transition">
            <ZoomOut className="w-4 h-4" />
          </button>
          {viewBox.w < MAX_ZOOM_W && (
            <button onClick={resetZoom} className="bg-neutral-800/90 border border-neutral-700 rounded-lg p-1.5 text-amber-400 hover:bg-neutral-700 transition">
              <Maximize className="w-4 h-4" />
            </button>
          )}
        </div>
        <svg
          ref={svgRef} viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`} className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
          style={{ touchAction: 'none' }}
          onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
        >
          <rect x="0" y="0" width="1000" height="700" fill="#0a0a0a" />

          {[...parentAreas, ...stallAreas].map((area) => {
            const idx = mapAreas.findIndex((a) => a.id === area.id)
            const style = AREA_STYLES[area.type] || AREA_STYLES.building
            const areaHorses = getHorsesForArea(area)
            const isSelected = selectedArea?.id === area.id
            const isDropTarget = !editMode && draggingHorse && (area.dbName || area.locationId)
            const isStall = area.type === 'stall'
            const isPasture = area.type === 'pasture'

            return (
              <g
                key={area.id}
                onClick={() => handleAreaTap(area)}
                onPointerDown={(e) => editMode && onAreaPointerDown(e, idx)}
                style={{ cursor: editMode ? 'move' : 'pointer' }}
              >
                <rect
                  x={area.x} y={area.y} width={area.w} height={area.h}
                  rx={isStall ? 3 : 6}
                  fill={isDropTarget ? '#451a0320' : style.fill}
                  stroke={isSelected ? '#f59e0b' : isDropTarget ? '#f59e0b80' : style.stroke}
                  strokeWidth={isSelected ? 2.5 : style.strokeW}
                />
                {/* Label */}
                <text
                  x={area.x + area.w / 2} y={isStall ? area.y + area.h / 2 + 3 : area.y + 16}
                  textAnchor="middle" fontSize={isStall ? 8 : 11} fontWeight="700"
                  fill={isSelected ? '#fbbf24' : style.textColor} opacity={0.9}
                >
                  {area.label}
                </text>
                {/* Horse count badge (non-stall, non-pasture) */}
                {!editMode && !isStall && !isPasture && areaHorses.length > 0 && !isSelected && (
                  <>
                    <circle cx={area.x + area.w - 14} cy={area.y + 14} r={9} fill="#f59e0b" />
                    <text x={area.x + area.w - 14} y={area.y + 18} textAnchor="middle" fontSize="10" fontWeight="800" fill="#000">{areaHorses.length}</text>
                  </>
                )}
                {/* Pasture: always show horse names */}
                {!editMode && isPasture && areaHorses.map((h, i) => (
                  <text key={h.id} x={area.x + area.w / 2} y={area.y + 30 + i * 14}
                    textAnchor="middle" fontSize="9" fontWeight="600" fill="#e5e5e5"
                  >{h.name}</text>
                ))}
                {/* Stall: show horse name if occupied */}
                {!editMode && isStall && areaHorses.length > 0 && (
                  <text x={area.x + area.w / 2} y={area.y + area.h / 2 + 13} textAnchor="middle" fontSize="7" fontWeight="600" fill="#e5e5e5">
                    {areaHorses[0].name}
                  </text>
                )}
                {/* Stall: occupied highlight */}
                {!editMode && isStall && areaHorses.length > 0 && (
                  <rect x={area.x} y={area.y} width={area.w} height={area.h} rx={3} fill="#f59e0b" opacity={0.12} />
                )}
                {/* Horse names when selected (non-stall) */}
                {!editMode && isSelected && !isStall && areaHorses.map((h, i) => (
                  <g key={h.id} onClick={(e) => handleHorseTap(e, h)}>
                    <rect x={area.x + 8} y={area.y + 26 + i * 22} width={area.w - 16} height={18} rx={4}
                      fill={draggingHorse?.id === h.id ? '#f59e0b40' : '#ffffff15'}
                      stroke={draggingHorse?.id === h.id ? '#f59e0b' : 'transparent'} strokeWidth={1}
                    />
                    <text x={area.x + 16} y={area.y + 39 + i * 22} fontSize="10" fontWeight="600"
                      fill={draggingHorse?.id === h.id ? '#fbbf24' : '#e5e5e5'}
                    >{h.name}</text>
                  </g>
                ))}
                {/* Resize handles in edit mode */}
                {editMode && isSelected && ['nw', 'ne', 'sw', 'se'].map((h) => {
                  const hx = h.includes('e') ? area.x + area.w : area.x
                  const hy = h.includes('s') ? area.y + area.h : area.y
                  return (
                    <rect key={h} x={hx - 5} y={hy - 5} width={10} height={10} rx={2}
                      fill="#f59e0b" stroke="#000" strokeWidth={1}
                      style={{ cursor: `${h}-resize` }}
                      onPointerDown={(e) => onHandleDown(e, idx, h)}
                    />
                  )
                })}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Edit panel */}
      {editMode && selectedArea && (
        <div className="mt-3 bg-neutral-900 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-amber-400">Edit: {selectedArea.label}</h3>
            <button onClick={() => setSelectedArea(null)} className="p-1"><X className="w-4 h-4 text-neutral-500" /></button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-neutral-500 uppercase font-semibold">Label</label>
              <input type="text" value={editLabel} onChange={(e) => updateLabel(e.target.value)}
                className="w-full mt-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <label className="text-[10px] text-neutral-500 uppercase font-semibold">Link to Location</label>
              <select value={editLocationId} onChange={(e) => linkLocation(e.target.value)}
                className="w-full mt-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500/50"
              >
                <option value="">— None —</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name} ({loc.type})</option>
                ))}
              </select>
            </div>
            <p className="text-[10px] text-neutral-600">Position: ({selectedArea.x}, {selectedArea.y}) · Size: {selectedArea.w}×{selectedArea.h}</p>
          </div>
        </div>
      )}

      {/* Detail panel (view mode) */}
      {!editMode && selectedArea && (
        <div className="mt-3 bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-amber-400">{selectedArea.label}</h3>
            <button onClick={() => setSelectedArea(null)} className="p-1"><X className="w-4 h-4 text-neutral-500" /></button>
          </div>
          {(() => {
            const areaHorses = getHorsesForArea(selectedArea)
            if (areaHorses.length === 0) {
              return <p className="text-xs text-neutral-500">{(selectedArea.dbName || selectedArea.locationId) ? 'No horses currently here.' : 'This area does not hold horses.'}</p>
            }
            return (
              <div className="space-y-1.5">
                {areaHorses.map((h) => (
                  <button key={h.id} onClick={() => isAdmin && setDraggingHorse(h)}
                    className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                      draggingHorse?.id === h.id ? 'bg-amber-500/20 text-amber-300' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
                    }`}
                  >
                    <span className="font-medium">{h.name}</span>
                    {isAdmin && <span className="text-[9px] text-neutral-500 ml-auto">Tap to move</span>}
                  </button>
                ))}
              </div>
            )
          })()}
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
              is normally assigned to <span className="font-semibold">{warningModal.assignedPastureName}</span>.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setWarningModal(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-700 text-sm font-medium text-neutral-400 hover:bg-neutral-800 transition"
              >Cancel</button>
              <button onClick={() => confirmMove(warningModal.horse, warningModal.targetLocation)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400 transition"
              >Move Anyway</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
