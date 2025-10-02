const request = require('supertest');
const express = require('express');
const { setupAudioRoutes } = require('../routes/audio');

// Mock dependencies
jest.mock('../utils/device-id-manager');
jest.mock('../utils/mcp-manager');
jest.mock('node-fetch', () => jest.fn());
jest.mock('../socket/socket-handler', () => ({
  setupSocketHandler: jest.fn()
}));

const fetch = require('node-fetch');

describe('TTS Endpoint Tests', () => {
  let app;
  let mockDeviceIdManager;
  let mockMcpManager;
  let mockConnectedR1s;
  let mockPendingRequests;
  let mockRequestDeviceMap;

  beforeEach(() => {
    // Create express app
    app = express();
    app.use(express.json());

    // Mock dependencies
    mockDeviceIdManager = {
      hasDevice: jest.fn(),
      getDeviceInfoFromDB: jest.fn(),
      deviceIds: new Map()
    };

    mockMcpManager = null; // Not needed for TTS

    mockConnectedR1s = new Map();
    mockPendingRequests = new Map();
    mockRequestDeviceMap = new Map();

    // Setup routes
    setupAudioRoutes(app, null, mockConnectedR1s, mockPendingRequests, mockRequestDeviceMap, mockDeviceIdManager, mockMcpManager);
  });

  test('should accept valid TTS request', (done) => {
    // Mock device as connected
    mockDeviceIdManager.hasDevice.mockReturnValue(true);
    mockDeviceIdManager.getDeviceInfoFromDB.mockResolvedValue({ pin_code: null });

    // Create a mock socket
    const mockSocket = {
      emit: jest.fn(),
      id: 'socket123',
      connected: true
    };
    mockConnectedR1s.set('test-device', mockSocket);

    request(app)
      .post('/test-device/v1/audio/speech')
      .set('x-test-request', 'true')
      .send({
        input: 'Hello world',
        model: 'tts-1',
        voice: 'alloy',
        response_format: 'mp3',
        speed: 1.0
      })
      .end((err, response) => {
        if (err) return done(err);

        // Should accept the request
        expect(response.status).toBe(200);

        // Check that socket.emit was called with correct TTS data
        expect(mockSocket.emit).toHaveBeenCalledWith('text_to_speech', expect.objectContaining({
          type: 'text_to_speech',
          data: expect.objectContaining({
            originalText: 'Hello world',
            model: 'tts-1',
            voice: 'alloy',
            response_format: 'mp3',
            speed: 1.0,
            text: expect.stringContaining('Hello world') // Enhanced text contains original
          })
        }));

        done();
      });

    // Manually resolve the pending TTS request
    setTimeout(() => {
      const requestId = mockSocket.emit.mock.calls[0][1].data.requestId;
      if (mockPendingRequests.has(requestId)) {
        const { res } = mockPendingRequests.get(requestId);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.send(Buffer.from('mock-audio-data'));
      }
    }, 100);
  });

  test('should reject TTS request without input', async () => {
    // Mock device info to avoid auth issues
    mockDeviceIdManager.getDeviceInfoFromDB.mockResolvedValue({ pin_code: null });

    const response = await request(app)
      .post('/test-device/v1/audio/speech')
      .send({
        model: 'tts-1',
        voice: 'alloy'
      });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('The input field is required');
  });

  test('should use default values for optional parameters', (done) => {
    // Mock device as connected
    mockDeviceIdManager.hasDevice.mockReturnValue(true);
    mockDeviceIdManager.getDeviceInfoFromDB.mockResolvedValue({ pin_code: null });

    // Create a mock socket
    const mockSocket = {
      emit: jest.fn(),
      id: 'socket123',
      connected: true
    };
    mockConnectedR1s.set('test-device', mockSocket);

    request(app)
      .post('/test-device/v1/audio/speech')
      .set('x-test-request', 'true')
      .send({
        input: 'Test message'
      })
      .end((err, response) => {
        if (err) return done(err);

        // Should accept the request
        expect(response.status).toBe(200);

        // Check that socket.emit was called with default values
        expect(mockSocket.emit).toHaveBeenCalledWith('text_to_speech', expect.objectContaining({
          type: 'text_to_speech',
          data: expect.objectContaining({
            originalText: 'Test message',
            model: 'tts-1',
            voice: 'alloy',
            response_format: 'mp3',
            speed: 1.0,
            text: expect.stringContaining('Test message') // Enhanced text contains original
          })
        }));

        done();
      });

    // Manually resolve the pending TTS request
    setTimeout(() => {
      const requestId = mockSocket.emit.mock.calls[0][1].data.requestId;
      if (mockPendingRequests.has(requestId)) {
        const { res } = mockPendingRequests.get(requestId);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.send(Buffer.from('mock-audio-data'));
      }
    }, 100);
  });

  test('should handle PIN authentication for TTS', async () => {
    // Mock device with PIN required
    mockDeviceIdManager.getDeviceInfoFromDB.mockResolvedValue({ pin_code: '123456' });

    const response = await request(app)
      .post('/test-device/v1/audio/speech')
      .send({
        input: 'Hello world'
      });

    expect(response.status).toBe(401);
    expect(response.body.error.message).toContain('PIN code required');
  });

  test('should accept custom model names', (done) => {
    // Mock device as connected
    mockDeviceIdManager.hasDevice.mockReturnValue(true);
    mockDeviceIdManager.getDeviceInfoFromDB.mockResolvedValue({ pin_code: null });

    // Create a mock socket
    const mockSocket = {
      emit: jest.fn(),
      id: 'socket123',
      connected: true
    };
    mockConnectedR1s.set('test-device', mockSocket);

    request(app)
      .post('/test-device/v1/audio/speech')
      .set('x-test-request', 'true')
      .send({
        input: 'Hello world',
        model: 'gpt-4o-mini-tts', // Custom model name
        voice: 'alloy',
        response_format: 'mp3',
        speed: 1.0
      })
      .end((err, response) => {
        if (err) return done(err);

        // Should accept the request with custom model
        expect(response.status).toBe(200);

        // Check that socket.emit was called with the custom model
        expect(mockSocket.emit).toHaveBeenCalledWith('text_to_speech', expect.objectContaining({
          type: 'text_to_speech',
          data: expect.objectContaining({
            model: 'gpt-4o-mini-tts'
          })
        }));

        done();
      });

    // Manually resolve the pending TTS request
    setTimeout(() => {
      const requestId = mockSocket.emit.mock.calls[0][1].data.requestId;
      if (mockPendingRequests.has(requestId)) {
        const { res } = mockPendingRequests.get(requestId);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.send(Buffer.from('mock-audio-data'));
      }
    }, 100);
  });

  test('should accept ElevenLabs voices', (done) => {
    // Mock device as connected
    mockDeviceIdManager.hasDevice.mockReturnValue(true);
    mockDeviceIdManager.getDeviceInfoFromDB.mockResolvedValue({ pin_code: null });

    // Create a mock socket
    const mockSocket = {
      emit: jest.fn(),
      id: 'socket123',
      connected: true
    };
    mockConnectedR1s.set('test-device', mockSocket);

    request(app)
      .post('/test-device/v1/audio/speech')
      .set('x-test-request', 'true')
      .send({
        input: 'Hello world',
        model: 'tts-1',
        voice: 'adam', // ElevenLabs voice
        response_format: 'mp3',
        speed: 1.0
      })
      .end((err, response) => {
        if (err) return done(err);

        // Should accept the request with ElevenLabs voice
        expect(response.status).toBe(200);

        // Check that socket.emit was called with the ElevenLabs voice
        expect(mockSocket.emit).toHaveBeenCalledWith('text_to_speech', expect.objectContaining({
          type: 'text_to_speech',
          data: expect.objectContaining({
            voice: 'adam'
          })
        }));

        done();
      });

    // Manually resolve the pending TTS request
    setTimeout(() => {
      const requestId = mockSocket.emit.mock.calls[0][1].data.requestId;
      if (mockPendingRequests.has(requestId)) {
        const { res } = mockPendingRequests.get(requestId);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.send(Buffer.from('mock-audio-data'));
      }
    }, 100);
  });