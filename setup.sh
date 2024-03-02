#!/bin/bash

# Step 1: Server Setup
sudo apt update
sudo apt install  -y git  # Install Git and pm2 as well
sudo rm /usr/share/systemtap/tapset/node.stp
sudo apt remove -y nodejs
sudo apt remove -y libnode-dev
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
sudo apt install  -y npm


# Step 3: Application Setup
GIT_URL="https://github.com/rakeshbade/combine-rss-as-api.git"  # Replace with your Git repository URL
APP_DIR="combine-rss-as-api"  # Replace with your desired app directory name

mkdir -p $APP_DIR
git clone $GIT_URL $APP_DIR

cd $APP_DIR
npm install
# If needed, build your app (e.g., for Next.js):
# npm run build

# Step 4: Run Your Application (using PM2)
sudo npm install pm2 --global
pm2 start npm --name $APP_DIR -- start  # Replace "appName" with your desired PM2 app name

sudo npm install -g tunnelmole
tmole 3000

echo "Node.js app successfully deployed and accessible externally!"