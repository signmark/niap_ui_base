#!/bin/bash

# Simple deployment script for SMM self-hosted application
# Run this in /root/smm directory

set -e

echo "=== SMM Simple Deployment ==="

# Stop existing container if running
if docker ps -q -f name=smm-production; then
    echo "Stopping existing container..."
    docker stop smm-production
    docker rm smm-production
fi

# Build and start new container
echo "Building application..."
docker-compose -f docker-compose.production.yml build --no-cache

echo "Starting application..."
docker-compose -f docker-compose.production.yml up -d

# Wait for startup
echo "Waiting for application to start..."
sleep 10

# Check health
if curl -s -f http://localhost:5000/health > /dev/null; then
    echo "✓ Application is healthy"
    echo "✓ Available at http://localhost:5000"
    
    # Show status
    curl -s http://localhost:5000/health | python3 -m json.tool 2>/dev/null || echo "Health check passed"
else
    echo "✗ Health check failed"
    docker logs smm-production --tail 20
    exit 1
fi

echo "=== Deployment Complete ==="