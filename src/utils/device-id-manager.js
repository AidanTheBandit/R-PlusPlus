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

// Blacklisted device IDs to prevent accidental assignment
const BLACKLISTED_IDS = [
  'red-fox-42',
  'red-fox-7',
  'red-fox-15',
  'red-fox-1',
  'red-fox-2',
  'red-fox-3',
  'red-fox-4',
  'red-fox-5',
  'red-fox-6',
  'red-fox-8',
  'red-fox-9',
  'red-fox-10',
  // Add more variations to be safe
  'blue-wolf-7',
  'quick-bird-15'
];

class DeviceIdManager {
  constructor(database = null) {
    this.database = database;
    this.deviceIds = new Map(); // deviceId -> socket/connection info (in-memory cache)
    this.persistentIds = new Map(); // socketId -> deviceId mapping (in-memory)
  }

  // Generate a short, memorable device ID
  generateDeviceId() {
    let deviceId;
    let attempts = 0;
    const maxAttempts = 100;
    
    do {
      const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
      const noun = nouns[Math.floor(Math.random() * nouns.length)];
      const number = Math.floor(Math.random() * 99) + 1; // 1-99
      deviceId = `${adjective}-${noun}-${number}`;
      attempts++;
      
      if (attempts >= maxAttempts) {
        // Fallback to timestamp-based ID if we can't generate a non-blacklisted one
        deviceId = `device-${Date.now().toString(36)}`;
        break;
      }
    } while (BLACKLISTED_IDS.includes(deviceId));
    
    return deviceId;
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

    // If we have database access, try to find an existing device for this connection
    if (this.database && (userAgent || ipAddress)) {
      try {
        // Look for existing devices with matching criteria
        // Use a broader time window (24 hours instead of 2 hours)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        let existingDevices = [];

        // Try to match by IP address first (most reliable for device identification)
        if (ipAddress) {
          existingDevices = await this.database.all(
            `SELECT * FROM devices WHERE ip_address = ? AND last_seen > ? ORDER BY last_seen DESC LIMIT 5`,
            [ipAddress, oneDayAgo]
          );

          if (existingDevices.length > 0) {
            const device = existingDevices[0];
            this.persistentIds.set(socketId, device.device_id);
            console.log(`🔄 Reusing device ID by IP match: ${device.device_id} for socket: ${socketId}`);
            return device.device_id;
          }
        }

        // If no IP match, try user agent (less reliable but still useful)
        if (userAgent) {
          existingDevices = await this.database.all(
            `SELECT * FROM devices WHERE user_agent = ? AND last_seen > ? ORDER BY last_seen DESC LIMIT 3`,
            [userAgent, oneDayAgo]
          );

          if (existingDevices.length > 0) {
            const device = existingDevices[0];
            this.persistentIds.set(socketId, device.device_id);
            console.log(`🔄 Reusing device ID by user agent match: ${device.device_id} for socket: ${socketId}`);
            return device.device_id;
          }
        }

        // As a last resort, look for any recently connected device from the same IP range
        // (useful for devices behind NAT that change IP slightly)
        if (ipAddress) {
          const ipParts = ipAddress.split('.');
          if (ipParts.length === 4) {
            const ipPrefix = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`; // First 3 octets
            existingDevices = await this.database.all(
              `SELECT * FROM devices WHERE ip_address LIKE ? AND last_seen > ? ORDER BY last_seen DESC LIMIT 3`,
              [`${ipPrefix}.%`, oneDayAgo]
            );

            if (existingDevices.length > 0) {
              const device = existingDevices[0];
              this.persistentIds.set(socketId, device.device_id);
              console.log(`🔄 Reusing device ID by IP range match: ${device.device_id} for socket: ${socketId}`);
              return device.device_id;
            }
          }
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
  }  // Register a device connection
  async registerDevice(socketId, deviceId = null, userAgent = null, ipAddress = null, enablePin = true) {
    console.log(`📱 Registering device for socket: ${socketId}, userAgent: ${userAgent?.substring(0, 50)}..., ipAddress: ${ipAddress}`);

    if (!deviceId) {
      deviceId = await this.getPersistentDeviceId(socketId, userAgent, ipAddress);
      console.log(`📱 Generated/found deviceId: ${deviceId} for socket: ${socketId}`);
    }
    
    // CRITICAL FIX: Always update the deviceIds map for chat completion lookup
    this.persistentIds.set(socketId, deviceId);
    this.deviceIds.set(deviceId, { 
      socketId, 
      connectedAt: new Date().toISOString(),
      userAgent,
      ipAddress 
    });
    console.log(`📱 Updated deviceIds map: ${deviceId} for socket: ${socketId}`)

    // Check if device already exists in database and has a PIN
    let pinCode = null;
    if (this.database) {
      try {
        const existingDevice = await this.database.getDevice(deviceId);
        if (existingDevice) {
          pinCode = existingDevice.pin_code;
          console.log(`📌 Found existing device ${deviceId} in database with PIN: ${pinCode ? 'set' : 'none'}`);
        } else {
          console.log(`📌 Device ${deviceId} not found in database, will create new entry`);
        }
      } catch (error) {
        console.warn('Failed to check existing device PIN:', error);
      }
    }

    // Generate new PIN code only if enabled and no existing PIN
    if (enablePin && !pinCode) {
      pinCode = this.generatePinCode();
      console.log(`🔢 Generated new PIN for device: ${deviceId}: ${pinCode}`);
    }

    // Save to database if available
    if (this.database) {
      try {
        // First check if device already exists
        const existingDevice = await this.database.getDevice(deviceId);
        if (existingDevice) {
          // Update existing device with new connection info
          await this.database.run(
            `UPDATE devices SET socket_id = ?, last_seen = CURRENT_TIMESTAMP, user_agent = ?, ip_address = ? WHERE device_id = ?`,
            [socketId, userAgent, ipAddress, deviceId]
          );
          console.log(`📱 Updated existing device: ${deviceId}`);
        } else {
          // Insert new device
          await this.database.saveDevice(deviceId, socketId, userAgent, ipAddress, pinCode);
          console.log(`📱 Created new device: ${deviceId}`);
        }
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