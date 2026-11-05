import { AsyncLocalStorage } from 'node:async_hooks';
const tenantContext = new AsyncLocalStorage();

function runWithTenant(tenantId, fn) {
  return tenantContext.run({ tenantId }, fn);
}

function getTenantId() {
  return tenantContext.getStore()?.tenantId;
}

export { runWithTenant, getTenantId };
