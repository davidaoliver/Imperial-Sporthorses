import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  Wheat,
  Package,
  Plus,
  RefreshCw,
  Trash2,
  X,
  Circle,
  Move,
  Save,
} from 'lucide-react'
import { format, differenceInDays, parseISO } from 'date-fns'

export default function FeedRoom() {
  const { isAdmin } = useAuth()
  const [horses, setHorses] = useState([])
  const [inventory, setInventory] = useState([])
  const [bowls, setBowls] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('chart')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showInventoryModal, setShowInventoryModal] = useState(false)
  const [bowlEditMode, setBowlEditMode] = useState(false)
  const [draggingBowl, setDraggingBowl] = useState(null)
  const bowlSvgRef = useRef(null)
  const [newItem, setNewItem] = useState({
    feed_name: '',
    quantity: '',
    delivery_date: format(new Date(), 'yyyy-MM-dd'),
    expiration_date: '',
  })
  const [newInventory, setNewInventory] = useState({ feed_name: '', quantity: '' })

  const fetchData = useCallback(async () => {
    try {
      const [horseRes, invRes, bowlRes] = await Promise.all([
        supabase.from('horses').select('*').order('name'),
        supabase.from('feed_inventory').select('*').order('expiration_date', { ascending: true }),
        supabase.from('feed_bowls').select('*').order('bowl_number', { ascending: true }),
      ])
      setHorses(horseRes.data || [])
      setInventory(invRes.data || [])
      setBowls(bowlRes.data || [])
    } catch (err) {
      console.error('fetchData exception:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()

    const channel = supabase
      .channel('feed-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_inventory' }, () =>
        fetchData()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_bowls' }, () =>
        fetchData()
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchData])

  function getExpirationStyle(dateStr) {
    if (!dateStr) return { class: 'text-neutral-500', label: '' }
    const days = differenceInDays(parseISO(dateStr), new Date())
    if (days < 0) return { class: 'bg-red-900/40 text-red-400', label: 'Expired' }
    if (days <= 14)
      return { class: 'bg-yellow-900/40 text-yellow-400', label: `${days}d left` }
    return { class: 'bg-green-900/40 text-green-400', label: `${days}d left` }
  }

  // --- Bowl drag handlers ---
  function getSvgPoint(e) {
    const svg = bowlSvgRef.current
    if (!svg) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = e.clientX; pt.y = e.clientY
    const ctm = svg.getScreenCTM().inverse()
    const svgP = pt.matrixTransform(ctm)
    return { x: svgP.x, y: svgP.y }
  }

  function onBowlPointerDown(e, bowlId) {
    if (!bowlEditMode) return
    e.preventDefault()
    e.stopPropagation()
    const pt = getSvgPoint(e)
    const bowl = bowls.find(b => b.id === bowlId)
    if (!bowl) return
    setDraggingBowl({ id: bowlId, offsetX: pt.x - bowl.x, offsetY: pt.y - bowl.y })
  }

  function onBowlPointerMove(e) {
    if (!draggingBowl) return
    const pt = getSvgPoint(e)
    setBowls(prev => prev.map(b =>
      b.id === draggingBowl.id
        ? { ...b, x: Math.round(pt.x - draggingBowl.offsetX), y: Math.round(pt.y - draggingBowl.offsetY) }
        : b
    ))
  }

  function onBowlPointerUp() {
    setDraggingBowl(null)
  }

  async function saveBowlPositions() {
    for (const b of bowls) {
      await supabase.from('feed_bowls').update({ x: b.x, y: b.y }).eq('id', b.id)
    }
    setBowlEditMode(false)
  }

  async function handleAddDelivery(e) {
    e.preventDefault()
    if (!newItem.feed_name.trim()) return

    const { error } = await supabase.from('feed_inventory').insert({
      feed_name: newItem.feed_name.trim(),
      quantity: newItem.quantity.trim() || null,
      delivery_date: newItem.delivery_date || null,
      expiration_date: newItem.expiration_date || null,
    })

    if (error) {
      console.error('Error adding delivery:', error)
      return
    }

    setNewItem({
      feed_name: '',
      quantity: '',
      delivery_date: format(new Date(), 'yyyy-MM-dd'),
      expiration_date: '',
    })
    setShowAddModal(false)
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
          <h1 className="text-xl font-bold text-amber-400">Feed Room</h1>
          <p className="text-xs text-neutral-400">Nutrition & inventory management</p>
        </div>
        {activeSection === 'inventory' && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowInventoryModal(true)}
              className="flex items-center gap-1.5 text-xs bg-green-500/20 text-green-400 px-3 py-1.5 rounded-lg font-medium hover:bg-green-500/30 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Item
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 text-xs bg-amber-500/20 text-amber-400 px-3 py-1.5 rounded-lg font-medium hover:bg-amber-500/30 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Log Delivery
            </button>
          </div>
        )}
        {activeSection === 'bowls' && isAdmin && (
          bowlEditMode ? (
            <button
              onClick={saveBowlPositions}
              className="flex items-center gap-1.5 text-xs bg-green-500/20 text-green-400 px-3 py-1.5 rounded-lg font-medium hover:bg-green-500/30 transition"
            >
              <Save className="w-3.5 h-3.5" />
              Save Layout
            </button>
          ) : (
            <button
              onClick={() => setBowlEditMode(true)}
              className="flex items-center gap-1.5 text-xs bg-amber-500/20 text-amber-400 px-3 py-1.5 rounded-lg font-medium hover:bg-amber-500/30 transition"
            >
              <Move className="w-3.5 h-3.5" />
              Edit Layout
            </button>
          )
        )}
      </div>

      {/* Section Toggle */}
      <div className="flex bg-neutral-900 rounded-xl p-1 mb-4 border border-neutral-800">
        <button
          onClick={() => setActiveSection('chart')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition ${
            activeSection === 'chart'
              ? 'bg-neutral-800 text-amber-400 shadow-sm'
              : 'text-neutral-500'
          }`}
        >
          <Wheat className="w-3.5 h-3.5" />
          Feed Chart
        </button>
        <button
          onClick={() => setActiveSection('inventory')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition ${
            activeSection === 'inventory'
              ? 'bg-neutral-800 text-amber-400 shadow-sm'
              : 'text-neutral-500'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          Inventory
        </button>
        <button
          onClick={() => setActiveSection('bowls')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition ${
            activeSection === 'bowls'
              ? 'bg-neutral-800 text-amber-400 shadow-sm'
              : 'text-neutral-500'
          }`}
        >
          <Circle className="w-3.5 h-3.5" />
          Feed Order
        </button>
      </div>

      {/* Feed Chart */}
      {activeSection === 'chart' && (
        <div>
          {horses.length === 0 ? (
            <div className="text-center py-16 text-neutral-500">
              <Wheat className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No horses configured</p>
              <p className="text-xs mt-1">Add horses in the Admin panel.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {horses.map((horse) => (
                <div
                  key={horse.id}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-neutral-100">
                      {horse.name}
                    </h3>
                    {horse.meds_notes && (
                      <span className="text-[9px] bg-purple-900/40 text-purple-400 px-2 py-0.5 rounded-full font-medium">
                        Meds
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div>
                      <span className="text-neutral-500">AM Grain:</span>{' '}
                      <span className="text-neutral-300 font-medium">
                        {horse.am_grain || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500">PM Grain:</span>{' '}
                      <span className="text-neutral-300 font-medium">
                        {horse.pm_grain || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500">Hay:</span>{' '}
                      <span className="text-neutral-300 font-medium">
                        {horse.hay_type || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500">Supps:</span>{' '}
                      <span className="text-neutral-300 font-medium">
                        {horse.supplements || '—'}
                      </span>
                    </div>
                  </div>
                  {horse.meds_notes && (
                    <div className="mt-2 bg-purple-900/30 rounded-lg px-2.5 py-1.5">
                      <p className="text-[10px] text-purple-300">
                        <span className="font-semibold">Notes:</span> {horse.meds_notes}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Inventory */}
      {activeSection === 'inventory' && (
        <div>
          {inventory.length === 0 ? (
            <div className="text-center py-16 text-neutral-500">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No inventory recorded</p>
              <p className="text-xs mt-1">Tap "Add Item" to track inventory.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {inventory.map((item) => {
                const expStyle = getExpirationStyle(item.expiration_date)
                return (
                  <div
                    key={item.id}
                    className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-100">
                        {item.feed_name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-neutral-500">
                        {item.quantity && <span>Qty: {item.quantity}</span>}
                        {item.delivery_date && (
                          <span>
                            Delivered:{' '}
                            {format(parseISO(item.delivery_date), 'MMM d')}
                          </span>
                        )}
                      </div>
                    </div>
                    {item.expiration_date && (
                      <span
                        className={`text-[10px] font-medium px-2 py-1 rounded-full whitespace-nowrap ${expStyle.class}`}
                      >
                        {expStyle.label}
                      </span>
                    )}
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete ${item.feed_name}?`)) return
                        await supabase.from('feed_inventory').delete().eq('id', item.id)
                        fetchData()
                      }}
                      className="p-1.5 text-neutral-600 hover:text-red-400 transition shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Feed Order — Bowl Map */}
      {activeSection === 'bowls' && (
        <div>
          {bowls.length === 0 ? (
            <div className="text-center py-16 text-neutral-500">
              <Circle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No bowls configured</p>
              <p className="text-xs mt-1">Add bowls in Admin → Feed Order.</p>
            </div>
          ) : (
            <>
              {bowlEditMode && (
                <p className="text-[10px] text-amber-400 text-center mb-2">Drag bowls to rearrange • Tap Save when done</p>
              )}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                <svg
                  ref={bowlSvgRef}
                  viewBox="0 0 400 300"
                  className="w-full"
                  style={{ touchAction: bowlEditMode ? 'none' : 'manipulation' }}
                  onPointerMove={onBowlPointerMove}
                  onPointerUp={onBowlPointerUp}
                  onPointerLeave={onBowlPointerUp}
                >
                  <rect x="0" y="0" width="400" height="300" fill="#0a0a0a" />
                  <text x="200" y="20" textAnchor="middle" fontSize="10" fill="#525252" fontWeight="600">Feed Room Floor</text>

                  {bowls.map((bowl) => {
                    const horse = bowl.horse_id ? horses.find(h => h.id === bowl.horse_id) : null
                    const hasHorse = !!horse
                    return (
                      <g
                        key={bowl.id}
                        onPointerDown={(e) => onBowlPointerDown(e, bowl.id)}
                        style={{ cursor: bowlEditMode ? 'move' : 'default' }}
                      >
                        <circle
                          cx={bowl.x} cy={bowl.y} r={28}
                          fill={hasHorse ? '#451a0340' : '#17171740'}
                          stroke={hasHorse ? '#d97706' : '#525252'}
                          strokeWidth={bowlEditMode ? 2.5 : 1.5}
                          strokeDasharray={bowlEditMode ? '4 2' : 'none'}
                        />
                        <text
                          x={bowl.x} y={bowl.y - 6}
                          textAnchor="middle" fontSize="9" fontWeight="700"
                          fill={hasHorse ? '#fbbf24' : '#737373'}
                        >
                          Bowl {bowl.bowl_number}
                        </text>
                        <text
                          x={bowl.x} y={bowl.y + 8}
                          textAnchor="middle" fontSize="8" fontWeight="600"
                          fill={hasHorse ? '#e5e5e5' : '#525252'}
                        >
                          {horse ? horse.name : '— empty —'}
                        </text>
                        {bowlEditMode && (
                          <circle cx={bowl.x} cy={bowl.y} r={28} fill="transparent" stroke="#f59e0b" strokeWidth={0.5} opacity={0.5} />
                        )}
                      </g>
                    )
                  })}
                </svg>
              </div>
              {!bowlEditMode && (
                <p className="text-[10px] text-neutral-600 text-center mt-2">Assign horses to bowls in Admin → Feed Order</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Add Inventory Modal */}
      {showInventoryModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center animate-fade-in">
          <div className="bg-neutral-900 border-t border-neutral-700 rounded-t-2xl w-full max-w-lg p-5 pb-24 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-neutral-100">Add Inventory Item</h3>
              <button onClick={() => setShowInventoryModal(false)}>
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (!newInventory.feed_name.trim()) return
                const { error } = await supabase.from('feed_inventory').insert({
                  feed_name: newInventory.feed_name.trim(),
                  quantity: newInventory.quantity.trim() || null,
                })
                if (error) { console.error('Error adding item:', error); return }
                setNewInventory({ feed_name: '', quantity: '' })
                setShowInventoryModal(false)
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Item Name *</label>
                <input
                  type="text"
                  value={newInventory.feed_name}
                  onChange={(e) => setNewInventory({ ...newInventory, feed_name: e.target.value })}
                  placeholder="e.g. Grain, Shavings, Supplements"
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Quantity</label>
                <input
                  type="text"
                  value={newInventory.quantity}
                  onChange={(e) => setNewInventory({ ...newInventory, quantity: e.target.value })}
                  placeholder="e.g. 10 bags, 3 bales"
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-green-600 text-white rounded-xl px-4 py-3 font-semibold hover:bg-green-500 transition mt-2"
              >
                Add to Inventory
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Delivery Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center animate-fade-in">
          <div className="bg-neutral-900 border-t border-neutral-700 rounded-t-2xl w-full max-w-lg p-5 pb-24 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-neutral-100">Add Delivery</h3>
              <button onClick={() => setShowAddModal(false)}>
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            <form onSubmit={handleAddDelivery} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">
                  Feed Name *
                </label>
                <input
                  type="text"
                  value={newItem.feed_name}
                  onChange={(e) =>
                    setNewItem({ ...newItem, feed_name: e.target.value })
                  }
                  placeholder="e.g. Timothy Hay"
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">
                  Quantity
                </label>
                <input
                  type="text"
                  value={newItem.quantity}
                  onChange={(e) =>
                    setNewItem({ ...newItem, quantity: e.target.value })
                  }
                  placeholder="e.g. 20 bales"
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">
                    Delivery Date
                  </label>
                  <input
                    type="date"
                    value={newItem.delivery_date}
                    onChange={(e) =>
                      setNewItem({ ...newItem, delivery_date: e.target.value })
                    }
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">
                    Expiration Date
                  </label>
                  <input
                    type="date"
                    value={newItem.expiration_date}
                    onChange={(e) =>
                      setNewItem({ ...newItem, expiration_date: e.target.value })
                    }
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-amber-500 text-black rounded-xl px-4 py-3 font-semibold hover:bg-amber-400 transition mt-2"
              >
                Add to Inventory
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
