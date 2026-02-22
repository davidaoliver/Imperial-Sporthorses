import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase, isConfigured } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authReady, setAuthReady] = useState(false)
  const fetchingRef = useRef(false)

  // Safety timeout: never stay loading for more than 8 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        console.warn('[Auth] Safety timeout — forcing loading=false')
        setLoading(false)
      }
    }, 8000)
    return () => clearTimeout(timer)
  }, [loading])

  // Effect 1: Track auth session ONLY. No database calls here.
  useEffect(() => {
    if (!isConfigured) {
      setLoading(false)
      return
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        console.log(`[Auth] event: ${event}`)
        setSession(currentSession)
        setAuthReady(true)
      }
    )

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        supabase.auth.startAutoRefresh()
      } else {
        supabase.auth.stopAutoRefresh()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Effect 2: Fetch profile SEPARATELY, triggered by session changes.
  // This avoids deadlocks from making Supabase calls inside onAuthStateChange.
  useEffect(() => {
    if (!authReady) return

    if (!session?.user) {
      setProfile(null)
      setLoading(false)
      return
    }

    // Reset fetchingRef when session changes so retries work
    fetchingRef.current = false

    const userId = session.user.id
    const userEmail = session.user.email

    async function loadProfile(attempt = 1) {
      if (fetchingRef.current) return
      fetchingRef.current = true

      console.log(`[Auth] Fetching profile for: ${userId} (attempt ${attempt})`)
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single()

        if (error && error.code === 'PGRST116') {
          console.log('[Auth] No profile found, upserting...')
          // Use upsert to handle race condition with handle_new_user trigger
          const { data: newProfile, error: upsertErr } = await supabase
            .from('users')
            .upsert({ id: userId, email: userEmail }, { onConflict: 'id' })
            .select()
            .single()

          if (upsertErr) {
            console.error('[Auth] Failed to upsert profile:', upsertErr.message)
            // Retry: the trigger might have created it, try fetching again
            if (attempt < 3) {
              fetchingRef.current = false
              setTimeout(() => loadProfile(attempt + 1), 1000)
              return
            }
            setProfile(null)
          } else {
            console.log('[Auth] Profile upserted')
            setProfile(newProfile)
          }
        } else if (error) {
          console.warn('[Auth] Profile fetch error:', error.message)
          // Retry on network errors
          if (attempt < 3) {
            fetchingRef.current = false
            setTimeout(() => loadProfile(attempt + 1), 1500)
            return
          }
          setProfile(null)
        } else {
          console.log('[Auth] Profile loaded:', data?.display_name)
          setProfile(data)
        }
      } catch (err) {
        console.error('[Auth] Profile fetch exception:', err)
        if (attempt < 3) {
          fetchingRef.current = false
          setTimeout(() => loadProfile(attempt + 1), 1500)
          return
        }
        setProfile(null)
      } finally {
        fetchingRef.current = false
        setLoading(false)
      }
    }

    loadProfile()
  }, [authReady, session])

  async function updateDisplayName(displayName) {
    if (!session?.user) throw new Error('No session')

    const { data, error } = await supabase
      .from('users')
      .update({ display_name: displayName })
      .eq('id', session.user.id)
      .select()
      .single()

    if (error) {
      console.error('[Auth] updateDisplayName error:', error)
      throw error
    }
    // Update local profile state to instantly reflect the change
    setProfile(data)
    return data
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
    // The onAuthStateChange listener will handle clearing session/profile
    window.location.reload() // Force a full reload to clear all state
  }

  const isAdmin = profile?.role === 'Admin'

  const value = {
    session,
    profile,
    loading,
    isAdmin,
    signInWithGoogle,
    signOut,
    updateDisplayName,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
