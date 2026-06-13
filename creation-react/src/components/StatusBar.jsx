import React from 'react'

function StatusBar({
  isConnected,
  deviceId,
  deviceInfo,
  onRefreshDeviceInfo,
  onReconnect,
  onChangePin,
  onDisablePin,
  onEnablePin
}) {
  return (
    <div className="status-bar">
      <div className="status-left">
        <div className="app-title">
          <span className="icon">⚡</span>
          <span>R1 Anywhere</span>
        </div>
        <div className={`connection-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
          <div className="pulse"></div>
          <span>{isConnected ? 'Online' : 'Offline'}</span>
        </div>
      </div>

      <div className="status-right">
        {deviceId && (
          <div className="device-badge">
            <span className="device-label">Device</span>
            <code className="device-code">{deviceId}</code>
          </div>
        )}

        {deviceInfo?.pinEnabled && deviceInfo?.pinCode && (
          <div className="pin-badge">
            <span className="pin-label">PIN</span>
            <code className="pin-code">{deviceInfo.pinCode}</code>
            <div className="pin-actions">
              <button className="pin-action" onClick={onChangePin} title="Change PIN">
                <span>⟲</span>
              </button>
              <button className="pin-action danger" onClick={onDisablePin} title="Disable PIN">
                <span>✕</span>
              </button>
            </div>
          </div>
        )}

        {(!deviceInfo?.pinEnabled || !deviceInfo?.pinCode) && deviceId && (
          <button className="enable-pin-btn" onClick={onEnablePin} title="Enable PIN">
            <span>🔒</span>
            <span>Enable PIN</span>
          </button>
        )}

        {deviceId && (
          <button
            className="refresh-btn"
            onClick={onRefreshDeviceInfo}
            title="Refresh device info"
          >
            <span>🔄</span>
          </button>
        )}

        <button
          className={`reconnect-btn ${isConnected ? 'connected' : 'disconnected'}`}
          onClick={onReconnect}
          disabled={isConnected}
          title={isConnected ? 'Connected' : 'Reconnect'}
        >
          <span>{isConnected ? '●' : '⟲'}</span>
        </button>
      </div>
    </div>
  )
}

export default StatusBar