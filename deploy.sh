#!/bin/bash

# Git-based deployment script for SMM application
# Run this script on the production server after git pull

set -e

echo "=== SMM Production Deployment ==="

# Configuration
PROJECT_DIR="/root/smm-project"
BACKUP_DIR="/root/smm-backups"
COMPOSE_FILE="docker-compose.production.yml"

# Create backup of current version
if [ -d "$PROJECT_DIR" ]; then
    echo "Creating backup of current version..."
    mkdir -p "$BACKUP_DIR"
    cp -r "$PROJECT_DIR" "$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S)"
fi

# Clone or update repository
if [ ! -d "$PROJECT_DIR" ]; then
    echo "Cloning repository..."
    git clone https://github.com/your-username/smm-project.git "$PROJECT_DIR"
else
    echo "Updating repository..."
    cd "$PROJECT_DIR"
    git fetch origin
    git reset --hard origin/main
fi

cd "$PROJECT_DIR"

# Copy production environment file
if [ ! -f ".env.production" ]; then
    echo "Creating .env.production file..."
    cat > .env.production << 'EOF'
# Production environment configuration
DIRECTUS_URL=https://directus.roboflow.tech
DIRECTUS_ADMIN_EMAIL=lbrspb@gmail.com
DIRECTUS_ADMIN_PASSWORD=QtpZ3dh7
DIRECTUS_DB_PASSWORD=QtpZ3dh7
VITE_DIRECTUS_URL=https://directus.roboflow.tech

NODE_ENV=production
PORT=5000
DOCKER_ENV=true

SESSION_SECRET=smm-secure-session-key-production-2024
DATABASE_URL=postgresql://postgres:QtpZ3dh7@localhost:5432/smm_db

LOG_LEVEL=info
DEBUG_SCHEDULER=false
CORS_ORIGIN=https://smm.roboflow.tech,https://directus.roboflow.tech

API_TIMEOUT=30000
DIRECTUS_TIMEOUT=15000
DISABLE_PUBLISHING=false
SCHEDULER_INTERVAL=20000
STATUS_CHECK_INTERVAL=60000
EOF
fi

# Create necessary directories
mkdir -p uploads/temp uploads/images logs

# Stop existing containers
echo "Stopping existing containers..."
docker-compose -f "$COMPOSE_FILE" down 2>/dev/null || true
docker stop smm-production 2>/dev/null || true
docker rm smm-production 2>/dev/null || true

# Remove old images
docker image prune -f

# Build and start new containers
echo "Building and starting new containers..."
docker-compose -f "$COMPOSE_FILE" up -d --build

# Wait for startup
echo "Waiting for application startup..."
sleep 30

# Health check
echo "Performing health check..."
if docker ps | grep -q smm-production; then
    echo "✓ Container is running"
    
    # Check application response
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:5000 | grep -q "200\|404"; then
        echo "✓ Application is responding"
        echo "✓ Deployment successful"
        
        # Show recent logs
        echo "Recent logs:"
        docker logs smm-production --tail 10
    else
        echo "✗ Application not responding"
        docker logs smm-production --tail 20
        exit 1
    fi
else
    echo "✗ Container failed to start"
    docker logs smm-production --tail 20
    exit 1
fi

echo "=== Deployment completed successfully ==="
echo "Application available at: https://smm.roboflow.tech"
echo "Monitor logs: docker logs smm-production -f"