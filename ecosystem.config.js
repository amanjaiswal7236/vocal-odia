module.exports = {
  apps: [{
    name: 'vocal-odia',
    script: 'npm',
    args: 'start',
    cwd: '/home/ubuntu/vocal-odia',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3003
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    time: true
  }]
};
