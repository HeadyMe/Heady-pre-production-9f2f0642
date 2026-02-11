# Cloud-First Quickstart Guide

## Connecting to Heady Systems

### Browser/Web Interface
1. Go to [https://app.headysystems.com](https://app.headysystems.com)
2. Log in with your Heady account
3. Access all services through the unified interface

### Desktop Clients
1. Download HeadyDesktop from [https://app.headysystems.com/downloads](https://app.headysystems.com/downloads)
2. Install and launch the application
3. Authenticate with your Heady API key

### Mobile Apps
1. Install HeadyMobile from Play Store/App Store
2. Open the app and scan your QR profile
3. All services will connect to cloud endpoints automatically

### API Access
```javascript
// JavaScript example
import { HeadyClient } from '@heady/sdk';

const client = new HeadyClient({
  apiKey: 'YOUR_API_KEY',
  endpoint: 'https://api.headysystems.com'
});

// Get system status
const status = await client.getSystemStatus();
```
