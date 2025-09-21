import React, { useState } from 'react'
import HardwareDebug from './HardwareDebug'
import CameraDebug from './CameraDebug'
import LLMDebug from './LLMDebug'
import StorageDebug from './StorageDebug'
import AudioDebug from './AudioDebug'
import PerformanceDebug from './PerformanceDebug'
import DeviceInfo from './DeviceInfo'
import LogsPanel from './LogsPanel'
import './DebugTool.css'

const DebugTool = ({ r1Sdk, socket, deviceId, isConnected }) => {
  const [activeTab, setActiveTab] = useState('hardware')

  const tabs = [
    { id: 'hardware', label: 'Hardware', component: HardwareDebug },
    { id: 'camera', label: 'Camera', component: CameraDebug },
    { id: 'llm', label: 'LLM', component: LLMDebug },
    { id: 'storage', label: 'Storage', component: StorageDebug },
    { id: 'audio', label: 'Audio', component: AudioDebug },
    { id: 'performance', label: 'Performance', component: PerformanceDebug },
    { id: 'device', label: 'Device Info', component: DeviceInfo },
    { id: 'logs', label: 'Logs', component: LogsPanel }
  ]

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component

  return (
    <div className="debug-tool">
      <div className="debug-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`debug-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="debug-content">
        {ActiveComponent && (
          <ActiveComponent
            r1Sdk={r1Sdk}
            socket={socket}
            deviceId={deviceId}
            isConnected={isConnected}
          />
        )}
      </div>
    </div>
  )
}

export default DebugTool