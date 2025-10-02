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

  test('should accept valid TTS request', () => {
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

    return request(app)
      .post('/test-device/v1/audio/speech')
      .set('x-test-request', 'true')
      .send({
        input: 'Hello world',
        model: 'tts-1',
        voice: 'alloy',
        response_format: 'mp3',
        speed: 1.0
      })
      .then((response) => {
        // Should queue the request (429 = device busy, but request was accepted)
        expect(response.status).toBe(429);

        // Check that socket.emit was called with correct TTS data
        expect(mockSocket.emit).toHaveBeenCalledWith('text_to_speech', expect.objectContaining({
          type: 'text_to_speech',
          data: expect.objectContaining({
            text: 'Hello world',
            model: 'tts-1',
            voice: 'alloy',
            response_format: 'mp3',
            speed: 1.0
          })
        }));
      });
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
    expect(response.body.error.message).toContain('Input text is required');
  });

  test('should use default values for optional parameters', () => {
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

    return request(app)
      .post('/test-device/v1/audio/speech')
      .set('x-test-request', 'true')
      .send({
        input: 'Test message'
      })
      .then((response) => {
        // Should queue the request
        expect(response.status).toBe(429);

        // Check that socket.emit was called with default values
        expect(mockSocket.emit).toHaveBeenCalledWith('text_to_speech', expect.objectContaining({
          type: 'text_to_speech',
          data: expect.objectContaining({
            text: 'Test message',
            model: 'tts-1',
            voice: 'alloy',
            response_format: 'mp3',
            speed: 1.0
          })
        }));
      });
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

  test('should accept valid PIN for TTS', () => {
    // Mock device with PIN required
    mockDeviceIdManager.hasDevice.mockReturnValue(true);
    mockDeviceIdManager.getDeviceInfoFromDB.mockResolvedValue({ pin_code: '123456' });

    // Create a mock socket
    const mockSocket = {
      emit: jest.fn(),
      id: 'socket123',
      connected: true
    };
    mockConnectedR1s.set('test-device', mockSocket);

    return request(app)
      .post('/test-device/v1/audio/speech')
      .set('Authorization', 'Bearer 123456')
      .set('x-test-request', 'true')
      .send({
        input: 'Hello world'
      })
      .then((response) => {
        // Should queue the request
        expect(response.status).toBe(429);
      });
  });
});