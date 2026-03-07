# Topology

```
Users and clients
      |
  HeadyMe / HeadyBuddy / HeadyConnection
      |
     CDN / Edge
      |
     HeadyAPI
  /      |             Auth   Routing   Events
  \      |      /
       HeadyOS
  /      |            HeadyMCP HeadyMemory HeadyBot
       \   |   /
      HeadySystems
         |
Postgres / Redis / Object Store / Metrics
```

## Traffic rules

- All external ingress terminates at HeadyAPI or an edge worker
- HeadyOS decides routing, planning, and safety policy
- HeadyMCP mediates tool execution and provider bridges
- HeadyMemory stores durable context and retrieval surfaces
- HeadySystems owns health, policy, release, and rollback
