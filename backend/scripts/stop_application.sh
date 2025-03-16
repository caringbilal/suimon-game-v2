#!/bin/bash

# Navigate to application directory
cd /home/ec2-user/suimon-game-v2/backend

# Stop the application using PM2
if pm2 show suimon-backend > /dev/null; then
    pm2 delete suimon-backend
    pm2 save
    echo "Application stopped successfully"
    exit 0
else
    echo "Application was not running"
    exit 0
fi