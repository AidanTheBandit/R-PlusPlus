import React from 'react'
import {
  CloseIcon,
  LockIcon,
  RefreshIcon,
  DotIcon
} from './Icons'

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
        <span className="app-title">R1 Anywhere</span>
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
                <RefreshIcon size={12} />
              </button>
              <button className="pin-action danger" onClick={onDisablePin} title="Disable PIN">
                <CloseIcon size={12} />
              </button>
            </div>
          </div>
        )}

        {(!deviceInfo?.pinEnabled || !deviceInfo?.pinCode) && deviceId && (
          <button className="enable-pin-btn" onClick={onEnablePin} title="Enable PIN">
            <LockIcon size={12} />
            <span>Enable PIN</span>
          </button>
        )}

        {deviceId && (
          <button
            className="refresh-btn"
            onClick={onRefreshDeviceInfo}
            title="Refresh device info"
          >
            <RefreshIcon size={14} />
          </button>
        )}

        <button
          className={`reconnect-btn ${isConnected ? 'connected' : 'disconnected'}`}
          onClick={onReconnect}
          disabled={isConnected}
          title={isConnected ? 'Connected' : 'Reconnect'}
        >
          {isConnected ? <DotIcon size={10} /> : <RefreshIcon size={14} />}
        </button>
      </div>
    </div>
  )
}

export default StatusBar
