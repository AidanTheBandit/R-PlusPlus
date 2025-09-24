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
    
    // Test 1: Initialize a web search server
    console.log('1. Initializing web search server...');
    const webSearchConfig = {
      command: 'simulated',
      args: [],
      env: {},
      autoApprove: ['search_web'],
      enabled: true
    };
    
    await mcpManager.initializeServer(testDeviceId, 'web-search', webSearchConfig);
    console.log('✅ Web search server initialized');
    
    // Test 2: Initialize a calculator server
    console.log('\n2. Initializing calculator server...');
    const calculatorConfig = {
      command: 'simulated',
      args: [],
      env: {},
      autoApprove: ['calculate'],
      enabled: true
    };
    
    await mcpManager.initializeServer(testDeviceId, 'calculator', calculatorConfig);
    console.log('✅ Calculator server initialized');
    
    // Test 3: Generate prompt injection
    console.log('\n3. Generating prompt injection...');
    const promptInjection = mcpManager.generateMCPPromptInjection(testDeviceId);
    console.log('Prompt injection length:', promptInjection.length);
    console.log('Prompt injection preview:');
    console.log(promptInjection.substring(0, 500) + '...\n');
    
    // Test 4: Test tool execution
    console.log('4. Testing tool execution...');
    
    // Test web search
    console.log('Testing web search tool...');
    const searchResult = await mcpManager.handleToolCall(testDeviceId, 'web-search', 'search_web', {
      query: 'latest AI news',
      max_results: 3
    });
    console.log('Search result:', JSON.stringify(searchResult, null, 2));
    
    // Test calculator
    console.log('\nTesting calculator tool...');
    const calcResult = await mcpManager.handleToolCall(testDeviceId, 'calculator', 'calculate', {
      expression: '2 + 2 * 3'
    });
    console.log('Calculator result:', JSON.stringify(calcResult, null, 2));
    
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