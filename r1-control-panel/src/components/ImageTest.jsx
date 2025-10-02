import React, { useState, useRef } from 'react';

const ImageTest = ({ deviceId, pinCode }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [prompt, setPrompt] = useState('Analyze this image and describe what you see in detail.');
  const [model, setModel] = useState('r1-command');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(150);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [response, setResponse] = useState('');
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file');
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }

      setSelectedFile(file);
      setError('');

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTestImage = async () => {
    if (!selectedFile) {
      setError('Please select an image file');
      return;
    }

    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');
    setResponse('');

    try {
      // Convert image to base64
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          // Remove the data:image/jpeg;base64, prefix
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      const headers = {
        'Content-Type': 'application/json'
      };

      if (pinCode) {
        headers['Authorization'] = `Bearer ${pinCode}`;
      }

      const requestBody = {
        messages: [
          {
            role: 'user',
            content: prompt,
            imageBase64: base64Data
          }
        ],
        model: model,
        temperature: temperature,
        max_tokens: maxTokens
      };

      console.log('Sending image analysis request:', {
        ...requestBody,
        messages: [
          {
            ...requestBody.messages[0],
            imageBase64: `[${base64Data.length} chars]`
          }
        ]
      });

      const response = await fetch(`/${deviceId}/v1/chat/completions`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || 'No response content';
        setResponse(content);
        setSuccess('Image analyzed successfully!');
      } else {
        const errorData = await response.json();
        setError(errorData.error?.message || 'Failed to analyze image');
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const clearImage = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setResponse('');
    setError('');
    setSuccess('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const presetPrompts = [
    'Analyze this image and describe what you see in detail.',
    'What objects can you identify in this image?',
    'Describe the colors and composition of this image.',
    'What emotions or mood does this image convey?',
    'Extract any text you can see in this image.'
  ];

  return (
    <div className="image-test">
      <div className="card">
        <h2>🖼️ Image Analysis Test</h2>
        <p>Test the image analysis capabilities of your R1 device using AI vision.</p>

        <div className="form-group">
          <label htmlFor="image-file">Select Image:</label>
          <input
            ref={fileInputRef}
            type="file"
            id="image-file"
            accept="image/*"
            onChange={handleFileSelect}
            className="file-input"
          />
          {selectedFile && (
            <div className="file-info">
              <span className="file-name">📎 {selectedFile.name}</span>
              <span className="file-size">({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
              <button onClick={clearImage} className="clear-btn">✕</button>
            </div>
          )}
        </div>

        {imagePreview && (
          <div className="image-preview">
            <img
              src={imagePreview}
              alt="Preview"
              className="preview-image"
              style={{ maxWidth: '300px', maxHeight: '300px', objectFit: 'contain' }}
            />
          </div>
        )}

        <div className="form-group">
          <label htmlFor="image-prompt">Analysis Prompt:</label>
          <textarea
            id="image-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your analysis prompt..."
            rows={3}
            className="prompt-textarea"
          />
        </div>

        <div className="preset-buttons">
          <label>Quick Prompts:</label>
          <div className="preset-grid">
            {presetPrompts.map((preset, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setPrompt(preset)}
                className="preset-btn"
                title={preset}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>

        <div className="image-controls">
          <div className="control-row">
            <div className="form-group">
              <label htmlFor="model">Model:</label>
              <select
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                <option value="r1-command">R1 Command</option>
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-4-vision-preview">GPT-4 Vision</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="temperature">Temperature: {temperature}</label>
              <input
                type="range"
                id="temperature"
                min="0.0"
                max="2.0"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="temp-slider"
              />
            </div>
          </div>

          <div className="control-row">
            <div className="form-group">
              <label htmlFor="max-tokens">Max Tokens:</label>
              <select
                id="max-tokens"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              >
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="150">150</option>
                <option value="200">200</option>
                <option value="300">300</option>
              </select>
            </div>
          </div>
        </div>

        <div className="action-buttons">
          <button
            onClick={handleTestImage}
            disabled={isLoading || !selectedFile}
            className="primary-btn"
          >
            {isLoading ? '🔍 Analyzing Image...' : '🖼️ Analyze Image'}
          </button>
          <button
            onClick={clearImage}
            disabled={!selectedFile}
            className="secondary-btn"
          >
            🗑️ Clear
          </button>
        </div>

        {error && (
          <div className="error-message">
            ❌ {error}
          </div>
        )}

        {success && (
          <div className="success-message">
            ✅ {success}
          </div>
        )}

        {response && (
          <div className="response-section">
            <h3>🤖 AI Response:</h3>
            <div className="response-content">
              {response}
            </div>
          </div>
        )}

        <div className="info-section">
          <h3>ℹ️ How it works:</h3>
          <ul>
            <li>Select an image file (JPG, PNG, etc.) under 10MB</li>
            <li>Enter a prompt describing what you want to know about the image</li>
            <li>Choose your preferred AI model and settings</li>
            <li>Click "Analyze Image" to process with your R1 device</li>
            <li>The AI will analyze the image and provide a detailed response</li>
          </ul>

          <h3>🔧 API Endpoint:</h3>
          <code>POST /{deviceId}/v1/chat/completions</code>
          <pre className="code-example">{`{
  "messages": [
    {
      "role": "user",
      "content": "Describe this image",
      "imageBase64": "<base64-encoded-image>"
    }
  ],
  "model": "r1-command",
  "temperature": 0.7,
  "max_tokens": 150
}`}</pre>
        </div>
      </div>
    </div>
  );
};

export default ImageTest;