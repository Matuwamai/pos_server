import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import logger from './config/logger.js';
import prisma from './config/prismaClient.js';
 
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception — shutting down', { stack: err.stack });
  process.exit(1);
});
 
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason });
  process.exit(1);
});
 
dotenv.config();
const app = express();
 
app.use(cors());
app.use(express.json());
 
const PORT = process.env.PORT || 5000;
 
// Verify the database is actually reachable BEFORE accepting traffic.
// A POS backend that starts "successfully" but can't reach MySQL is worse
// than one that fails fast and loud — every request would 500 anyway.
async function startServer() {
  try {
    await prisma.$connect();
    logger.info('Database connection established');
 
    const server = app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
 
    // Graceful shutdown: close the DB connection cleanly on deploy/restart
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
    });
  } catch (err) {
    logger.error('Failed to connect to the database — server not started', {
      message: err.message,
    });
    process.exit(1);
  }
}
 
startServer();
 