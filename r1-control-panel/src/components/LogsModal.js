import React, { useState, useEffect, useRef } from 'react';

const LogsModal = ({ deviceId, pinCode, onClose }) => {
  const [logs, setLogs] = useState([]);
  const [serverFilter, setServerFilter] = useState('');
  const [servers, setServers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const logsEndRef = useRef(null);

  useEffect(() => {
    loadServers();
    loadLogs();
  }, [deviceId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadLogs();
  }, [serverFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadServers = async () => {
    try {
      const headers = {};
      if (pinCode) {
        headers['Authorization'] = `Bearer ${pinCode}`;
      }

      const response = await fetch(`/${deviceId}/mcp/servers`, { headers });
      if (response.ok) {
        const data = await response.json();
        setServers(data.servers || []);
      }
    } catch (error) {
      console.error('Failed to load servers:', error);
    }
  };

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      let url = `/${deviceId}/mcp/logs?limit=100`;
      if (serverFilter) {
        url += `&serverName=${encodeURIComponent(serverFilter)}`;
      }

      const headers = {};
      if (pinCode) {
        headers['Authorization'] = `Bearer ${pinCode}`;
      }

      const response = await fetch(url, { headers });
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      } else {
        console.error('Failed to load logs');
        setLogs([]);
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearLogs = () => {
    if (window.confirm('Are you sure you want to clear the logs display?')) {
      setLogs([]);
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '800px' }}>
        <div className="modal-header">
          <div className="modal-title">MCP Server Logs</div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="form-group">
          <label className="form-label">Filter by Server:</label>
          <select 
            className="form-select"
            value={serverFilter}
            onChange={(e) => setServerFilter(e.target.value)}
          >
            <option value="">All Servers</option>
            {servers.map(server => (
              <option key={server.name} value={server.name}>
                {server.name}
              </option>
            ))}
          </select>
        </div>

        <div className="logs-container">
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <span className="loading"></span>
              Loading logs...
            </div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
              No logs available
            </div>
          ) : (
            <>
              {logs.map((log, index) => (
                <div key={index} className={`log-entry ${log.level}`}>
                  <span className="log-timestamp">{formatTimestamp(log.timestamp)}</span>
                  <span className="log-level">[{log.level.toUpperCase()}]</span>
                  <span className="log-server">{log.server_name}</span>
                  <span className="log-message">{log.message}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </>
          )}
        </div>

        <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={loadLogs}>
            Refresh
          </button>
          <button className="btn btn-secondary" onClick={clearLogs}>
            Clear Display
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogsModal;