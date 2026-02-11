# Secret Service API

## Associate Secret
```bash
POST /associate
{
  "userId": "<user_id>",
  "secret": "<secret_value>"
}
```

## Retrieve Secret
```bash
GET /retrieve/:userId
```

## Security
- All secrets encrypted with AES-256
- Requires valid encryption key
- Access logs monitored

## Rate Limits
- 10 requests/minute per IP
- 100 requests/day per user
