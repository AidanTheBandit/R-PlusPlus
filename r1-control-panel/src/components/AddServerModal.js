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

  const [showTemplates, setShowTemplates] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // Available MCP server templates
  const templates = [
    {
      id: 'deepwiki',
      name: 'DeepWiki MCP Server',
      description: 'Access GitHub repository documentation and ask questions about codebases',
      url: 'https://mcp.deepwiki.com/sse',
      tools: ['read_wiki_structure', 'read_wiki_contents', 'ask_question'],
      category: 'documentation'
    },
    {
      id: 'test-server',
      name: 'Local Test Server',
      description: 'Built-in test MCP server for development and testing',
      url: `http://localhost:${window.location.port || 3000}/mcp/test-server`,
      tools: ['test_echo', 'test_calculator'],
      category: 'test'
    }
  ];

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

  const testConnection = async () => {
    if (!formData.url) {
      setConnectionTestResult({ success: false, message: 'URL is required for connection test' });
      return;
    }

    setTestingConnection(true);
    setConnectionTestResult(null);

    try {
      // Parse headers if provided
      let parsedHeaders = {};
      if (headersText.trim()) {
        parsedHeaders = JSON.parse(headersText);
      }

      // Create a test MCP client configuration
      const testConfig = {
        url: formData.url,
        protocolVersion: formData.protocolVersion,
        capabilities: formData.capabilities,
        headers: parsedHeaders,
        timeout: formData.timeout
      };

      // Test the connection by making a request to initialize
      const response = await fetch(formData.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'MCP-Protocol-Version': formData.protocolVersion,
          ...parsedHeaders
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: formData.protocolVersion,
            capabilities: formData.capabilities,
            clientInfo: {
              name: 'R-API-MCP-Test-Client',
              version: '1.0.0'
            }
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.result && result.result.protocolVersion) {
          setConnectionTestResult({
            success: true,
            message: `Connected successfully! Server supports MCP ${result.result.protocolVersion}`,
            serverInfo: result.result.serverInfo
          });
        } else {
          setConnectionTestResult({
            success: false,
            message: 'Server responded but does not appear to be a valid MCP server'
          });
        }
      } else {
        const errorText = await response.text();
        setConnectionTestResult({
          success: false,
          message: `Connection failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`
        });
      }
    } catch (error) {
      setConnectionTestResult({
        success: false,
        message: `Connection error: ${error.message}`
      });
    } finally {
      setTestingConnection(false);
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
          {/* Template Selection */}
          <div className="form-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Quick Setup</h3>
              <button
                type="button"
                className="btn btn-secondary small"
                onClick={() => setShowTemplates(!showTemplates)}
              >
                {showTemplates ? 'Hide Templates' : 'Show Templates'}
              </button>
            </div>

            {showTemplates && (
              <div className="templates-grid">
                {templates.map(template => (
                  <div
                    key={template.id}
                    className={`template-card ${selectedTemplate === template.id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedTemplate(template.id);
                      setFormData(prev => ({
                        ...prev,
                        serverName: template.id,
                        description: template.description,
                        url: template.url,
                        capabilities: {
                          tools: { enabled: true, autoApprove: template.tools || [] },
                          resources: { enabled: false, autoApprove: [] },
                          prompts: { enabled: false, autoApprove: [] },
                          sampling: { enabled: false }
                        }
                      }));
                    }}
                  >
                    <h4>{template.name}</h4>
                    <p>{template.description}</p>
                    <div className="template-meta">
                      <span className="category">{template.category}</span>
                      {template.tools && (
                        <span className="tools-count">{template.tools.length} tools</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedTemplate && (
              <div className="selected-template-notice">
                <strong>Template selected:</strong> {templates.find(t => t.id === selectedTemplate)?.name}
                <button
                  type="button"
                  className="btn btn-secondary small"
                  onClick={() => {
                    setSelectedTemplate(null);
                    setFormData(prev => ({
                      ...prev,
                      serverName: '',
                      description: '',
                      url: '',
                      capabilities: {
                        tools: { enabled: true, autoApprove: [] },
                        resources: { enabled: false, autoApprove: [] },
                        prompts: { enabled: false, autoApprove: [] },
                        sampling: { enabled: false }
                      }
                    }));
                  }}
                  style={{ marginLeft: '10px' }}
                >
                  Clear
                </button>
              </div>
            )}
          </div>

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
                placeholder="e.g., deepwiki, weather-api, file-system"
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
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
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
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={testConnection}
                  disabled={testingConnection || !formData.url || !validateUrl(formData.url)}
                  style={{ minWidth: '120px' }}
                >
                  {testingConnection ? 'Testing...' : 'Test Connection'}
                </button>
              </div>

              {connectionTestResult && (
                <div className={`connection-test-result ${connectionTestResult.success ? 'success' : 'error'}`}>
                  <strong>{connectionTestResult.success ? '✅ Success:' : '❌ Failed:'}</strong> {connectionTestResult.message}
                  {connectionTestResult.serverInfo && (
                    <div style={{ marginTop: '5px', fontSize: '0.9em' }}>
                      Server: {connectionTestResult.serverInfo.name} v{connectionTestResult.serverInfo.version}
                    </div>
                  )}
                </div>
              )}
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