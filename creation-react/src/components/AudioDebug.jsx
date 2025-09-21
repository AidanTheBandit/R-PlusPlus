import React, { useState, useRef, useEffect } from 'react'

const AudioDebug = ({ r1Sdk, socket, deviceId, isConnected }) => {
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioEvents, setAudioEvents] = useState([])
  const [audioHistory, setAudioHistory] = useState([])
  const [microphoneLevel, setMicrophoneLevel] = useState(0)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const animationFrameRef = useRef(null)

  const addAudioEvent = (type, description) => {
    const event = {
      id: Date.now(),
      type,
      description,
      timestamp: new Date().toLocaleTimeString()
    }
    setAudioEvents(prev => [event, ...prev.slice(0, 9)])

    // Stream to server
    if (socket && socket.connected) {
      fetch('/debug/stream/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          data: event,
          timestamp: new Date().toISOString()
        })
      }).catch(err => console.warn('Failed to stream audio event:', err))
    }
  }

  const startRecording = async () => {
    if (!r1Sdk?.microphone) {
      addAudioEvent('error', 'Microphone API not available')
      return
    }

    try {
      addAudioEvent('info', 'Starting audio recording')
      await r1Sdk.microphone.startRecording()
      setIsRecording(true)
      addAudioEvent('success', 'Recording started')

      // Start microphone level monitoring
      startMicrophoneMonitoring()
    } catch (error) {
      addAudioEvent('error', `Recording start failed: ${error.message}`)
    }
  }

  const stopRecording = async () => {
    if (!r1Sdk?.microphone) return

    try {
      const audioBlob = await r1Sdk.microphone.stopRecording()
      setIsRecording(false)
      addAudioEvent('success', 'Recording stopped')

      const audioEntry = {
        id: Date.now(),
        blob: audioBlob,
        size: audioBlob.size,
        timestamp: new Date().toLocaleTimeString()
      }
      setAudioHistory(prev => [audioEntry, ...prev.slice(0, 4)]) // Keep last 5 recordings

      // Stop microphone monitoring
      stopMicrophoneMonitoring()

      // Send audio to server
      if (socket && socket.connected) {
        const reader = new FileReader()
        reader.onload = () => {
          const base64Audio = reader.result.split(',')[1]
          socket.emit('audio_captured', {
            audio: base64Audio,
            deviceId,
            timestamp: new Date().toISOString()
          })
        }
        reader.readAsDataURL(audioBlob)
      }
    } catch (error) {
      addAudioEvent('error', `Recording stop failed: ${error.message}`)
    }
  }

  const playAudio = async (audioBlob) => {
    if (!r1Sdk?.speaker) {
      addAudioEvent('error', 'Speaker API not available')
      return
    }

    try {
      setIsPlaying(true)
      addAudioEvent('info', 'Playing audio through speaker')
      await r1Sdk.speaker.play(audioBlob)
      setIsPlaying(false)
      addAudioEvent('success', 'Audio playback completed')
    } catch (error) {
      setIsPlaying(false)
      addAudioEvent('error', `Audio playback failed: ${error.message}`)
    }
  }

  const playTone = async (frequency = 440, duration = 1000) => {
    if (!r1Sdk?.speaker) {
      addAudioEvent('error', 'Speaker API not available')
      return
    }

    try {
      addAudioEvent('info', `Playing tone: ${frequency}Hz for ${duration}ms`)
      await r1Sdk.speaker.playTone(frequency, duration)
      addAudioEvent('success', 'Tone playback completed')
    } catch (error) {
      addAudioEvent('error', `Tone playback failed: ${error.message}`)
    }
  }

  const startMicrophoneMonitoring = async () => {
    try {
      // Create audio context for monitoring
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256

      // Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)

      const updateMicrophoneLevel = () => {
        if (!analyserRef.current) return

        analyserRef.current.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length
        setMicrophoneLevel(Math.round(average))

        animationFrameRef.current = requestAnimationFrame(updateMicrophoneLevel)
      }

      updateMicrophoneLevel()
    } catch (error) {
      addAudioEvent('error', `Microphone monitoring failed: ${error.message}`)
    }
  }

  const stopMicrophoneMonitoring = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    setMicrophoneLevel(0)
  }

  const testAudioCapabilities = () => {
    if (!r1Sdk) {
      addAudioEvent('error', 'R1 SDK not available')
      return
    }

    const capabilities = {
      hasMicrophone: !!r1Sdk.microphone,
      hasSpeaker: !!r1Sdk.speaker,
      microphoneMethods: r1Sdk.microphone ? Object.getOwnPropertyNames(Object.getPrototypeOf(r1Sdk.microphone)) : [],
      speakerMethods: r1Sdk.speaker ? Object.getOwnPropertyNames(Object.getPrototypeOf(r1Sdk.speaker)) : []
    }

    addAudioEvent('info', `Audio capabilities: ${JSON.stringify(capabilities)}`)
  }

  const clearAudioHistory = () => {
    setAudioHistory([])
    addAudioEvent('info', 'Audio history cleared')
  }

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      stopMicrophoneMonitoring()
    }
  }, [])

  return (
    <div className="audio-debug">
      <h3>Audio Debug</h3>

      {/* Audio Controls */}
      <div className="debug-section">
        <h4>Audio Controls</h4>
        <div className="audio-controls">
          <button
            className={`audio-btn ${isRecording ? 'active' : ''}`}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={!isConnected}
          >
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>
          <button
            className="audio-btn"
            onClick={testAudioCapabilities}
            disabled={!isConnected}
          >
            Test Capabilities
          </button>
          <button
            className="audio-btn clear"
            onClick={clearAudioHistory}
          >
            Clear History
          </button>
        </div>
        <div className="microphone-level">
          <div className="level-label">Mic Level: {microphoneLevel}</div>
          <div className="level-bar">
            <div
              className="level-fill"
              style={{ width: `${Math.min(microphoneLevel * 2, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tone Generation */}
      <div className="debug-section">
        <h4>Tone Generation</h4>
        <div className="tone-controls">
          <button
            className="audio-btn"
            onClick={() => playTone(440, 1000)}
            disabled={!isConnected || isPlaying}
          >
            A4 (440Hz)
          </button>
          <button
            className="audio-btn"
            onClick={() => playTone(523, 1000)}
            disabled={!isConnected || isPlaying}
          >
            C5 (523Hz)
          </button>
          <button
            className="audio-btn"
            onClick={() => playTone(659, 1000)}
            disabled={!isConnected || isPlaying}
          >
            E5 (659Hz)
          </button>
          <button
            className="audio-btn"
            onClick={() => playTone(784, 1000)}
            disabled={!isConnected || isPlaying}
          >
            G5 (784Hz)
          </button>
        </div>
      </div>

      {/* Audio History */}
      <div className="debug-section">
        <h4>Audio Recordings</h4>
        <div className="audio-history">
          {audioHistory.map(audio => (
            <div key={audio.id} className="audio-entry">
              <div className="audio-info">
                [{audio.timestamp}] Size: {audio.size} bytes
              </div>
              <button
                className="audio-btn play"
                onClick={() => playAudio(audio.blob)}
                disabled={isPlaying}
              >
                {isPlaying ? 'Playing...' : 'Play'}
              </button>
            </div>
          ))}
          {audioHistory.length === 0 && (
            <div className="no-audio">No audio recordings yet</div>
          )}
        </div>
      </div>

      {/* Event Log */}
      <div className="debug-section">
        <h4>Audio Events</h4>
        <div className="event-log">
          {audioEvents.map(event => (
            <div key={event.id} className={`event-entry event-${event.type}`}>
              [{event.timestamp}] {event.description}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default AudioDebug