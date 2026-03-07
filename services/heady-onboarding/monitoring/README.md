# Monitoring & Observability

## Health Checks
- Endpoint: /api/health
- Checks database connectivity
- Returns service status

## Metrics to Track
1. User signups per day
2. Onboarding completion rate
3. Drop-off at each step
4. Average time to complete onboarding
5. API usage per user
6. Active sessions
7. Error rates

## Logging
- All onboarding steps logged to OnboardingLog table
- API usage tracked in ApiKeyUsage table
- Auth events logged automatically by Auth.js

## Alerts
Set up alerts for:
- Database connection failures
- High error rates (>5%)
- Low completion rates (<70%)
- Unusual API usage patterns

## Recommended Tools
- **Sentry**: Error tracking
- **Datadog**: APM and infrastructure monitoring
- **LogRocket**: Session replay
- **Mixpanel**: Product analytics
