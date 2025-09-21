import React, { useState, useEffect } from 'react'

const StorageDebug = ({ r1Sdk, socket, deviceId, isConnected }) => {
  const [storageData, setStorageData] = useState({
    plain: {},
    secure: {}
  })
  const [storageEvents, setStorageEvents] = useState([])
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [storageType, setStorageType] = useState('plain')

  const addStorageEvent = (type, description) => {
    const event = {
      id: Date.now(),
      type,
      description,
      timestamp: new Date().toLocaleTimeString()
    }
    setStorageEvents(prev => [event, ...prev.slice(0, 9)])

    // Stream to server
    if (socket && socket.connected) {
      fetch('/debug/stream/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          data: event,
          timestamp: new Date().toISOString()
        })
      }).catch(err => console.warn('Failed to stream storage event:', err))
    }
  }

  const loadStorageData = async () => {
    if (!r1Sdk?.storage) {
      addStorageEvent('error', 'Storage API not available')
      return
    }

    try {
      const plainData = {}
      const secureData = {}

      // Try to get some common keys (this is just for testing)
      const testKeys = ['theme', 'settings', 'user_data', 'app_config']

      for (const key of testKeys) {
        try {
          const plainValue = await r1Sdk.storage.plain.getItem(key)
          if (plainValue !== null) {
            plainData[key] = plainValue
          }
        } catch (error) {
          // Key doesn't exist, skip
        }

        try {
          const secureValue = await r1Sdk.storage.secure.getItem(key, false) // Get as string
          if (secureValue !== null) {
            secureData[key] = secureValue
          }
        } catch (error) {
          // Key doesn't exist, skip
        }
      }

      setStorageData({ plain: plainData, secure: secureData })
      addStorageEvent('success', 'Storage data loaded')
    } catch (error) {
      addStorageEvent('error', `Failed to load storage data: ${error.message}`)
    }
  }

  const setStorageItem = async () => {
    if (!newKey.trim() || !newValue.trim() || !r1Sdk?.storage) {
      addStorageEvent('error', 'Key, value, or storage API missing')
      return
    }

    try {
      if (storageType === 'plain') {
        // Try to parse as JSON for plain storage
        let valueToStore
        try {
          valueToStore = JSON.parse(newValue)
        } catch {
          valueToStore = newValue
        }
        await r1Sdk.storage.plain.setItem(newKey, valueToStore)
        addStorageEvent('success', `Plain storage: set ${newKey}`)
      } else {
        await r1Sdk.storage.secure.setItem(newKey, newValue)
        addStorageEvent('success', `Secure storage: set ${newKey}`)
      }

      setNewKey('')
      setNewValue('')
      loadStorageData() // Refresh data
    } catch (error) {
      addStorageEvent('error', `Failed to set storage item: ${error.message}`)
    }
  }

  const removeStorageItem = async (key, type) => {
    if (!r1Sdk?.storage) return

    try {
      if (type === 'plain') {
        await r1Sdk.storage.plain.removeItem(key)
        addStorageEvent('success', `Plain storage: removed ${key}`)
      } else {
        await r1Sdk.storage.secure.removeItem(key)
        addStorageEvent('success', `Secure storage: removed ${key}`)
      }
      loadStorageData() // Refresh data
    } catch (error) {
      addStorageEvent('error', `Failed to remove storage item: ${error.message}`)
    }
  }

  const clearStorage = async (type) => {
    if (!r1Sdk?.storage) return

    try {
      if (type === 'plain') {
        await r1Sdk.storage.plain.clear()
        addStorageEvent('success', 'Plain storage cleared')
      } else {
        await r1Sdk.storage.secure.clear()
        addStorageEvent('success', 'Secure storage cleared')
      }
      loadStorageData() // Refresh data
    } catch (error) {
      addStorageEvent('error', `Failed to clear storage: ${error.message}`)
    }
  }

  const testStorageCapabilities = () => {
    if (!r1Sdk?.storage) {
      addStorageEvent('error', 'Storage API not available')
      return
    }

    const capabilities = {
      hasPlain: !!r1Sdk.storage.plain,
      hasSecure: !!r1Sdk.storage.secure,
      plainMethods: r1Sdk.storage.plain ? Object.getOwnPropertyNames(Object.getPrototypeOf(r1Sdk.storage.plain)) : [],
      secureMethods: r1Sdk.storage.secure ? Object.getOwnPropertyNames(Object.getPrototypeOf(r1Sdk.storage.secure)) : []
    }

    addStorageEvent('info', `Storage capabilities: ${JSON.stringify(capabilities)}`)
  }

  useEffect(() => {
    if (isConnected) {
      loadStorageData()
    }
  }, [isConnected, r1Sdk])

  return (
    <div className="storage-debug">
      <h3>Storage Debug</h3>

      {/* Storage Controls */}
      <div className="debug-section">
        <h4>Storage Operations</h4>
        <div className="storage-controls">
          <button
            className="storage-btn"
            onClick={loadStorageData}
            disabled={!isConnected}
          >
            Refresh Data
          </button>
          <button
            className="storage-btn"
            onClick={testStorageCapabilities}
            disabled={!isConnected}
          >
            Test Capabilities
          </button>
          <button
            className="storage-btn clear"
            onClick={() => clearStorage('plain')}
            disabled={!isConnected}
          >
            Clear Plain
          </button>
          <button
            className="storage-btn clear"
            onClick={() => clearStorage('secure')}
            disabled={!isConnected}
          >
            Clear Secure
          </button>
        </div>
      </div>

      {/* Add Item */}
      <div className="debug-section">
        <h4>Add Storage Item</h4>
        <div className="add-item-form">
          <select
            value={storageType}
            onChange={(e) => setStorageType(e.target.value)}
          >
            <option value="plain">Plain Storage</option>
            <option value="secure">Secure Storage</option>
          </select>
          <input
            type="text"
            placeholder="Key"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
          />
          <textarea
            placeholder="Value (JSON for plain storage)"
            value={newValue}
            onChange={(e) => setNewValue(e.target)}
            rows={2}
          />
          <button
            className="storage-btn"
            onClick={setStorageItem}
            disabled={!isConnected || !newKey.trim() || !newValue.trim()}
          >
            Set Item
          </button>
        </div>
      </div>

      {/* Plain Storage */}
      <div className="debug-section">
        <h4>Plain Storage</h4>
        <div className="storage-items">
          {Object.keys(storageData.plain).length === 0 ? (
            <div className="no-data">No plain storage data</div>
          ) : (
            Object.entries(storageData.plain).map(([key, value]) => (
              <div key={key} className="storage-item">
                <div className="item-header">
                  <strong>{key}</strong>
                  <button
                    className="remove-btn"
                    onClick={() => removeStorageItem(key, 'plain')}
                  >
                    ×
                  </button>
                </div>
                <div className="item-value">
                  {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Secure Storage */}
      <div className="debug-section">
        <h4>Secure Storage</h4>
        <div className="storage-items">
          {Object.keys(storageData.secure).length === 0 ? (
            <div className="no-data">No secure storage data</div>
          ) : (
            Object.entries(storageData.secure).map(([key, value]) => (
              <div key={key} className="storage-item">
                <div className="item-header">
                  <strong>{key}</strong>
                  <button
                    className="remove-btn"
                    onClick={() => removeStorageItem(key, 'secure')}
                  >
                    ×
                  </button>
                </div>
                <div className="item-value">
                  {String(value)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Event Log */}
      <div className="debug-section">
        <h4>Storage Events</h4>
        <div className="event-log">
          {storageEvents.map(event => (
            <div key={event.id} className={`event-entry event-${event.type}`}>
              [{event.timestamp}] {event.description}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default StorageDebug