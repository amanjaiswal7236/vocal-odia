#!/bin/bash

# VocalOdia Deployment Script
# This script builds and deploys the Next.js application on the VM

set -e  # Exit on error

echo "🚀 Starting VocalOdia deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js v18 or higher.${NC}"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js version must be 18 or higher. Current version: $(node -v)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js version: $(node -v)${NC}"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from .env.example...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${YELLOW}⚠️  Please update .env file with your configuration before continuing.${NC}"
        echo -e "${YELLOW}   Press Enter to continue after updating .env, or Ctrl+C to cancel...${NC}"
        read
    else
        echo -e "${RED}❌ .env.example file not found. Please create .env file manually.${NC}"
        exit 1
    fi
fi

# Install dependencies
echo -e "${GREEN}📦 Installing dependencies...${NC}"
npm ci --production=false

# Build the application (remove .next first to avoid permission errors from prior root-owned builds)
echo -e "${GREEN}🔨 Building the application...${NC}"
if [ -d .next ]; then
    echo -e "${YELLOW}   Removing existing .next to ensure clean build...${NC}"
    rm -rf .next 2>/dev/null || sudo rm -rf .next
fi
npm run build

echo -e "${GREEN}✅ Build completed successfully!${NC}"

# Check if systemd service should be installed
if [ "$1" == "--install-service" ]; then
    echo -e "${GREEN}📋 Installing systemd service...${NC}"
    sudo cp vocal-odia.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable vocal-odia.service
    echo -e "${GREEN}✅ Service installed. Starting service...${NC}"
    sudo systemctl start vocal-odia.service
    echo -e "${GREEN}✅ Service started. Check status with: sudo systemctl status vocal-odia${NC}"
elif [ "$1" == "--nginx" ]; then
    echo -e "${GREEN}📋 Configuring Nginx reverse proxy...${NC}"
    if ! command -v nginx &> /dev/null; then
        echo -e "${YELLOW}⚠️  Nginx not installed. Installing...${NC}"
        sudo apt-get update -qq && sudo apt-get install -y nginx
    fi
    sudo cp nginx/vocal-odia.conf /etc/nginx/sites-available/vocal-odia
    sudo ln -sf /etc/nginx/sites-available/vocal-odia /etc/nginx/sites-enabled/vocal-odia
    sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
    if sudo nginx -t 2>/dev/null; then
        sudo systemctl reload nginx
        echo -e "${GREEN}✅ Nginx configured and reloaded.${NC}"
    else
        echo -e "${RED}❌ Nginx config test failed. Check /etc/nginx/sites-available/vocal-odia${NC}"
        exit 1
    fi
    echo -e "${GREEN}📋 Installing systemd service (app on port 3003)...${NC}"
    sudo cp vocal-odia.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable vocal-odia.service
    sudo systemctl start vocal-odia.service
    echo -e "${GREEN}✅ Nginx + app running. Site: http://localhost (port 80) → app:3003${NC}"
elif [ "$1" == "--pm2" ]; then
    echo -e "${GREEN}📋 Starting with PM2...${NC}"
    if ! command -v pm2 &> /dev/null; then
        echo -e "${YELLOW}⚠️  PM2 not installed. Installing PM2...${NC}"
        sudo npm install -g pm2
    fi
    pm2 start ecosystem.config.js
    pm2 save
    pm2 startup
    echo -e "${GREEN}✅ Application started with PM2.${NC}"
else
    echo -e "${GREEN}✅ Deployment ready!${NC}"
    echo -e "${YELLOW}To start the application:${NC}"
    echo -e "  - Run manually: ${GREEN}npm start${NC} (listens on port 3003)"
    echo -e "  - Nginx + service (recommended): ${GREEN}./deploy.sh --nginx${NC}"
    echo -e "  - Service only: ${GREEN}./deploy.sh --install-service${NC}"
    echo -e "  - Use PM2: ${GREEN}./deploy.sh --pm2${NC}"
fi

echo -e "${GREEN}🎉 Deployment complete!${NC}"
APP_URL="http://localhost:3003"
[ "$1" == "--nginx" ] && APP_URL="http://localhost (port 80)"
echo -e "${GREEN}Application: ${APP_URL}${NC}"
