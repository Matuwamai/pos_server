import { PrismaClient, Prisma } from '@prisma/client';
import logger from './logger.js';
import { getTenantId } from './tenantContext.js';
const basePrisma = new PrismaClient({
  log: [
    { level: 'warn', emit: 'event' },
    { level: 'error', emit: 'event' },
  ],
});
basePrisma.$on('warn', (e) => logger.warn('Prisma warning', { message: e.message }));
basePrisma.$on('error', (e) => logger.error('Prisma error', { message: e.message }));
const tenantScopedModels = new Set(
  Prisma.dmmf.datamodel.models
    .filter((model) => model.fields.some((field) => field.name === 'tenantId'))
    .map((model) => model.name)
);
const whereScopedOps = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'findMany',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
]);
const prisma = basePrisma.$extends({
  name: 'tenant-scoping',
  query: {
    $allModels: {
      $allOperations({ model, operation, args, query }) {
        const tenantId = getTenantId();
        if (!tenantId || !tenantScopedModels.has(model)) {
          return query(args);
        }

        if (whereScopedOps.has(operation)) {
          args.where = { ...(args.where || {}), tenantId };
        } else if (operation === 'create') {
          args.data = { ...(args.data || {}), tenantId };
        } else if (operation === 'createMany' && Array.isArray(args.data)) {
          args.data = args.data.map((row) => ({ ...row, tenantId }));
        } else if (operation === 'upsert') {
          args.where = { ...(args.where || {}), tenantId };
          args.create = { ...(args.create || {}), tenantId };
        }

        return query(args);
      },
    },
  },
});

export default prisma;