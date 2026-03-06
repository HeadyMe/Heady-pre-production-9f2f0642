#!/bin/bash
# 🔄 Repository Management Script

set -euo pipefail

BASE_DIR="/home/headyme"
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

show_help() {
    echo "Repository Management Script"
    echo "Usage: $0 {sync-all|status-all|create-repo|list-repos}"
    echo ""
    echo "Commands:"
    echo "  sync-all    Sync all repositories"
    echo "  status-all  Show status of all repositories"
    echo "  create-repo Create new repository"
    echo "  list-repos  List all repositories"
}

list_repos() {
    echo -e "${BLUE}📋 All Repositories:${NC}"
    echo ""
    
    accounts=("HeadyConnection" "HeadySystems" "HeadyMe")
    
    for account in "${accounts[@]}"; do
        echo -e "${GREEN}$account:${NC}"
        find "$BASE_DIR/$account" -name ".git" -type d 2>/dev/null | while read -r gitdir; do
            repo=$(dirname "$gitdir")
            echo "  - $(basename "$repo")"
        done
        echo ""
    done
}

sync_all() {
    echo -e "${BLUE}🔄 Syncing all repositories...${NC}"
    
    find "$BASE_DIR" -name ".git" -type d 2>/dev/null | while read -r gitdir; do
        repo=$(dirname "$gitdir")
        echo "Syncing: $repo"
        cd "$repo"
        
        if git rev-parse --git-dir >/dev/null 2>&1; then
            git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || echo "  ⚠️ Pull failed"
        fi
    done
}

status_all() {
    echo -e "${BLUE}📊 Repository Status:${NC}"
    echo ""
    
    find "$BASE_DIR" -name ".git" -type d 2>/dev/null | while read -r gitdir; do
        repo=$(dirname "$gitdir")
        cd "$repo"
        
        if git rev-parse --git-dir >/dev/null 2>&1; then
            branch=$(git branch --show-current 2>/dev/null || echo "detached")
            changes=$(git status --porcelain 2>/dev/null | wc -l)
            remote=$(git remote get-url origin 2>/dev/null | cut -d'/' -f3-4 || echo "no-remote")
            
            echo "📁 $(basename "$repo")"
            echo "   Branch: $branch"
            echo "   Changes: $changes files"
            echo "   Remote: $remote"
            echo ""
        fi
    done
}

create_repo() {
    echo -e "${BLUE}🆕 Create New Repository${NC}"
    echo "Available accounts:"
    echo "1) HeadyConnection"
    echo "2) HeadySystems" 
    echo "3) HeadyMe"
    echo ""
    read -p "Select account (1-3): " account_choice
    
    case $account_choice in
        1) account="HeadyConnection" ;;
        2) account="HeadySystems" ;;
        3) account="HeadyMe" ;;
        *) echo "Invalid choice"; exit 1 ;;
    esac
    
    read -p "Repository name: " repo_name
    read -p "Description: " description
    
    repo_dir="$BASE_DIR/$account/$repo_name"
    
    if [[ -d "$repo_dir" ]]; then
        echo "❌ Repository already exists locally"
        exit 1
    fi
    
    mkdir -p "$repo_dir"
    cd "$repo_dir"
    
    # Initialize git repo
    git init
    echo "# $repo_name" > README.md
    echo "$description" >> README.md
    git add README.md
    git commit -m "Initial commit"
    
    echo "✅ Repository created locally at: $repo_dir"
    echo "💡 Create remote repository on GitHub and add remote:"
    echo "   cd $repo_dir"
    echo "   git remote add origin git@github.com:$account/$repo_name.git"
    echo "   git push -u origin main"
}

case "${1:-help}" in
    sync-all)
        sync_all
        ;;
    status-all)
        status_all
        ;;
    create-repo)
        create_repo
        ;;
    list-repos)
        list_repos
        ;;
    *)
        show_help
        exit 1
        ;;
esac
