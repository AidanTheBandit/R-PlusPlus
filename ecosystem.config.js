module.exports = {
  apps: [
    {
      name: 'r-api-server',
      script: 'src/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5482
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5482
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 5482
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      // Restart the app if it crashes
      restart_delay: 4000,
      // Maximum number of restart attempts
      max_restarts: 10,
      // Time window for max_restarts
      min_uptime: '10s'
    }
  ]
};