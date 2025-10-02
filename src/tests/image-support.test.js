const request = require('supertest');
const express = require('express');
const { setupOpenAIRoutes } = require('../routes/openai');
const { setupAudioRoutes } = require('../routes/audio');

// Mock dependencies
jest.mock('../utils/device-id-manager');
jest.mock('../utils/mcp-manager');
jest.mock('node-fetch', () => jest.fn());
jest.mock('../socket/socket-handler', () => ({
  setupSocketHandler: jest.fn()
}));

const fetch = require('node-fetch');

describe('Image Support in Chat Completions', () => {
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

    mockMcpManager = {
      getDeviceTools: jest.fn(),
      generateMCPPromptInjection: jest.fn()
    };

    mockConnectedR1s = new Map();
    mockPendingRequests = new Map();
    mockRequestDeviceMap = new Map();

    // Setup routes
    setupOpenAIRoutes(app, null, mockConnectedR1s, mockPendingRequests, mockRequestDeviceMap, mockDeviceIdManager, mockMcpManager);
  });

  test('should extract imageBase64 from message', () => {
    // Mock device as connected
    mockDeviceIdManager.hasDevice.mockReturnValue(true);
    mockDeviceIdManager.getDeviceInfoFromDB.mockResolvedValue({ pin_code: null });

    // Mock MCP manager
    mockMcpManager.getDeviceTools.mockResolvedValue([]);
    mockMcpManager.generateMCPPromptInjection.mockResolvedValue('');

    // Create a mock socket
    const mockSocket = {
      emit: jest.fn(),
      id: 'socket123',
      connected: true
    };
    mockConnectedR1s.set('test-device', mockSocket);

    // Use supertest with test header to skip timeouts
    return request(app)
      .post('/test-device/v1/chat/completions')
      .set('x-test-request', 'true')
      .send({
        messages: [{
          role: 'user',
          content: 'Analyze this image',
          imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          pluginId: 'image-analyzer'
        }],
        model: 'r1-command'
      })
      .then((response) => {
        // Should queue the request (429 = device busy, but request was accepted)
        expect(response.status).toBe(429);

        // Check that socket.emit was called with image data
        expect(mockSocket.emit).toHaveBeenCalledWith('chat_completion', expect.objectContaining({
          type: 'chat_completion',
          data: expect.objectContaining({
            message: expect.stringContaining('Analyze this image'),
            imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
            pluginId: 'image-analyzer'
          })
        }));
      });
  });

  test('should handle messages without image data', () => {
    // Mock device as connected
    mockDeviceIdManager.hasDevice.mockReturnValue(true);
    mockDeviceIdManager.getDeviceInfoFromDB.mockResolvedValue({ pin_code: null });

    // Mock MCP manager
    mockMcpManager.getDeviceTools.mockResolvedValue([]);
    mockMcpManager.generateMCPPromptInjection.mockResolvedValue('');

    // Create a mock socket
    const mockSocket = {
      emit: jest.fn(),
      id: 'socket123',
      connected: true
    };
    mockConnectedR1s.set('test-device', mockSocket);

    return request(app)
      .post('/test-device/v1/chat/completions')
      .set('x-test-request', 'true')
      .send({
        messages: [{
          role: 'user',
          content: 'Hello world'
        }],
        model: 'r1-command'
      })
      .then((response) => {
        // Should queue the request
        expect(response.status).toBe(429);

        // Check that socket.emit was called without image data
        expect(mockSocket.emit).toHaveBeenCalledWith('chat_completion', expect.objectContaining({
          type: 'chat_completion',
          data: expect.not.objectContaining({
            imageBase64: expect.anything()
          })
        }));
      });
  });
});