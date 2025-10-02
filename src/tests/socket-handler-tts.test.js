const { setupSocketHandler } = require('../socket/socket-handler');

// Mock dependencies
jest.mock('../utils/device-id-manager');
jest.mock('../utils/mcp-manager');
jest.mock('../utils/response-utils');
jest.mock('node-fetch', () => jest.fn());

const fetch = require('node-fetch');

describe('Socket Handler TTS Response Tests', () => {
  let mockIo;
  let mockConnectedR1s;
  let mockPendingRequests;
  let mockRequestDeviceMap;
  let mockDebugStreams;
  let mockDeviceLogs;
  let mockDebugDataStore;
  let mockPerformanceMetrics;
  let mockDeviceIdManager;
  let mockMcpManager;

  beforeEach(() => {
    // Mock all dependencies
    mockIo = {
      on: jest.fn()
    };

    mockConnectedR1s = new Map();
    mockPendingRequests = new Map();
    mockRequestDeviceMap = new Map();
    mockDebugStreams = new Map();
    mockDeviceLogs = new Map();
    mockDebugDataStore = new Map();
    mockPerformanceMetrics = new Map();

    mockDeviceIdManager = {
      registerDevice: jest.fn(),
      unregisterDevice: jest.fn(),
      hasDevice: jest.fn(),
      getDeviceInfo: jest.fn()
    };

    mockMcpManager = {
      getDeviceServers: jest.fn(),
      initializeServer: jest.fn(),
      shutdownDeviceServers: jest.fn()
    };

    // Mock the response-utils
    require('../utils/response-utils').sendOpenAIResponse = jest.fn();
  });

  test('should handle TTS response with base64 audio data', () => {
    // Setup socket handler
    setupSocketHandler(
      mockIo,
      mockConnectedR1s,
      mockPendingRequests,
      mockRequestDeviceMap,
      mockDebugStreams,
      mockDeviceLogs,
      mockDebugDataStore,
      mockPerformanceMetrics,
      mockDeviceIdManager,
      mockMcpManager
    );

    // Get the connection handler
    const connectionHandler = mockIo.on.mock.calls.find(call => call[0] === 'connection')[1];

    // Create mock socket
    const mockSocket = {
      id: 'socket123',
      handshake: {
        headers: { 'user-agent': 'test' },
        address: '127.0.0.1'
      },
      emit: jest.fn(),
      on: jest.fn()
    };

    // Mock device registration
    mockDeviceIdManager.registerDevice.mockReturnValue({
      deviceId: 'test-device',
      pinCode: null,
      deviceSecret: 'secret',
      isReconnection: false
    });

    // Call connection handler
    connectionHandler(mockSocket);

    // Find the tts_response handler
    const ttsResponseHandler = mockSocket.on.mock.calls.find(call => call[0] === 'tts_response')[1];

    // Mock pending request
    const mockRes = {
      setHeader: jest.fn(),
      send: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    mockPendingRequests.set('tts-123', {
      res: mockRes,
      timeout: setTimeout(() => {}, 1000),
      isTTS: true,
      response_format: 'mp3'
    });

    mockRequestDeviceMap.set('tts-123', 'test-device');

    // Call TTS response handler
    ttsResponseHandler({
      requestId: 'tts-123',
      audioData: 'base64AudioData',
      audioFormat: 'mp3'
    });

    // Verify response was sent
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'audio/mpeg');
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="speech.mp3"');
    expect(mockRes.send).toHaveBeenCalledWith(Buffer.from('base64AudioData', 'base64'));

    // Verify cleanup
    expect(mockPendingRequests.has('tts-123')).toBe(false);
    expect(mockRequestDeviceMap.has('tts-123')).toBe(false);
  });

  test('should handle TTS response with binary audio data', () => {
    // Setup socket handler
    setupSocketHandler(
      mockIo,
      mockConnectedR1s,
      mockPendingRequests,
      mockRequestDeviceMap,
      mockDebugStreams,
      mockDeviceLogs,
      mockDebugDataStore,
      mockPerformanceMetrics,
      mockDeviceIdManager,
      mockMcpManager
    );

    // Get the connection handler
    const connectionHandler = mockIo.on.mock.calls.find(call => call[0] === 'connection')[1];

    // Create mock socket
    const mockSocket = {
      id: 'socket123',
      handshake: {
        headers: { 'user-agent': 'test' },
        address: '127.0.0.1'
      },
      emit: jest.fn(),
      on: jest.fn()
    };

    // Mock device registration
    mockDeviceIdManager.registerDevice.mockReturnValue({
      deviceId: 'test-device',
      pinCode: null,
      deviceSecret: 'secret',
      isReconnection: false
    });

    // Call connection handler
    connectionHandler(mockSocket);

    // Find the tts_response handler
    const ttsResponseHandler = mockSocket.on.mock.calls.find(call => call[0] === 'tts_response')[1];

    // Mock pending request
    const mockRes = {
      setHeader: jest.fn(),
      send: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    mockPendingRequests.set('tts-456', {
      res: mockRes,
      timeout: setTimeout(() => {}, 1000),
      isTTS: true,
      response_format: 'wav'
    });

    mockRequestDeviceMap.set('tts-456', 'test-device');

    // Call TTS response handler with binary data
    const binaryData = Buffer.from('binaryAudioData');
    ttsResponseHandler({
      requestId: 'tts-456',
      audioData: binaryData,
      audioFormat: 'wav'
    });

    // Verify response was sent
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'audio/wav');
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="speech.wav"');
    expect(mockRes.send).toHaveBeenCalledWith(binaryData);
  });

  test('should handle TTS response with missing audio data', () => {
    // Setup socket handler
    setupSocketHandler(
      mockIo,
      mockConnectedR1s,
      mockPendingRequests,
      mockRequestDeviceMap,
      mockDebugStreams,
      mockDeviceLogs,
      mockDebugDataStore,
      mockPerformanceMetrics,
      mockDeviceIdManager,
      mockMcpManager
    );

    // Get the connection handler
    const connectionHandler = mockIo.on.mock.calls.find(call => call[0] === 'connection')[1];

    // Create mock socket
    const mockSocket = {
      id: 'socket123',
      handshake: {
        headers: { 'user-agent': 'test' },
        address: '127.0.0.1'
      },
      emit: jest.fn(),
      on: jest.fn()
    };

    // Mock device registration
    mockDeviceIdManager.registerDevice.mockReturnValue({
      deviceId: 'test-device',
      pinCode: null,
      deviceSecret: 'secret',
      isReconnection: false
    });

    // Call connection handler
    connectionHandler(mockSocket);

    // Find the tts_response handler
    const ttsResponseHandler = mockSocket.on.mock.calls.find(call => call[0] === 'tts_response')[1];

    // Mock pending request
    const mockRes = {
      setHeader: jest.fn(),
      send: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    mockPendingRequests.set('tts-789', {
      res: mockRes,
      timeout: setTimeout(() => {}, 1000),
      isTTS: true,
      response_format: 'mp3'
    });

    mockRequestDeviceMap.set('tts-789', 'test-device');

    // Call TTS response handler with no audio data
    ttsResponseHandler({
      requestId: 'tts-789',
      audioFormat: 'mp3'
    });

    // Verify error response
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: {
        message: 'No audio data received from device',
        type: 'no_audio_data'
      }
    });
  });

  test('should reject TTS response from wrong device', () => {
    // Setup socket handler
    setupSocketHandler(
      mockIo,
      mockConnectedR1s,
      mockPendingRequests,
      mockRequestDeviceMap,
      mockDebugStreams,
      mockDeviceLogs,
      mockDebugDataStore,
      mockPerformanceMetrics,
      mockDeviceIdManager,
      mockMcpManager
    );

    // Get the connection handler
    const connectionHandler = mockIo.on.mock.calls.find(call => call[0] === 'connection')[1];

    // Create mock socket
    const mockSocket = {
      id: 'socket123',
      handshake: {
        headers: { 'user-agent': 'test' },
        address: '127.0.0.1'
      },
      emit: jest.fn(),
      on: jest.fn()
    };

    // Mock device registration
    mockDeviceIdManager.registerDevice.mockReturnValue({
      deviceId: 'test-device',
      pinCode: null,
      deviceSecret: 'secret',
      isReconnection: false
    });

    // Call connection handler
    connectionHandler(mockSocket);

    // Find the tts_response handler
    const ttsResponseHandler = mockSocket.on.mock.calls.find(call => call[0] === 'tts_response')[1];

    // Mock pending request for different device
    mockPendingRequests.set('tts-999', {
      res: {},
      timeout: setTimeout(() => {}, 1000),
      isTTS: true
    });

    mockRequestDeviceMap.set('tts-999', 'different-device');

    // Call TTS response handler
    ttsResponseHandler({
      requestId: 'tts-999',
      audioData: 'audioData'
    });

    // Should not process the request (security violation)
    expect(mockPendingRequests.has('tts-999')).toBe(true); // Request should still exist
  });
});