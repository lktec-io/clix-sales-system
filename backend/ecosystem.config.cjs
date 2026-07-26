// PM2 process definition for the backend API.
// CommonJS (.cjs) deliberately — backend/package.json sets "type": "module",
// and PM2's own config loader expects CommonJS regardless.
//
// Usage on the server:
//   pm2 start ecosystem.config.cjs --env production
//   pm2 save && pm2 startup   (persist across reboots — see DEPLOYMENT.md)
module.exports = {
  apps: [
    {
      name: 'clix-sales-api',
      script: './server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '30s',
      watch: false,
      max_memory_restart: '400M',
      env_production: {
        NODE_ENV: 'production',
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      time: true,
    },
  ],
};
