import { useState } from 'react'
import './App.css'

/**
 * App — Device Pairing / Login screen.
 *
 * A single, focused screen for entering a Device ID and PIN, built in the
 * Boondit Rhythm design language (dark canvas, PowerGrotesk, orange primary,
 * 3-segment brand stripe, colored glow). Authored at the R1's native 240×282
 * device canvas and scaled to fill the viewport.
 */
function App() {
  const [deviceId, setDeviceId] = useState('')
  const [pin, setPin] = useState('')
  const [status, setStatus] = useState('idle') // 'idle' | 'pairing' | 'success' | 'error'
  const [message, setMessage] = useState('')

  const canSubmit = deviceId.trim().length > 0 && pin.trim().length > 0

  const clearError = () => {
    if (status === 'error') {
      setStatus('idle')
      setMessage('')
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (status === 'pairing') return

    if (!canSubmit) {
      setStatus('error')
      setMessage('Enter your Device ID and PIN')
      return
    }

    setStatus('pairing')
    setMessage('Pairing…')

    // Simulated pairing handshake.
    // Real device registration happens server-side over the socket bridge;
    // this screen only captures and validates the credentials.
    window.setTimeout(() => {
      setStatus('success')
      setMessage('Paired')
    }, 1400)
  }

  const handleReset = () => {
    setDeviceId('')
    setPin('')
    setStatus('idle')
    setMessage('')
  }

  return (
    <div className="creation-viewport">
      <div className="creation-canvas pair-screen">
        {/* Brand stripe (signature 3-segment ribbon) */}
        <div className="brand-stripe">
          <div className="seg-1"></div>
          <div className="seg-2"></div>
          <div className="seg-3"></div>
        </div>

        <div className="pair-body">
          {/* Logo mark */}
          <div className="pair-logo" aria-hidden="true">
            <span className="pair-logo-mark">R</span>
          </div>

          {/* Headings */}
          <h1 className="pair-title">Pair Device</h1>
          <p className="pair-subtitle">Enter your credentials</p>

          {status === 'success' ? (
            <div className="pair-success">
              <div className="pair-success-icon">✓</div>
              <p className="pair-success-text">{message}</p>
              <p className="pair-success-id">{deviceId}</p>
              <button type="button" className="pair-reset-btn" onClick={handleReset}>
                Pair another
              </button>
            </div>
          ) : (
            <form className="pair-form" onSubmit={handleSubmit} autoComplete="off">
              <label className="pair-field">
                <span className="pair-label">Device ID</span>
                <input
                  className="pair-input"
                  type="text"
                  value={deviceId}
                  onChange={(e) => { setDeviceId(e.target.value); clearError() }}
                  placeholder="0000-0000"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </label>

              <label className="pair-field">
                <span className="pair-label">PIN</span>
                <input
                  className="pair-input pair-pin"
                  type="password"
                  value={pin}
                  onChange={(e) => { setPin(e.target.value); clearError() }}
                  placeholder="••••"
                  maxLength={8}
                  inputMode="numeric"
                />
              </label>

              {status === 'error' && <p className="pair-error">{message}</p>}

              <button
                className="pair-btn"
                type="submit"
                disabled={status === 'pairing'}
              >
                {status === 'pairing' ? (
                  <>
                    <span className="pair-spinner" />
                    <span>Pairing</span>
                  </>
                ) : (
                  'Pair'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
