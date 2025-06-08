# SMM Multi-Server Deployment Guide

## Current Status
- **Replit Environment**: ✅ Fully operational
- **Docker Container**: ✅ Running with correct credentials  
- **New Server (31.128.43.113)**: ❌ SMM app not deployed

## Quick Deployment for New Server

### Step 1: Prepare Deployment Package
```bash
# Run on Replit to create deployment package
./multi_server_sync.sh
```

### Step 2: Deploy to New Server
```bash
# Copy files to server
scp smm-deployment.tar.gz deploy_universal.sh root@31.128.43.113:/tmp/

# Deploy on server
ssh root@31.128.43.113
cd /tmp && chmod +x deploy_universal.sh && ./deploy_universal.sh
```

### Step 3: Configure Nginx
```bash
# Copy nginx config to server
scp nginx_smm_config.conf root@31.128.43.113:/etc/nginx/sites-available/smm.roboflow.tech

# Enable site
ssh root@31.128.43.113
ln -s /etc/nginx/sites-available/smm.roboflow.tech /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### Step 4: Setup SSL Certificate
```bash
# Install Let's Encrypt certificate
certbot --nginx -d smm.roboflow.tech
```

## Environment Configurations

### Production Server (.env.production)
- Admin: `lbrspb@gmail.com`
- Directus: `https://directus.roboflow.tech`
- Docker optimized settings

### Replit Development (.env)
- Admin: `admin@roboflow.tech` (system override)
- Development mode settings
- Hot reload enabled

## Troubleshooting

### 404 Errors
- Check if Docker container is running: `docker ps | grep smm`
- Verify Nginx proxy configuration
- Check application logs: `docker logs smm-1 -f`

### Authentication Issues
- System uses environment detection for credentials
- Docker environment automatically uses production credentials
- Replit uses development credentials from system variables

### Service Health Check
```bash
# Check container status
docker ps | grep smm-1

# Check application response
curl -I http://localhost:5000

# Check logs
docker logs smm-1 --tail 20
```

## Multi-Server Architecture

```
Internet
    ↓
Nginx (SSL Termination)
    ↓
SMM Application (Docker:5000)
    ↓
Directus API (directus.roboflow.tech)
    ↓
PostgreSQL Database
```

## Deployment Verification

After deployment, verify:
1. `https://smm.roboflow.tech` returns 200/404 (not connection error)
2. Docker container shows in `docker ps`
3. Application logs show successful Directus connection
4. Global API keys loaded (8 keys expected)
5. Content processing active (50+ items)

## Current Working Configuration

The system in Replit shows:
- ✅ Authentication successful with admin@roboflow.tech
- ✅ Processing 50 content items
- ✅ 3 scheduled publications
- ✅ 8 global API keys loaded
- ✅ All background services operational

Transfer this exact configuration to new server using deployment scripts.