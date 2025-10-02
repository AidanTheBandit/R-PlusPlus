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
      const { input, model = 'tts-1', voice = 'alloy', response_format = 'mp3', speed = 1.0 } = req.body;

      if (!input) {
        return res.status(400).json({
          error: {
            message: 'Input text is required',
            type: 'validation_error'
          }
        });
      }

      // Check if target device already has a pending request
      const existingRequests = Array.from(requestDeviceMap.entries())
        .filter(([_, deviceId]) => deviceId === targetDeviceId);

      if (existingRequests.length > 0) {
        console.log(`❌ Device ${targetDeviceId} already has ${existingRequests.length} pending request(s)`);
        return res.status(429).json({
          error: {
            message: 'Device is currently processing another request. Please wait for it to complete.',
            type: 'device_busy'
          }
        });
      }

      console.log(`📊 Current pending requests: ${pendingRequests.size}`);

      // Generate unique request ID
      const requestId = `tts-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
              type: 'timeout'
            }
          });
        }, 60000);
      }

      // Store the request for response handling
      pendingRequests.set(requestId, { res, timeout, isTTS: true, response_format });

      // Build TTS command for R1 device
      const command = {
        type: 'text_to_speech',
        data: {
          text: input,
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
              type: 'service_unavailable'
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
            type: 'service_unavailable'
          }
        });
      }
    } catch (error) {
      console.error('Error processing TTS request:', error);
      res.status(500).json({
        error: {
          message: 'Internal server error',
          type: 'server_error'
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