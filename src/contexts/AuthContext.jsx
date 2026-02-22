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

    if (fetchingRef.current) return
    fetchingRef.current = true

    const userId = session.user.id
    const userEmail = session.user.email

    async function loadProfile() {
      console.log('[Auth] Fetching profile for:', userId)
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single()

        if (error && error.code === 'PGRST116') {
          console.log('[Auth] No profile found, creating one...')
          const { data: newProfile, error: insertErr } = await supabase
            .from('users')
            .insert({ id: userId, email: userEmail })
            .select()
            .single()

          if (insertErr) {
            console.error('[Auth] Failed to create profile:', insertErr.message)
            setProfile(null)
          } else {
            console.log('[Auth] New profile created')
            setProfile(newProfile)
          }
        } else if (error) {
          console.warn('[Auth] Profile fetch error:', error.message)
          setProfile(null)
        } else {
          console.log('[Auth] Profile loaded:', data?.display_name)
          setProfile(data)
        }
      } catch (err) {
        console.error('[Auth] Profile fetch exception:', err)
        setProfile(null)
      } finally {
        setLoading(false)
        fetchingRef.current = false
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
