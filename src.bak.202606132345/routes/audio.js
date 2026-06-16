const { sendOpenAIResponse } = require('../utils/response-utils');

function setupAudioRoutes(app, io, connectedR1s, pendingRequests, requestDeviceMap, deviceIdManager, mcpManager) {
  // Device-specific TTS endpoints: /device-{deviceId}/v1/audio/speech (legacy format)
  app.post('/device-:deviceId/v1/audio/speech', async (req, res) => {
    const { deviceId } = req.params;
    await handleTextToSpeech(req, res, deviceId);
  });

  // Device-specific TTS endpoints: /{deviceId}/v1/audio/speech (new format)
  app.post('/:deviceId/v1/audio/speech', async (req, res) => {
    const { deviceId } = req.params;
    await handleTextToSpeech(req, res, deviceId);
  });

  // Shared handler for text-to-speech
  async function handleTextToSpeech(req, res, targetDeviceId) {
    // Check authentication
    const authResult = await authenticateDevice(targetDeviceId, req.headers.authorization);
    if (!authResult.authenticated) {
      return res.status(401).json({
        error: {
          message: authResult.error,
          type: 'authentication_failed'
        }
      });
    }

    try {
      // OpenAI TTS API compliant parameters
      const { input, model = 'tts-1', voice = 'alloy', response_format = 'mp3', speed = 1.0 } = req.body;

      if (!input) {
        return res.status(400).json({
          error: {
            message: 'The input field is required',
            type: 'invalid_request_error',
            param: 'input'
          }
        });
      }

      // Validate model parameter - be permissive, accept any model name
      // This allows for custom models like "gpt-4o-mini-tts" or other TTS models
      if (!model || typeof model !== 'string' || model.trim().length === 0) {
        return res.status(400).json({
          error: {
            message: 'Model parameter must be a non-empty string',
            type: 'invalid_request_error',
            param: 'model'
          }
        });
      }

      // Validate voice parameter - support both OpenAI and ElevenLabs voices
      const openAIVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
      const elevenLabsVoices = [
        'adam', 'antoni', 'arnold', 'bella', 'domi', 'elli', 'josh', 'rachel', 'sam',
        'adam_onnx', 'antoni_onnx', 'arnold_onnx', 'bella_onnx', 'domi_onnx', 'elli_onnx', 'josh_onnx', 'rachel_onnx', 'sam_onnx',
        '21m00tcm4tcm05', '29vD33pUPOjHqjUhCw', '2EiwWnXFnvU5JabPnv8n', '5QlozMw6BCG9V7kF', 'AZnzlk1XvdvUeBnXmlld',
        'EXAVITQu4vr4xnSDxMaL', 'ErXwobaYiN019PkySvjV', 'MF3mGyEYCl7XYWbV9V6O', 'TxGEqnHWrfWFTfGW9XjX',
        'VR6AewLTigWG4xSOukaG', 'pNInz6obpgDQGcFmaJgB', 'yoZ06aMxZJJ28mfd3POQ', 'zwPf7U9Gk5Xz5t8Ld1wK'
      ];

      const allValidVoices = [...openAIVoices, ...elevenLabsVoices];

      if (!voice || typeof voice !== 'string' || voice.trim().length === 0) {
        return res.status(400).json({
          error: {
            message: 'Voice parameter must be a non-empty string',
            type: 'invalid_request_error',
            param: 'voice'
          }
        });
      }

      // Log if using ElevenLabs voice for debugging
      const isElevenLabsVoice = elevenLabsVoices.includes(voice.toLowerCase());
      if (isElevenLabsVoice) {
        console.log(`🎭 Using ElevenLabs voice: ${voice}`);
      }

      // Validate response_format parameter
      const validFormats = ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'];
      if (!validFormats.includes(response_format)) {
        return res.status(400).json({
          error: {
            message: `Invalid response_format: ${response_format}. Supported formats: ${validFormats.join(', ')}`,
            type: 'invalid_request_error',
            param: 'response_format'
          }
        });
      }

      // Validate speed parameter
      if (speed < 0.25 || speed > 4.0) {
        return res.status(400).json({
          error: {
            message: 'Speed must be between 0.25 and 4.0',
            type: 'invalid_request_error',
            param: 'speed'
          }
        });
      }

      // Check if target device already has a pending TTS request
      const existingTTSRequests = Array.from(requestDeviceMap.entries())
        .filter(([_, deviceId]) => deviceId === targetDeviceId)
        .filter(([requestId]) => {
          const request = pendingRequests.get(requestId);
          return request && request.isTTS; // Only count TTS requests
        });

      if (existingTTSRequests.length > 0) {
        console.log(`❌ Device ${targetDeviceId} already has ${existingTTSRequests.length} pending TTS request(s): ${existingTTSRequests.map(([id]) => id).join(', ')}`);
        return res.status(429).json({
          error: {
            message: 'Device is currently processing another speech request. Please wait for it to complete.',
            type: 'device_busy_error'
          }
        });
      }

      console.log(`📊 Current pending requests: ${pendingRequests.size}`);

      // Generate unique request ID with timestamp for better uniqueness
      const requestId = `tts-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log(`🎯 Generated request ID: ${requestId}`);

      // Check if this is a test request (skip timeouts)
      const isTestRequest = req.headers['x-test-request'] === 'true';

      let timeout;
      if (!isTestRequest) {
        // Set up timeout for request (longer for TTS)
        timeout = setTimeout(() => {
          console.log(`⏰ TTS request ${requestId} timed out after 60 seconds`);
          pendingRequests.delete(requestId);
          requestDeviceMap.delete(requestId);
          res.status(504).json({
            error: {
              message: 'TTS request timeout - R1 device did not respond within 60 seconds',
              type: 'timeout_error'
            }
          });
        }, 60000);
      }

      // Store the request for response handling
      pendingRequests.set(requestId, { res, timeout, isTTS: true, response_format });

      // Build enhanced TTS command for R1 device with better prompting
      const getVoiceDescription = (voiceName) => {
        const voice = voiceName.toLowerCase();

        // OpenAI voices
        if (voice === 'alloy') return 'a clear and friendly female voice';
        if (voice === 'echo') return 'a deep and resonant male voice';
        if (voice === 'fable') return 'a warm and engaging storytelling voice';
        if (voice === 'onyx') return 'a powerful and authoritative male voice';
        if (voice === 'nova') return 'a youthful and energetic female voice';
        if (voice === 'shimmer') return 'a bright and cheerful female voice';

        // ElevenLabs voices - provide descriptive styles
        if (voice.includes('adam')) return 'a deep and professional male voice';
        if (voice.includes('antoni')) return 'a warm and conversational male voice';
        if (voice.includes('arnold')) return 'a strong and confident male voice';
        if (voice.includes('bella')) return 'a gentle and melodic female voice';
        if (voice.includes('domi')) return 'a youthful and expressive female voice';
        if (voice.includes('elli')) return 'a bright and enthusiastic female voice';
        if (voice.includes('josh')) return 'a friendly and approachable male voice';
        if (voice.includes('rachel')) return 'a sophisticated and articulate female voice';
        if (voice.includes('sam')) return 'a calm and reassuring male voice';

        // Default fallback for unknown voices
        return `a ${voice} voice style`;
      };

      const voiceDescription = getVoiceDescription(voice);
      // Use the original input text directly without verbose instructions
      const textToSpeak = input;

      const command = {
        type: 'text_to_speech',
        data: {
          text: textToSpeak,
          originalText: input,
          model,
          voice,
          response_format,
          speed,
          requestId,
          timestamp: new Date().toISOString()
        }
      };

      console.log('Sending TTS command to R1 device:', JSON.stringify(command, null, 2));

      let responsesSent = 0;

      // Send to specific device
      if (deviceIdManager.hasDevice(targetDeviceId)) {
        const socket = connectedR1s.get(targetDeviceId);
        if (socket) {
          console.log(`📤 Sending TTS to device:`, JSON.stringify(command, null, 2));
          socket.emit('text_to_speech', command);
          requestDeviceMap.set(requestId, targetDeviceId);
          responsesSent++;
          console.log(`📊 Sent TTS request ${requestId} to device`);
        } else {
          console.log(`❌ Device has no socket in connectedR1s`);
        }
      } else {
        console.log(`❌ Device not found in deviceIdManager`);
        // Try fallback
        if (connectedR1s.has(targetDeviceId)) {
          console.log(`🔄 Fallback: Found device in connectedR1s, sending TTS anyway`);
          const socket = connectedR1s.get(targetDeviceId);
          if (socket) {
            socket.emit('text_to_speech', command);
            requestDeviceMap.set(requestId, targetDeviceId);
            responsesSent++;
            console.log(`📊 Fallback sent TTS request ${requestId} to device`);
          }
        } else {
          pendingRequests.delete(requestId);
          clearTimeout(timeout);
          res.status(503).json({
            error: {
              message: `Device not connected`,
              type: 'service_unavailable_error'
            }
          });
          return;
        }
      }

      if (responsesSent === 0) {
        pendingRequests.delete(requestId);
        clearTimeout(timeout);
        res.status(503).json({
          error: {
            message: 'No R1 devices available',
            type: 'service_unavailable_error'
          }
        });
      }
    } catch (error) {
      console.error('Error processing TTS request:', error);
      res.status(500).json({
        error: {
          message: 'Internal server error',
          type: 'internal_server_error'
        }
      });
    }
  }

  // Authentication helper function
  async function authenticateDevice(deviceId, authHeader) {
    // Check if device exists and get PIN status
    const deviceInfo = await deviceIdManager.getDeviceInfoFromDB(deviceId);
    if (!deviceInfo) {
      return { authenticated: false, error: 'Device not found' };
    }

    // If PIN is disabled (null or empty), allow access without authentication
    if (!deviceInfo.pin_code) {
      return { authenticated: true };
    }

    // PIN is enabled, require authentication
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { authenticated: false, error: 'PIN code required. Use Authorization: Bearer <pin-code>' };
    }

    const providedPin = authHeader.substring(7); // Remove 'Bearer '

    if (deviceInfo.pin_code !== providedPin) {
      return { authenticated: false, error: 'Invalid PIN code' };
    }

    return { authenticated: true };
  }
}

module.exports = { setupAudioRoutes };