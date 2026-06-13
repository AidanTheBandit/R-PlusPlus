import React, { forwardRef } from 'react'

const ConsolePanel = forwardRef(({ consoleLogs }, ref) => {
  return (
    <div className="console-panel">
      <div className="console-header">
        <div className="console-title">
          <span className="console-icon">📝</span>
          <span>Activity Log</span>
        </div>
        <div className="console-stats">
          <span className="log-count">{consoleLogs.length}</span>
          <span className="log-label">entries</span>
        </div>
      </div>

      <div className="console-content" ref={ref}>
        {consoleLogs.length === 0 ? (
          <div className="console-empty">
            <div className="empty-icon">🔄</div>
            <div className="empty-text">Waiting for activity...</div>
          </div>
        ) : (
          consoleLogs.map((log, index) => (
            <div key={index} className={`console-entry ${log.type}`}>
              <div className="entry-time">{log.timestamp}</div>
              <div className="entry-level">
                <span className={`level-badge ${log.type}`}>
                  {log.type === 'error' ? '❌' : log.type === 'warn' ? '⚠️' : log.type === 'info' ? 'ℹ️' : '📝'}
                </span>
              </div>
              <div className="entry-message">{log.message}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
})

ConsolePanel.displayName = 'ConsolePanel'

export default ConsolePanel