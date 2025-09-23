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
  constructor(database = null) {
    this.database = database;
    this.deviceIds = new Map(); // deviceId -> socket/connection info (in-memory cache)
    this.persistentIds = new Map(); // socketId -> deviceId mapping (in-memory)
  }

  // Generate a short, memorable device ID
  generateDeviceId() {
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const number = Math.floor(Math.random() * 99) + 1; // 1-99
    return `${adjective}-${noun}-${number}`;
  }

  // Generate a 6-digit PIN code
  generatePinCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

      // Get or create a persistent device ID for a socket
  async getPersistentDeviceId(socketId, userAgent = null, ipAddress = null) {
    // First check if we already have this socket mapped
    if (this.persistentIds.has(socketId)) {
      return this.persistentIds.get(socketId);
    }

    // If we have database access, try to find an existing device for this user agent/IP
    if (this.database && userAgent) {
      try {
        // Look for existing devices with the same user agent (R1 devices should have consistent UA)
        const existingDevices = await this.database.all(
          `SELECT * FROM devices WHERE user_agent = ? ORDER BY last_seen DESC LIMIT 5`,
          [userAgent]
        );

        // If we find a recent device (within last hour), reuse it
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const recentDevice = existingDevices.find(device => device.last_seen > oneHourAgo);

        if (recentDevice) {
          this.persistentIds.set(socketId, recentDevice.device_id);
          console.log(`🔄 Reusing existing device ID: ${recentDevice.device_id} for socket: ${socketId}`);
          return recentDevice.device_id;
        }
      } catch (error) {
        console.warn('Database query for existing device failed:', error);
      }
    }

    // Generate a new ID and store it
    const deviceId = this.generateDeviceId();
    this.persistentIds.set(socketId, deviceId);
    this.deviceIds.set(deviceId, { socketId, connectedAt: new Date().toISOString() });

    console.log(`🔄 Generated new device ID: ${deviceId} for socket: ${socketId}`);
    return deviceId;
  }

  // Register a device connection
  async registerDevice(socketId, deviceId = null, userAgent = null, ipAddress = null, enablePin = true) {
    if (!deviceId) {
      deviceId = await this.getPersistentDeviceId(socketId, userAgent, ipAddress);
    } else {
      // If a specific deviceId is provided, use it
      this.persistentIds.set(socketId, deviceId);
      this.deviceIds.set(deviceId, { socketId, connectedAt: new Date().toISOString() });
    }

    // Check if device already exists in database and has a PIN
    let pinCode = null;
    if (this.database) {
      try {
        const existingDevice = await this.database.getDevice(deviceId);
        if (existingDevice && existingDevice.pin_code) {
          pinCode = existingDevice.pin_code;
          console.log(`📌 Using existing PIN for device: ${deviceId}`);
        }
      } catch (error) {
        console.warn('Failed to check existing device PIN:', error);
      }
    }

    // Generate new PIN code only if enabled and no existing PIN
    if (enablePin && !pinCode) {
      pinCode = this.generatePinCode();
      console.log(`🔢 Generated new PIN for device: ${deviceId}`);
    }

    // Save to database if available
    if (this.database) {
      try {
        await this.database.saveDevice(deviceId, socketId, userAgent, ipAddress, pinCode);
      } catch (error) {
        console.warn('Failed to save device to database:', error);
      }
    }

    const pinMessage = pinCode ? `, PIN: ${pinCode}` : ', PIN disabled';
    console.log(`📱 Device registered: ${deviceId} (socket: ${socketId}${pinMessage})`);
    return { deviceId, pinCode };
  }

  // Unregister a device (on disconnect)
  async unregisterDevice(socketId) {
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

  // Get device info from database
  async getDeviceInfoFromDB(deviceId) {
    if (!this.database) return null;
    try {
      return await this.database.getDevice(deviceId);
    } catch (error) {
      console.warn('Failed to get device info from database:', error);
      return null;
    }
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