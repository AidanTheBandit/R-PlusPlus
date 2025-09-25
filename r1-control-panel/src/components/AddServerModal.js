import React, { useState } from 'react';

const AddServerModal = ({ templates, onAdd, onClose }) => {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formData, setFormData] = useState({
    serverName: '',
    description: '',
    url: '',
    protocolVersion: '2025-06-18',
    autoApprove: '[]',
    enabled: true
  });

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    setFormData({
      serverName: template.name,
      description: template.description,
      url: template.url || '', // Use URL from template if available, otherwise empty
      protocolVersion: '2025-06-18',
      autoApprove: JSON.stringify(template.autoApprove || [], null, 2),
      enabled: true
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.serverName || !formData.url) {
      alert('Server name and URL are required');
      return;
    }

    try {
      const config = {
        url: formData.url,
        protocolVersion: formData.protocolVersion,
        enabled: formData.enabled,
        autoApprove: JSON.parse(formData.autoApprove),
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

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <div className="modal-title">Add Remote MCP Server</div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Choose Template:</label>
            <div className="template-grid">
              {templates.map(template => (
                <div
                  key={template.name}
                  className={`template-card ${selectedTemplate?.name === template.name ? 'selected' : ''}`}
                  onClick={() => handleTemplateSelect(template)}
                >
                  <div className="template-name">{template.displayName}</div>
                  <div className="template-description">{template.description}</div>
                  <div className={`template-category template-category-${template.category}`}>
                    {template.category}
                    {template.url && <span className="template-url-indicator"> • Ready to use</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Server Name:</label>
            <input
              type="text"
              className="form-input"
              value={formData.serverName}
              onChange={(e) => handleInputChange('serverName', e.target.value)}
              placeholder="e.g., web-search, weather-api"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description:</label>
            <input
              type="text"
              className="form-input"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Brief description of the server"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Server URL:</label>
            <input
              type="url"
              className="form-input"
              value={formData.url}
              onChange={(e) => handleInputChange('url', e.target.value)}
              placeholder="https://your-mcp-server.com/mcp"
              required
            />
            <small className="form-help">
              {selectedTemplate?.url
                ? `Using URL from ${selectedTemplate.displayName} template`
                : selectedTemplate?.category === 'directory'
                ? `Visit ${selectedTemplate.displayName} to find and copy a specific MCP server URL`
                : selectedTemplate?.category === 'examples'
                ? `Visit ${selectedTemplate.displayName} to find working MCP server examples`
                : "Enter the URL of a remote MCP server that supports the MCP protocol"}
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
          </div>

          <div className="form-group">
            <label className="form-label">Auto-approve Tools (JSON array):</label>
            <textarea
              className="form-textarea"
              value={formData.autoApprove}
              onChange={(e) => handleInputChange('autoApprove', e.target.value)}
              placeholder='["search_web", "get_weather"]'
              rows="2"
            />
            <small className="form-help">Tools that can be called without manual approval</small>
          </div>

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
                ? 'Server will attempt to connect and discover tools immediately'
                : 'Server will be saved but you can connect later. Useful for testing URLs.'}
            </small>
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