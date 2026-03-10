/**
 * PM2 ecosystem config for Techivano EAM (NRCS).
 * Run from release directory (e.g. /var/www/nrcseam/current).
 *   cd /var/www/nrcseam/current && pm2 reload ecosystem.config.cjs --update-env
 *
 * API: cluster mode, max instances.
 * Worker: fork mode, 1 instance.
 */
const path = require("path");

module.exports = {
  apps: [
    {
      name: "nrcseam",
      cwd: path.resolve(__dirname),
      script: "dist/index.js",
      instances: "max",
      exec_mode: "cluster",
      env: { NODE_ENV: "production" },
      env_production: { NODE_ENV: "production" },
    },
    {
      name: "nrcseam-worker",
      cwd: path.resolve(__dirname),
      script: "dist/worker.js",
      instances: 1,
      exec_mode: "fork",
      env: { NODE_ENV: "production" },
      env_production: { NODE_ENV: "production" },
    },
  ],
};
