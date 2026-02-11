# Heady API Quickstart

## Authentication
```bash
curl -X POST https://api.headyio.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your_user", "password":"your_pass"}'
# Returns: {"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}
```

## Calling Services
```bash
# Process text with HeadyAI
curl -X POST https://api.headyio.com/v1/process \
  -H "Authorization: Bearer <token>" \
  -d '{"text":"Hello world", "mode":"analysis"}'
```

## Real-time Sync
```javascript
// WebSocket example
const socket = new WebSocket('wss://sync.headyio.com');
socket.onopen = () => {
  socket.send(JSON.stringify({type: 'auth', token: '<token>'}));
};
```

## SDKs
- JavaScript: `npm install @headyio/js-sdk`
- Python: `pip install headyio`
