# Projection Model

## Intent

Keep one strong internal codebase while still publishing clean domain-specific repos.

## Projection flow

1. Build features in the monorepo
2. Tag ownership and projection boundaries in the registry
3. Run the projection script
4. Emit dist-projections/<repo-name>
5. Push each projected view to its destination repository

## Projection rules

- Shared packages remain versioned from the monorepo
- Apps and services can project with or without docs
- Infra can project only to repos that own deployment responsibility
- Public docs are allowed to project independently of runtime code

## Why it matters

This lets Heady act like a coherent operating system while still presenting specialized public repositories such as headyapi-core, headymcp-core, and headybuddy-core.
