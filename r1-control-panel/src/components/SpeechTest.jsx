import React, { useState } from 'react';

const SpeechTest = ({ deviceId, pinCode }) => {
  const [text, setText] = useState('Hello R1! This is a test of the text-to-speech functionality.');
  const [model, setModel] = useState('tts-1');
  const [voice, setVoice] = useState('alloy');
  const [responseFormat, setResponseFormat] = useState('mp3');
  const [speed, setSpeed] = useState(1.0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleTestSpeech = async () => {
    if (!text.trim()) {
      setError('Please enter some text to convert to speech');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const headers = {
        'Content-Type': 'application/json'
      };

      if (pinCode) {
        headers['Authorization'] = `Bearer ${pinCode}`;
      }

      const response = await fetch(`/${deviceId}/v1/audio/speech`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          input: text,
          model: model,
          voice: voice,
          response_format: responseFormat,
          speed: speed
        })
      });

      if (response.ok) {
        // Get the audio blob
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        // Create audio element and play
        const audio = new Audio(audioUrl);
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
        };

        await audio.play();
        setSuccess('Speech generated and played successfully!');
      } else {
        const errorData = await response.json();
        setError(errorData.error?.message || 'Failed to generate speech');
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const presetTexts = [
    'Hello R1! This is a test of the text-to-speech functionality.',
    'The weather today is sunny with a high of 75 degrees.',
    'Your meeting with the design team is scheduled for 3 PM.',
    'Remember to pick up groceries on your way home.',
    'Good morning! How can I help you today?'
  ];

  return (
    <div className="speech-test">
      <div className="card">
        <h2>🎵 Text-to-Speech Test</h2>
        <p>Test the speech synthesis capabilities of your R1 device using OpenAI-compatible TTS.</p>

        <div className="form-group">
          <label htmlFor="speech-text">Text to Speak:</label>
          <textarea
            id="speech-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text to convert to speech..."
            rows={3}
            className="speech-textarea"
          />
        </div>

        <div className="preset-buttons">
          <label>Quick Presets:</label>
          <div className="preset-grid">
            {presetTexts.map((preset, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setText(preset)}
                className="preset-btn"
                title={preset}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>

        <div className="speech-controls">
          <div className="control-row">
            <div className="form-group">
              <label htmlFor="model">Model:</label>
              <select
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                <option value="tts-1">TTS-1</option>
                <option value="tts-1-hd">TTS-1-HD</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="voice">Voice:</label>
              <select
                id="voice"
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
              >
                <option value="alloy">Alloy</option>
                <option value="echo">Echo</option>
                <option value="fable">Fable</option>
                <option value="onyx">Onyx</option>
                <option value="nova">Nova</option>
                <option value="shimmer">Shimmer</option>
              </select>
            </div>
          </div>

          <div className="control-row">
            <div className="form-group">
              <label htmlFor="format">Format:</label>
              <select
                id="format"
                value={responseFormat}
                onChange={(e) => setResponseFormat(e.target.value)}
              >
                <option value="mp3">MP3</option>
                <option value="wav">WAV</option>
                <option value="ogg">OGG</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="speed">Speed: {speed}x</label>
              <input
                type="range"
                id="speed"
                min="0.25"
                max="4.0"
                step="0.25"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="speed-slider"
              />
            </div>
          </div>
        </div>

        <div className="action-buttons">
          <button
            onClick={handleTestSpeech}
            disabled={isLoading}
            className="primary-btn"
          >
            {isLoading ? '🎵 Generating Speech...' : '🔊 Test Speech'}
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

        <div className="info-section">
          <h3>ℹ️ How it works:</h3>
          <ul>
            <li>Enter text or use one of the preset messages</li>
            <li>Choose your preferred voice and audio format</li>
            <li>Adjust the speech speed if needed</li>
            <li>Click "Test Speech" to generate and play audio</li>
            <li>The audio will be generated by your R1 device and played automatically</li>
          </ul>

          <h3>🔧 API Endpoint:</h3>
          <code>POST /{deviceId}/v1/audio/speech</code>
          <pre className="code-example">{`{
  "input": "Hello world!",
  "model": "tts-1",
  "voice": "alloy",
  "response_format": "mp3",
  "speed": 1.0
}`}</pre>
        </div>
      </div>
    </div>
  );
};

export default SpeechTest;