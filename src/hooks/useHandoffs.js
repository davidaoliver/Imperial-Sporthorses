import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export default function useHandoffs() {
  const [handoffs, setHandoffs] = useState([])

  const fetchHandoffs = useCallback(async () => {
    // Try with joins first, fall back to plain select
    const { data, error } = await supabase
      .from('shift_handoffs')
      .select(
        '*, from_user:users!shift_handoffs_from_user_id_fkey(display_name), to_user:users!shift_handoffs_to_user_id_fkey(display_name)'
      )

    if (error) {
      console.warn('[Handoffs] Join query failed, trying fallback:', error.message)
      const { data: fallback } = await supabase
        .from('shift_handoffs')
        .select('*')
      setHandoffs(fallback || [])
    } else {
      setHandoffs(data || [])
    }
  }, [])

  useEffect(() => {
    fetchHandoffs()

    const channel = supabase
      .channel('handoffs-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shift_handoffs' },
        () => fetchHandoffs()
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchHandoffs])

  // Get handoff for a specific date + shift + user (pending or accepted)
  function getHandoff(dateStr, shift, userId) {
    return handoffs.find(
      (h) =>
        h.handoff_date === dateStr &&
        h.shift === shift &&
        h.from_user_id === userId
    )
  }

  // Get all handoffs for a specific date + shift
  function getShiftHandoffs(dateStr, shift) {
    return handoffs.filter(
      (h) => h.handoff_date === dateStr && h.shift === shift
    )
  }

  // Create a handoff request
  async function createHandoff(dateStr, shift, fromUserId, toUserId) {
    const existing = handoffs.find(
      (h) =>
        h.handoff_date === dateStr &&
        h.shift === shift &&
        h.from_user_id === fromUserId &&
        h.status === 'pending'
    )
    if (existing) return { error: 'A hand-off is already pending' }

    const { data: insertData, error } = await supabase.from('shift_handoffs').insert({
      handoff_date: dateStr,
      shift,
      from_user_id: fromUserId,
      to_user_id: toUserId,
    }).select()

    if (error) {
      console.error('[Handoffs] Error creating handoff:', error)
      return { error: error.message }
    }
    await fetchHandoffs()
    return { error: null }
  }

  // Accept a handoff
  async function acceptHandoff(handoffId) {
    const { data: updated, error } = await supabase
      .from('shift_handoffs')
      .update({
        status: 'accepted',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', handoffId)
      .select()

    if (error) {
      console.error('[Handoffs] Error accepting:', error)
      return { error: error.message }
    }
    await fetchHandoffs()
    return { error: null }
  }

  return { handoffs, getHandoff, getShiftHandoffs, createHandoff, acceptHandoff }
}
