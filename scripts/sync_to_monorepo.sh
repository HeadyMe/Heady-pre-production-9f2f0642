#!/bin/bash
# Syncs transformed semantic code back to HeadyMe monorepo

DEV_REPO=${1:-"../HeadyMe"}
PROJECTION_PATH=${2:-"./transformed"}

echo "[*] Syncing to $DEV_REPO"

cd "$DEV_REPO" || exit 1
git checkout main
git pull origin main

BRANCH="feature/csl-transform-$(date +%s)"
git checkout -b "$BRANCH"

rsync -av --exclude='.git' --exclude='node_modules' --exclude='.env' "$PROJECTION_PATH/" "./"

git add .
git commit -m "feat(csl): project continuous semantic logic gates"
git push origin "$BRANCH"

echo "[+] Ready for HCFullPipeline merge"
