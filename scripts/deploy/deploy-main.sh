#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/solana-playground}"
BRANCH="${BRANCH:-main}"

echo "==> Deploy start: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "==> App dir: ${APP_DIR}"
echo "==> Branch: ${BRANCH}"

cd "${APP_DIR}"

echo "==> Fetching latest code"
git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git reset --hard "origin/${BRANCH}"

echo "==> Installing dependencies"
yarn install --frozen-lockfile

echo "==> Building frontend + TypeScript"
yarn build

echo "==> Building backend output"
yarn build:backend

echo "==> Restarting app via PM2"
pm2 startOrReload ecosystem.config.cjs --env production
pm2 save

echo "==> Deploy complete"
