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

curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc \
  | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null && echo "deb https://ngrok-agent.s3.amazonaws.com buster main" \
  | sudo tee /etc/apt/sources.list.d/ngrok.list && sudo apt update && sudo apt install ngrok

ngrok config add-authtoken $AUTH_TOKEN

ngrok http http://localhost:3000

# Step 6: Test
# Open a web browser and navigate to http://<your_domain_or_ip>

echo "Node.js app successfully deployed and accessible externally!"
