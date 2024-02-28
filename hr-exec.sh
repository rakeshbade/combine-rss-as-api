find . ! -name 'exec.sh' -exec rm -rf {} +
git clone https://github.com/rakeshbade/combine-rss-as-api.git
cd combine-rss-as-api
sudo npm install pm2 --global
npm install 
pm2 start index.js --cron-restart="0 0 * * *"
