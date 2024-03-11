module.exports = {
  apps: [
    {
      name: 'combine-rss-api', // Replace with your app name
      script: 'node index.js', // Replace with your entry script file
      instances: 'max', // Spawn as many instances as CPU cores
      max_memory_restart: '300M', // Restart if memory usage exceeds 300 megabytes
      cron_restart: '0 */30 * * *', // Restart every 30 minutes (on the hour)
    },
  ],
};
