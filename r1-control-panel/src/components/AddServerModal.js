import React, { useState } from 'react';

const AddServerModal = ({ templates, onAdd, onClose }) => {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formData, setFormData] = useState({
    serverName: '',
    description: '',
    command: '',
    args: '[]',
    env: '{}',
    autoApprove: '[]',
    enabled: true
  });

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    setFormData({
      serverName: template.name,
      description: template.description,
      command: template.command,
      args: JSON.stringify(template.args, null, 2),
      env: JSON.stringify(template.env, null, 2),
      autoApprove: JSON.stringify(template.autoApprove, null, 2),
      enabled: true
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.serverName || !formData.command) {
      alert('Server name and command are required');
      return;
    }

    try {
      const config = {
        command: formData.command,
        args: JSON.parse(formData.args),
        env: JSON.parse(formData.env),
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
          <div className="modal-title">Add MCP Server</div>
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
              placeholder="e.g., filesystem, web-search"
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
            <label className="form-label">Command:</label>
            <input
              type="text"
              className="form-input"
              value={formData.command}
              onChange={(e) => handleInputChange('command', e.target.value)}
              placeholder="e.g., uvx, python, node"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Arguments (JSON array):</label>
            <textarea
              className="form-textarea"
              value={formData.args}
              onChange={(e) => handleInputChange('args', e.target.value)}
              placeholder='["mcp-server-filesystem"]'
              rows="3"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Environment Variables (JSON object):</label>
            <textarea
              className="form-textarea"
              value={formData.env}
              onChange={(e) => handleInputChange('env', e.target.value)}
              placeholder='{"API_KEY": "your-key"}'
              rows="3"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Auto-approve Tools (JSON array):</label>
            <textarea
              className="form-textarea"
              value={formData.autoApprove}
              onChange={(e) => handleInputChange('autoApprove', e.target.value)}
              placeholder='["search", "read_file"]'
              rows="2"
            />
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => handleInputChange('enabled', e.target.checked)}
              />
              Enable server immediately
            </label>
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