import { useAuth } from './contexts/AuthContext'
import { isConfigured } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import CompleteProfilePage from './pages/CompleteProfilePage'
import Layout from './components/Layout'
import { RefreshCw, Database, Key, FileCode2 } from 'lucide-react'

function SetupScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-950 px-6">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-8 w-full max-w-md animate-scale-in">
        <div className="flex justify-center mb-6">
          <img src="/logo.png" alt="Imperial Sporthorses" className="h-20 w-auto" />
        </div>
        <h1 className="text-2xl font-bold text-amber-400 mb-1 text-center">
          Imperial Sporthorses
        </h1>
        <p className="text-neutral-400 text-sm mb-6 text-center">
          Almost ready! Connect your Supabase project to get started.
        </p>

        <div className="space-y-4 text-sm">
          <div className="flex gap-3 items-start bg-neutral-800 rounded-xl p-3">
            <Database className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-neutral-100">1. Create a Supabase Project</p>
              <p className="text-neutral-400 text-xs mt-0.5">
                Go to{' '}
                <a
                  href="https://supabase.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 underline"
                >
                  supabase.com
                </a>{' '}
                and create a new project. Enable Google OAuth in Auth → Providers.
              </p>
            </div>
          </div>

          <div className="flex gap-3 items-start bg-neutral-800 rounded-xl p-3">
            <FileCode2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-neutral-100">2. Run the SQL Schema</p>
              <p className="text-neutral-400 text-xs mt-0.5">
                Open the Supabase SQL Editor and run the contents of{' '}
                <code className="bg-neutral-700 px-1 rounded text-[11px] text-amber-300">supabase-schema.sql</code>.
              </p>
            </div>
          </div>

          <div className="flex gap-3 items-start bg-neutral-800 rounded-xl p-3">
            <Key className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-neutral-100">3. Add Environment Variables</p>
              <p className="text-neutral-400 text-xs mt-0.5">
                Create a <code className="bg-neutral-700 px-1 rounded text-[11px] text-amber-300">.env</code> file
                in the project root:
              </p>
              <div className="bg-black text-amber-300 rounded-lg p-3 mt-2 text-[11px] font-mono leading-relaxed">
                VITE_SUPABASE_URL=https://your-id.supabase.co
                <br />
                VITE_SUPABASE_ANON_KEY=your-anon-key
              </div>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-neutral-500 mt-5 text-center">
          After creating the <code>.env</code> file, restart the dev server.
        </p>
      </div>
    </div>
  )
}

export default function App() {
  const { session, profile, loading } = useAuth()

  if (!isConfigured) {
    return <SetupScreen />
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950">
        <div className="text-center animate-fade-in">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-neutral-400">Loading...</p>
        </div>
      </div>
    )
  }

  // Not logged in
  if (!session) {
    return <LoginPage />
  }

  // Logged in but no display name -> complete profile
  if (!profile?.display_name) {
    return <CompleteProfilePage />
  }

  // Fully authenticated
  return <Layout />
}
