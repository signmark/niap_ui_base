#!/bin/bash

# Simple deployment script for SMM self-hosted application
# Auto-detects project directory and handles deployment

set -e

echo "=== SMM Simple Deployment ==="

# Auto-detect project root
if [ -f "package.json" ] && [ -f "docker-compose.production.yml" ]; then
    PROJECT_ROOT=$(pwd)
    echo "Project detected in current directory: $PROJECT_ROOT"
elif [ -f "../package.json" ] && [ -f "../docker-compose.production.yml" ]; then
    PROJECT_ROOT=$(cd .. && pwd)
    echo "Project detected in parent directory: $PROJECT_ROOT"
    cd "$PROJECT_ROOT"
else
    echo "Error: Cannot find project files (package.json, docker-compose.production.yml)"
    exit 1
fi

# Stop existing SMM service if running
echo "Stopping existing SMM service..."
docker-compose down smm || true

# Check if required files exist
if [ ! -f "docker-compose.yml" ]; then
    echo "Error: docker-compose.yml not found in $PROJECT_ROOT"
    exit 1
fi

echo "Using main docker-compose.yml with SMM service"

# For production deployment, use the main docker-compose.yml with rebuilt SMM service
echo "Rebuilding SMM service in $PROJECT_ROOT..."
docker-compose build --no-cache smm

echo "Starting SMM service..."
docker-compose up -d smm

# Wait for startup
echo "Waiting for application to start..."
sleep 15

# Check health with retries
echo "Checking application health..."
for i in {1..6}; do
    if curl -s -f http://localhost:5000/health > /dev/null; then
        echo "✓ Application is healthy"
        echo "✓ Available at https://smm.nplanner.ru (via Traefik)"
        echo "✓ Local access: http://localhost:5000"
        
        # Show status
        echo "Application status:"
        curl -s http://localhost:5000/health | python3 -m json.tool 2>/dev/null || echo "Health check passed"
        
        echo "Container status:"
        docker ps | grep smm
        
        echo "=== Deployment Complete ==="
        exit 0
    else
        echo "Health check attempt $i/6 failed, waiting 10 seconds..."
        sleep 10
    fi
done

echo "✗ Health check failed after 6 attempts"
echo "Container logs:"
docker logs $(docker ps -q -f "name=smm") --tail 30 2>/dev/null || echo "No SMM container found"
echo "Container status:"
docker ps -a | grep smm
exit 1