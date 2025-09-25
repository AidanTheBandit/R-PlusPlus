import React, { useState } from 'react';

const AddServerModal = ({ onAdd, onClose }) => {
  const [formData, setFormData] = useState({
    serverName: '',
    description: '',
    url: '',
    protocolVersion: '2025-06-18',
    capabilities: {
      tools: { enabled: true, autoApprove: [] },
      resources: { enabled: true, autoApprove: [] },
      prompts: { enabled: true, autoApprove: [] },
      sampling: { enabled: false }
    },
    headers: {},
    timeout: 30000,
    enabled: true
  });

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [headersText, setHeadersText] = useState('{}');

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.serverName || !formData.url) {
      alert('Server name and URL are required');
      return;
    }

    try {
      // Parse headers if provided
      let parsedHeaders = {};
      if (headersText.trim()) {
        parsedHeaders = JSON.parse(headersText);
      }

      const config = {
        url: formData.url,
        protocolVersion: formData.protocolVersion,
        capabilities: formData.capabilities,
        headers: parsedHeaders,
        timeout: formData.timeout,
        enabled: formData.enabled,
        description: formData.description
      };

      onAdd({
        serverName: formData.serverName,
        config
      });
    } catch (error) {
      alert(`Invalid JSON in configuration: ${error.message}`);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCapabilityChange = (capability, enabled) => {
    setFormData(prev => ({
      ...prev,
      capabilities: {
        ...prev.capabilities,
        [capability]: {
          ...prev.capabilities[capability],
          enabled
        }
      }
    }));
  };

  const handleAutoApproveChange = (capability, value) => {
    try {
      const parsed = JSON.parse(value);
      setFormData(prev => ({
        ...prev,
        capabilities: {
          ...prev.capabilities,
          [capability]: {
            ...prev.capabilities[capability],
            autoApprove: parsed
          }
        }
      }));
    } catch (error) {
      // Invalid JSON, keep current value
    }
  };

  const validateUrl = (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content large-modal">
        <div className="modal-header">
          <div className="modal-title">Add MCP Server</div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Basic Configuration */}
          <div className="form-section">
            <h3>Basic Configuration</h3>

            <div className="form-group">
              <label className="form-label">Server Name:</label>
              <input
                type="text"
                className="form-input"
                value={formData.serverName}
                onChange={(e) => handleInputChange('serverName', e.target.value)}
                placeholder="e.g., web-search, weather-api, file-system"
                required
              />
              <small className="form-help">Unique identifier for this MCP server</small>
            </div>

            <div className="form-group">
              <label className="form-label">Description:</label>
              <input
                type="text"
                className="form-input"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Brief description of what this server provides"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Server URL:</label>
              <input
                type="url"
                className={`form-input ${formData.url && !validateUrl(formData.url) ? 'error' : ''}`}
                value={formData.url}
                onChange={(e) => handleInputChange('url', e.target.value)}
                placeholder="https://your-mcp-server.com/mcp"
                required
              />
              <small className="form-help">
                Full URL to the MCP server endpoint supporting HTTP transport
                {formData.url && !validateUrl(formData.url) && (
                  <span style={{ color: '#ff6b6b' }}> • Invalid URL format</span>
                )}
              </small>
            </div>

            <div className="form-group">
              <label className="form-label">Protocol Version:</label>
              <select
                className="form-input"
                value={formData.protocolVersion}
                onChange={(e) => handleInputChange('protocolVersion', e.target.value)}
              >
                <option value="2025-06-18">2025-06-18 (Latest)</option>
                <option value="2024-11-05">2024-11-05</option>
              </select>
              <small className="form-help">MCP protocol version supported by the server</small>
            </div>
          </div>

          {/* MCP Capabilities */}
          <div className="form-section">
            <h3>MCP Capabilities</h3>
            <p className="form-help">Select which MCP capabilities to enable for this server</p>

            <div className="capabilities-grid">
              <div className="capability-item">
                <label className="capability-label">
                  <input
                    type="checkbox"
                    checked={formData.capabilities.tools.enabled}
                    onChange={(e) => handleCapabilityChange('tools', e.target.checked)}
                  />
                  <strong>Tools</strong>
                </label>
                <p>Enable tool calling capabilities</p>
                {formData.capabilities.tools.enabled && (
                  <div className="capability-config">
                    <label>Auto-approve tools:</label>
                    <textarea
                      className="form-textarea small"
                      value={JSON.stringify(formData.capabilities.tools.autoApprove, null, 2)}
                      onChange={(e) => handleAutoApproveChange('tools', e.target.value)}
                      placeholder='["search_web", "get_weather"]'
                      rows="2"
                    />
                  </div>
                )}
              </div>

              <div className="capability-item">
                <label className="capability-label">
                  <input
                    type="checkbox"
                    checked={formData.capabilities.resources.enabled}
                    onChange={(e) => handleCapabilityChange('resources', e.target.checked)}
                  />
                  <strong>Resources</strong>
                </label>
                <p>Enable resource access capabilities</p>
                {formData.capabilities.resources.enabled && (
                  <div className="capability-config">
                    <label>Auto-approve resources:</label>
                    <textarea
                      className="form-textarea small"
                      value={JSON.stringify(formData.capabilities.resources.autoApprove, null, 2)}
                      onChange={(e) => handleAutoApproveChange('resources', e.target.value)}
                      placeholder='["file://*", "https://*"]'
                      rows="2"
                    />
                  </div>
                )}
              </div>

              <div className="capability-item">
                <label className="capability-label">
                  <input
                    type="checkbox"
                    checked={formData.capabilities.prompts.enabled}
                    onChange={(e) => handleCapabilityChange('prompts', e.target.checked)}
                  />
                  <strong>Prompts</strong>
                </label>
                <p>Enable prompt template capabilities</p>
                {formData.capabilities.prompts.enabled && (
                  <div className="capability-config">
                    <label>Auto-approve prompts:</label>
                    <textarea
                      className="form-textarea small"
                      value={JSON.stringify(formData.capabilities.prompts.autoApprove, null, 2)}
                      onChange={(e) => handleAutoApproveChange('prompts', e.target.value)}
                      placeholder='["code-review", "summarize"]'
                      rows="2"
                    />
                  </div>
                )}
              </div>

              <div className="capability-item">
                <label className="capability-label">
                  <input
                    type="checkbox"
                    checked={formData.capabilities.sampling.enabled}
                    onChange={(e) => handleCapabilityChange('sampling', e.target.checked)}
                  />
                  <strong>Sampling</strong>
                </label>
                <p>Enable model sampling capabilities (advanced)</p>
              </div>
            </div>
          </div>

          {/* Advanced Configuration */}
          <div className="form-section">
            <button
              type="button"
              className="btn btn-secondary small"
              onClick={() => setAdvancedOpen(!advancedOpen)}
            >
              {advancedOpen ? '▼' : '▶'} Advanced Configuration
            </button>

            {advancedOpen && (
              <div className="advanced-config">
                <div className="form-group">
                  <label className="form-label">Request Timeout (ms):</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.timeout}
                    onChange={(e) => handleInputChange('timeout', parseInt(e.target.value))}
                    min="1000"
                    max="120000"
                  />
                  <small className="form-help">Maximum time to wait for server responses (1000-120000ms)</small>
                </div>

                <div className="form-group">
                  <label className="form-label">Custom Headers (JSON):</label>
                  <textarea
                    className="form-textarea"
                    value={headersText}
                    onChange={(e) => setHeadersText(e.target.value)}
                    placeholder='{"Authorization": "Bearer token", "X-API-Key": "key"}'
                    rows="3"
                  />
                  <small className="form-help">Additional HTTP headers to send with requests</small>
                </div>
              </div>
            )}
          </div>

          {/* Connection Settings */}
          <div className="form-section">
            <h3>Connection Settings</h3>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => handleInputChange('enabled', e.target.checked)}
                />
                {formData.enabled ? 'Connect to server immediately' : 'Add server but don\'t connect yet'}
              </label>
              <small className="form-help">
                {formData.enabled
                  ? 'Server will attempt to connect and discover capabilities immediately'
                  : 'Server will be saved but you can connect later. Useful for testing configurations.'}
              </small>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn">
              Add Server
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddServerModal;