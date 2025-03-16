#!/bin/bash

# Create application directory if it doesn't exist
mkdir -p /home/ec2-user/suimon-game-v2/backend

# Install Node.js and npm if not already installed
if ! command -v node &> /dev/null; then
    curl -sL https://rpm.nodesource.com/setup_16.x | sudo bash -
    sudo yum install -y nodejs
fi

# Install PM2 globally if not installed
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi

# Clean up old deployment if exists
rm -rf /home/ec2-user/suimon-game-v2/backend/*