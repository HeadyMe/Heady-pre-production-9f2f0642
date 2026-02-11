# HeadyServices Quickstart - Backend System

## Deployment
```powershell
cd heady-services
docker compose up -d
```

## Configuration
Update `configs/service-core.yaml`:
```yaml
databases:
  main: postgres://user:pass@db:5432/heady
redis: redis://redis:6379
```

## API Endpoints
- Authentication: `POST /auth/login`
- Data sync: `WS /sync`
- AI processing: `POST /v1/process`
