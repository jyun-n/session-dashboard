import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { disconnectDb } from "./config/db.js";
import { logger } from "./utils/logger.js";
import { startScheduler } from "./scheduler.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Server listening on port ${env.PORT}`, {
    env: env.NODE_ENV,
    cors: env.CORS_ORIGIN,
  });
  startScheduler();
});

async function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  server.close(async () => {
    await disconnectDb();
    logger.info("Shutdown complete");
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));