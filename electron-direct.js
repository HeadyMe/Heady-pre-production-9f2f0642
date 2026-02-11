const { execSync } = require('child_process');
const electronPath = require('electron');

// Execute Electron directly with a test script
try {
  const result = execSync(`"${electronPath}" -e "console.log(require('electron').app)"`);
  console.log('Electron API output:', result.toString());
} catch (error) {
  console.error('Failed to access Electron API:', error.message);
}
