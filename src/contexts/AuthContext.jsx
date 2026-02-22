import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, isConfigured } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false)
      return
    }

    // This is the recommended, standard way to handle auth.
    // It runs once on mount to get the initial state, then
    // listens for any subsequent changes.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`[Auth] onAuthStateChange event: ${event}`)
        setSession(session)

        if (session?.user) {
          try {
            const { data, error } = await supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .single()

            if (error) {
              console.warn('[Auth] Profile fetch error:', error.message)
              setProfile(null)
            } else {
              console.log('[Auth] Profile loaded:', data?.display_name)
              setProfile(data)
            }
          } catch (err) {
            console.error('[Auth] fetchProfile exception:', err)
            setProfile(null)
          }
        } else {
          setProfile(null)
        }
        // Loading is complete once the first auth event has been handled.
        setLoading(false)
      }
    )

    // Set up visibility change listener for better token refresh management.
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
