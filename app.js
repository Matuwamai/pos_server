// Must be the very first import: ES module imports execute before any of
// this file's own code runs, so if dotenv were loaded later, modules like
// requireSuperAdmin.js (imported transitively below) would read their
// process.env secrets as undefined and silently break auth.
import 'dotenv/config';
import express from "express";
import cors from "cors";
import helmet from "helmet";

import env from './config/env.js';
import logger from './config/logger.js';
import prisma from './config/prismaClient.js';
import requestLogger from './middlewares/requestLogger.js';
import errorHandler from './middlewares/errorHandler.js';
import tenantRoutes from './routers/tenant.js';
import superAdminRoutes from './routers/superAdmin.js';
import authRoutes from './routers/auth.js';
import billingRoutes from './routers/billing.js';

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception — shutting down', { stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason });
  process.exit(1);
});

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestLogger);
app.use ('/api/v1/tenants', tenantRoutes);
app.use('/api/v1/super-admins', superAdminRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/webhooks', billingRoutes);

// Must be registered last, after all routes.
app.use(errorHandler);

const PORT = env.port;

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
