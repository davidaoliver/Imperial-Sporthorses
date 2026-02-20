import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase, isConfigured } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const initialized = useRef(false)

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false)
      return
    }

    // Safety timeout — never stay stuck loading for more than 10s
    const timeout = setTimeout(() => {
      console.warn('[Auth] Timeout reached — forcing loading=false')
      setLoading(false)
    }, 10000)

    // Use onAuthStateChange as the single source of truth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log('[Auth] onAuthStateChange:', _event, session?.user?.email)
        setSession(session)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
          setLoading(false)
        }
        clearTimeout(timeout)
      }
    )

    // Also do an initial getSession check for page refreshes
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[Auth] getSession:', session?.user?.email ?? 'no session')
      if (!initialized.current) {
        initialized.current = true
        setSession(session)
        if (session?.user) {
          fetchProfile(session.user.id).then(() => clearTimeout(timeout))
        } else {
          setLoading(false)
          clearTimeout(timeout)
        }
      }
    }).catch((err) => {
      console.error('[Auth] getSession error:', err)
      setLoading(false)
      clearTimeout(timeout)
    })

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function fetchProfile(userId, retryCount = 0) {
    console.log('[Auth] fetchProfile for:', userId, 'attempt:', retryCount + 1)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.warn('[Auth] Profile fetch error:', error.message, error.code)
        // If user row doesn't exist, try to create it
        if (error.code === 'PGRST116') {
          const { data: sessionData } = await supabase.auth.getUser()
          if (sessionData?.user) {
            const { data: newProfile, error: insertErr } = await supabase
              .from('users')
              .upsert({
                id: sessionData.user.id,
                email: sessionData.user.email,
              })
              .select()
              .single()
            if (!insertErr && newProfile) {
              console.log('[Auth] Created missing user row:', newProfile)
              setProfile(newProfile)
              return
            }
          }
        }
        // Retry once after 2s if first attempt failed
        if (retryCount === 0) {
          console.log('[Auth] Retrying fetchProfile in 2s...')
          await new Promise(r => setTimeout(r, 2000))
          return fetchProfile(userId, 1)
        }
        setProfile(null)
      } else {
        console.log('[Auth] Profile loaded:', data?.display_name, data?.role)
        setProfile(data)
      }
    } catch (err) {
      console.error('[Auth] fetchProfile exception:', err)
      // Retry once after 2s if first attempt threw
      if (retryCount === 0) {
        console.log('[Auth] Retrying fetchProfile in 2s...')
        await new Promise(r => setTimeout(r, 2000))
        return fetchProfile(userId, 1)
      }
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  async function updateDisplayName(displayName) {
    if (!session?.user) throw new Error('No session')
    console.log('[Auth] updateDisplayName:', displayName, 'for user:', session.user.id)
    const { data, error } = await supabase
      .from('users')
      .update({ display_name: displayName })
      .eq('id', session.user.id)
      .select()
      .single()

    if (error) {
      console.error('[Auth] updateDisplayName error:', error)
      // If update fails (row doesn't exist), try upsert
      if (error.code === 'PGRST116' || error.message?.includes('0 rows')) {
        const { data: upserted, error: upsertErr } = await supabase
          .from('users')
          .upsert({
            id: session.user.id,
            email: session.user.email,
            display_name: displayName,
          })
          .select()
          .single()
        if (upsertErr) throw upsertErr
        setProfile(upserted)
        return upserted
      }
      throw error
    }
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
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.warn('[Auth] signOut error (clearing state anyway):', err)
    }
    // Force clear everything
    setSession(null)
    setProfile(null)
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch (e) {}
    window.location.reload()
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
    fetchProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
