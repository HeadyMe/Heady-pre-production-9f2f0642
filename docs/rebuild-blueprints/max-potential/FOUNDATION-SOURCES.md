# Foundation Sources

This rebuild package uses the public HeadyMe repository layer as the reference foundation.

## Public repositories reviewed

- https://github.com/HeadyMe/Heady-pre-production-9f2f0642
- https://github.com/HeadyMe/heady-docs
- https://github.com/HeadyMe/headyme-core
- https://github.com/HeadyMe/headyos-core
- https://github.com/HeadyMe/headymcp-core
- https://github.com/HeadyMe/headyapi-core
- https://github.com/HeadyMe/headybuddy-core
- https://github.com/HeadyMe/headysystems-core
- https://github.com/HeadyMe/headyconnection-core
- https://github.com/HeadyMe/headyio-core
- https://github.com/HeadyMe/headybot-core

## Observed pattern

The public repository layout suggests:

- one stronger source-of-truth monorepo
- multiple projected core repositories
- distinct experience, intelligence, and infrastructure products
- a documentation hub as the knowledge authority

This rebuild turns that pattern into an explicit operating model with manifests, a registry, and projection automation.
