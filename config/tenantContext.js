import { AsyncLocalStorage } from 'node:async_hooks';

// Request-scoped tenant context, set once by authenticate.js after verifying
// a tenant-user JWT. prismaClient.js reads this to auto-scope every query
// against a tenant-owned model by tenantId, so a controller/service that
// forgets a `where: { tenantId }` clause can't leak or mutate another
// tenant's rows.
const tenantContext = new AsyncLocalStorage();

function runWithTenant(tenantId, fn) {
  return tenantContext.run({ tenantId }, fn);
}

function getTenantId() {
  return tenantContext.getStore()?.tenantId;
}

export { runWithTenant, getTenantId };
