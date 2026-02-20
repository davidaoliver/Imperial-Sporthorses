import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { ArrowRight, RefreshCw } from 'lucide-react'

export default function CompleteProfilePage() {
  const { session, updateDisplayName, signOut, fetchProfile } = useAuth()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [retrying, setRetrying] = useState(true)

  // Try to re-fetch profile in case it failed to load initially (5s max)
  useEffect(() => {
    if (session?.user) {
      const timer = setTimeout(() => setRetrying(false), 5000)
      fetchProfile(session.user.id).finally(() => {
        clearTimeout(timer)
        setRetrying(false)
      })
    } else {
      setRetrying(false)
    }
  }, [session])

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Please enter your display name.')
      return
    }
    if (trimmed.length < 2) {
      setError('Name must be at least 2 characters.')
      return
    }
    setSaving(true)
    try {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out')), 10000)
      )
      await Promise.race([updateDisplayName(trimmed), timeout])
    } catch (err) {
      setError(err.message === 'Request timed out'
        ? 'Request timed out. Check your connection and try again.'
        : 'Failed to save. Please try again.')
      console.error('[CompleteProfile] Error:', err)
    } finally {
      setSaving(false)
    }
  }

  if (retrying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950">
        <div className="text-center animate-fade-in">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-neutral-400">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-950 px-6">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <img src="/logo.png" alt="Imperial Sporthorses" className="h-20 w-auto" />
        </div>
        <h1 className="text-xl font-bold text-amber-400 mb-1 text-center">
          Complete Your Profile
        </h1>
        <p className="text-neutral-400 text-sm mb-6 text-center">
          Enter a display name so your team can identify you.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="displayName"
              className="block text-sm font-medium text-neutral-300 mb-1"
            >
              Display Name
            </label>
            <input
              id="displayName"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError('')
              }}
              placeholder="e.g. Sarah M."
              className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              autoFocus
            />
            {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-amber-500 text-black rounded-xl px-4 py-3 font-semibold hover:bg-amber-400 active:bg-amber-600 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Continue'}
            {!saving && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <button
          onClick={() => {
            try { localStorage.clear(); sessionStorage.clear(); } catch(e) {}
            window.location.reload()
          }}
          className="w-full mt-3 text-red-400 text-sm hover:text-red-300 transition font-medium"
        >
          Reset & Sign Out
        </button>
      </div>
    </div>
  )
}
