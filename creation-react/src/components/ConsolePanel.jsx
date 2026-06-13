import React, { forwardRef } from 'react'
import {
  MemoIcon,
  RefreshIcon,
  ErrorIcon,
  WarningIcon,
  InfoIcon
} from './Icons'

const ConsolePanel = forwardRef(({ consoleLogs }, ref) => {
  return (
    <div className="console-panel">
      <div className="console-header">
        <div className="console-title">
          <span className="console-icon"><MemoIcon size={14} /></span>
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
            <div className="empty-icon"><RefreshIcon size={28} /></div>
            <div className="empty-text">Waiting for activity...</div>
          </div>
        ) : (
          consoleLogs.map((log, index) => (
            <div key={index} className={`console-entry ${log.type}`}>
              <div className="entry-time">{log.timestamp}</div>
              <div className="entry-level">
                <span className={`level-badge ${log.type}`}>
                  {log.type === 'error'
                    ? <ErrorIcon size={12} />
                    : log.type === 'warn'
                      ? <WarningIcon size={12} />
                      : log.type === 'info'
                        ? <InfoIcon size={12} />
                        : <MemoIcon size={12} />}
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