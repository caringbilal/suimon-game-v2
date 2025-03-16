#!/bin/bash

# Navigate to application directory
cd /home/ec2-user/suimon-game-v2/backend

# Start the application with PM2
pm2 delete suimon-backend || true
pm2 start server.js --name "suimon-backend" --time
pm2 save

# Wait for application to start
sleep 10

# Check if application is running
if pm2 show suimon-backend > /dev/null; then
    echo "Application started successfully"
    exit 0
else
    echo "Failed to start application"
    exit 1
fi