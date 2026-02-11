// Standalone Electron test
const { execSync } = require('child_process');
const electronPath = require.resolve('electron');

console.log('Testing Electron at:', electronPath);

try {
  const result = execSync(`"${electronPath}" -e "
    const { app, BrowserWindow } = require('electron');
    console.log('Electron API successfully accessed!');
    app.quit();
  "`);
  console.log('Test output:', result.toString());
} catch (error) {
  console.error('Test failed:', error.message);
}
