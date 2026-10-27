import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';

// Tenant has no tenantId column of its own, so it's NOT one of the
// auto-scoped models in config/prismaClient.js — every query here filters
// explicitly by id, always sourced from the caller's req.tenantId (off the
// verified JWT), never a client-supplied id.

const UPLOADS_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');

const MIME_EXTENSIONS = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };

function logoDir(tenantId) {
  return path.join(UPLOADS_ROOT, 'tenants', tenantId);
}

const SELF_FIELDS = { id: true, name: true, subdomain: true, logoUrl: true, mpesaType: true, mpesaShortcode: true };

async function getMyTenant(tenantId) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: SELF_FIELDS });
  if (!tenant) throw ApiError.notFound('Tenant not found');
  return tenant;
}

// Removes any previously-saved logo file for this tenant regardless of its
// extension, so switching from a .png upload to a .jpg one doesn't leave the
// old file behind.
async function clearExistingLogoFiles(tenantId) {
  const dir = logoDir(tenantId);
  const entries = await fs.readdir(dir).catch(() => []);
  await Promise.all(
    entries.filter((name) => name.startsWith('logo.')).map((name) => fs.unlink(path.join(dir, name)))
  );
}

async function updateTenantLogo(tenantId, file) {
  const ext = MIME_EXTENSIONS[file.mimetype];
  if (!ext) throw ApiError.badRequest('Only PNG, JPEG, or WEBP images are accepted');

  const dir = logoDir(tenantId);
  await fs.mkdir(dir, { recursive: true });
  await clearExistingLogoFiles(tenantId);
  await fs.writeFile(path.join(dir, `logo${ext}`), file.buffer);

  const logoUrl = `/uploads/tenants/${tenantId}/logo${ext}`;
  return prisma.tenant.update({ where: { id: tenantId }, data: { logoUrl }, select: SELF_FIELDS });
}

async function removeTenantLogo(tenantId) {
  await clearExistingLogoFiles(tenantId);
  return prisma.tenant.update({ where: { id: tenantId }, data: { logoUrl: null }, select: SELF_FIELDS });
}

// Till (Buy Goods) or Paybill number, shown at the point of sale so the
// cashier can tell the customer where to send payment, confirmed manually
// by typing the M-Pesa SMS code in as the payment's transactionRef — no
// Daraja API credentials involved yet (see the Phase 4 plan: STK Push
// automation is a deferred fast-follow, not part of this).
async function updateTenantPayments(tenantId, { mpesaType, mpesaShortcode }) {
  return prisma.tenant.update({ where: { id: tenantId }, data: { mpesaType, mpesaShortcode }, select: SELF_FIELDS });
}

export default { getMyTenant, updateTenantLogo, removeTenantLogo, updateTenantPayments };
