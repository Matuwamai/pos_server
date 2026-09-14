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
import locationRoutes from './routers/location.js';
import terminalRoutes from './routers/terminal.js';
import cashDrawerSessionRoutes from './routers/cashDrawerSession.js';
import customerGroupRoutes from './routers/customerGroup.js';
import customerRoutes from './routers/customer.js';
import supplierRoutes from './routers/supplier.js';
import categoryRoutes from './routers/category.js';
import modifierGroupRoutes from './routers/modifierGroup.js';
import productRoutes from './routers/product.js';
import inventoryRoutes from './routers/inventory.js';
import purchaseOrderRoutes from './routers/purchaseOrder.js';
import stockTransferRoutes from './routers/stockTransfer.js';
import loyaltyProgramRoutes from './routers/loyaltyProgram.js';
import loyaltyTransactionRoutes from './routers/loyaltyTransaction.js';
import storeCreditTransactionRoutes from './routers/storeCreditTransaction.js';
import giftCardRoutes from './routers/giftCard.js';
import promotionRoutes from './routers/promotion.js';
import taxRateRoutes from './routers/taxRate.js';
import orderRoutes from './routers/order.js';
import employeeShiftRoutes from './routers/employeeShift.js';
import auditLogRoutes from './routers/auditLog.js';
import paymentRoutes from './routers/payment.js';
import userRoutes from './routers/user.js';
import roleRoutes from './routers/role.js';
import permissionRoutes from './routers/permission.js';
import apiKeyRoutes from './routers/apiKey.js';
import salesSummaryRoutes from './routers/salesSummary.js';

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
app.use('/api/v1/locations', locationRoutes);
app.use('/api/v1/terminals', terminalRoutes);
app.use('/api/v1/cash-drawer-sessions', cashDrawerSessionRoutes);
app.use('/api/v1/customer-groups', customerGroupRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/suppliers', supplierRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/modifier-groups', modifierGroupRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/purchase-orders', purchaseOrderRoutes);
app.use('/api/v1/stock-transfers', stockTransferRoutes);
app.use('/api/v1/loyalty-program', loyaltyProgramRoutes);
app.use('/api/v1/loyalty-transactions', loyaltyTransactionRoutes);
app.use('/api/v1/store-credit-transactions', storeCreditTransactionRoutes);
app.use('/api/v1/gift-cards', giftCardRoutes);
app.use('/api/v1/promotions', promotionRoutes);
app.use('/api/v1/tax-rates', taxRateRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/employee-shifts', employeeShiftRoutes);
app.use('/api/v1/audit-logs', auditLogRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/permissions', permissionRoutes);
app.use('/api/v1/api-keys', apiKeyRoutes);
app.use('/api/v1/sales-summary', salesSummaryRoutes);

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
