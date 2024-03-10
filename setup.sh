#!/bin/bash

# Step 1: Server Setup
sudo apt update
sudo apt install  -y git  # Install Git and pm2 as well
sudo rm /usr/share/systemtap/tapset/node.stp
sudo apt remove -y nodejs
sudo apt remove -y libnode-dev
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install  -y npm
sudo apt install -y nodejs


# Step 3: Application Setup
GIT_URL="https://github.com/rakeshbade/combine-rss-as-api.git"  # Replace with your Git repository URL
APP_DIR="combine-rss-as-api"  # Replace with your desired app directory name
PORT="9981" # random port from 1000 - 9999

mkdir -p $APP_DIR
git clone $GIT_URL $APP_DIR

cd $APP_DIR
npm install
# If needed, build your app (e.g., for Next.js):
# npm run build

# Step 4: Run Your Application (using PM2)
sudo npm install pm2 --global
# pm2 start npm --name $APP_DIR -- start --port $PORT --cron-restart="0 0 * * *"  # Replace "appName" with your desired PM2 app name
pm2 start npm --name $APP_DIR -- start --port $PORT --max-memory-restart 300M # Replace "appName" with your desired PM2 app name

echo "Node.js app successfully deployed and accessible externally!"
