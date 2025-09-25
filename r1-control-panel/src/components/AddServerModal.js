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
    enabled: true,
    // Authentication
    authType: 'none', // 'none', 'bearer', 'basic', 'api-key', 'oauth'
    authConfig: {
      bearerToken: '',
      username: '',
      password: '',
      apiKey: '',
      apiKeyHeader: 'X-API-Key',
      oauthClientId: '',
      oauthClientSecret: '',
      oauthTokenUrl: ''
    }
  });

  const [showTemplates, setShowTemplates] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [headersText, setHeadersText] = useState('{}');
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState(null);

  // Available MCP server templates
  const templates = [
    {
      id: 'deepwiki',
      name: 'DeepWiki MCP Server',
      description: 'Access GitHub repository documentation and ask questions about codebases',
      url: 'https://mcp.deepwiki.com/sse',
      tools: ['read_wiki_structure', 'read_wiki_contents', 'ask_question'],
      category: 'documentation'
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

      // Build authentication headers
      const authHeaders = buildAuthHeaders();
      const finalHeaders = { ...parsedHeaders, ...authHeaders };

      const config = {
        url: formData.url,
        protocolVersion: formData.protocolVersion,
        capabilities: formData.capabilities,
        headers: finalHeaders,
        timeout: formData.timeout,
        enabled: formData.enabled,
        description: formData.description,
        authType: formData.authType,
        authConfig: formData.authConfig
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

  const handleAuthTypeChange = (authType) => {
    setFormData(prev => ({
      ...prev,
      authType,
      authConfig: {
        ...prev.authConfig,
        // Reset auth config when changing type
        ...(authType === 'none' && {
          bearerToken: '',
          username: '',
          password: '',
          apiKey: '',
          oauthClientId: '',
          oauthClientSecret: '',
          oauthTokenUrl: ''
        })
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

  // Build authentication headers
  const buildAuthHeaders = () => {
    const headers = { ...formData.headers };

    switch (formData.authType) {
      case 'bearer':
        if (formData.authConfig.bearerToken) {
          headers['Authorization'] = `Bearer ${formData.authConfig.bearerToken}`;
        }
        break;
      case 'basic':
        if (formData.authConfig.username && formData.authConfig.password) {
          const credentials = btoa(`${formData.authConfig.username}:${formData.authConfig.password}`);
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;
      case 'api-key':
        if (formData.authConfig.apiKey && formData.authConfig.apiKeyHeader) {
          headers[formData.authConfig.apiKeyHeader] = formData.authConfig.apiKey;
        }
        break;
      case 'oauth':
        // OAuth headers would be handled by the OAuth flow
        // For now, we'll assume the token is already obtained
        if (formData.authConfig.bearerToken) {
          headers['Authorization'] = `Bearer ${formData.authConfig.bearerToken}`;
        }
        break;
    }

    return headers;
  };

  const testConnection = async () => {
    if (!formData.url) {
      setConnectionTestResult({ success: false, message: 'URL is required for connection test' });
      return;
    }

    setTestingConnection(true);
    setConnectionTestResult(null);

    try {
      // Use the backend API to test the connection (avoids CORS issues)
      const testResponse = await fetch('/api/mcp/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: formData.url,
          protocolVersion: formData.protocolVersion,
          capabilities: formData.capabilities,
          headers: buildAuthHeaders(),
          timeout: formData.timeout
        })
      });

      if (!testResponse.ok) {
        throw new Error(`Test request failed: ${testResponse.status}`);
      }

      const result = await testResponse.json();

      if (result.success) {
        setConnectionTestResult({
          success: true,
          message: result.message,
          serverInfo: result.serverInfo
        });
      } else {
        setConnectionTestResult({
          success: false,
          message: result.message
        });
      }
    } catch (error) {
      setConnectionTestResult({
        success: false,
        message: `Connection test failed: ${error.message}`
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

          {/* Authentication Configuration */}
          <div className="form-section">
            <h3>Authentication</h3>
            <p className="form-help">Configure authentication for this MCP server</p>

            <div className="form-group">
              <label className="form-label">Authentication Type:</label>
              <select
                className="form-input"
                value={formData.authType}
                onChange={(e) => handleAuthTypeChange(e.target.value)}
              >
                <option value="none">No Authentication</option>
                <option value="bearer">Bearer Token</option>
                <option value="basic">Basic Authentication</option>
                <option value="api-key">API Key</option>
                <option value="oauth">OAuth 2.0</option>
              </select>
              <small className="form-help">Choose the authentication method required by the server</small>
            </div>

            {formData.authType === 'bearer' && (
              <div className="form-group">
                <label className="form-label">Bearer Token:</label>
                <input
                  type="password"
                  className="form-input"
                  value={formData.authConfig.bearerToken}
                  onChange={(e) => handleAuthConfigChange('bearerToken', e.target.value)}
                  placeholder="Enter your bearer token"
                />
                <small className="form-help">Token will be sent as "Authorization: Bearer &lt;token&gt;"</small>
              </div>
            )}

            {formData.authType === 'basic' && (
              <>
                <div className="form-group">
                  <label className="form-label">Username:</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.authConfig.username}
                    onChange={(e) => handleAuthConfigChange('username', e.target.value)}
                    placeholder="Enter username"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Password:</label>
                  <input
                    type="password"
                    className="form-input"
                    value={formData.authConfig.password}
                    onChange={(e) => handleAuthConfigChange('password', e.target.value)}
                    placeholder="Enter password"
                  />
                  <small className="form-help">Credentials will be base64 encoded for Basic auth</small>
                </div>
              </>
            )}

            {formData.authType === 'api-key' && (
              <>
                <div className="form-group">
                  <label className="form-label">API Key Header:</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.authConfig.apiKeyHeader}
                    onChange={(e) => handleAuthConfigChange('apiKeyHeader', e.target.value)}
                    placeholder="X-API-Key"
                  />
                  <small className="form-help">HTTP header name for the API key</small>
                </div>
                <div className="form-group">
                  <label className="form-label">API Key:</label>
                  <input
                    type="password"
                    className="form-input"
                    value={formData.authConfig.apiKey}
                    onChange={(e) => handleAuthConfigChange('apiKey', e.target.value)}
                    placeholder="Enter your API key"
                  />
                </div>
              </>
            )}

            {formData.authType === 'oauth' && (
              <>
                <div className="form-group">
                  <label className="form-label">Client ID:</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.authConfig.oauthClientId}
                    onChange={(e) => handleAuthConfigChange('oauthClientId', e.target.value)}
                    placeholder="OAuth client ID"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Client Secret:</label>
                  <input
                    type="password"
                    className="form-input"
                    value={formData.authConfig.oauthClientSecret}
                    onChange={(e) => handleAuthConfigChange('oauthClientSecret', e.target.value)}
                    placeholder="OAuth client secret"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Token URL:</label>
                  <input
                    type="url"
                    className="form-input"
                    value={formData.authConfig.oauthTokenUrl}
                    onChange={(e) => handleAuthConfigChange('oauthTokenUrl', e.target.value)}
                    placeholder="https://auth.example.com/oauth/token"
                  />
                  <small className="form-help">OAuth token endpoint URL</small>
                </div>
                <div className="form-group">
                  <label className="form-label">Access Token:</label>
                  <input
                    type="password"
                    className="form-input"
                    value={formData.authConfig.bearerToken}
                    onChange={(e) => handleAuthConfigChange('bearerToken', e.target.value)}
                    placeholder="Enter obtained access token"
                  />
                  <small className="form-help">If you already have an access token, enter it here</small>
                </div>
              </>
            )}
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