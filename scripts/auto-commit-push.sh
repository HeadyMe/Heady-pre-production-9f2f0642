#!/bin/bash
# Heady Auto-Commit & Push Failsafe
# Runs every 15 minutes to catch any stalled deployment files

cd /home/headyme/Heady || exit 1

# Check if there are changes
if [[ -n $(git status -s) ]]; then
    echo "[$(date)] Found uncommitted changes. Executing auto-commit and push..." >> /home/headyme/Heady/logs/auto-commit.log
    
    # Remove index lock if it exists from a crashed process
    rm -f .git/index.lock
    
    # Add, commit, and push bypassing hooks to ensure sync
    git add .
    git commit --no-verify -m "Auto-commit: Synchronize repository state to trigger deployment pipeline"
    git push origin main
    
    if [ $? -eq 0 ]; then
        echo "[$(date)] Successfully pushed changes to origin" >> /home/headyme/Heady/logs/auto-commit.log
    else
        echo "[$(date)] ERROR: Failed to push changes" >> /home/headyme/Heady/logs/auto-commit.log
    fi
else
    echo "[$(date)] No changes to commit. Repository is clean." >> /home/headyme/Heady/logs/auto-commit.log
fi
