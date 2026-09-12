import { PrismaClient, Prisma } from '@prisma/client';
import logger from './logger.js';
import { getTenantId } from './tenantContext.js';

// Reuse a single PrismaClient instance across the app (avoids exhausting
// MySQL connections, especially important with nodemon hot-reloads in dev).
const basePrisma = new PrismaClient({
  log: [
    { level: 'warn', emit: 'event' },
    { level: 'error', emit: 'event' },
  ],
});

// Pipe Prisma's own warnings/errors through winston so every log in the
// app — including from the ORM layer — goes through one consistent place.
basePrisma.$on('warn', (e) => logger.warn('Prisma warning', { message: e.message }));
basePrisma.$on('error', (e) => logger.error('Prisma error', { message: e.message }));

// Every model that carries its own `tenantId` column, derived from the
// schema itself (not hand-maintained) so this never drifts as models are
// added. Models without a tenantId field (line items reachable only via a
// tenant-owned parent, e.g. OrderItem/Payment) are NOT auto-scoped here —
// those still rely on the parent relation being scoped correctly.
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

// Auto-scopes every query against a tenant-owned model to the tenantId set
// on the current request by authenticate.js (via AsyncLocalStorage). This is
// a safety net, not the primary access control: a controller that forgets
// `where: { tenantId }` still can't read/write another tenant's rows, and a
// `create` still can't be pointed at a different tenant than the caller's
// own — the authenticated tenantId always wins over anything a service
// happens to pass in.
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