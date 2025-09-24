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

    // SECURITY FIX: Only try to reuse device IDs for the EXACT same socket connection
    // This prevents multiple R1 devices from getting the same ID
    
    // If we have database access, ONLY look for devices with the exact same socket ID
    // that were recently disconnected (within 5 minutes)
    if (this.database && socketId) {
      try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        
        // Only match by exact socket ID and very recent disconnection
        const existingDevices = await this.database.all(
          `SELECT * FROM devices WHERE socket_id = ? AND last_seen > ? ORDER BY last_seen DESC LIMIT 1`,
          [socketId, fiveMinutesAgo]
        );

        if (existingDevices.length > 0) {
          const device = existingDevices[0];
          this.persistentIds.set(socketId, device.device_id);
          console.log(`🔄 Reusing device ID for same socket: ${device.device_id} for socket: ${socketId}`);
          return device.device_id;
        }

      } catch (error) {
        console.warn('Database query for existing device failed:', error);
      }
    }

    // Always generate a new unique ID for new connections
    // This ensures each R1 device gets its own unique identifier
    let deviceId;
    let attempts = 0;
    const maxAttempts = 50;
    
    do {
      deviceId = this.generateDeviceId();
      attempts++;
      
      // Check if this ID is already in use (in memory or database)
      const inMemoryConflict = this.deviceIds.has(deviceId);
      let dbConflict = false;
      
      if (this.database) {
        try {
          const existingDevice = await this.database.getDevice(deviceId);
          dbConflict = !!existingDevice;
        } catch (error) {
          // Ignore database errors for ID generation
        }
      }
      
      if (!inMemoryConflict && !dbConflict && !BLACKLISTED_IDS.includes(deviceId)) {
        break; // Found a unique ID
      }
      
      if (attempts >= maxAttempts) {
        // Fallback to timestamp-based ID to guarantee uniqueness
        deviceId = `device-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
        break;
      }
    } while (true);
    
    this.persistentIds.set(socketId, deviceId);
    this.deviceIds.set(deviceId, { socketId, connectedAt: new Date().toISOString() });

    console.log(`🆕 Generated NEW unique device ID: ${deviceId} for socket: ${socketId}`);
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

  // EMERGENCY: Force regenerate device IDs for all currently connected devices
  // This fixes the security issue where multiple R1s have the same ID
  async forceRegenerateAllDeviceIds() {
    console.log('🚨 EMERGENCY: Force regenerating all device IDs to fix security issue');
    
    const oldMappings = new Map(this.deviceIds);
    const oldPersistentMappings = new Map(this.persistentIds);
    
    // Clear all current mappings
    this.deviceIds.clear();
    this.persistentIds.clear();
    
    let regeneratedCount = 0;
    
    for (const [oldDeviceId, deviceInfo] of oldMappings) {
      const { socketId, userAgent, ipAddress } = deviceInfo;
      
      // Generate a completely new unique device ID
      let newDeviceId;
      let attempts = 0;
      const maxAttempts = 50;
      
      do {
        newDeviceId = this.generateDeviceId();
        attempts++;
        
        // Ensure it's not in use and not the same as the old one
        const inUse = this.deviceIds.has(newDeviceId) || oldMappings.has(newDeviceId);
        const isBlacklisted = BLACKLISTED_IDS.includes(newDeviceId);
        
        if (!inUse && !isBlacklisted && newDeviceId !== oldDeviceId) {
          break;
        }
        
        if (attempts >= maxAttempts) {
          newDeviceId = `device-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
          break;
        }
      } while (true);
      
      // Update mappings with new ID
      this.deviceIds.set(newDeviceId, {
        ...deviceInfo,
        regeneratedFrom: oldDeviceId,
        regeneratedAt: new Date().toISOString()
      });
      this.persistentIds.set(socketId, newDeviceId);
      
      // Update database if available
      if (this.database) {
        try {
          // Create new device entry
          await this.database.saveDevice(newDeviceId, socketId, userAgent, ipAddress, null);
          console.log(`🔄 Database: Created new device ${newDeviceId} (was ${oldDeviceId})`);
        } catch (error) {
          console.warn(`Failed to update database for ${newDeviceId}:`, error);
        }
      }
      
      regeneratedCount++;
      console.log(`🆕 Regenerated: ${oldDeviceId} → ${newDeviceId} (socket: ${socketId})`);
    }
    
    console.log(`✅ Emergency regeneration complete: ${regeneratedCount} device IDs regenerated`);
    return regeneratedCount;
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