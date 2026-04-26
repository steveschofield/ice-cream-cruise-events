#!/bin/bash

set -e

SERVER_IP="192.168.1.175"
SERVER_USER="ss"
PRIVATE_KEY="/Users/ss/.ssh/id_ed25519"
REMOTE_DIR="/home/ss/ice-cream-cruisers-backend"
SSH_CMD="ssh -i $PRIVATE_KEY $SERVER_USER@$SERVER_IP"

echo "🚀 Starting deployment to $SERVER_IP..."

# Create remote directory
echo "📁 Creating remote directory..."
$SSH_CMD "mkdir -p $REMOTE_DIR"

# Copy individual files
echo "📤 Uploading files..."
scp -i $PRIVATE_KEY /Users/ss/code/ice-cream-cruise-events/backend/package.json $SERVER_USER@$SERVER_IP:$REMOTE_DIR/
scp -i $PRIVATE_KEY /Users/ss/code/ice-cream-cruise-events/backend/package-lock.json $SERVER_USER@$SERVER_IP:$REMOTE_DIR/
scp -i $PRIVATE_KEY /Users/ss/code/ice-cream-cruise-events/backend/server.js $SERVER_USER@$SERVER_IP:$REMOTE_DIR/
scp -i $PRIVATE_KEY /Users/ss/code/ice-cream-cruise-events/backend/db.js $SERVER_USER@$SERVER_IP:$REMOTE_DIR/
scp -i $PRIVATE_KEY -r /Users/ss/code/ice-cream-cruise-events/backend/public $SERVER_USER@$SERVER_IP:$REMOTE_DIR/

# Install Node.js if not present
echo "🔧 Checking Node.js installation..."
$SSH_CMD "command -v node &> /dev/null || (curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs)"

# Install PM2 globally
echo "⚙️  Installing PM2..."
$SSH_CMD "sudo npm install -g pm2 || npm install -g pm2"

# Install dependencies
echo "📦 Installing dependencies..."
$SSH_CMD "cd $REMOTE_DIR && npm install"

# Stop existing process if running
echo "🛑 Stopping existing service..."
$SSH_CMD "pm2 delete ice-cream-cruisers || true"

# Start with PM2
echo "▶️  Starting service with PM2..."
$SSH_CMD "cd $REMOTE_DIR && pm2 start server.js --name ice-cream-cruisers"

# Set PM2 to auto-start on reboot
echo "🔄 Setting up auto-start on reboot..."
$SSH_CMD "pm2 startup || true && pm2 save || true"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📍 Admin panel at: http://home.level52.tech/admin"
echo "📍 API at: http://home.level52.tech/api"
echo ""
echo "To view logs: ssh -i $PRIVATE_KEY $SERVER_USER@$SERVER_IP 'pm2 logs ice-cream-cruisers'"
