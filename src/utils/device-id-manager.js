// Device ID management utility
// Generates short, memorable device IDs for R1 devices

const adjectives = [
  'red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'gray',
  'quick', 'slow', 'fast', 'lazy', 'brave', 'calm', 'wild', 'cool',
  'hot', 'cold', 'warm', 'fresh', 'dark', 'light', 'bright', 'dim'
];

const nouns = [
  'fox', 'wolf', 'bear', 'eagle', 'hawk', 'owl', 'lion', 'tiger',
  'cat', 'dog', 'bird', 'fish', 'tree', 'rock', 'star', 'moon',
  'sun', 'cloud', 'rain', 'snow', 'wind', 'fire', 'ice', 'leaf'
];

class DeviceIdManager {
  constructor() {
    this.deviceIds = new Map(); // deviceId -> socket/connection info
    this.persistentIds = new Map(); // persistent mapping of socket IDs to device IDs
  }

  // Generate a short, memorable device ID
  generateDeviceId() {
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const number = Math.floor(Math.random() * 99) + 1; // 1-99
    return `${adjective}-${noun}-${number}`;
  }

  // Get or create a persistent device ID for a socket
  getPersistentDeviceId(socketId) {
    if (this.persistentIds.has(socketId)) {
      return this.persistentIds.get(socketId);
    }

    // Generate a new ID and store it
    const deviceId = this.generateDeviceId();
    this.persistentIds.set(socketId, deviceId);
    this.deviceIds.set(deviceId, { socketId, connectedAt: new Date().toISOString() });

    console.log(`🔄 Generated new device ID: ${deviceId} for socket: ${socketId}`);
    return deviceId;
  }

  // Register a device connection
  registerDevice(socketId, deviceId = null) {
    if (!deviceId) {
      deviceId = this.getPersistentDeviceId(socketId);
    } else {
      // If a specific deviceId is provided, use it
      this.persistentIds.set(socketId, deviceId);
      this.deviceIds.set(deviceId, { socketId, connectedAt: new Date().toISOString() });
    }

    console.log(`📱 Device registered: ${deviceId} (socket: ${socketId})`);
    return deviceId;
  }

  // Unregister a device (on disconnect)
  unregisterDevice(socketId) {
    const deviceId = this.persistentIds.get(socketId);
    if (deviceId) {
      this.deviceIds.delete(deviceId);
      // Keep the persistent mapping for reconnection
      console.log(`📱 Device unregistered: ${deviceId} (socket: ${socketId})`);
    }
  }

  // Get all connected devices
  getConnectedDevices() {
    return Array.from(this.deviceIds.entries()).map(([deviceId, info]) => ({
      deviceId,
      ...info
    }));
  }

  // Check if device ID exists
  hasDevice(deviceId) {
    return this.deviceIds.has(deviceId);
  }

  // Get socket for device ID
  getSocketForDevice(deviceId) {
    const deviceInfo = this.deviceIds.get(deviceId);
    return deviceInfo ? deviceInfo.socketId : null;
  }

  // Get device info
  getDeviceInfo(deviceId) {
    return this.deviceIds.get(deviceId) || null;
  }

  // Clean up old persistent IDs (optional - call periodically)
  cleanupOldIds(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
    const now = Date.now();
    const toRemove = [];

    for (const [socketId, deviceId] of this.persistentIds) {
      const deviceInfo = this.deviceIds.get(deviceId);
      if (deviceInfo) {
        const connectedAt = new Date(deviceInfo.connectedAt).getTime();
        if (now - connectedAt > maxAge) {
          toRemove.push(socketId);
        }
      }
    }

    toRemove.forEach(socketId => {
      const deviceId = this.persistentIds.get(socketId);
      this.persistentIds.delete(socketId);
      this.deviceIds.delete(deviceId);
      console.log(`🧹 Cleaned up old device ID: ${deviceId}`);
    });

    return toRemove.length;
  }
}

module.exports = { DeviceIdManager };