# GitHub Organization Documentation

## Directory Structure

```
/home/headyme/
├── HeadyConnection/           # HeadyConnection Inc. repositories
├── HeadySystems/              # HeadySystems Inc. repositories  
├── HeadyMe/                   # Personal repositories
└── Shared/                    # Shared configurations and scripts
```

## Account Responsibilities

- **HeadyConnection**: Commercial products and services
- **HeadySystems**: Internal tools and infrastructure
- **HeadyMe**: Personal projects and experiments

## Scripts

- `repo-manager.sh` - Manage all repositories
- `migrate-repos.sh` - Migrate existing repositories
- `github-env.sh` - Environment configuration

## Configuration

- Git configs are account-specific
- SSH keys should be set up per account
- PATs are managed per account

## Usage

```bash
# Source environment
source ~/Shared/configs/github-env.sh

# List all repositories
~/Shared/scripts/repo-manager.sh list-repos

# Check status of all repositories
~/Shared/scripts/repo-manager.sh status-all

# Sync all repositories
~/Shared/scripts/repo-manager.sh sync-all
```
