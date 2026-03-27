#!/bin/bash
# Production deployment script for Mansariya
# Usage: ./infra/deploy.sh [user@host]

set -euo pipefail

HOST="${1:-}"
DEPLOY_DIR="/opt/mansariya"

if [ -z "$HOST" ]; then
  echo "Usage: $0 user@host"
  echo "Example: $0 root@api.masariya.lk"
  exit 1
fi

echo "=== Deploying Mansariya to $HOST ==="

# 1. Sync code to server
echo "[1/5] Syncing code..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.source' \
  --exclude '*.env' \
  --exclude '*.env.mk' \
  --exclude '.git' \
  --exclude 'data/collector/__pycache__' \
  --exclude 'mobile/ios/Pods' \
  --exclude 'mobile/android/.gradle' \
  ./ "$HOST:$DEPLOY_DIR/"

# 2. Copy env file if it doesn't exist on server
echo "[2/5] Checking env file..."
ssh "$HOST" "[ -f $DEPLOY_DIR/infra/.env ] || echo 'WARNING: No .env file on server. Copy infra/.env.example and configure.'"

# 3. Build and start services
echo "[3/5] Building and starting services..."
ssh "$HOST" "cd $DEPLOY_DIR && docker compose -f infra/docker-compose.prod.yml --env-file infra/.env build"
ssh "$HOST" "cd $DEPLOY_DIR && docker compose -f infra/docker-compose.prod.yml --env-file infra/.env up -d"

# 4. Run migrations
echo "[4/5] Running migrations..."
ssh "$HOST" "cd $DEPLOY_DIR && docker compose -f infra/docker-compose.prod.yml exec backend /server migrate"

# 5. Health check
echo "[5/5] Health check..."
sleep 5
if ssh "$HOST" "curl -sf http://localhost:9900/health > /dev/null"; then
  echo "=== Deployment successful! ==="
  echo "API: https://api.masariya.lk"
  echo "Docs: https://api.masariya.lk/docs"
else
  echo "=== WARNING: Health check failed ==="
  ssh "$HOST" "cd $DEPLOY_DIR && docker compose -f infra/docker-compose.prod.yml logs --tail=20 backend"
fi
