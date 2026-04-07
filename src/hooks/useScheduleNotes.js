import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function useScheduleNotes(profileId) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const saveTimerRef = useRef(null)
  const pendingSaveRef = useRef(null)

  const fetchNotes = useCallback(async () => {
    const { data, error } = await supabase
      .from('schedule_notes')
      .select('*, creator:created_by(display_name), updater:updated_by(display_name)')
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false })
    if (error) {
      console.error('Error fetching notes:', error)
    } else {
      setNotes(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchNotes()

    const channel = supabase
      .channel('schedule-notes-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_notes' }, () =>
        fetchNotes()
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchNotes])

  async function createNote() {
    const { data, error } = await supabase
      .from('schedule_notes')
      .insert({ title: '', body: '', created_by: profileId, updated_by: profileId })
      .select()
      .single()
    if (error) {
      console.error('Error creating note:', error)
      return null
    }
    return data
  }

  function saveNote(id, fields) {
    // Cancel any pending save
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    pendingSaveRef.current = { id, fields }

    return new Promise((resolve) => {
      saveTimerRef.current = setTimeout(async () => {
        const { error } = await supabase
          .from('schedule_notes')
          .update({ ...fields, updated_by: profileId, updated_at: new Date().toISOString() })
          .eq('id', id)
        pendingSaveRef.current = null
        if (error) console.error('Error saving note:', error)
        resolve(!error)
      }, 500)
    })
  }

  async function flushSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    if (pendingSaveRef.current) {
      const { id, fields } = pendingSaveRef.current
      pendingSaveRef.current = null
      const { error } = await supabase
        .from('schedule_notes')
        .update({ ...fields, updated_by: profileId, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) console.error('Error flushing save:', error)
    }
  }

  async function deleteNote(id) {
    const { error } = await supabase.from('schedule_notes').delete().eq('id', id)
    if (error) console.error('Error deleting note:', error)
    return !error
  }

  async function togglePin(id, currentPinned) {
    const { error } = await supabase
      .from('schedule_notes')
      .update({ pinned: !currentPinned })
      .eq('id', id)
    if (error) console.error('Error toggling pin:', error)
  }

  return { notes, loading, fetchNotes, createNote, saveNote, flushSave, deleteNote, togglePin }
}
