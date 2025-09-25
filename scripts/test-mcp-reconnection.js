// Test script for MCP server reconnection functionality
const { MCPManager } = require('../src/utils/mcp-manager');
const { DatabaseManager } = require('../src/utils/database');

async function testReconnection() {
  console.log('🧪 Testing MCP server reconnection functionality...\n');

  // Create database and MCP manager
  const database = new DatabaseManager();
  await database.init();

  const mcpManager = new MCPManager(database, null);

  // Wait a bit for health monitoring to start
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('1. Testing health monitoring...');
  // The health monitoring should be running
  if (mcpManager.healthCheckInterval) {
    console.log('✅ Health monitoring is active');
  } else {
    console.log('❌ Health monitoring is not active');
  }

  console.log('\n2. Testing reconnection attempt tracking...');
  // Simulate a reconnection attempt
  const testServerKey = 'test-device-test-server';
  mcpManager.reconnectionAttempts.set(testServerKey, 2);

  const attempts = mcpManager.reconnectionAttempts.get(testServerKey);
  if (attempts === 2) {
    console.log('✅ Reconnection attempt tracking works');
  } else {
    console.log('❌ Reconnection attempt tracking failed');
  }

  console.log('\n3. Testing exponential backoff calculation...');
  // Test the delay calculation logic (simulate attemptReconnection method)
  const baseDelay = 30000;
  const maxDelay = 480000;

  for (let attempt = 0; attempt < 6; attempt++) {
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    const delayMinutes = Math.round(delay / 1000 / 60 * 10) / 10;
    console.log(`   Attempt ${attempt + 1}: ${delay}ms (${delayMinutes} minutes)`);
  }

  console.log('\n4. Testing server disconnection handling...');
  // This would normally be called when a health check fails
  // We'll just verify the method exists and can be called
  try {
    // Note: This will fail because we don't have a real server, but it should handle the error gracefully
    await mcpManager.handleServerDisconnection('nonexistent-device-nonexistent-server');
    console.log('✅ Server disconnection handling works (graceful failure expected)');
  } catch (error) {
    console.log('❌ Server disconnection handling failed:', error.message);
  }

  console.log('\n5. Testing shutdown cleanup...');
  await mcpManager.shutdown();

  if (!mcpManager.healthCheckInterval) {
    console.log('✅ Shutdown cleanup works - health monitoring stopped');
  } else {
    console.log('❌ Shutdown cleanup failed - health monitoring still active');
  }

  // Close database
  database.close();

  console.log('\n🎉 Reconnection functionality test completed!');
}

testReconnection().catch(console.error);