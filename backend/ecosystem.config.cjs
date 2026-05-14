module.exports = {
  apps: [
    {
      name: "dashboard-api",
      script: "dist/index.js",

      // Rate limiter / 로그인 5회 잠금이 메모리 기반이므로 1 인스턴스 고정.
      // 다중 인스턴스가 필요해지면 Redis 스토어로 이동 필요.
      instances: 1,
      exec_mode: "fork",

      // 안정성
      autorestart: true,
      max_memory_restart: "500M",
      restart_delay: 2000,

      // 환경변수 (실제 시크릿은 backend/.env 에서 dotenv 로 로드)
      env: {
        TZ: "UTC",
        NODE_ENV: "production",
      },

      // 로그
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      time: true,
    },
  ],
};
