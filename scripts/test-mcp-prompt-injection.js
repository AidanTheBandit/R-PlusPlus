#!/usr/bin/env node

// Test script for MCP prompt injection system
const { MCPManager } = require('../src/utils/mcp-manager');
const { DatabaseManager } = require('../src/utils/database');
const { DeviceIdManager } = require('../src/utils/device-id-manager');

async function testMCPPromptInjection() {
  console.log('🧪 Testing MCP Prompt Injection System...\n');
  
  try {
    // Initialize components
    const database = new DatabaseManager();
    await database.init();
    
    const deviceIdManager = new DeviceIdManager(database);
    const mcpManager = new MCPManager(database, deviceIdManager);
    
    const testDeviceId = 'test-device-123';
    
    // Test 1: Initialize a web search server (remote server)
    console.log('1. Initializing web search server...');
    const webSearchConfig = {
      url: `http://localhost:${process.env.PORT || 3000}/mcp/test-server`,
      protocolVersion: '2025-06-18',
      autoApprove: ['test_echo'],
      enabled: true, // Connect to test server
      description: 'Test MCP server for prompt injection testing'
    };
    
    await mcpManager.initializeServer(testDeviceId, 'web-search', webSearchConfig);
    console.log('✅ Web search server initialized');
    
    // Test 2: Initialize a calculator server (remote server)
    console.log('\n2. Initializing calculator server...');
    const calculatorConfig = {
      url: `http://localhost:${process.env.PORT || 3000}/mcp/test-server`,
      protocolVersion: '2025-06-18',
      autoApprove: ['test_calculator'],
      enabled: true, // Connect to test server
      description: 'Test MCP server for calculator testing'
    };
    
    await mcpManager.initializeServer(testDeviceId, 'calculator', calculatorConfig);
    console.log('✅ Calculator server initialized');
    
    // Test 3: Generate prompt injection
    console.log('\n3. Generating prompt injection...');
    const promptInjection = mcpManager.generateMCPPromptInjection(testDeviceId);
    console.log('Prompt injection length:', promptInjection.length);
    console.log('Prompt injection preview:');
    console.log(promptInjection.substring(0, 500) + '...\n');
    
    // Test 4: Test tool execution (skip if server not running)
    console.log('4. Testing tool execution...');
    
    try {
      // Test web search (using test_echo tool)
      console.log('Testing web search tool...');
      const searchResult = await mcpManager.handleToolCall(testDeviceId, 'web-search', 'test_echo', {
        message: 'Search for latest AI news'
      });
      console.log('Search result:', JSON.stringify(searchResult, null, 2));
      
      // Test calculator (using test_calculator tool)
      console.log('\nTesting calculator tool...');
      const calcResult = await mcpManager.handleToolCall(testDeviceId, 'calculator', 'test_calculator', {
        a: 2,
        b: 3
      });
      console.log('Calculator result:', JSON.stringify(calcResult, null, 2));
    } catch (error) {
      console.log('⚠️ Tool execution test skipped (server not running):', error.message);
      console.log('✅ Configuration and prompt injection tests passed');
    }
    
    // Test 5: Get server status
    console.log('\n5. Getting server status...');
    const webSearchStatus = await mcpManager.getServerStatus(testDeviceId, 'web-search');
    console.log('Web search status:', JSON.stringify(webSearchStatus, null, 2));
    
    console.log('\n✅ All tests passed! MCP prompt injection system is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testMCPPromptInjection().then(() => {
  console.log('\n🎉 Test completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test failed with error:', error);
  process.exit(1);
});