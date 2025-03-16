#!/bin/bash

# Navigate to application directory
cd /home/ec2-user/suimon-game-v2/backend

# Install dependencies
npm install

# Set file permissions
chmod +x scripts/*.sh

# Create environment file if not exists
if [ ! -f .env ]; then
    echo "AWS_REGION=${AWS_REGION}" > .env
    echo "AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}" >> .env
    echo "AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}" >> .env
    echo "DYNAMODB_PLAYERS_TABLE=SuimonPlayers" >> .env
    echo "DYNAMODB_GAMES_TABLE=SuimonGames" >> .env
    echo "PORT=3002" >> .env
fi