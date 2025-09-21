import React, { useState, useRef, useEffect } from 'react'

const CameraDebug = ({ r1Sdk, socket, deviceId, isConnected }) => {
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraFacing, setCameraFacing] = useState('user')
  const [cameraEvents, setCameraEvents] = useState([])
  const [photoHistory, setPhotoHistory] = useState([])
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const addCameraEvent = (type, description) => {
    const event = {
      id: Date.now(),
      type,
      description,
      timestamp: new Date().toLocaleTimeString()
    }
    setCameraEvents(prev => [event, ...prev.slice(0, 9)])

    // Stream to server
    if (socket && socket.connected) {
      fetch('/debug/stream/camera', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          data: event,
          timestamp: new Date().toISOString()
        })
      }).catch(err => console.warn('Failed to stream camera event:', err))
    }
  }

  const startCamera = async () => {
    if (!r1Sdk?.camera) {
      addCameraEvent('error', 'Camera API not available')
      return
    }

    try {
      addCameraEvent('info', `Starting camera with ${cameraFacing} facing mode`)
      const stream = await r1Sdk.camera.start({ facingMode: cameraFacing })
      streamRef.current = stream
      setCameraActive(true)
      addCameraEvent('success', 'Camera started successfully')

      // Set up video element if available
      if (videoRef.current && r1Sdk.camera.createVideoElement) {
        const videoElement = r1Sdk.camera.createVideoElement()
        videoRef.current.appendChild(videoElement)
      }
    } catch (error) {
      addCameraEvent('error', `Camera start failed: ${error.message}`)
    }
  }

  const stopCamera = async () => {
    if (!r1Sdk?.camera) return

    try {
      await r1Sdk.camera.stop()
      setCameraActive(false)
      streamRef.current = null
      addCameraEvent('info', 'Camera stopped')

      // Clean up video element
      if (videoRef.current) {
        videoRef.current.innerHTML = ''
      }
    } catch (error) {
      addCameraEvent('error', `Camera stop failed: ${error.message}`)
    }
  }

  const capturePhoto = async () => {
    if (!r1Sdk?.camera) {
      addCameraEvent('error', 'Camera API not available')
      return
    }

    try {
      const photo = await r1Sdk.camera.capturePhoto(240, 282)
      addCameraEvent('success', 'Photo captured successfully')

      const photoEntry = {
        id: Date.now(),
        data: photo,
        timestamp: new Date().toLocaleTimeString(),
        size: photo ? photo.length : 0
      }
      setPhotoHistory(prev => [photoEntry, ...prev.slice(0, 4)]) // Keep last 5 photos

      // Send photo to server
      if (socket && socket.connected) {
        socket.emit('photo_captured', {
          photo: photo,
          deviceId,
          timestamp: new Date().toISOString()
        })
      }
    } catch (error) {
      addCameraEvent('error', `Photo capture failed: ${error.message}`)
    }
  }

  const switchCamera = () => {
    const newFacing = cameraFacing === 'user' ? 'environment' : 'user'
    setCameraFacing(newFacing)
    addCameraEvent('info', `Camera facing mode switched to ${newFacing}`)

    if (cameraActive) {
      stopCamera().then(() => {
        setTimeout(() => startCamera(), 500) // Small delay for switching
      })
    }
  }

  const testCameraCapabilities = () => {
    if (!r1Sdk?.camera) {
      addCameraEvent('error', 'Camera API not available')
      return
    }

    const capabilities = {
      hasStart: typeof r1Sdk.camera.start === 'function',
      hasStop: typeof r1Sdk.camera.stop === 'function',
      hasCapturePhoto: typeof r1Sdk.camera.capturePhoto === 'function',
      hasCreateVideoElement: typeof r1Sdk.camera.createVideoElement === 'function'
    }

    addCameraEvent('info', `Camera capabilities: ${JSON.stringify(capabilities)}`)
  }

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (streamRef.current && r1Sdk?.camera?.stop) {
        r1Sdk.camera.stop()
      }
    }
  }, [r1Sdk])

  return (
    <div className="camera-debug">
      <h3>Camera Debug</h3>

      {/* Camera Controls */}
      <div className="debug-section">
        <h4>Camera Controls</h4>
        <div className="camera-controls">
          <button
            className={`cam-btn ${cameraActive ? 'active' : ''}`}
            onClick={cameraActive ? stopCamera : startCamera}
            disabled={!isConnected}
          >
            {cameraActive ? 'Stop' : 'Start'} Camera
          </button>
          <button
            className="cam-btn"
            onClick={switchCamera}
            disabled={!cameraActive}
          >
            Switch ({cameraFacing === 'user' ? 'Front' : 'Back'})
          </button>
          <button
            className="cam-btn"
            onClick={capturePhoto}
            disabled={!cameraActive}
          >
            Capture Photo
          </button>
          <button
            className="cam-btn"
            onClick={testCameraCapabilities}
            disabled={!isConnected}
          >
            Test Capabilities
          </button>
        </div>
        <div className="camera-status">
          Status: {cameraActive ? `Active (${cameraFacing})` : 'Inactive'}
        </div>
      </div>

      {/* Video Preview */}
      <div className="debug-section">
        <h4>Video Preview</h4>
        <div className="video-container" ref={videoRef}>
          {!cameraActive && <div className="video-placeholder">Camera not active</div>}
        </div>
      </div>

      {/* Photo History */}
      <div className="debug-section">
        <h4>Recent Photos</h4>
        <div className="photo-history">
          {photoHistory.map(photo => (
            <div key={photo.id} className="photo-entry">
              <div className="photo-info">
                [{photo.timestamp}] Size: {photo.size} bytes
              </div>
              {photo.data && (
                <img
                  src={`data:image/jpeg;base64,${photo.data}`}
                  alt="Captured"
                  className="photo-thumbnail"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Event Log */}
      <div className="debug-section">
        <h4>Camera Events</h4>
        <div className="event-log">
          {cameraEvents.map(event => (
            <div key={event.id} className={`event-entry event-${event.type}`}>
              [{event.timestamp}] {event.description}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default CameraDebug