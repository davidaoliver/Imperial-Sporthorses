import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import useScheduleNotes from '../hooks/useScheduleNotes'
import NoteEditor from '../components/NoteEditor'
import { Search, Plus, RefreshCw, FileText, Pin } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default function ScheduleNotes() {
  const { profile } = useAuth()
  const { notes, loading, createNote, saveNote, flushSave, deleteNote, togglePin } =
    useScheduleNotes(profile?.id)
  const [selectedNote, setSelectedNote] = useState(null)
  const [search, setSearch] = useState('')

  async function handleCreate() {
    const note = await createNote()
    if (note) setSelectedNote(note)
  }

  async function handleDelete(id) {
    const ok = await deleteNote(id)
    if (ok) setSelectedNote(null)
  }

  async function handleBack() {
    await flushSave()
    setSelectedNote(null)
  }

  // Filter notes by search
  const filtered = search.trim()
    ? notes.filter(
        (n) =>
          n.title.toLowerCase().includes(search.toLowerCase()) ||
          n.body.toLowerCase().includes(search.toLowerCase())
      )
    : notes

  const pinned = filtered.filter((n) => n.pinned)
  const unpinned = filtered.filter((n) => !n.pinned)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
      </div>
    )
  }

  // Editor view
  if (selectedNote) {
    // Get latest version from notes array (realtime updates)
    const latest = notes.find((n) => n.id === selectedNote.id) || selectedNote
    return (
      <NoteEditor
        note={latest}
        onBack={handleBack}
        onDelete={handleDelete}
        onSave={saveNote}
        onTogglePin={togglePin}
      />
    )
  }

  // List view
  return (
    <div className="px-4 pt-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-amber-400">Schedule Notes</h1>
          <p className="text-xs text-neutral-400">Shared barn schedules</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search"
          className="w-full bg-neutral-800/60 border border-neutral-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
        />
      </div>

      {/* Notes List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-neutral-500">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">
            {search ? 'No matching notes' : 'No schedule notes yet'}
          </p>
          <p className="text-xs mt-1">
            {search ? 'Try a different search' : 'Tap + to create one'}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {/* Pinned Section */}
          {pinned.length > 0 && (
            <>
              <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide px-1 pt-1 pb-1">
                Pinned
              </p>
              {pinned.map((note) => (
                <NoteCard key={note.id} note={note} onTap={() => setSelectedNote(note)} />
              ))}
            </>
          )}

          {/* Unpinned Section */}
          {unpinned.length > 0 && (
            <>
              {pinned.length > 0 && (
                <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide px-1 pt-3 pb-1">
                  Notes
                </p>
              )}
              {unpinned.map((note) => (
                <NoteCard key={note.id} note={note} onTap={() => setSelectedNote(note)} />
              ))}
            </>
          )}
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={handleCreate}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-lg active:scale-95 transition z-40"
      >
        <Plus className="w-7 h-7" />
      </button>
    </div>
  )
}

function NoteCard({ note, onTap }) {
  const title = note.title || 'New Note'
  const preview = note.body ? note.body.slice(0, 80).replace(/\n/g, ' ') : 'No additional text'
  const timeAgo = note.updated_at
    ? formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })
    : ''

  return (
    <button
      onClick={onTap}
      className="w-full text-left bg-neutral-900 border border-neutral-800 rounded-xl p-3 active:scale-[0.98] transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-neutral-100 truncate">{title}</p>
          <p className="text-xs text-neutral-500 truncate mt-0.5">{preview}</p>
          <p className="text-[10px] text-neutral-600 mt-1">{timeAgo}</p>
        </div>
        {note.pinned && <Pin className="w-3.5 h-3.5 text-amber-500/60 shrink-0 mt-0.5" />}
      </div>
    </button>
  )
}
