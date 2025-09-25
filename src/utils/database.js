// SQLite database manager for persistent storage
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseManager {
  constructor(dbPath = null) {
    this.dbPath = dbPath || path.join(__dirname, '..', '..', 'r-api.db');
    this.db = null;
    this.initialized = false;
  }

  // Initialize database and create tables
  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Failed to open database:', err);
          reject(err);
          return;
        }

        console.log('Connected to SQLite database');
        this.createTables().then(() => {
          this.initialized = true;
          resolve();
        }).catch(reject);
      });
    });
  }

  // Create necessary tables
  async createTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT UNIQUE NOT NULL,
        socket_id TEXT,
        pin_code TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_agent TEXT,
        ip_address TEXT
      )`,

      `CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        device_id TEXT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS pending_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT UNIQUE NOT NULL,
        device_id TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
      )`,

      `CREATE TABLE IF NOT EXISTS debug_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT,
        level TEXT,
        message TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT
      )`,

      `CREATE TABLE IF NOT EXISTS system_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        device_id TEXT,
        data TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS mcp_servers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        server_name TEXT NOT NULL,
        server_type TEXT DEFAULT 'external',
        command TEXT,
        args TEXT,
        env TEXT,
        enabled BOOLEAN DEFAULT 1,
        auto_approve TEXT,
        config TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(device_id, server_name)
      )`,

      `CREATE TABLE IF NOT EXISTS mcp_tools (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id INTEGER,
        tool_name TEXT NOT NULL,
        tool_description TEXT,
        tool_schema TEXT,
        enabled BOOLEAN DEFAULT 1,
        usage_count INTEGER DEFAULT 0,
        last_used DATETIME,
        FOREIGN KEY(server_id) REFERENCES mcp_servers(id) ON DELETE CASCADE
      )`,

      `CREATE TABLE IF NOT EXISTS mcp_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        server_name TEXT NOT NULL,
        session_id TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_activity DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS mcp_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT,
        server_name TEXT,
        level TEXT,
        message TEXT,
        metadata TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS phone_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        phone_number TEXT UNIQUE NOT NULL,
        verification_code TEXT,
        verified BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        verified_at DATETIME,
        FOREIGN KEY(device_id) REFERENCES devices(device_id) ON DELETE CASCADE
      )`
    ];

    for (const sql of tables) {
      await this.run(sql);
    }

    // Run migrations for existing databases
    await this.runMigrations();

    console.log('Database tables created/verified and migrations run');
  }

  // Run database migrations
  async runMigrations() {
    try {
      // Check if pin_code column exists, add it if not
      const tableInfo = await this.all("PRAGMA table_info(devices)");
      const hasPinCode = tableInfo.some(column => column.name === 'pin_code');
      const hasDeviceSecret = tableInfo.some(column => column.name === 'device_secret');

      if (!hasPinCode) {
        console.log('Adding pin_code column to devices table...');
        await this.run(`ALTER TABLE devices ADD COLUMN pin_code TEXT`);
        console.log('pin_code column added successfully');
      }

      if (!hasDeviceSecret) {
        console.log('Adding device_secret column to devices table...');
        await this.run(`ALTER TABLE devices ADD COLUMN device_secret TEXT`);
        console.log('device_secret column added successfully');
      }

      // Check if config column exists in mcp_servers table
      const mcpTableInfo = await this.all("PRAGMA table_info(mcp_servers)");
      const hasConfigColumn = mcpTableInfo.some(column => column.name === 'config');

      if (!hasConfigColumn) {
        console.log('Adding config column to mcp_servers table...');
        await this.run(`ALTER TABLE mcp_servers ADD COLUMN config TEXT`);
        console.log('config column added successfully');
      }
    } catch (error) {
      console.warn('Migration check failed:', error);
    }
  }

  // Run a SQL query
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  // Get a single row
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Get all rows
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Device management methods
  async saveDevice(deviceId, socketId = null, userAgent = null, ipAddress = null, pinCode = null) {
    const sql = `
      INSERT OR REPLACE INTO devices (device_id, socket_id, last_seen, user_agent, ip_address, pin_code)
      VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?)
    `;
    await this.run(sql, [deviceId, socketId, userAgent, ipAddress, pinCode]);
  }

  async saveDeviceWithSecret(deviceId, socketId = null, userAgent = null, ipAddress = null, pinCode = null, deviceSecret = null) {
    const sql = `
      INSERT OR REPLACE INTO devices (device_id, socket_id, last_seen, user_agent, ip_address, pin_code, device_secret)
      VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?)
    `;
    await this.run(sql, [deviceId, socketId, userAgent, ipAddress, pinCode, deviceSecret]);
  }

  async updateDevicePin(deviceId, pinCode) {
    const sql = `UPDATE devices SET pin_code = ? WHERE device_id = ?`;
    await this.run(sql, [pinCode, deviceId]);
  }

  async disableDevicePin(deviceId) {
    const sql = `UPDATE devices SET pin_code = NULL WHERE device_id = ?`;
    await this.run(sql, [deviceId]);
  }

  async getDevice(deviceId) {
    const sql = `SELECT * FROM devices WHERE device_id = ?`;
    return await this.get(sql, [deviceId]);
  }

  async getAllDevices() {
    const sql = `SELECT * FROM devices ORDER BY last_seen DESC`;
    return await this.all(sql);
  }

  async updateDeviceLastSeen(deviceId) {
    const sql = `UPDATE devices SET last_seen = CURRENT_TIMESTAMP WHERE device_id = ?`;
    await this.run(sql, [deviceId]);
  }

  async removeDevice(deviceId) {
    const sql = `DELETE FROM devices WHERE device_id = ?`;
    await this.run(sql, [deviceId]);
  }

  // Conversation management
  async saveMessage(sessionId, deviceId, role, content) {
    const sql = `
      INSERT INTO conversations (session_id, device_id, role, content)
      VALUES (?, ?, ?, ?)
    `;
    await this.run(sql, [sessionId, deviceId, role, content]);
  }

  async getConversationHistory(sessionId, limit = 50) {
    const sql = `
      SELECT * FROM conversations
      WHERE session_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `;
    const rows = await this.all(sql, [sessionId, limit]);
    return rows.reverse(); // Return in chronological order
  }

  // Pending requests management
  async savePendingRequest(requestId, deviceId) {
    const sql = `
      INSERT INTO pending_requests (request_id, device_id)
      VALUES (?, ?)
    `;
    await this.run(sql, [requestId, deviceId]);
  }

  async completePendingRequest(requestId) {
    const sql = `
      UPDATE pending_requests
      SET status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE request_id = ?
    `;
    await this.run(sql, [requestId]);
  }

  async getPendingRequest(requestId) {
    const sql = `SELECT * FROM pending_requests WHERE request_id = ?`;
    return await this.get(sql, [requestId]);
  }

  async cleanupOldPendingRequests(maxAgeMinutes = 60) {
    const sql = `
      DELETE FROM pending_requests
      WHERE created_at < datetime('now', '-${maxAgeMinutes} minutes')
      AND status = 'pending'
    `;
    const result = await this.run(sql);
    return result.changes;
  }

  // Debug logs management
  async saveDebugLog(deviceId, level, message, metadata = null) {
    const sql = `
      INSERT INTO debug_logs (device_id, level, message, metadata)
      VALUES (?, ?, ?, ?)
    `;
    await this.run(sql, [deviceId, level, message, metadata ? JSON.stringify(metadata) : null]);
  }

  async getDebugLogs(deviceId, limit = 100) {
    const sql = `
      SELECT * FROM debug_logs
      WHERE device_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `;
    return await this.all(sql, [deviceId, limit]);
  }

  async cleanupOldDebugLogs(maxAgeDays = 7) {
    const sql = `
      DELETE FROM debug_logs
      WHERE timestamp < datetime('now', '-${maxAgeDays} days')
    `;
    const result = await this.run(sql);
    return result.changes;
  }

  // System events
  async saveSystemEvent(eventType, deviceId, data = null) {
    const sql = `
      INSERT INTO system_events (event_type, device_id, data)
      VALUES (?, ?, ?)
    `;
    await this.run(sql, [eventType, deviceId, data ? JSON.stringify(data) : null]);
  }

  async getSystemEvents(deviceId = null, limit = 50) {
    let sql, params;
    if (deviceId) {
      sql = `
        SELECT * FROM system_events
        WHERE device_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `;
      params = [deviceId, limit];
    } else {
      sql = `
        SELECT * FROM system_events
        ORDER BY timestamp DESC
        LIMIT ?
      `;
      params = [limit];
    }
    return await this.all(sql, params);
  }

  // Maintenance methods
  async cleanup(maxAgeDays = 30) {
    console.log('Running database cleanup...');

    const cleaned = {
      pendingRequests: await this.cleanupOldPendingRequests(),
      debugLogs: await this.cleanupOldDebugLogs(maxAgeDays),
    };

    console.log(`Cleanup completed:`, cleaned);
    return cleaned;
  }

  // MCP Server management
  async saveMCPServer(deviceId, serverName, config) {
    const sql = `
      INSERT OR REPLACE INTO mcp_servers 
      (device_id, server_name, server_type, command, args, env, enabled, auto_approve, config, description, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    const args = [
      deviceId,
      serverName,
      config.type || 'external',
      config.command || null,
      config.args ? JSON.stringify(config.args) : null,
      config.env ? JSON.stringify(config.env) : null,
      config.enabled !== false ? 1 : 0,
      config.capabilities?.tools?.autoApprove ? JSON.stringify(config.capabilities.tools.autoApprove) : null,
      JSON.stringify(config), // Store full config
      config.description || null
    ];
    return await this.run(sql, args);
  }

  async getMCPServers(deviceId) {
    const sql = `SELECT * FROM mcp_servers WHERE device_id = ? ORDER BY server_name`;
    return await this.all(sql, [deviceId]);
  }

  async getMCPServer(deviceId, serverName) {
    const sql = `SELECT * FROM mcp_servers WHERE device_id = ? AND server_name = ?`;
    return await this.get(sql, [deviceId, serverName]);
  }

  async deleteMCPServer(deviceId, serverName) {
    const sql = `DELETE FROM mcp_servers WHERE device_id = ? AND server_name = ?`;
    return await this.run(sql, [deviceId, serverName]);
  }

  async updateMCPServerStatus(deviceId, serverName, enabled) {
    const sql = `UPDATE mcp_servers SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE device_id = ? AND server_name = ?`;
    return await this.run(sql, [enabled ? 1 : 0, deviceId, serverName]);
  }

  // MCP Tools management
  async saveMCPTool(serverId, toolName, toolDescription, toolSchema) {
    const sql = `
      INSERT OR REPLACE INTO mcp_tools (server_id, tool_name, tool_description, tool_schema)
      VALUES (?, ?, ?, ?)
    `;
    return await this.run(sql, [serverId, toolName, toolDescription, JSON.stringify(toolSchema)]);
  }

  async getMCPTools(serverId) {
    const sql = `SELECT * FROM mcp_tools WHERE server_id = ? ORDER BY tool_name`;
    return await this.all(sql, [serverId]);
  }

  async updateMCPToolUsage(toolId) {
    const sql = `UPDATE mcp_tools SET usage_count = usage_count + 1, last_used = CURRENT_TIMESTAMP WHERE id = ?`;
    return await this.run(sql, [toolId]);
  }

  // MCP Sessions management
  async createMCPSession(deviceId, serverName, sessionId) {
    const sql = `
      INSERT INTO mcp_sessions (device_id, server_name, session_id)
      VALUES (?, ?, ?)
    `;
    return await this.run(sql, [deviceId, serverName, sessionId]);
  }

  async getMCPSessions(deviceId) {
    const sql = `SELECT * FROM mcp_sessions WHERE device_id = ? AND status = 'active' ORDER BY last_activity DESC`;
    return await this.all(sql, [deviceId]);
  }

  async updateMCPSessionActivity(sessionId) {
    const sql = `UPDATE mcp_sessions SET last_activity = CURRENT_TIMESTAMP WHERE session_id = ?`;
    return await this.run(sql, [sessionId]);
  }

  async closeMCPSession(sessionId) {
    const sql = `UPDATE mcp_sessions SET status = 'closed' WHERE session_id = ?`;
    return await this.run(sql, [sessionId]);
  }

  // MCP Logs management
  async saveMCPLog(deviceId, serverName, level, message, metadata = null) {
    const sql = `
      INSERT INTO mcp_logs (device_id, server_name, level, message, metadata)
      VALUES (?, ?, ?, ?, ?)
    `;
    return await this.run(sql, [deviceId, serverName, level, message, metadata ? JSON.stringify(metadata) : null]);
  }

  async getMCPLogs(deviceId, serverName = null, limit = 100) {
    let sql, params;
    if (serverName) {
      sql = `SELECT * FROM mcp_logs WHERE device_id = ? AND server_name = ? ORDER BY timestamp DESC LIMIT ?`;
      params = [deviceId, serverName, limit];
    } else {
      sql = `SELECT * FROM mcp_logs WHERE device_id = ? ORDER BY timestamp DESC LIMIT ?`;
      params = [deviceId, limit];
    }
    return await this.all(sql, params);
  }

  // Phone links management
  async createPhoneLink(deviceId, phoneNumber, verificationCode) {
    const sql = `
      INSERT OR REPLACE INTO phone_links (device_id, phone_number, verification_code, verified, verified_at)
      VALUES (?, ?, ?, 0, NULL)
    `;
    return await this.run(sql, [deviceId, phoneNumber, verificationCode]);
  }

  async verifyPhoneLink(phoneNumber, verificationCode) {
    const sql = `
      UPDATE phone_links
      SET verified = 1, verified_at = CURRENT_TIMESTAMP, verification_code = NULL
      WHERE phone_number = ? AND verification_code = ?
    `;
    const result = await this.run(sql, [phoneNumber, verificationCode]);
    return result.changes > 0;
  }

  async getPhoneLink(phoneNumber) {
    const sql = `SELECT * FROM phone_links WHERE phone_number = ?`;
    return await this.get(sql, [phoneNumber]);
  }

  async getPhoneLinksByDevice(deviceId) {
    const sql = `SELECT * FROM phone_links WHERE device_id = ? ORDER BY created_at DESC`;
    return await this.all(sql, [deviceId]);
  }

  async unlinkPhone(phoneNumber) {
    const sql = `DELETE FROM phone_links WHERE phone_number = ?`;
    return await this.run(sql, [phoneNumber]);
  }

  // Close database connection
  close() {
    if (this.db) {
      const db = this.db;
      this.db = null; // Prevent double-close
      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed');
        }
      });
    }
  }
}

module.exports = { DatabaseManager };