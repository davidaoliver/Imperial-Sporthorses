import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, Pin, PinOff, Trash2, CheckSquare } from 'lucide-react'
import { format } from 'date-fns'

export default function NoteEditor({ note, onBack, onDelete, onSave, onTogglePin }) {
  const [title, setTitle] = useState(note?.title || '')
  const [body, setBody] = useState(note?.body || '')
  const [saveStatus, setSaveStatus] = useState('saved') // 'saved' | 'saving' | 'unsaved'
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const bodyRef = useRef(null)
  const titleRef = useRef(null)
  const isNew = !note?.title && !note?.body

  // Auto-focus title if new note
  useEffect(() => {
    if (isNew && titleRef.current) {
      titleRef.current.focus()
    }
  }, [])

  function handleChange(newTitle, newBody) {
    setTitle(newTitle)
    setBody(newBody)
    setSaveStatus('saving')
    onSave(note.id, { title: newTitle, body: newBody }).then(() => {
      setSaveStatus('saved')
    })
  }

  function handleBack() {
    onBack()
  }

  function insertChecklist() {
    if (!bodyRef.current) return
    const ta = bodyRef.current
    const start = ta.selectionStart
    const before = body.slice(0, start)
    const after = body.slice(ta.selectionEnd)
    // If at start of line or start of text, just insert. Otherwise add newline first.
    const needsNewline = start > 0 && before[before.length - 1] !== '\n'
    const insert = (needsNewline ? '\n' : '') + '- [ ] '
    const newBody = before + insert + after
    setBody(newBody)
    setSaveStatus('saving')
    onSave(note.id, { title, body: newBody }).then(() => setSaveStatus('saved'))
    // Set cursor after the inserted text
    requestAnimationFrame(() => {
      const pos = start + insert.length
      ta.setSelectionRange(pos, pos)
      ta.focus()
    })
  }

  // Render body with visual checkboxes
  function handleBodyKeyDown(e) {
    if (e.key === 'Enter') {
      const ta = bodyRef.current
      const pos = ta.selectionStart
      const lines = body.slice(0, pos).split('\n')
      const currentLine = lines[lines.length - 1]
      // If current line is a checklist item, auto-continue
      if (/^- \[[ x]\] /.test(currentLine)) {
        e.preventDefault()
        const before = body.slice(0, pos)
        const after = body.slice(ta.selectionEnd)
        // If the current checklist line is empty (just the prefix), remove it instead
        if (/^- \[[ x]\] $/.test(currentLine)) {
          const newBody = body.slice(0, pos - currentLine.length) + after
          setBody(newBody)
          setSaveStatus('saving')
          onSave(note.id, { title, body: newBody }).then(() => setSaveStatus('saved'))
          requestAnimationFrame(() => {
            const newPos = pos - currentLine.length
            ta.setSelectionRange(newPos, newPos)
          })
        } else {
          const insert = '\n- [ ] '
          const newBody = before + insert + after
          setBody(newBody)
          setSaveStatus('saving')
          onSave(note.id, { title, body: newBody }).then(() => setSaveStatus('saved'))
          requestAnimationFrame(() => {
            const newPos = pos + insert.length
            ta.setSelectionRange(newPos, newPos)
          })
        }
      }
    }
  }

  const updaterName = note?.updater?.display_name || 'Unknown'
  const updatedTime = note?.updated_at ? format(new Date(note.updated_at), 'MMM d, h:mm a') : ''

  return (
    <div className="fixed inset-0 bg-neutral-950 z-50 flex flex-col animate-fade-in">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 safe-area-top">
        <button
          onClick={handleBack}
          className="flex items-center gap-1 text-amber-400 text-sm font-medium"
        >
          <ChevronLeft className="w-5 h-5" />
          Notes
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onTogglePin(note.id, note.pinned)}
            className="p-1.5 text-neutral-400 hover:text-amber-400 transition"
          >
            {note.pinned ? <PinOff className="w-5 h-5" /> : <Pin className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-1.5 text-neutral-400 hover:text-red-400 transition"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Save Status */}
      <div className="px-4 pt-2">
        <p className="text-[10px] text-neutral-600">
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : ''}
        </p>
      </div>

      {/* Title */}
      <input
        ref={titleRef}
        type="text"
        value={title}
        onChange={(e) => handleChange(e.target.value, body)}
        placeholder="Title"
        className="w-full bg-transparent text-2xl font-bold text-neutral-100 placeholder-neutral-600 outline-none border-none py-2 px-4"
      />

      {/* Body */}
      <textarea
        ref={bodyRef}
        value={body}
        onChange={(e) => handleChange(title, e.target.value)}
        onKeyDown={handleBodyKeyDown}
        placeholder="Start typing..."
        className="w-full flex-1 bg-transparent text-base text-neutral-300 placeholder-neutral-600 outline-none border-none resize-none px-4 py-2 leading-relaxed"
      />

      {/* Bottom Toolbar */}
      <div className="border-t border-neutral-800 px-4 py-2.5 flex items-center justify-between safe-area-bottom mb-0">
        <button
          onClick={insertChecklist}
          className="p-2 text-neutral-400 hover:text-amber-400 transition"
        >
          <CheckSquare className="w-5 h-5" />
        </button>
        <p className="text-[10px] text-neutral-500">
          {updaterName} {updatedTime && `\u00B7 ${updatedTime}`}
        </p>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center animate-fade-in">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-5 mx-6 max-w-sm w-full">
            <h3 className="text-neutral-100 font-semibold text-center mb-2">Delete Note?</h3>
            <p className="text-sm text-neutral-400 text-center mb-5">
              This will permanently delete "{title || 'Untitled'}"
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-neutral-800 text-neutral-300 py-2.5 rounded-xl font-medium hover:bg-neutral-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete(note.id)
                  setShowDeleteConfirm(false)
                }}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-xl font-medium hover:bg-red-500 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
