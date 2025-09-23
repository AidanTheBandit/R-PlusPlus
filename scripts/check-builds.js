#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const builds = [
  {
    name: 'R1 Control Panel',
    path: path.join(__dirname, '..', 'r1-control-panel', 'build', 'index.html'),
    buildCommand: 'npm run build-control-panel'
  },
  {
    name: 'Creation React',
    path: path.join(__dirname, '..', 'creation-react', 'dist', 'index.html'),
    buildCommand: 'npm run build-creation'
  }
];

console.log('🔍 Checking React builds...\n');

let allBuildsExist = true;

builds.forEach(build => {
  const exists = fs.existsSync(build.path);
  const status = exists ? '✅' : '❌';
  console.log(`${status} ${build.name}: ${exists ? 'Built' : 'Not built'}`);
  
  if (!exists) {
    console.log(`   Run: ${build.buildCommand}`);
    allBuildsExist = false;
  }
});

if (allBuildsExist) {
  console.log('\n🎉 All React builds are ready!');
  console.log('🚀 Start the server with: npm start');
} else {
  console.log('\n⚠️  Some builds are missing.');
  console.log('🔧 Build all at once with: npm run build-all');
  console.log('🚀 Or build and start with: npm run all');
}

process.exit(allBuildsExist ? 0 : 1);