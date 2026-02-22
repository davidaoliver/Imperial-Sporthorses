import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24, textAlign: 'center', background: '#0a0a0a' }}>
          <img src="/logo.png" alt="Imperial Sporthorses" style={{ height: 64, opacity: 0.8 }} />
          <div style={{ color: '#fbbf24', fontSize: 16, fontWeight: 'bold' }}>Something went wrong</div>
          <div style={{ color: '#a3a3a3', fontSize: 12, maxWidth: 280 }}>{this.state.error?.message || 'Unknown error'}</div>
          <button
            onClick={() => {
              try { localStorage.clear() } catch(e) {}
              try { sessionStorage.clear() } catch(e) {}
              window.location.href = window.location.origin
            }}
            style={{ background: '#f59e0b', color: '#000', border: 'none', padding: '10px 24px', borderRadius: 8, fontWeight: 'bold', fontSize: 14, cursor: 'pointer' }}
          >
            Clear Cache & Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
