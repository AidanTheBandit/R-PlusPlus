#!/usr/bin/env node

const { DeviceIdManager } = require('../src/utils/device-id-manager');

console.log('🧪 Testing device ID blacklist...\n');

const manager = new DeviceIdManager();
const generatedIds = new Set();
const blacklistedFound = [];

// Generate 1000 device IDs to test
for (let i = 0; i < 1000; i++) {
  const deviceId = manager.generateDeviceId();
  generatedIds.add(deviceId);
  
  // Check if any blacklisted IDs were generated
  const blacklisted = [
    'red-fox-42', 'red-fox-7', 'red-fox-15', 'red-fox-1', 'red-fox-2',
    'red-fox-3', 'red-fox-4', 'red-fox-5', 'red-fox-6', 'red-fox-8',
    'red-fox-9', 'red-fox-10', 'blue-wolf-7', 'quick-bird-15'
  ];
  
  if (blacklisted.includes(deviceId)) {
    blacklistedFound.push(deviceId);
  }
}

console.log(`Generated ${generatedIds.size} unique device IDs`);
console.log(`Sample IDs: ${Array.from(generatedIds).slice(0, 10).join(', ')}`);

if (blacklistedFound.length > 0) {
  console.log(`❌ FAILED: Found blacklisted IDs: ${blacklistedFound.join(', ')}`);
  process.exit(1);
} else {
  console.log('✅ SUCCESS: No blacklisted IDs were generated');
  console.log('🔒 Blacklist is working correctly');
  process.exit(0);
}